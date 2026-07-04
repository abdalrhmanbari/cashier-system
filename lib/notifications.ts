import { prisma } from '@/lib/prisma'
import { diskFreePercent, dbFileSizeBytes, lastBackupAgeMs } from '@/lib/system-metrics'

export type NotificationType =
  | 'LOW_STOCK'
  | 'STALE_EXCHANGE_RATE'
  | 'CUSTOMER_DEBT_LIMIT'
  | 'SUPPLIER_INVOICE_DUE'
  | 'SHIFT_DIFFERENCE'
  | 'SUBSCRIPTION_EXPIRING'
  | 'BACKUP_STALE'
  | 'DISK_SPACE_LOW'
  | 'HIGH_ERROR_RATE'
  | 'DB_SIZE_WARNING'

type Severity = 'INFO' | 'WARNING' | 'CRITICAL'

type NotifyInput = {
  /** null لتنبيهات منصّة-مستوى (targetRole = SUPER_ADMIN) — لا تخص متجراً بعينه */
  storeId?: string | null
  type: NotificationType
  title: string
  body: string
  link?: string | null
  targetRole?: 'MANAGER' | 'SUPER_ADMIN'
  severity?: Severity
  /** مفتاح منع التكرار للحالات المستمرة — إشعار واحد غير مقروء فقط لكل مفتاح (ضمن المتجر، أو عالمياً لتنبيهات المنصّة). اتركه فارغاً للأحداث اللحظية. */
  referenceKey?: string | null
}

async function ensureNotification({ storeId = null, type, title, body, link, targetRole = 'MANAGER', severity = 'INFO', referenceKey }: NotifyInput) {
  if (referenceKey) {
    const existing = await prisma.notification.findFirst({
      where: { storeId, referenceKey, isRead: false },
      select: { id: true },
    })
    if (existing) return
  }
  await prisma.notification.create({
    data: { storeId, type, title, body, link: link ?? null, targetRole, severity, referenceKey: referenceKey ?? null },
  })
}

/** توليد الإشعارات دائماً best-effort — فشلها لا يجب أن يُفشل العملية الأصلية (بيع/إغلاق وردية/...) أبداً. */
function safe(fn: () => Promise<void>) {
  return fn().catch(e => console.error('[notifications]', e))
}

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/** LOW_STOCK — يُستدعى بعد أي تغيير مخزون (بيع / إرجاع / تسوية جرد / تالف) لصنف واحد */
export function checkLowStock(storeId: string, productId: string) {
  return safe(async () => {
    const product = await prisma.product.findFirst({
      where: { id: productId, storeId },
      select: { id: true, name: true, stock: true, lowStockThreshold: true },
    })
    if (!product || product.lowStockThreshold == null) return
    if (product.stock > product.lowStockThreshold) return
    await ensureNotification({
      storeId,
      type: 'LOW_STOCK',
      title: 'مخزون منخفض',
      body: `المنتج "${product.name}" وصل إلى ${product.stock} قطعة (الحد ${product.lowStockThreshold})`,
      link: '/products',
      referenceKey: `LOW_STOCK:${productId}`,
    })
  })
}

/** CUSTOMER_DEBT_LIMIT — يُستدعى بعد بيع آجل يزيد رصيد العميل */
export function checkCustomerDebtLimit(storeId: string, customerId: string) {
  return safe(async () => {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, storeId },
      select: { id: true, name: true, currentBalance: true, debtLimitUsdCents: true },
    })
    if (!customer || customer.debtLimitUsdCents == null) return
    if (customer.currentBalance <= customer.debtLimitUsdCents) return
    await ensureNotification({
      storeId,
      type: 'CUSTOMER_DEBT_LIMIT',
      title: 'تجاوز سقف الدين',
      body: `العميل "${customer.name}" تجاوز سقف الدين المسموح ($${(customer.debtLimitUsdCents / 100).toFixed(2)}) — الرصيد الحالي $${(customer.currentBalance / 100).toFixed(2)}`,
      link: `/customers/${customerId}`,
      referenceKey: `CUSTOMER_DEBT_LIMIT:${customerId}`,
    })
  })
}

