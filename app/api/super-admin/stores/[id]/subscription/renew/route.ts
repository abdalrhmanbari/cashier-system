import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { renewalDuration, getSubscriptionDetail } from '@/lib/subscription'
import { logger } from '@/lib/logger'

async function requireSuperAdmin(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: 'super-admin.session-token' })
  if (!token) throw new Error('UNAUTHORIZED')
  return token
}

// تجديد اشتراك — خطوة واحدة: يمدد endDate (من endDate الحالي إن كان بالمستقبل، أو من الآن إن كان منتهياً)،
// يسجل SubscriptionRenewal، ويعيد الحالة دائماً إلى ACTIVE بغض النظر عن الحالة السابقة (EXPIRED/SUSPENDED/CANCELLED).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = await requireSuperAdmin(req)
    const body = await req.json()
    const billingCycle: string | undefined = body.billingCycle
    const customDays: number | undefined   = body.customDays ? Number(body.customDays) : undefined
    const priceUsd: number | undefined     = body.priceUsd != null ? Number(body.priceUsd) : undefined
    const notes: string | undefined        = body.notes

    const renewal = await prisma.$transaction(async tx => {
      const sub = await tx.subscription.findUnique({ where: { storeId: params.id } })
      if (!sub) throw new Error('NOT_FOUND')

      const cycle    = billingCycle || sub.billingCycle
      const duration = renewalDuration(cycle, customDays)
      const fromDate = sub.endDate.getTime() > Date.now() ? sub.endDate : new Date()
      const toDate   = new Date(fromDate.getTime() + duration * 24 * 60 * 60 * 1000)
      const finalPrice = priceUsd != null && !Number.isNaN(priceUsd) ? priceUsd : sub.priceUsd

      const renewal = await tx.subscriptionRenewal.create({
        data: {
          subscriptionId: sub.id,
          fromDate,
          toDate,
          branchCount:  sub.branchCount,
          priceUsd:     finalPrice,
          billingCycle: cycle,
        },
      })

      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          status:       'ACTIVE',
          endDate:      toDate,
          billingCycle: cycle,
          priceUsd:     finalPrice,
          notes:        notes ?? sub.notes,
        },
      })

      return renewal
    })

    const admin = await prisma.superAdmin.findUnique({ where: { id: token.id as string }, select: { name: true, email: true } })
    try {
      await prisma.auditLog.create({
        data: {
          action:     'RENEW_SUBSCRIPTION',
          resource:   'SUBSCRIPTION',
          resourceId: renewal.subscriptionId,
          storeId:    params.id,
          superAdminId: token.id as string,
          newData:    JSON.stringify({ adminName: admin?.name, adminEmail: admin?.email, toDate: renewal.toDate, priceUsd: renewal.priceUsd }),
        },
      })
    } catch (e) {
      logger.error('فشل تسجيل AuditLog', { action: 'RENEW_SUBSCRIPTION', storeId: params.id, err: (e as Error)?.message })
    }

    const subscription = await getSubscriptionDetail(params.id)
    return NextResponse.json(subscription)
  } catch (err) {
    const msg = (err as Error).message
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    if (msg === 'NOT_FOUND')    return NextResponse.json({ error: 'لا يوجد اشتراك لهذا المتجر' }, { status: 404 })
    return NextResponse.json({ error: msg || 'خطأ في الخادم' }, { status: 400 })
  }
}
