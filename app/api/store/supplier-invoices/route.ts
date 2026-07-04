import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStore, requireManager } from '@/lib/store-auth-helper'
import { logApiError } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    const t    = await requireStore(req)
    requireManager(t)
    const { supplierId, total, amountPaid = 0, items = [], dueDate } = await req.json()

    if (!supplierId || !total || total <= 0)
      return NextResponse.json({ error: 'بيانات غير صحيحة' }, { status: 400 })

    // verify supplier belongs to store
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId, storeId: t.storeId } })
    if (!supplier) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 })

    const paid      = Math.min(amountPaid, total)
    const remaining = total - paid

    const validItems = (items as { productId: string; quantity: number; unitCost: number }[])
      .filter(it => it.productId && it.quantity > 0)

    // generate invoice number
    const count = await prisma.supplierInvoice.count({ where: { supplier: { storeId: t.storeId } } })
    const invoiceNumber = `SI-${String(count + 1).padStart(4, '0')}`

    const invoice = await prisma.$transaction(async (tx) => {
      const created = await tx.supplierInvoice.create({
        data: {
          invoiceNumber,
          total,
          amountPaid: paid,
          remaining,
          status: remaining === 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID',
          dueDate: dueDate ? new Date(dueDate) : null,
          supplierId,
          items: {
            create: validItems.map(it => ({
              productId: it.productId,
              quantity:  it.quantity,
              unitCost:  it.unitCost,
              total:     it.quantity * it.unitCost,
            })),
          },
          ...(paid > 0 ? { payments: { create: [{ amount: paid }] } } : {}),
        },
      })

      // زيادة المخزون + تسجيل حركة شراء لكل صنف
      for (const it of validItems) {
        const product = await tx.product.update({
          where: { id: it.productId, storeId: t.storeId },
          data:  { stock: { increment: it.quantity } },
        })
        await tx.inventoryMovement.create({
          data: {
            type:              'PURCHASE',
            quantity:          it.quantity,
            quantityAfter:     product.stock,
            storeId:           t.storeId,
            productId:         it.productId,
            branchId:          t.branchId,
            storeUserId:       t.id,
            supplierInvoiceId: created.id,
          },
        })
      }

      // update supplier balance
      await tx.supplier.update({
        where: { id: supplierId },
        data:  { currentBalance: { increment: remaining } },
      })

      return created
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (e) {
    await logApiError(req, e)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
