import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStore } from '@/lib/store-auth-helper'
import { checkLowStock } from '@/lib/notifications'
import { logger, logApiError } from '@/lib/logger'
import { z } from 'zod'

const SLOW_OPERATION_MS = 2000

const itemSchema = z.object({
  saleItemId: z.string(),
  quantity:   z.number().int().min(1),
})

const returnSchema = z.object({
  saleId:       z.string(),
  reason:       z.string().optional().nullable(),
  refundMethod: z.enum(['CASH', 'CREDIT_NOTE']).default('CASH'),
  items:        z.array(itemSchema).min(1),
})

async function generateReturnNumber(storeId: string): Promise<string> {
  const year  = new Date().getFullYear()
  const count = await prisma.saleReturn.count({ where: { storeId } })
  return `RET-${year}-${String(count + 1).padStart(4, '0')}`
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now()
  try {
    const t    = await requireStore(req)
    const body = await req.json()
    const data = returnSchema.parse(body)

    const sale = await prisma.sale.findFirst({
      where: { id: data.saleId, storeId: t.storeId },
      include: {
        items: { include: { returnItems: { select: { quantity: true, total: true, taxRefund: true } } } },
      },
    })
    if (!sale) return NextResponse.json({ error: 'الفاتورة غير موجودة' }, { status: 404 })

    if (data.refundMethod === 'CREDIT_NOTE' && !sale.customerId) {
      return NextResponse.json({ error: 'الإشعار الدائن يتطلب فاتورة مرتبطة بعميل' }, { status: 422 })
    }

    // الوردية الحالية للمستخدم — يُخصم منها الاسترجاع النقدي عند الإغلاق (وليس وردية البيع الأصلي)
    const openShift = await prisma.shift.findFirst({
      where: { storeId: t.storeId, status: 'OPEN', userId: t.id },
    })
    if (data.refundMethod === 'CASH' && !openShift) {
      return NextResponse.json({ error: 'لا توجد وردية مفتوحة — لا يمكن تسجيل استرجاع نقدي بدونها' }, { status: 400 })
    }

    const returnItems: { saleItemId: string; productId: string; quantity: number; unitPrice: number; total: number; taxRefund: number }[] = []
    for (const reqItem of data.items) {
      const saleItem = sale.items.find(si => si.id === reqItem.saleItemId)
      if (!saleItem) return NextResponse.json({ error: 'عنصر غير موجود في الفاتورة' }, { status: 422 })

      const alreadyReturned = saleItem.returnItems.reduce((s, r) => s + r.quantity, 0)
      const remaining = saleItem.quantity - alreadyReturned
      if (reqItem.quantity > remaining) {
        return NextResponse.json({ error: 'الكمية المطلوب استرجاعها أكبر من المتاح' }, { status: 422 })
      }

      // المبلغ المسترجَع فعلياً = نصيب الكمية المرجعة من (netLineTotal + lineTax) — صافي بعد كل الخصومات شاملاً نصيبه من الضريبة
      // الزبون يسترد بالضبط ما دفعه فعلاً مقابل هذه الكمية، لا أكثر ولا أقل (بما فيها الضريبة)
      let netRefund: number
      let taxRefund: number
      const isFinalReturn = alreadyReturned + reqItem.quantity === saleItem.quantity
      if (isFinalReturn) {
        // الدفعة الأخيرة تأخذ "المتبقي المالي بالضبط" بدل الحساب النسبي — يضمن أن مجموع كل الاسترجاعات الجزئية = netLineTotal + lineTax تماماً بلا انجراف تقريب متراكم
        const prevNetRefund = saleItem.returnItems.reduce((s, r) => s + (r.total - r.taxRefund), 0)
        const prevTaxRefund = saleItem.returnItems.reduce((s, r) => s + r.taxRefund, 0)
        netRefund = saleItem.netLineTotal - prevNetRefund
        taxRefund = saleItem.lineTax - prevTaxRefund
      } else {
        netRefund = Math.round((saleItem.netLineTotal * reqItem.quantity) / saleItem.quantity)
        taxRefund = Math.round((saleItem.lineTax     * reqItem.quantity) / saleItem.quantity)
      }

      returnItems.push({
        saleItemId: saleItem.id,
        productId:  saleItem.productId,
        quantity:   reqItem.quantity,
        unitPrice:  saleItem.unitPrice,
        total:      netRefund + taxRefund,
        taxRefund,
      })
    }

    const total  = returnItems.reduce((s, i) => s + i.total, 0)
    const taxSyp = returnItems.reduce((s, i) => s + i.taxRefund, 0)
    // القيمة الدولارية تُحسب بسعر صرف الفاتورة الأصلية المجمَّد (sale.exchangeRate)، وليس سعر اليوم
    const totalUsdCents = sale.exchangeRate > 0 ? Math.round((total / sale.exchangeRate) * 100) : 0
    const taxUsdCents   = sale.exchangeRate > 0 ? Math.round((taxSyp / sale.exchangeRate) * 100) : 0
    const returnNumber = await generateReturnNumber(t.storeId)

    const saleReturn = await prisma.$transaction(async (tx) => {
      const created = await tx.saleReturn.create({
        data: {
          returnNumber,
          reason:       data.reason ?? null,
          refundMethod: data.refundMethod,
          total,
          taxSyp,
          totalUsdCents,
          taxUsdCents,
          totalSyp:     total,
          storeId:    t.storeId,
          branchId:   sale.branchId,
          userId:     t.id,
          saleId:     sale.id,
          customerId: sale.customerId,
          shiftId:    openShift?.id ?? null,
          items: { create: returnItems },
        },
        include: {
          items: { include: { product: { select: { name: true } } } },
          sale:     { select: { invoiceNumber: true } },
          customer: { select: { name: true } },
        },
      })

      for (const item of returnItems) {
        const product = await tx.product.update({
          where: { id: item.productId, storeId: t.storeId },
          data:  { stock: { increment: item.quantity } },
        })
        await tx.inventoryMovement.create({
          data: {
            type:          'SALE_RETURN',
            quantity:      item.quantity,
            quantityAfter: product.stock,
            note:          data.reason ?? null,
            storeId:       t.storeId,
            productId:     item.productId,
            branchId:      sale.branchId,
            storeUserId:   t.id,
            saleId:        sale.id,
          },
        })
      }

      // الإشعار الدائن يُنقص دين العميل بالدولار — بسعر الصرف المخزَّن في الفاتورة الأصلية، وليس سعر اليوم
      if (data.refundMethod === 'CREDIT_NOTE' && sale.customerId) {
        await tx.customer.update({
          where: { id: sale.customerId },
          data:  { currentBalance: { decrement: totalUsdCents } },
        })
      }

      return created
    })

    // إشعارات — best-effort، لا تُفشل عملية الاسترجاع أبداً
    for (const item of returnItems) await checkLowStock(t.storeId, item.productId)

    const durationMs = Date.now() - startedAt
    if (durationMs > SLOW_OPERATION_MS) {
      logger.performance('عملية استرجاع بطيئة', { path: req.nextUrl.pathname, method: 'POST', storeId: t.storeId, durationMs })
    }

    return NextResponse.json(saleReturn, { status: 201 })
  } catch (e) {
    await logApiError(req, e)
    const err = e as Error & { status?: number }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 422 })
    }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const t = await requireStore(req)
    const { searchParams } = new URL(req.url)
    const q     = searchParams.get('q')
    const limit = parseInt(searchParams.get('limit') ?? '50')

    const returns = await prisma.saleReturn.findMany({
      where: {
        storeId: t.storeId,
        ...(q ? { OR: [
          { returnNumber: { contains: q } },
          { sale: { invoiceNumber: { contains: q } } },
        ] } : {}),
      },
      include: {
        items:    { include: { product: { select: { name: true } } } },
        sale:     { select: { invoiceNumber: true } },
        customer: { select: { name: true } },
        user:     { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return NextResponse.json(returns)
  } catch (e) {
    await logApiError(req, e)
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
