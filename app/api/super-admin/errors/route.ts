import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { parseReportPeriod } from '@/lib/report-data'

async function requireSuperAdmin(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: 'super-admin.session-token' })
  if (!token) throw Object.assign(new Error('UNAUTHORIZED'), { status: 401 })
  return token
}

const MAX_ROWS = 500

export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req)
    const url = req.nextUrl
    const storeId    = url.searchParams.get('storeId')
    const type       = url.searchParams.get('type')
    const statusCode = url.searchParams.get('statusCode')
    const q          = url.searchParams.get('q')?.trim()
    const period     = url.searchParams.get('period')

    const where: Record<string, unknown> = {}
    if (storeId)    where.storeId = storeId
    if (type)       where.type = type
    if (statusCode) where.statusCode = parseInt(statusCode)
    if (q) {
      where.OR = [
        { message:  { contains: q } },
        { apiRoute: { contains: q } },
      ]
    }
    if (period && period !== 'all') {
      const { from, to } = parseReportPeriod(url)
      where.createdAt = { gte: from, lte: to }
    }

    const [errors, total, stores, typeRows] = await Promise.all([
      prisma.errorLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: MAX_ROWS }),
      prisma.errorLog.count({ where }),
      prisma.store.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      prisma.errorLog.findMany({ distinct: ['type'], select: { type: true }, orderBy: { type: 'asc' } }),
    ])

    const storeNameById = new Map(stores.map(s => [s.id, s.name]))
    const errorsWithStoreName = errors.map(e => ({ ...e, storeName: e.storeId ? storeNameById.get(e.storeId) ?? null : null }))

    return NextResponse.json({
      errors: errorsWithStoreName,
      total,
      truncated: total > MAX_ROWS,
      stores,
      types: typeRows.map(t => t.type),
    })
  } catch (e) {
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
