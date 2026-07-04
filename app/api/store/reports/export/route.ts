import { NextRequest, NextResponse } from 'next/server'
import { requireStore, requireManager } from '@/lib/store-auth-helper'
import { parseReportPeriod, getReportData } from '@/lib/report-data'
import { buildReportWorkbook, buildReportWorkbookFilename } from '@/lib/report-workbook'

export async function GET(req: NextRequest) {
  try {
    const t = await requireStore(req)
    requireManager(t)

    const url = new URL(req.url)
    const { from, to } = parseReportPeriod(url)
    const data = await getReportData(t.storeId, from, to)

    const buffer   = buildReportWorkbook(t.storeName, from, to, data)
    const bytes    = new Uint8Array(buffer)
    const filename = buildReportWorkbookFilename(t.storeSlug, from, to)

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="report.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    })
  } catch (err) {
    console.error(err)
    const e = err as Error & { status?: number }
    return NextResponse.json({ error: e.status ? e.message : 'خطأ في الخادم' }, { status: e.status ?? 500 })
  }
}