/** SHIFT_DIFFERENCE — حدث لحظي عند إغلاق وردية بفرق (عجز أو زيادة) غير صفري — بلا referenceKey */
export function notifyShiftDifference(
  storeId: string,
  params: { cashierName: string; branchName: string; difference: number }
) {
  return safe(async () => {
    const { difference, cashierName, branchName } = params
    if (!difference) return
    const kind = difference > 0 ? 'زيادة' : 'عجز'
    await ensureNotification({
      storeId,
      type: 'SHIFT_DIFFERENCE',
      title: `فرق في الوردية (${kind})`,
      body: `وردية ${cashierName} — ${branchName}: ${kind} قدره ${Math.abs(difference).toLocaleString('en-US')} ل.س`,
      link: '/shifts',
    })
  })
}

/** STALE_EXCHANGE_RATE — يُفحص عند أول طلب/تحميل يكتشف تقادم آخر سعر صرف (> 24 ساعة) */
export function checkStaleExchangeRate(storeId: string, effectiveFrom: Date) {
  return safe(async () => {
    if (Date.now() - effectiveFrom.getTime() <= DAY) return
    await ensureNotification({
      storeId,
      type: 'STALE_EXCHANGE_RATE',
      title: 'سعر الصرف قديم',
      body: 'مضى أكثر من 24 ساعة منذ آخر تحديث لسعر الصرف — يُرجى مراجعته',
      link: '/settings',
      referenceKey: 'STALE_EXCHANGE_RATE',
    })
  })
}

/** SUPPLIER_INVOICE_DUE — يُفحص عند تحميل لوحة المدير: فواتير غير مسددة استحقت أو تستحق خلال 3 أيام */
export function checkSupplierInvoicesDue(storeId: string) {
  return safe(async () => {
    const horizon = new Date(Date.now() + 3 * DAY)
    const invoices = await prisma.supplierInvoice.findMany({
      where: {
        supplier: { storeId },
        status: { in: ['UNPAID', 'PARTIAL'] },
        dueDate: { not: null, lte: horizon },
      },
      select: {
        id: true, invoiceNumber: true, remaining: true, dueDate: true,
        supplier: { select: { id: true, name: true } },
      },
    })
    for (const inv of invoices) {
      const overdue = inv.dueDate! < new Date()
      await ensureNotification({
        storeId,
        type: 'SUPPLIER_INVOICE_DUE',
        title: overdue ? 'فاتورة مورد متأخرة السداد' : 'فاتورة مورد تستحق قريباً',
        body: `فاتورة #${inv.invoiceNumber} للمورد "${inv.supplier.name}" — المتبقي $${(inv.remaining / 100).toFixed(2)}`,
        link: `/suppliers/${inv.supplier.id}`,
        referenceKey: `SUPPLIER_INVOICE_DUE:${inv.id}`,
      })
    }
  })
}

/** SUBSCRIPTION_EXPIRING — يُفحص عند تحميل لوحة المدير: الاشتراك ينتهي خلال 7 أيام */
export function checkSubscriptionExpiring(storeId: string, sub: { status: string; endDate: Date }) {
  return safe(async () => {
    if (sub.status !== 'ACTIVE') return
    const daysLeft = (sub.endDate.getTime() - Date.now()) / DAY
    if (daysLeft < 0 || daysLeft > 7) return
    await ensureNotification({
      storeId,
      type: 'SUBSCRIPTION_EXPIRING',
      title: 'اشتراك المتجر على وشك الانتهاء',
      body: `ينتهي اشتراك المتجر خلال ${Math.max(0, Math.ceil(daysLeft))} يوم — يُرجى التجديد`,
      referenceKey: 'SUBSCRIPTION_EXPIRING',
    })
  })
}

// ══════════════════════════════════════════
// تنبيهات منصّة-مستوى (targetRole = SUPER_ADMIN, storeId = null) — تُفحص عند تحميل لوحة السوبر أدمن فقط
// ══════════════════════════════════════════

