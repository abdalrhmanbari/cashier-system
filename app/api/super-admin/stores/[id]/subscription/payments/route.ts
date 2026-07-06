import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

async function requireSuperAdmin(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: 'super-admin.session-token' })
  if (!token) throw new Error('UNAUTHORIZED')
  return token
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSuperAdmin(req)
    const sub = await prisma.subscription.findUnique({ where: { storeId: params.id }, select: { id: true } })
    if (!sub) return NextResponse.json({ error: 'لا يوجد اشتراك لهذا المتجر' }, { status: 404 })

    const payments = await prisma.subscriptionPayment.findMany({
      where:   { subscriptionId: sub.id },
      orderBy: { paidAt: 'desc' },
    })
    return NextResponse.json(payments)
  } catch (err) {
    const msg = (err as Error).message
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}

// تسجيل دفعة اشتراك — amountUsd بالسنتات (integer) حسب اصطلاح المشروع
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = await requireSuperAdmin(req)
    const body = await req.json()
    const amountUsd: number = Number(body.amountUsd)
    const method: string    = body.method || 'CASH'

    if (!amountUsd || amountUsd <= 0 || !Number.isFinite(amountUsd)) {
      return NextResponse.json({ error: 'مبلغ غير صالح' }, { status: 400 })
    }

    const sub = await prisma.subscription.findUnique({ where: { storeId: params.id }, select: { id: true } })
    if (!sub) return NextResponse.json({ error: 'لا يوجد اشتراك لهذا المتجر' }, { status: 404 })

    const admin = await prisma.superAdmin.findUnique({ where: { id: token.id as string }, select: { name: true } })

    const payment = await prisma.subscriptionPayment.create({
      data: {
        subscriptionId:  sub.id,
        amountUsd:       Math.round(amountUsd),
        method,
        referenceNumber: body.referenceNumber || null,
        receiptUrl:      body.receiptUrl || null,
        notes:           body.notes || null,
        confirmedBy:     admin?.name ?? null,
      },
    })

    try {
      await prisma.auditLog.create({
        data: {
          action:     'RECORD_SUBSCRIPTION_PAYMENT',
          resource:   'SUBSCRIPTION',
          resourceId: sub.id,
          storeId:    params.id,
          superAdminId: token.id as string,
          newData:    JSON.stringify({ adminName: admin?.name, amountUsd: payment.amountUsd, method }),
        },
      })
    } catch (e) {
      logger.error('فشل تسجيل AuditLog', { action: 'RECORD_SUBSCRIPTION_PAYMENT', storeId: params.id, err: (e as Error)?.message })
    }

    return NextResponse.json(payment)
  } catch (err) {
    const msg = (err as Error).message
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
