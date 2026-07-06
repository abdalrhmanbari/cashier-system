import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStore, requireManager } from '@/lib/store-auth-helper'
import { z } from 'zod'

const schema = z.object({
  name:          z.string().min(1),
  barcode:       z.string().optional().nullable(),
  price:         z.number().int().min(0),
  costPrice:     z.number().int().min(0).default(0),
  stock:         z.number().int().default(0),
  minStock:      z.number().int().default(5),
  lowStockThreshold: z.number().int().min(0).optional().nullable(),
  categoryId:    z.string().optional().nullable(),
  hasDiscount:   z.boolean().default(false),
  discountType:  z.string().optional().nullable(),
  discountValue: z.number().int().default(0),
})

function err(msg: string, status = 500) {
  return NextResponse.json({ error: msg }, { status })
}

export async function GET(req: NextRequest) {
  try {
    const t = await requireStore(req)
    const { searchParams } = new URL(req.url)
    const q          = searchParams.get('q') ?? ''
    const categoryId = searchParams.get('categoryId')
    const lowStock   = searchParams.get('lowStock') === 'true'

    const products = await prisma.product.findMany({
      where: {
        storeId: t.storeId,
        isActive: true,
        ...(q           ? { name: { contains: q } } : {}),
        ...(categoryId  ? { categoryId }             : {}),
      },
      include: { category: { select: { id: true, name: true, color: true, imageUrl: true } } },
      orderBy: { name: 'asc' },
    })

    // lowStock filter in memory (SQLite doesn't support column comparisons in where)
    const result = lowStock
      ? products.filter(p => p.stock <= p.minStock)
      : products

    return NextResponse.json(result)
  } catch (e) {
    const err_ = e as Error & { status?: number }
    return err(err_.message, err_.status ?? 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const t = await requireStore(req)
    requireManager(t)
    const body = await req.json()
    const data = schema.parse(body)

    const store = await prisma.store.findUnique({ where: { id: t.storeId }, select: { pricingCurrency: true } })

    const product = await prisma.product.create({
      data: { ...data, priceCurrency: store?.pricingCurrency ?? 'USD', storeId: t.storeId },
      include: { category: { select: { id: true, name: true, color: true, imageUrl: true } } },
    })
    return NextResponse.json(product, { status: 201 })
  } catch (e) {
    const err_ = e as Error & { status?: number }
    if (err_ instanceof z.ZodError) return err(err_.errors[0].message, 422)
    if (err_.message === 'Unique constraint') return err('الباركود مستخدم', 409)
    return err(err_.message, err_.status ?? 500)
  }
}
