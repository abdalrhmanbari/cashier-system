import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStore } from '@/lib/store-auth-helper'
import { notifyShiftDifference } from '@/lib/notifications'
import { logger, logApiError } from '@/lib/logger'

const SLOW_OPERATION_MS = 2000

// إغلاق الوردية
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const startedAt = Date.now()
  try {
    const t = await requireStore(req)

    const shift = await prisma.shift.findFirst({
      where: { id: params.id, storeId: t.storeId, status: 'OPEN' },
      include: {
        sales: {
          where: { status: 'COMPLETED' },
          select: { total: true },
        },
      },
    })
    if (!shift) return NextResponse.json({ error: 'الوردية غير موجودة أو مغلقة' }, { status: 404 })

    // تحقق أن المستخدم يملك هذه الوردية (أو هو مدير)
    if (t.role === 'CASHIER' && shift.userId !== t.id) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }

    const { actualCash, notes } = await req.json()

    // حساب النقد المتوقع
    const cashSales    = await prisma.payment.aggregate({
      where: { sale: { shiftId: params.id, status: 'COMPLETED' }, method: 'CASH' },
      _sum: { amount: true },
    })
    // الاسترجاع النقدي المسجَّل على هذه الوردية (شيفتها هي وردية الاسترجاع نفسه، وليس وردية البيع الأصلي) يُخصم من الصندوق بالليرة كما خرج فعلياً
    const cashReturns = await prisma.saleReturn.aggregate({
      where: { shiftId: params.id, refundMethod: 'CASH' },
      _sum: { total: true },
    })
    const expectedCash = shift.openingCash + (cashSales._sum.amount ?? 0) - (cashReturns._sum.total ?? 0)
    const difference   = (actualCash ?? 0) - expectedCash

    const updated = await prisma.shift.update({
      where: { id: params.id },
      data: {
        status:       'CLOSED',
        closedAt:     new Date(),
        expectedCash,
        actualCash:   actualCash ?? null,
        difference:   actualCash !== undefined ? difference : null,
        notes,
      },
      include: {
        user:   { select: { name: true } },
        branch: { select: { name: true } },
        _count: { select: { sales: true } },
      },
    })

    // إشعار — best-effort، لا يُفشل عملية إغلاق الوردية أبداً
    if (actualCash !== undefined && difference !== 0) {
      await notifyShiftDifference(t.storeId, {
        cashierName: updated.user.name,
        branchName:  updated.branch.name,
        difference,
      })
    }

    const durationMs = Date.now() - startedAt
    if (durationMs > SLOW_OPERATION_MS) {
      logger.performance('عملية إغلاق وردية بطيئة', { path: req.nextUrl.pathname, method: 'PATCH', storeId: t.storeId, durationMs })
    }

    return NextResponse.json(updated)
  } catch (e) {
    await logApiError(req, e)
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}

// تفاصيل وردية واحدة
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const t = await requireStore(req)
    const shift = await prisma.shift.findFirst({
      where: { id: params.id, storeId: t.storeId },
      include: {
        user:   { select: { name: true, role: true } },
        branch: { select: { name: true } },
        sales: {
          where: { status: 'COMPLETED' },
          select: {
            id: true, invoiceNumber: true, total: true, createdAt: true,
            payments: { select: { method: true, amount: true } },
          },
        },
      },
    })
    if (!shift) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })
    return NextResponse.json(shift)
  } catch (e) {
    await logApiError(req, e)
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
