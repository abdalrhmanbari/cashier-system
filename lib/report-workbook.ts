import * as XLSX from 'xlsx'
import type { getReportData } from '@/lib/report-data'

type ReportData = Awaited<ReturnType<typeof getReportData>>

const usdFmt   = '"$"#,##0.00'
const sypFmt   = '#,##0'
const pctFmt   = '0.0"%"'
const countFmt = '0'

const TYPE_LABELS:         Record<string, string> = { CASH: 'نقدي', CREDIT: 'آجل' }
const REFUND_LABELS:       Record<string, string> = { CASH: 'نقدي', CREDIT_NOTE: 'خصم من الدين' }
const EXPENSE_TYPE_LABELS: Record<string, string> = { SALARY: 'راتب', ADVANCE: 'سلفة', STORE: 'مصروف عام' }

const pad = (n: number) => String(n).padStart(2, '0')
export const fmtDate     = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const fmtDateTime = (d: Date) => `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`

function setFmt(ws: XLSX.WorkSheet, row: number, col: number, fmt: string) {
  const ref = XLSX.utils.encode_cell({ r: row, c: col })
  if (ws[ref]) ws[ref].z = fmt
}

export function buildReportWorkbookFilename(storeSlug: string, from: Date, to: Date) {
  return `تقرير-متجر-${storeSlug}-${fmtDate(from)}-الى-${fmtDate(to)}.xlsx`
}