const DISK_SPACE_LOW_THRESHOLD_PCT = 85
// حد تحذيري لحجم ملف SQLite الواحد — إشارة للتخطيط للانتقال إلى Postgres، وليس عطلاً وشيكاً
const DB_SIZE_WARNING_BYTES = 500 * 1024 * 1024
const HIGH_ERROR_RATE_THRESHOLD = 20

/** BACKUP_STALE — لا توجد نسخة احتياطية إطلاقاً، أو آخر نسخة أقدم من 24 ساعة */
export function checkBackupStale() {
  return safe(async () => {
    const ageMs = lastBackupAgeMs()
    if (ageMs !== null && ageMs <= DAY) return
    await ensureNotification({
      storeId: null,
      targetRole: 'SUPER_ADMIN',
      severity: ageMs === null ? 'CRITICAL' : 'WARNING',
      type: 'BACKUP_STALE',
      title: ageMs === null ? 'لا توجد أي نسخة احتياطية' : 'النسخة الاحتياطية قديمة',
      body: ageMs === null
        ? 'لم يتم إنشاء أي نسخة احتياطية لقاعدة البيانات بعد'
        : `آخر نسخة احتياطية منذ ${Math.floor(ageMs / HOUR)} ساعة — تجاوزت 24 ساعة`,
      link: '/system/health',
      referenceKey: 'BACKUP_STALE',
    })
  })
}

/** DISK_SPACE_LOW — مساحة القرص المتبقية أقل من (100 - الحد) % */
export function checkDiskSpaceLow() {
  return safe(async () => {
    const freePct = diskFreePercent()
    if (freePct === null) return
    const usedPct = 100 - freePct
    if (usedPct < DISK_SPACE_LOW_THRESHOLD_PCT) return
    await ensureNotification({
      storeId: null,
      targetRole: 'SUPER_ADMIN',
      severity: 'WARNING',
      type: 'DISK_SPACE_LOW',
      title: 'مساحة القرص منخفضة',
      body: `المساحة المستخدمة من القرص ${usedPct.toFixed(1)}% (الحد ${DISK_SPACE_LOW_THRESHOLD_PCT}%)`,
      link: '/system/health',
      referenceKey: 'DISK_SPACE_LOW',
    })
  })
}

/** HIGH_ERROR_RATE — أكثر من 20 خطأ مسجَّل بـ ErrorLog خلال آخر ساعة */
export function checkHighErrorRate() {
  return safe(async () => {
    const count = await prisma.errorLog.count({ where: { createdAt: { gte: new Date(Date.now() - HOUR) } } })
    if (count <= HIGH_ERROR_RATE_THRESHOLD) return
    await ensureNotification({
      storeId: null,
      targetRole: 'SUPER_ADMIN',
      severity: 'CRITICAL',
      type: 'HIGH_ERROR_RATE',
      title: 'معدل أخطاء مرتفع',
      body: `${count} خطأ مسجَّل خلال آخر ساعة (الحد ${HIGH_ERROR_RATE_THRESHOLD})`,
      link: '/system/errors',
      referenceKey: 'HIGH_ERROR_RATE',
    })
  })
}

/** DB_SIZE_WARNING — حجم ملف قاعدة البيانات تجاوز الحد التحذيري */
export function checkDbSizeWarning() {
  return safe(async () => {
    const size = dbFileSizeBytes()
    if (size === null || size < DB_SIZE_WARNING_BYTES) return
    await ensureNotification({
      storeId: null,
      targetRole: 'SUPER_ADMIN',
      severity: 'WARNING',
      type: 'DB_SIZE_WARNING',
      title: 'حجم قاعدة البيانات كبير',
      body: `حجم dev.db حالياً ${(size / (1024 * 1024)).toFixed(0)} MB — يستحق التخطيط للانتقال إلى قاعدة بيانات أكبر`,
      link: '/system/health',
      referenceKey: 'DB_SIZE_WARNING',
    })
  })
}
