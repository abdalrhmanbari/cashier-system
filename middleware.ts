import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// مسارات لا تحتاج مصادقة
const PUBLIC_SEGMENTS: Record<string, string[]> = {
  'super-admin': ['login'],
}
const SKIP_PREFIXES = ['_next', 'api', 'favicon.ico', 'public']

// صفحات مسموحة لـ CASHIER داخل المتجر (قائمة سماح — أي شيء آخر محجوب افتراضياً)
const CASHIER_ALLOWED = ['pos', 'shifts', 'returns']

// ══════════════════════════════════════════
// طبقة دفاع ثانية لـ CASHIER على /api/store/* (defense-in-depth)
// الحماية الأساسية تبقى requireManager() داخل كل route — هذه شبكة أمان إضافية
// فقط، تمنع أي route جديد يُنسى فيه requireManager() من الانكشاف الكامل.
// القائمة مستخرَجة فعلياً من كل نداءات fetch() في صفحات pos/shifts/returns
// (شاملة المكوّنات المشتركة بالـ layout: ExchangeRateIndicator, ConnectionIndicator)
// ══════════════════════════════════════════
const CASHIER_API_RULES: { pattern: RegExp; methods: string[] }[] = [
  { pattern: /^\/api\/store\/products$/,          methods: ['GET'] },
  { pattern: /^\/api\/store\/categories$/,         methods: ['GET'] },
  { pattern: /^\/api\/store\/customers\/lookup$/,  methods: ['GET'] },
  { pattern: /^\/api\/store\/settings$/,           methods: ['GET'] },
  { pattern: /^\/api\/store\/exchange-rate$/,      methods: ['GET'] },
  { pattern: /^\/api\/store\/ping$/,               methods: ['GET', 'HEAD'] },
  { pattern: /^\/api\/store\/shifts$/,             methods: ['GET', 'POST'] },
  { pattern: /^\/api\/store\/shifts\/[^/]+$/,      methods: ['PATCH'] },
  { pattern: /^\/api\/store\/sales$/,              methods: ['GET', 'POST'] },
  { pattern: /^\/api\/store\/returns$/,            methods: ['GET', 'POST'] },
]

function cashierApiAllowed(pathname: string, method: string) {
  return CASHIER_API_RULES.some(rule => rule.pattern.test(pathname) && rule.methods.includes(method))
}

// ══════════════════════════════════════════
// وضع الصيانة — middleware يعمل على Edge runtime ولا يستطيع استدعاء Prisma
// (SQLite) مباشرة، لذا يقرأ الحالة عبر نداء داخلي خفيف ويخزّنها بذاكرة محلية
// قصيرة الأمد لتفادي أي استعلام قاعدة بيانات مع كل طلب.
// ══════════════════════════════════════════
type MaintenanceStatus = {
  global: {
    enabled: boolean
    message: string
    endsAt: string | null
    activatedAt: string | null
    graceMinutes: number
  }
  store: { maintenanceMode: boolean; maintenanceMessage: string | null } | null
  storeExists: boolean | null
}

const STATUS_CACHE_MS = 12_000
const statusCache = new Map<string, { data: MaintenanceStatus; expiresAt: number }>()

async function getMaintenanceStatus(
  request: NextRequest,
  params: { slug?: string; storeId?: string }
): Promise<MaintenanceStatus> {
  const key = params.slug ? `slug:${params.slug}` : params.storeId ? `id:${params.storeId}` : 'global'
  const cached = statusCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.data

  const url = new URL('/api/internal/maintenance-status', request.url)
  if (params.slug)    url.searchParams.set('slug', params.slug)
  if (params.storeId) url.searchParams.set('storeId', params.storeId)

  try {
    const res = await fetch(url, { cache: 'no-store' })
    const data = (await res.json()) as MaintenanceStatus
    statusCache.set(key, { data, expiresAt: Date.now() + STATUS_CACHE_MS })
    return data
  } catch {
    // فشل النداء الداخلي لا يجب أن يعطّل المنصة كلها — نفترض عدم وجود صيانة والمتجر موجود
    return { global: { enabled: false, message: '', endsAt: null, activatedAt: null, graceMinutes: 0 }, store: null, storeExists: true }
  }
}