export function buildReportWorkbook(storeName: string, from: Date, to: Date, data: ReportData): Buffer {
  const hasTax    = data.invoiceRows.some(r => r.tax !== 0)
  const marginPct = data.totalRevenue > 0 ? (data.totalProfit / data.totalRevenue) * 100 : 0

  const wb = XLSX.utils.book_new()
  wb.Workbook = { Views: [{ RTL: true }] }

  // ───── ورقة الملخص ─────
  const metaRows: (string | number)[][] = [
    ['المتجر', storeName],
    ['الفترة', `${fmtDate(from)} إلى ${fmtDate(to)}`],
    ['تاريخ التصدير', fmtDateTime(new Date())],
    [],
    ['المؤشر', 'القيمة'],
  ]
  type KpiRow = [string, number, 'usd' | 'syp' | 'pct' | 'count']
  const kpiRows: KpiRow[] = [
    ['صافي الإيراد',        data.totalRevenue      / 100, 'usd'],
    ['صافي الربح',          data.totalProfit       / 100, 'usd'],
    ['تكلفة المبيعات',      data.totalCost         / 100, 'usd'],
    ['هامش الربح %',        marginPct,                     'pct'],
    ['عدد الفواتير',        data.invoiceCount,             'count'],
    ['متوسط الفاتورة',      data.avgInvoice        / 100, 'usd'],
    ['عدد المرتجعات',       data.returnsCount,             'count'],
    ['قيمة المرتجعات',      data.returnsRevenue    / 100, 'usd'],
    ['إجمالي الخصومات',     data.totalDiscounts    / 100, 'usd'],
    ['المصاريف',            data.totalExpenses     / 100, 'usd'],
    ['المقبوض نقداً (ل.س)', data.totalCashSyp,             'syp'],
    ...(data.taxCollected !== 0 ? [['الضريبة المحصلة', data.taxCollected / 100, 'usd'] as KpiRow] : []),
    ['مستحق للموردين',      data.supplierDebt      / 100, 'usd'],
    ['مدفوع للموردين',      data.supplierPaid      / 100, 'usd'],
    ['مستحق على العملاء',   data.customerDebt      / 100, 'usd'],
    ['تحصيل من العملاء',    data.customerCollected / 100, 'usd'],
    ['مسدد للعملاء',        data.customerPaid      / 100, 'usd'],
  ]

  const summaryAoa: (string | number)[][] = [...metaRows, ...kpiRows.map(([l, v]) => [l, v])]
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryAoa)
  summaryWs['!cols'] = [{ wch: 22 }, { wch: 20 }]
  const kpiStartRow = metaRows.length
  kpiRows.forEach((row, i) => {
    const fmt = row[2] === 'usd' ? usdFmt : row[2] === 'syp' ? sypFmt : row[2] === 'pct' ? pctFmt : countFmt
    setFmt(summaryWs, kpiStartRow + i, 1, fmt)
  })
  XLSX.utils.book_append_sheet(wb, summaryWs, 'الملخص')

  // ───── ورقة الفواتير ─────
  const invoiceHeaders = [
    'رقم الفاتورة', 'التاريخ والوقت', 'الكاشير', 'النوع', 'العميل',
    'الإجمالي الفرعي', 'الخصم', ...(hasTax ? ['الضريبة'] : []),
    'الإجمالي بالليرة', 'سعر الصرف', 'المعادل بالدولار',
  ]
  const invoiceAoa: (string | number)[][] = [invoiceHeaders]
  data.invoiceRows.forEach(r => {
    invoiceAoa.push([
      r.invoiceNumber, fmtDateTime(r.date), r.cashier, TYPE_LABELS[r.type] ?? r.type, r.customerName,
      r.subtotal, r.discount, ...(hasTax ? [r.tax] : []),
      r.total, r.exchangeRate, r.totalUsdCents / 100,
    ])
  })
  const invoiceWs = XLSX.utils.aoa_to_sheet(invoiceAoa)
  const invMoneyColsSyp = hasTax ? [5, 6, 7, 8] : [5, 6, 7]
  const invRateCol = hasTax ? 9  : 8
  const invUsdCol  = hasTax ? 10 : 9
  data.invoiceRows.forEach((_, i) => {
    const row = i + 1
    invMoneyColsSyp.forEach(c => setFmt(invoiceWs, row, c, sypFmt))
    setFmt(invoiceWs, row, invRateCol, sypFmt)
    setFmt(invoiceWs, row, invUsdCol, usdFmt)
  })
  invoiceWs['!cols'] = invoiceHeaders.map(() => ({ wch: 16 }))
  XLSX.utils.book_append_sheet(wb, invoiceWs, 'الفواتير')

  // ───── ورقة الأصناف المباعة ─────
  const productHeaders = ['المنتج', 'الكمية', 'الإيراد', 'التكلفة', 'الربح']
  const productAoa: (string | number)[][] = [productHeaders]
  data.productSales.forEach(p => productAoa.push([p.name, p.qty, p.revenue / 100, p.cost / 100, p.profit / 100]))
  const productWs = XLSX.utils.aoa_to_sheet(productAoa)
  data.productSales.forEach((_, i) => {
    const row = i + 1
    setFmt(productWs, row, 2, usdFmt); setFmt(productWs, row, 3, usdFmt); setFmt(productWs, row, 4, usdFmt)
  })
  productWs['!cols'] = [{ wch: 24 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, productWs, 'الأصناف المباعة')

  // ───── ورقة المرتجعات ─────
  const returnHeaders = ['التاريخ', 'رقم الفاتورة الأصلية', 'الأصناف والكميات', 'المبلغ المردود بالليرة', 'المعادل بالدولار', 'طريقة الرد']
  const returnAoa: (string | number)[][] = [returnHeaders]
  data.returnRows.forEach(r => returnAoa.push([
    fmtDateTime(r.date), r.originalInvoiceNumber, r.itemsText, r.totalSyp, r.totalUsdCents / 100,
    REFUND_LABELS[r.refundMethod] ?? r.refundMethod,
  ]))
  const returnWs = XLSX.utils.aoa_to_sheet(returnAoa)
  data.returnRows.forEach((_, i) => {
    const row = i + 1
    setFmt(returnWs, row, 3, sypFmt); setFmt(returnWs, row, 4, usdFmt)
  })
  returnWs['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 32 }, { wch: 18 }, { wch: 14 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, returnWs, 'المرتجعات')

  // ───── ورقة المصاريف ─────
  const expenseHeaders = ['التاريخ', 'النوع/الوصف', 'المبلغ بالليرة', 'المعادل بالدولار', 'من سجّله']
  const expenseAoa: (string | number)[][] = [expenseHeaders]
  data.expenseRows.forEach(e => {
    const label = e.title ? `${EXPENSE_TYPE_LABELS[e.type] ?? e.type} - ${e.title}` : (EXPENSE_TYPE_LABELS[e.type] ?? e.type)
    expenseAoa.push([fmtDate(e.date), label, e.amount, e.amountUsdCents / 100, e.recordedBy])
  })
  const expenseWs = XLSX.utils.aoa_to_sheet(expenseAoa)
  data.expenseRows.forEach((_, i) => {
    const row = i + 1
    setFmt(expenseWs, row, 2, sypFmt); setFmt(expenseWs, row, 3, usdFmt)
  })
  expenseWs['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, expenseWs, 'المصاريف')

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}
