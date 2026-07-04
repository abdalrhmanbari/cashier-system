import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStore } from '@/lib/store-auth-helper'
import { roundSyp, distributeProportionally } from '@/lib/utils'
import { checkLowStock, checkCustomerDebtLimit } from '@/lib/notifications'
import { logger, logApiError } from '@/lib/logger'
import { z } from 'zod'

const SLOW_OPERATION_MS = 2000

const itemSchema = z.object({
  productId: z.string(),
  quantity:  z.number().int().min(1),
  // خصم على مستوى الصنف بالليرة السورية (منفصل عن خصم المنتج التلقائي hasDiscount)
  discount:  z.number().int().min(0).default(0),
})

const saleSchema = z.object({
  shiftId:    z.string(),
  customerId: z.string().optional().nullable(),
  type:       z.enum(['CASH', 'CREDIT']).default('CASH'),
  // خصم إجمالي الفاتورة بالليرة السورية
  discount:   z.number().int().min(0).default(0),
  // المبلغ المستلم بالليرة السورية (0 للبيع الآجل)
  amountPaid: z.number().int().min(0),
  notes:      z.string().optional().nullable(),
  items:      z.array(itemSchema).min(1),
})

type ProductForPricing = {
  price: number; priceCurrency: string
  hasDiscount: boolean; discountType: string | null; discountValue: number
}

function calcFinalPriceInProductCurrency(p: ProductForPricing): number {
  if (!p.hasDiscount || !p.discountValue) return p.price
  if (p.discountType === 'PERCENTAGE') return Math.round(p.price * (1 - p.discountValue / 100))
  if (p.discountType === 'FIXED')      return Math.max(0, p.price - p.discountValue)
  return p.price
}

