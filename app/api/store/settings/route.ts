import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStore, requireManager } from '@/lib/store-auth-helper'
import { logApiError } from '@/lib/logger'
import { z } from 'zod'

const schema = z.object({
  roundingRule:    z.enum(['100', '500', '1000']).optional(),
  pricingCurrency: z.enum(['USD', 'SYP']).optional(),
  taxEnabled:      z.boolean().optional(),
  // taxRate: نقاط أساس (basis points) — 0 إلى 10000 (0% إلى 100%)
  taxRate:         z.number().int().min(0).max(10000).optional(),
  taxName:         z.string().trim().min(1).max(50).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const t = await requireStore(req)
    const store = await prisma.store.findUnique({
      where:  { id: t.storeId },
      select: { roundingRule: true, pricingCurrency: true, taxEnabled: true, taxRate: true, taxName: true },
    })
    if (!store) return NextResponse.json({ error: 'المتجر غير موجود' }, { status: 404 })
    return NextResponse.json(store)
  } catch (e) {
    await logApiError(req, e)
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const t = await requireStore(req)
    requireManager(t)
    const body = await req.json()
    const data = schema.parse(body)

    const store = await prisma.store.update({
      where:  { id: t.storeId },
      data,
      select: { roundingRule: true, pricingCurrency: true, taxEnabled: true, taxRate: true, taxName: true },
    })
    return NextResponse.json(store)
  } catch (e) {
    await logApiError(req, e)
    const err = e as Error & { status?: number }
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors[0].message }, { status: 422 })
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
