import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStore, requireManager } from '@/lib/store-auth-helper'
import { checkLowStock } from '@/lib/notifications'
import { z } from 'zod'

const adjustSchema = z.object({
  productId: z.string(),
  type:      z.enum(['ADJUSTMENT', 'DAMAGE']),
  branchId:  z.string().optional().nullable(),
  note:      z.string().optional().nullable(),
  // ADJUSTMENT: الكمية الفعلية المعدودة بعد الجرد
  actualQuantity: z.number().int().min(0).optional(),
  // DAMAGE: عدد القطع التالفة (رقم موجب يُخصم من المخزون)
  quantity: z.number().int().min(1).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const t = await requireStore(req)
    requireManager(t)
    const { searchParams } = new URL(req.url)
    const productId = searchParams.get('productId')
    const branchId  = searchParams.get('branchId')
    const type      = searchParams.get('type')
    const from      = searchParams.get('from')
    const to        = searchParams.get('to')
    const limit     = parseInt(searchParams.get('limit') ?? '200')

    const movements = await prisma.inventoryMovement.findMany({
      where: {
        storeId: t.storeId,
        ...(productId ? { productId } : {}),
        ...(branchId  ? { branchId }  : {}),
        ...(type      ? { type }      : {}),
        ...(from || to ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to   ? { lte: new Date(new Date(to).setHours(23, 59, 59, 999)) } : {}),
          },
        } : {}),
      },
      include: {
        product:   { select: { id: true, name: true, barcode: true } },
        branch:    { select: { id: true, name: true } },
        storeUser: { select: { id: true, name: true } },
        sale:      { select: { id: true, invoiceNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return NextResponse.json(movements)
  } catch (e) {
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const t    = await requireStore(req)
    requireManager(t)
    const body = await req.json()
    const data = adjustSchema.parse(body)

    const product = await prisma.product.findUnique({
      where: { id: data.productId, storeId: t.storeId },
    })
    if (!product) return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 })

    let delta: number
    if (data.type === 'ADJUSTMENT') {
      if (data.actualQuantity === undefined) {
        return NextResponse.json({ error: 'الكمية الفعلية مطلوبة لتسوية الجرد' }, { status: 422 })
      }
      delta = data.actualQuantity - product.stock
    } else {
      if (!data.quantity) {
        return NextResponse.json({ error: 'كمية التالف مطلوبة' }, { status: 422 })
      }
      if (data.quantity > product.stock) {
        return NextResponse.json({ error: 'كمية التالف أكبر من الرصيد الحالي' }, { status: 422 })
      }
      delta = -data.quantity
    }

    if (delta === 0) {
      return NextResponse.json({ error: 'لا يوجد فرق ليتم تسجيله' }, { status: 422 })
    }

    const movement = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: product.id, storeId: t.storeId },
        data:  { stock: { increment: delta } },
      })
      return tx.inventoryMovement.create({
        data: {
          type:          data.type,
          quantity:      delta,
          quantityAfter: updated.stock,
          note:          data.note ?? null,
          storeId:       t.storeId,
          productId:     product.id,
          branchId:      data.branchId ?? t.branchId ?? null,
          storeUserId:   t.id,
        },
        include: {
          product:   { select: { id: true, name: true, barcode: true } },
          branch:    { select: { id: true, name: true } },
          storeUser: { select: { id: true, name: true } },
        },
      })
    })

    // إشعار — best-effort، لا يُفشل عملية التسوية أبداً
    await checkLowStock(t.storeId, product.id)

    return NextResponse.json(movement, { status: 201 })
  } catch (e) {
    const err = e as Error & { status?: number }
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors[0].message }, { status: 422 })
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
