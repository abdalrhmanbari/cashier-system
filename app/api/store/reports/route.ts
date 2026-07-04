import { NextRequest, NextResponse } from 'next/server'
import { requireStore, requireManager } from '@/lib/store-auth-helper'
import { parseReportPeriod, getReportData } from '@/lib/report-data'

export async function GET(req: NextRequest) {
  try {
    const t   = await requireStore(req)
    requireManager(t)
    const url = new URL(req.url)

    const { from, to } = parseReportPeriod(url)
    const data = await getReportData(t.storeId, from, to)

    const {
      totalRevenue, totalCost, totalExpenses, totalProfit, invoiceCount, avgInvoice,
      returnsCount, returnsRevenue, totalDiscounts, taxCollected,
      supplierPaid, supplierDebt, customerCollected, customerPaid, customerDebt,
      totalCashSyp,
      dailySales, topProducts, soldItems,
    } = data

    return NextResponse.json({
      totalRevenue, totalCost, totalExpenses, totalProfit, invoiceCount, avgInvoice,
      returnsCount, returnsRevenue, totalDiscounts, taxCollected,
      supplierPaid, supplierDebt, customerCollected, customerPaid, customerDebt,
      totalCashSyp,
      dailySales, topProducts, soldItems,
    })
  } catch (err) {
    console.error(err)
    const e = err as Error & { status?: number }
    return NextResponse.json({ error: e.status ? e.message : 'خطأ في الخادم' }, { status: e.status ?? 500 })
  }
}
