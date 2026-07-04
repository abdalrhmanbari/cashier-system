import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

async function requireSuperAdmin(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: 'super-admin.session-token' })
  if (!token) throw Object.assign(new Error('UNAUTHORIZED'), { status: 401 })
  return token
}

export async function PATCH(req: NextRequest) {
  try {
    await requireSuperAdmin(req)

    await prisma.notification.updateMany({
      where: { storeId: null, targetRole: 'SUPER_ADMIN', isRead: false },
      data: { isRead: true },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
