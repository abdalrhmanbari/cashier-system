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

    const invoice = await prisma.supplierInvoice.findUnique({
      where:   { id: params.id },
      include: { supplier: { select: { storeId: true } } },
    })

    if (!invoice || invoice.supplier.storeId !== t.storeId)
      return NextResponse.json({ error: 'الفاتورة غير موجودة' }, { status: 404 })

    if (invoice.remaining <= 0)
      return NextResponse.json({ error: 'الفاتورة مسددة بالكامل' }, { status: 400 })

    const applied      = Math.min(amount, invoice.remaining)
    const newPaid      = invoice.amountPaid + applied
    const newRemaining = invoice.remaining  - applied
    const newStatus    = newRemaining === 0 ? 'PAID' : 'PARTIAL'

    await prisma.supplierInvoice.update({
      where: { id: params.id },
      data:  { amountPaid: newPaid, remaining: newRemaining, status: newStatus },
    })
    await prisma.supplierPayment.create({
      data: { amount: applied, supplierInvoiceId: params.id, notes: notes || null },
    })
    await prisma.supplier.update({
      where: { id: invoice.supplierId },
      data:  { currentBalance: { decrement: applied } },
    })

    return NextResponse.json({ ok: true, applied, newRemaining })
  } catch (e) {
    await logApiError(req, e)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
