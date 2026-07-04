import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

async function requireSuperAdmin(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: 'super-admin.session-token' })
  if (!token) throw Object.assign(new Error('UNAUTHORIZED'), { status: 401 })
  return token
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSuperAdmin(req)

    const notification = await prisma.notification.findFirst({
      where: { id: params.id, storeId: null, targetRole: 'SUPER_ADMIN' },
      select: { id: true },
    })
    if (!notification) return NextResponse.json({ error: 'الإشعار غير موجود' }, { status: 404 })

    const updated = await prisma.notification.update({
      where: { id: params.id },
      data: { isRead: true },
    })
    return NextResponse.json(updated)
  } catch (e) {
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