async function generateInvoiceNumber(storeId: string): Promise<string> {
  const year  = new Date().getFullYear()
  const count = await prisma.sale.count({ where: { storeId } })
  return `INV-${year}-${String(count + 1).padStart(4, '0')}`
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now()
  try {
    const t    = await requireStore(req)
    const body = await req.json()
    const data = saleSchema.parse(body)

    // تحقق من الوردية
    const shift = await prisma.shift.findFirst({
      where: { id: data.shiftId, storeId: t.storeId, status: 'OPEN', userId: t.id },
    })
    if (!shift) return NextResponse.json({ error: 'لا توجد وردية مفتوحة' }, { status: 400 })

    if (data.type === 'CREDIT' && !data.customerId) {
      return NextResponse.json({ error: 'يجب اختيار عميل للبيع الآجل' }, { status: 422 })
    }

    const rateRow = await prisma.exchangeRate.findFirst({
      where:   { storeId: t.storeId },
      orderBy: { effectiveFrom: 'desc' },
    })
    if (!rateRow) {
      return NextResponse.json({ error: 'لا يوجد سعر صرف مسجل — أدخله من الإعدادات' }, { status: 400 })
    }
    const rate = rateRow.rate

    const store = await prisma.store.findUnique({
      where:  { id: t.storeId },
      select: { taxRate: true, taxEnabled: true, taxName: true, roundingRule: true },
    })

    const productIds = data.items.map(i => i.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, storeId: t.storeId },
    })
    const productMap = new Map(products.map(p => [p.id, p]))

    let subtotalSyp = 0
    const itemsToCreate: {
      productId: string; quantity: number; unitPrice: number; discount: number; total: number; priceCurrency: string
    }[] = []

    for (const reqItem of data.items) {
      const product = productMap.get(reqItem.productId)
      if (!product) return NextResponse.json({ error: 'أحد المنتجات غير موجود' }, { status: 422 })

      const priceInProductCurrency = calcFinalPriceInProductCurrency(product)
      const unitPriceSyp = product.priceCurrency === 'USD'
        ? Math.round((priceInProductCurrency / 100) * rate)
        : priceInProductCurrency

      const lineTotal = unitPriceSyp * reqItem.quantity - reqItem.discount
      if (lineTotal < 0) {
        return NextResponse.json(
          { error: `خصم الصنف "${product.name}" أكبر من قيمة السطر الإجمالية` },
          { status: 400 }
        )
      }
      subtotalSyp += lineTotal

      itemsToCreate.push({
        productId:     reqItem.productId,
        quantity:      reqItem.quantity,
        unitPrice:     unitPriceSyp,
        discount:      reqItem.discount,
        total:         lineTotal,
        priceCurrency: product.priceCurrency,
      })
    }

    // خصم إجمالي الفاتورة لا يجوز أن يتجاوز صافي الأصناف قبله — وإلا نتج إجمالي سالب
    if (data.discount > subtotalSyp) {
      return NextResponse.json(
        { error: 'قيمة الخصم أكبر من إجمالي الفاتورة — يرجى تصحيح المبلغ' },
        { status: 400 }
      )
    }

    // توزيع خصم إجمالي الفاتورة على الأسطر نسبياً حسب قيمة كل سطر — netLineTotal هو الرقم المرجعي الوحيد لما دفعه الزبون فعلاً لكل سطر (قبل الضريبة)
    const invoiceDiscountShares = distributeProportionally(itemsToCreate.map(i => i.total), data.discount)
    const itemsToCreateWithNet = itemsToCreate.map((item, i) => ({
      ...item,
      netLineTotal: item.total - invoiceDiscountShares[i],
    }))

    // الضريبة تُحسب على الصافي بعد كل الخصومات (صنف + فاتورة)، فقط إن كانت مفعّلة ونسبتها > 0
    // Math.max احتياط دفاعي ثانٍ (مطابق لمنطق العميل بـ pos/page.tsx) — الرفض أعلاه هو خط الدفاع الأول
    const netAfterDiscount = Math.max(0, subtotalSyp - data.discount)
    const taxActive = !!store?.taxEnabled && (store?.taxRate ?? 0) > 0
    const taxRateApplied = taxActive ? store!.taxRate : 0
    const tax = taxActive ? Math.round((netAfterDiscount * taxRateApplied) / 10000) : 0

    // توزيع مبلغ الضريبة على الأسطر نسبياً حسب netLineTotal — lineTax هو نصيب كل سطر، والمبلغ الذي دفعه الزبون فعلياً لهذا السطر = netLineTotal + lineTax
    const lineTaxShares = distributeProportionally(itemsToCreateWithNet.map(i => i.netLineTotal), tax)
    const itemsFinal = itemsToCreateWithNet.map((item, i) => ({ ...item, lineTax: lineTaxShares[i] }))

    const totalBeforeRounding = Math.max(0, netAfterDiscount + tax)
    const totalSyp        = roundSyp(totalBeforeRounding, store?.roundingRule ?? '500')
    const roundingDiffSyp = totalSyp - totalBeforeRounding
    const totalUsdCents   = Math.round((totalSyp / rate) * 100)
    const taxUsdCents     = taxActive ? Math.round((tax / rate) * 100) : 0

    const remaining = Math.max(0, totalSyp - data.amountPaid)
    const remainingUsdCents = totalSyp > 0 ? Math.round((totalUsdCents * remaining) / totalSyp) : 0

    const invoiceNumber = await generateInvoiceNumber(t.storeId)

    const sale = await prisma.$transaction(async (tx) => {
      const created = await tx.sale.create({
        data: {
          invoiceNumber,
          type:       data.type,
          status:     'COMPLETED',
          subtotal:   subtotalSyp,
          discount:   data.discount,
          tax,
          taxRateApplied,
          taxName:    store?.taxName ?? 'ضريبة',
          taxUsdCents,
          total:      totalSyp,
          amountPaid: data.amountPaid,
          remaining,
          exchangeRate:    rate,
          totalUsdCents,
          totalSyp,
          roundingDiffSyp,
          notes:      data.notes,
          storeId:    t.storeId,
          branchId:   shift.branchId,
          userId:     t.id,
          shiftId:    data.shiftId,
          customerId: data.customerId ?? null,
          items: { create: itemsFinal },
          payments: data.amountPaid > 0 ? { create: [{ amount: data.amountPaid, method: 'CASH' }] } : undefined,
        },
        include: {
          items:    { include: { product: { select: { name: true } } } },
          payments: true,
          customer: { select: { name: true } },
        },
      })

      // خصم المخزون + تسجيل حركة مخزون لكل صنف
      for (const item of data.items) {
        const product = await tx.product.update({
          where: { id: item.productId, storeId: t.storeId },
          data:  { stock: { decrement: item.quantity } },
        })
        await tx.inventoryMovement.create({
          data: {
            type:          'SALE',
            quantity:      -item.quantity,
            quantityAfter: product.stock,
            storeId:       t.storeId,
            productId:     item.productId,
            branchId:      shift.branchId,
            storeUserId:   t.id,
            saleId:        created.id,
          },
        })
      }

      // تحديث رصيد العميل (آجل) — بالدولار حصراً
      if (data.type === 'CREDIT' && data.customerId && remainingUsdCents > 0) {
        await tx.customer.update({
          where: { id: data.customerId },
          data:  { currentBalance: { increment: remainingUsdCents } },
        })
      }

      return created
    })

    // إشعارات — best-effort، لا تُفشل عملية البيع أبداً
    for (const item of data.items) await checkLowStock(t.storeId, item.productId)
    if (data.type === 'CREDIT' && data.customerId) await checkCustomerDebtLimit(t.storeId, data.customerId)

    const durationMs = Date.now() - startedAt
    if (durationMs > SLOW_OPERATION_MS) {
      logger.performance('عملية بيع بطيئة', { path: req.nextUrl.pathname, method: 'POST', storeId: t.storeId, durationMs })
    }

    return NextResponse.json(sale, { status: 201 })
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
    const shiftId = searchParams.get('shiftId')
    const q       = searchParams.get('q')
    const limit   = parseInt(searchParams.get('limit') ?? '20')

    const sales = await prisma.sale.findMany({
      where: {
        storeId: t.storeId,
        ...(shiftId ? { shiftId } : {}),
        ...(q ? { invoiceNumber: { contains: q } } : {}),
      },
      include: {
        items: {
          select: {
            id: true, quantity: true, unitPrice: true, discount: true, total: true, netLineTotal: true, lineTax: true, priceCurrency: true,
            productId: true,
            product:     { select: { name: true } },
            returnItems: { select: { quantity: true } },
          },
        },
        customer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return NextResponse.json(sales)
  } catch (e) {
    await logApiError(req, e)
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
