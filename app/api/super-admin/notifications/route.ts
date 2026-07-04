import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

async function requireSuperAdmin(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: 'super-admin.session-token' })
  if (!token) throw Object.assign(new Error('UNAUTHORIZED'), { status: 401 })
  return token
}

export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req)
    const { searchParams } = new URL(req.url)
    const page  = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20'))

    const where = { storeId: null, targetRole: 'SUPER_ADMIN' }

    const [notifications, unreadCount, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where: { ...where, isRead: false } }),
      prisma.notification.count({ where }),
    ])

    return NextResponse.json({
      notifications,
      unreadCount,
      hasMore: page * limit < total,
    })
  } catch (e) {
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
