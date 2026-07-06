import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStore, requireManager } from '@/lib/store-auth-helper'
import { checkStaleExchangeRate } from '@/lib/notifications'
import { logApiError } from '@/lib/logger'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const schema = z.object({
  rate: z.number().int().min(1, 'سعر الصرف غير صحيح'),
})

export async function GET(req: NextRequest) {
  try {
    const t = await requireStore(req)

    const history = await prisma.exchangeRate.findMany({
      where:   { storeId: t.storeId },
      orderBy: { effectiveFrom: 'desc' },
      take:    30,
      include: { createdBy: { select: { name: true } } },
    })

    // إشعار — best-effort، يُكتشف تقادم السعر عند أول طلب يقرأه
    if (history[0]) await checkStaleExchangeRate(t.storeId, history[0].effectiveFrom)

    return NextResponse.json({
      current: history[0] ?? null,
      history,
    })
  } catch (e) {
    await logApiError(req, e)
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const t = await requireStore(req)
    requireManager(t)
    const body = await req.json()
    const data = schema.parse(body)

    const rate = await prisma.exchangeRate.create({
      data: {
        rate:        data.rate,
        storeId:     t.storeId,
        createdById: t.id,
      },
      include: { createdBy: { select: { name: true } } },
    })

    await logAudit({
      userId:   t.id,
      storeId:  t.storeId,
      action:   'CHANGE_EXCHANGE_RATE',
      resource: 'EXCHANGE_RATE',
      resourceId: rate.id,
      newData:  { rate: data.rate },
    })

    return NextResponse.json(rate, { status: 201 })
  } catch (e) {
    await logApiError(req, e)
    const err = e as Error & { status?: number }
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors[0].message }, { status: 422 })
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
