import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStore, requireManager } from '@/lib/store-auth-helper'
import { logApiError } from '@/lib/logger'
import { z } from 'zod'

const createSchema = z.object({
  name:           z.string().min(2),
  phone:          z.string().optional().nullable(),
  address:        z.string().optional().nullable(),
  creditLimit:    z.number().int().min(0).default(0),
  currentBalance: z.number().int().default(0),  // موجب = دين على العميل، سالب = رصيد للعميل
  debtLimitUsdCents: z.number().int().min(0).optional().nullable(),
})

const customerSelect = {
  id: true, name: true, phone: true, address: true,
  creditLimit: true, currentBalance: true, debtLimitUsdCents: true, createdAt: true,
  _count: { select: { sales: true } },
} as const

export async function GET(req: NextRequest) {
  try {
    const t         = await requireStore(req)
    requireManager(t)
    const customers = await prisma.customer.findMany({
      where:   { storeId: t.storeId },
      select:  customerSelect,
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(customers)
  } catch (e) {
    await logApiError(req, e)
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const t    = await requireStore(req)
    requireManager(t)
    const body = await req.json()
    const data = createSchema.parse(body)

    const customer = await prisma.customer.create({
      data: {
        name:           data.name,
        phone:          data.phone ?? null,
        address:        data.address ?? null,
        creditLimit:    data.creditLimit,
        currentBalance: data.currentBalance,
        debtLimitUsdCents: data.debtLimitUsdCents ?? null,
        storeId:        t.storeId,
      },
      select: customerSelect,
    })
    return NextResponse.json(customer, { status: 201 })
  } catch (e) {
    await logApiError(req, e)
    const err = e as Error & { status?: number }
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors[0].message }, { status: 422 })
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
