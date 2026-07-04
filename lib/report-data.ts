import { prisma } from '@/lib/prisma'

export type ReportPeriod = 'today' | 'week' | 'month' | 'custom'

export function parseReportPeriod(url: URL): { period: ReportPeriod; from: Date; to: Date } {
  const period = (url.searchParams.get('period') ?? 'month') as ReportPeriod
  const now    = new Date()
  let   from   = new Date()
  let   to     = now

  if (period === 'today') {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  } else if (period === 'week') {
    from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  } else if (period === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1)
  } else if (period === 'custom') {
    const f = url.searchParams.get('from'); const t2 = url.searchParams.get('to')
    from = f ? new Date(f) : new Date(0)
    if (t2) { const end = new Date(t2); end.setHours(23, 59, 59, 999); to = end }
  }

  return { period, from, to }
}

export async function getReportData(storeId: string, from: Date, to: Date) {
  const sales = await prisma.sale.findMany({
    where: { storeId, createdAt: { gte: from, lte: to } },
    include: {
      items:    { include: { product: { select: { name: true, costPrice: true, priceCurrency: true } } } },
      user:     { select: { name: true } },
      customer: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  // المرتجعات تُحسب في فترة حدوث الإرجاع نفسها (createdAt الخاص بالمرتجع)، وليس فترة البيع الأصلي
  const saleReturns = await prisma.saleReturn.findMany({
    where: { storeId, createdAt: { gte: from, lte: to } },
    include: {
      items: { include: { product: { select: { name: true, costPrice: true, priceCurrency: true } } } },
      sale:  { select: { exchangeRate: true, invoiceNumber: true } },
    },
  })

  const expenses = await prisma.expense.findMany({
    where: { storeId, date: { gte: from, lte: to } },
    include: { user: { select: { name: true } } },
  })

  const supplierPayments = await prisma.supplierPayment.findMany({
    where: { date: { gte: from, lte: to }, supplierInvoice: { supplier: { storeId } } },
  })

  const supplierRemaining = await prisma.supplierInvoice.aggregate({
    where: { supplier: { storeId }, remaining: { gt: 0 } },
    _sum: { remaining: true },
  })

  const customerPayments = await prisma.customerPayment.findMany({
    where: { date: { gte: from, lte: to }, customer: { storeId } },
  })

  const customerDebt = await prisma.customer.aggregate({
    where: { storeId, currentBalance: { gt: 0 } },
    _sum: { currentBalance: true },
  })

  // كل الأرقام المالية هنا بالدولار (سنتات) — totalUsdCents/amountUsdCents مجمَّدة لحظة كل عملية، لا تعتمد على سعر الصرف الحالي
  const usdRatio       = (sale: (typeof sales)[number]) => sale.totalSyp > 0 ? sale.totalUsdCents / sale.totalSyp : 0
  const usdRatioReturn = (ret: (typeof saleReturns)[number]) => ret.totalSyp > 0 ? ret.totalUsdCents / ret.totalSyp : 0

  // costPrice يُفسَّر حسب priceCurrency الخاص بالمنتج (تماماً مثل price) — إن كان "USD" فهو بالفعل سنتات دولار جاهزة
  // ولا يحتاج أي تحويل؛ فقط إن كان "SYP" يُحوَّل عبر سعر صرف الفاتورة (exchangeRate) إلى سنتات دولار
  type CostItem = { quantity: number; product: { costPrice: number; priceCurrency: string } | null }
  const itemCostUsdCents = (item: CostItem, exchangeRate: number) => {
    const cost = (item.product?.costPrice ?? 0) * item.quantity
    if (item.product?.priceCurrency === 'SYP') {
      return exchangeRate > 0 ? Math.round((cost / exchangeRate) * 100) : 0
    }
    return cost
  }

  // grossRevenue شامل الضريبة (كما دفعها الزبون فعلياً). grossTax تُطرح منه لاحقاً لأن الضريبة ليست إيراداً للمتجر.
  const grossRevenue = sales.reduce((s, sale) => s + sale.totalUsdCents, 0)
  const grossTax     = sales.reduce((s, sale) => s + sale.taxUsdCents, 0)
  const grossCost    = sales.reduce((s, sale) => {
    return s + sale.items.reduce((ss, item) => ss + itemCostUsdCents(item, sale.exchangeRate), 0)
  }, 0)

  // المرتجعات تُنقص الإيراد والتكلفة بنفس منطق تجميد سعر الصرف — بسعر صرف الفاتورة الأصلية (مخزَّن مسبقاً بـ SaleReturn.totalUsdCents)
  const returnsCount   = saleReturns.length
  const returnsRevenue = saleReturns.reduce((s, ret) => s + ret.totalUsdCents, 0)
  const returnsTax     = saleReturns.reduce((s, ret) => s + ret.taxUsdCents, 0)
  const returnsCost    = saleReturns.reduce((s, ret) => {
    return s + ret.items.reduce((ss, item) => ss + itemCostUsdCents(item, ret.sale.exchangeRate), 0)
  }, 0)

  // صافي الإيراد وصافي الضريبة المحصلة — كلاهما مطروح منهما نصيب المرتجعات
  const totalRevenue  = (grossRevenue - grossTax) - (returnsRevenue - returnsTax)
  const taxCollected  = grossTax - returnsTax
  const totalCost     = grossCost - returnsCost
  const totalExpenses = expenses.reduce((s, e) => s + (e.amountUsdCents ?? 0), 0)
  const totalProfit   = totalRevenue - totalCost - totalExpenses
  const invoiceCount  = sales.length
  const avgInvoice    = invoiceCount > 0 ? Math.round(grossRevenue / invoiceCount) : 0
  const supplierPaid  = supplierPayments.reduce((s, p) => s + p.amount, 0)
  const supplierDebt  = supplierRemaining._sum.remaining ?? 0
  const customerCollected = customerPayments.filter(p => p.amount > 0).reduce((s, p) => s + p.amount, 0)
  const customerPaid      = customerPayments.filter(p => p.amount < 0).reduce((s, p) => s - p.amount, 0)
  const customerDebtTotal = customerDebt._sum.currentBalance ?? 0

  // إجمالي المقبوض نقداً بالليرة — معلومة ثانوية لمطابقة الصندوق فقط، لا تدخل في أي حساب دولاري
  const totalCashSyp = sales.reduce((s, sale) => s + sale.amountPaid, 0)

  // إجمالي الخصومات الممنوحة (خصم كل صنف + خصم إجمالي الفاتورة) بالدولار
  const totalDiscounts = sales.reduce((s, sale) => {
    const itemsDiscountSyp = sale.items.reduce((ss, item) => ss + item.discount, 0)
    return s + Math.round((itemsDiscountSyp + sale.discount) * usdRatio(sale))
  }, 0)

  // مبيعات يومية بالدولار
  const dailyMap: Record<string, number> = {}
  sales.forEach(sale => {
    const day = sale.createdAt.toISOString().split('T')[0]
    dailyMap[day] = (dailyMap[day] ?? 0) + sale.totalUsdCents
  })
  const dailySales = Object.entries(dailyMap).map(([date, total]) => ({ date, total }))

  // كل المنتجات المباعة خلال الفترة (كمية/إيراد/تكلفة/ربح) صافياً بعد طرح مرتجعات نفس الفترة
  const productMap: Record<string, { name: string; qty: number; revenue: number; cost: number }> = {}
  sales.forEach(sale => {
    const ratio = usdRatio(sale)
    sale.items.forEach(item => {
      if (!productMap[item.productId]) productMap[item.productId] = { name: item.product?.name ?? '—', qty: 0, revenue: 0, cost: 0 }
      productMap[item.productId].qty     += item.quantity
      productMap[item.productId].revenue += Math.round(item.netLineTotal * ratio)
      productMap[item.productId].cost    += itemCostUsdCents(item, sale.exchangeRate)
    })
  })
  saleReturns.forEach(ret => {
    const ratio = usdRatioReturn(ret)
    ret.items.forEach(item => {
      if (!productMap[item.productId]) productMap[item.productId] = { name: item.product?.name ?? '—', qty: 0, revenue: 0, cost: 0 }
      productMap[item.productId].qty     -= item.quantity
      productMap[item.productId].revenue -= Math.round(item.total * ratio)
      productMap[item.productId].cost    -= itemCostUsdCents(item, ret.sale.exchangeRate)
    })
  })
  const productSales = Object.entries(productMap)
    .map(([id, v]) => ({ id, name: v.name, qty: v.qty, revenue: v.revenue, cost: v.cost, profit: v.revenue - v.cost }))
    .sort((a, b) => b.revenue - a.revenue)
  const topProducts = productSales.slice(0, 10).map(({ id, name, qty, revenue }) => ({ id, name, qty, revenue }))

  // كل المنتجات المباعة خلال الفترة مع التاريخ والبائع — بالدولار (لا تُطرح منه المرتجعات، سطر تفصيلي وقت البيع فقط)
  const soldItems = sales.flatMap(sale => {
    const ratio = usdRatio(sale)
    return sale.items.map(item => ({
      id:            item.id,
      date:          sale.createdAt,
      invoiceNumber: sale.invoiceNumber,
      productName:   item.product?.name ?? '—',
      quantity:      item.quantity,
      unitPrice:     Math.round(item.unitPrice * ratio),
      total:         Math.round(item.netLineTotal * ratio),
      userName:      sale.user?.name ?? '—',
    }))
  }).sort((a, b) => b.date.getTime() - a.date.getTime())

  // صف لكل فاتورة — لتصدير Excel
  const invoiceRows = sales.map(sale => ({
    invoiceNumber: sale.invoiceNumber,
    date:          sale.createdAt,
    cashier:       sale.user?.name ?? '—',
    type:          sale.type,
    customerName:  sale.type === 'CREDIT' ? (sale.customer?.name ?? '') : '',
    subtotal:      sale.subtotal,
    discount:      sale.discount,
    tax:           sale.tax,
    total:         sale.total,
    exchangeRate:  sale.exchangeRate,
    totalUsdCents: sale.totalUsdCents,
  }))

  // صف لكل مرتجع — لتصدير Excel
  const returnRows = saleReturns.map(ret => ({
    date:                  ret.createdAt,
    originalInvoiceNumber: ret.sale.invoiceNumber,
    itemsText:             ret.items.map(i => `${i.product?.name ?? '—'} ×${i.quantity}`).join('، '),
    totalSyp:              ret.totalSyp,
    totalUsdCents:         ret.totalUsdCents,
    refundMethod:          ret.refundMethod,
  }))

  // صف لكل مصروف — لتصدير Excel
  const expenseRows = expenses.map(e => ({
    date:           e.date,
    type:           e.type,
    title:          e.title,
    amount:         e.amount,
    amountUsdCents: e.amountUsdCents ?? 0,
    recordedBy:     e.user?.name ?? '—',
  }))

  return {
    totalRevenue, totalCost, totalExpenses, totalProfit, invoiceCount, avgInvoice,
    returnsCount, returnsRevenue, totalDiscounts, taxCollected,
    supplierPaid, supplierDebt, customerCollected, customerPaid, customerDebt: customerDebtTotal,
    totalCashSyp,
    dailySales, topProducts, soldItems,
    productSales, invoiceRows, returnRows, expenseRows,
  }
}
