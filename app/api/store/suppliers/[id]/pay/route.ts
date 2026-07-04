import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStore, requireManager } from '@/lib/store-auth-helper'
import { logApiError } from '@/lib/logger'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const t = await requireStore(req)
    requireManager(t)
    const { amount, notes } = await req.json()

    if (!amount || amount <= 0)
      return NextResponse.json({ error: 'قيمة الدفعة غير صحيحة' }, { status: 400 })

    const supplier = await prisma.supplier.findUnique({ where: { id: params.id, storeId: t.storeId } })
    if (!supplier) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 })

    // get invoices with remaining balance, oldest first (FIFO)
    const invoices = await prisma.supplierInvoice.findMany({
      where:   { supplierId: params.id, remaining: { gt: 0 } },
      orderBy: { date: 'asc' },
    })

    if (invoices.length === 0)
      return NextResponse.json({ error: 'لا توجد فواتير غير مسددة' }, { status: 400 })

    let leftover = amount
    for (const inv of invoices) {
      if (leftover <= 0) break
      const applied      = Math.min(leftover, inv.remaining)
      const newPaid      = inv.amountPaid + applied
      const newRemaining = inv.remaining  - applied
      const newStatus    = newRemaining === 0 ? 'PAID' : 'PARTIAL'

      await prisma.supplierInvoice.update({
        where: { id: inv.id },
        data:  { amountPaid: newPaid, remaining: newRemaining, status: newStatus },
      })
      await prisma.supplierPayment.create({
        data: { amount: applied, supplierInvoiceId: inv.id, notes: notes || null },
      })
      leftover -= applied
    }

    const actualPaid = amount - leftover
    const updated = await prisma.supplier.update({
      where: { id: params.id },
      data:  { currentBalance: { decrement: actualPaid } },
    })

    return NextResponse.json({ ok: true, paid: actualPaid, currentBalance: updated.currentBalance })
  } catch (e) {
    await logApiError(req, e)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
