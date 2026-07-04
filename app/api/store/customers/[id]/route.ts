import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStore, requireManager } from '@/lib/store-auth-helper'
import { logApiError } from '@/lib/logger'
import { z } from 'zod'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const t = await requireStore(req)
    requireManager(t)
    const customer = await prisma.customer.findFirst({
      where: { id: params.id, storeId: t.storeId },
      select: {
        id: true, name: true, phone: true, address: true,
        creditLimit: true, currentBalance: true, debtLimitUsdCents: true, createdAt: true,
        sales: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, invoiceNumber: true, type: true, status: true,
            subtotal: true, discount: true, tax: true, total: true,
            amountPaid: true, remaining: true, notes: true, createdAt: true,
            totalUsdCents: true, exchangeRate: true,
            user: { select: { name: true } },
            items: {
              select: {
                quantity: true, unitPrice: true, discount: true, total: true,
                product: { select: { name: true } },
              },
            },
            payments: {
              select: { id: true, amount: true, method: true, date: true },
            },
          },
        },
        payments: {
          orderBy: { date: 'desc' },
          select: { id: true, amount: true, method: true, notes: true, date: true },
        },
      },
    })
    if (!customer) return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 })
    return NextResponse.json(customer)
  } catch (e) {
    await logApiError(req, e)
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}

const updateSchema = z.object({
  name:           z.string().min(2).optional(),
  phone:          z.string().optional().nullable(),
  address:        z.string().optional().nullable(),
  creditLimit:    z.number().int().min(0).optional(),
  currentBalance: z.number().int().optional(),
  debtLimitUsdCents: z.number().int().min(0).optional().nullable(),
})

const customerSelect = {
  id: true, name: true, phone: true, address: true,
  creditLimit: true, currentBalance: true, debtLimitUsdCents: true, createdAt: true,
  _count: { select: { sales: true } },
} as const

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const t    = await requireStore(req)
    requireManager(t)
    const body = await req.json()

    // تسوية الرصيد: دفع دين أو سداد رصيد
    if (typeof body.payment === 'number' && body.payment !== 0) {
      const existing = await prisma.customer.findFirst({
        where: { id: params.id, storeId: t.storeId },
        select: { currentBalance: true },
      })
      if (!existing) return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 })

      // موجب = عميل يسدد دين (يُنقص الرصيد الموجب)
      // سالب = متجر يسدد رصيد للعميل (يُزيد الرصيد السالب نحو الصفر)
      const newBalance = existing.currentBalance - body.payment
      const method = (body.method as string) ?? 'CASH'

      // ملاحظة: التسديد يُنقص رصيد العميل الإجمالي بالدولار مباشرة فقط —
      // لا يُوزَّع على فواتير Sale الفردية (SYP) لتفادي خلط عملتين مختلفتين في حقل واحد،
      // ولا يُنشئ Payment مرتبطاً بوردية (التسديد لا علاقة له بصندوق الكاشير أو الوردية)

      const rateRow = await prisma.exchangeRate.findFirst({
        where:   { storeId: t.storeId },
        orderBy: { effectiveFrom: 'desc' },
      })

      const customer = await prisma.$transaction(async (tx) => {
        const updated = await tx.customer.update({
          where:  { id: params.id },
          data:   { currentBalance: newBalance },
          select: customerSelect,
        })
        // amount بالدولار حصراً — exchangeRate هنا للتوثيق فقط، لا يدخل في أي حساب
        await tx.customerPayment.create({
          data: {
            customerId: params.id, amount: body.payment, method, notes: body.notes ?? null,
            currency: 'USD', exchangeRate: rateRow?.rate ?? null,
          },
        })
        return updated
      })
      return NextResponse.json(customer)
    }

    // تعديل بيانات العميل
    const data = updateSchema.parse(body)
    const customer = await prisma.customer.update({
      where:  { id: params.id, storeId: t.storeId },
      data,
      select: customerSelect,
    })
    return NextResponse.json(customer)
  } catch (e) {
    await logApiError(req, e)
    const err = e as Error & { status?: number }
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors[0].message }, { status: 422 })
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const t = await requireStore(req)
    requireManager(t)

    const salesCount = await prisma.sale.count({
      where: { customerId: params.id, storeId: t.storeId },
    })
    if (salesCount > 0) {
      return NextResponse.json(
        { error: 'لا يمكن حذف عميل لديه مبيعات مسجّلة' },
        { status: 409 }
      )
    }

    await prisma.customer.delete({ where: { id: params.id, storeId: t.storeId } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    await logApiError(req, e)
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