// هل تجاوزنا لحظة قطع الجلسات النشطة (وقت التفعيل + مهلة السماح)؟
function globalCutoverPassed(global: MaintenanceStatus['global']) {
  if (!global.enabled) return false
  if (!global.activatedAt) return true
  const cutover = new Date(global.activatedAt).getTime() + global.graceMinutes * 60_000
  return Date.now() >= cutover
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const segments = pathname.split('/').filter(Boolean)
  const first = segments[0] ?? ''

  // نداء الحالة الداخلي نفسه — يجب ألا يمر عبر بوابة الصيانة (حلقة لا نهائية)
  if (pathname.startsWith('/api/internal/')) return NextResponse.next()

  // ══════════════════════════════════════════
  // API متجر  →  /api/store/...  (بوابة صيانة 503 + تجاهل بقية الـ API)
  // ══════════════════════════════════════════
  if (pathname.startsWith('/api/store/')) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      cookieName: 'store.session-token',
    })

    // طبقة سماح ثانية للكاشير — لا تُستبدَل requireManager() داخل كل route، بل تُضاف فوقها
    if (token?.role === 'CASHIER' && !cashierApiAllowed(pathname, request.method)) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'غير مصرّح لك بالوصول إلى هذا المسار' },
        { status: 403 }
      )
    }

    if (token) {
      const status = await getMaintenanceStatus(request, { storeId: token.storeId as string })
      const blocked = status.store?.maintenanceMode || globalCutoverPassed(status.global)
      if (blocked) {
        const message = status.store?.maintenanceMode
          ? (status.store.maintenanceMessage || status.global.message)
          : status.global.message
        return NextResponse.json(
          { error: 'MAINTENANCE', message, endsAt: status.global.endsAt },
          { status: 503 }
        )
      }
    }

    return NextResponse.next()
  }

  // تجاهل بقية الأصول الثابتة والـ API (auth routes وغيرها)
  if (!first || SKIP_PREFIXES.includes(first)) return NextResponse.next()

  // ══════════════════════════════════════════
  // Super Admin routes  →  /super-admin/...  (مستثنى دائماً من الصيانة)
  // ══════════════════════════════════════════
  if (first === 'super-admin') {
    const second = segments[1] ?? ''

    const token = await getToken({
      req:        request,
      secret:     process.env.NEXTAUTH_SECRET,
      cookieName: 'super-admin.session-token',
    })

    // مسجّل دخول → لا تعرض صفحة الدخول
    if (second === 'login') {
      if (token) return NextResponse.redirect(new URL('/super-admin', request.url))
      return NextResponse.next()
    }

    if (!token) {
      return NextResponse.redirect(new URL('/super-admin/login', request.url))
    }

    return NextResponse.next()
  }

  // ══════════════════════════════════════════
  // Store routes  →  /[slug]/...
  // ══════════════════════════════════════════
  const slug   = first
  const second = segments[1] ?? ''

  // صفحة الصيانة وصفحة المتجر غير الموجود — يجب ألا تُحجبا (حلقة لا نهائية)
  if (second === 'maintenance' || second === 'store-not-found') {
    return NextResponse.next()
  }

  const token = await getToken({
    req:        request,
    secret:     process.env.NEXTAUTH_SECRET,
    cookieName: 'store.session-token',
  })

  // بوابة الصيانة لكل صفحات المتجر (تشمل صفحة الدخول — تسجيل دخول جديد يُمنع فوراً)
  const status = await getMaintenanceStatus(request, { slug })

  // الـ slug نفسه غير موجود كمتجر — وجّه لصفحة "المتجر غير موجود" قبل أي فحص آخر
  if (status.storeExists === false) {
    return NextResponse.redirect(new URL(`/${slug}/store-not-found`, request.url))
  }

  if (status.store?.maintenanceMode) {
    return NextResponse.redirect(new URL(`/${slug}/maintenance`, request.url))
  }
  if (status.global.enabled) {
    // جلسة جديدة (بلا token) تُمنع فوراً؛ جلسة نشطة تُمهَل حتى انتهاء مهلة السماح
    if (!token || globalCutoverPassed(status.global)) {
      return NextResponse.redirect(new URL(`/${slug}/maintenance`, request.url))
    }
  }

  // صفحات عامة داخل المتجر (ما عدا login التي تُعالج أدناه)
  if (['suspended', 'expired', 'forbidden'].includes(second)) {
    return NextResponse.next()
  }

  // صفحة تسجيل الدخول → لا تعرضها إن كان المستخدم مسجّلاً
  if (second === 'login') {
    if (token && token.storeSlug === slug) {
      return NextResponse.redirect(new URL(`/${slug}/pos`, request.url))
    }
    return NextResponse.next()
  }

  if (!token) {
    return NextResponse.redirect(new URL(`/${slug}/login`, request.url))
  }

  // المستخدم ينتمي لمتجر آخر
  if (token.storeSlug !== slug) {
    return NextResponse.redirect(new URL(`/${slug}/login`, request.url))
  }

  // CASHIER مسموح له فقط بالمسارات المحددة في CASHIER_ALLOWED — أي شيء آخر محجوب
  if (token.role === 'CASHIER' && !CASHIER_ALLOWED.includes(second)) {
    return NextResponse.redirect(new URL(`/${slug}/forbidden`, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
