import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getSubscriptionDetail } from '@/lib/subscription'

async function requireSuperAdmin(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: 'super-admin.session-token' })
  if (!token) throw new Error('UNAUTHORIZED')
  return token
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSuperAdmin(req)
    const subscription = await getSubscriptionDetail(params.id)
    if (!subscription) return NextResponse.json({ error: 'لا يوجد اشتراك لهذا المتجر' }, { status: 404 })
    return NextResponse.json(subscription)
  } catch (err) {
    const msg = (err as Error).message
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
