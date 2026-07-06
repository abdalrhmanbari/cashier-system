import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStore, requireManager } from '@/lib/store-auth-helper'
import { z } from 'zod'

const updateSchema = z.object({
  name:          z.string().min(1).optional(),
  barcode:       z.string().optional().nullable(),
  price:         z.number().int().min(0).optional(),
  costPrice:     z.number().int().min(0).optional(),
  stock:         z.number().int().optional(),
  minStock:      z.number().int().optional(),
  lowStockThreshold: z.number().int().min(0).optional().nullable(),
  categoryId:    z.string().optional().nullable(),
  hasDiscount:   z.boolean().optional(),
  discountType:  z.string().optional().nullable(),
  discountValue: z.number().int().optional(),
  isActive:      z.boolean().optional(),
})

function errResp(msg: string, status = 500) {
  return NextResponse.json({ error: msg }, { status })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const t = await requireStore(req)
    requireManager(t)
    const body = await req.json()
    const data = updateSchema.parse(body)

    // priceCurrency يُحدَّث فقط عند تغيير قيمة السعر فعلياً (وليس مجرد وجوده بالطلب — النموذج يرسل كل الحقول دائماً)
    // يمنع إعادة تفسير أرقام مخزّنة قديمة عند تعديل حقول أخرى بعد تغيير إعداد المتجر لاحقاً
    let priceCurrency: string | undefined
    if (data.price !== undefined || data.costPrice !== undefined) {
      const existing = await prisma.product.findUnique({
        where: { id: params.id, storeId: t.storeId },
        select: { price: true, costPrice: true, priceCurrency: true },
      })
      const priceChanged     = data.price     !== undefined && data.price     !== existing?.price
      const costPriceChanged = data.costPrice !== undefined && data.costPrice !== existing?.costPrice
      if (priceChanged || costPriceChanged) {
        const store = await prisma.store.findUnique({ where: { id: t.storeId }, select: { pricingCurrency: true } })
        priceCurrency = store?.pricingCurrency ?? 'USD'
      }
    }

    const product = await prisma.product.update({
      where:   { id: params.id, storeId: t.storeId },
      data:    { ...data, ...(priceCurrency ? { priceCurrency } : {}) },
      include: { category: { select: { id: true, name: true, color: true, imageUrl: true } } },
    })
    return NextResponse.json(product)
  } catch (e) {
    const err = e as Error & { status?: number }
    return errResp(err.message, err.status ?? 500)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const t = await requireStore(req)
    requireManager(t)
    // soft delete
    await prisma.product.update({
      where: { id: params.id, storeId: t.storeId },
      data:  { isActive: false },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const err = e as Error & { status?: number }
    return errResp(err.message, err.status ?? 500)
  }
}
