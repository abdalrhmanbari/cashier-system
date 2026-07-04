import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

async function auth(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: 'super-admin.session-token' })
  if (!token) throw new Error('UNAUTHORIZED')
}

export async function GET(req: NextRequest) {
  try {
    await auth(req)
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    // مزامنة بلا cron: أي اشتراك ACTIVE تجاوز endDate يُصحَّح إلى EXPIRED عند كل تحميل لهذه القائمة
    await prisma.subscription.updateMany({
      where: { status: 'ACTIVE', endDate: { lt: new Date() } },
      data:  { status: 'EXPIRED' },
    })

    const data = await prisma.subscription.findMany({
      where: status ? { status } : undefined,
      include: {
        store: { select: { id: true, name: true, slug: true } },
        plan:  { select: { name: true } },
        payments: { orderBy: { paidAt: 'desc' }, take: 1 },
      },
      orderBy: { endDate: 'asc' },
    })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
}

// تغيير حالة الاشتراك
export async function PATCH(req: NextRequest) {
  try {
    await auth(req)
    const { id, status, notes } = await req.json()

    const allowed = ['ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED', 'TRIAL']
    if (!allowed.includes(status)) {
      return NextResponse.json({ error: 'حالة غير صالحة' }, { status: 400 })
    }

    const data = await prisma.subscription.update({
      where: { id },
      data: { status, notes },
    })
    return NextResponse.json(data)
  } catch (err) {
    const msg = (err as Error).message
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: 'خطأ' }, { status: 500 })
  }
}
