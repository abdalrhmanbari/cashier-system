import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStore, requireManager } from '@/lib/store-auth-helper'
import { logApiError } from '@/lib/logger'
import { z } from 'zod'

const updateSchema = z.object({
  type:       z.enum(['SALARY', 'ADVANCE', 'STORE']).optional(),
  amount:     z.number().int().min(1).optional(),
  title:      z.string().optional().nullable(),
  notes:      z.string().optional().nullable(),
  date:       z.string().optional(),
  employeeId: z.string().optional().nullable(),
  branchId:   z.string().optional().nullable(),
})

function err(msg: string, status = 500) {
  return NextResponse.json({ error: msg }, { status })
}

const expenseInclude = {
  employee: { select: { id: true, name: true } },
  user:     { select: { id: true, name: true } },
  branch:   { select: { id: true, name: true } },
} as const

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const t = await requireStore(req)
    requireManager(t)
    const body = await req.json()
    const data = updateSchema.parse(body)

    // إعادة حساب سعر الصرف والمعادل الدولاري فقط عند تغيير المبلغ فعلياً
    let usdFields: { exchangeRate: number; amountUsdCents: number } | undefined
    if (data.amount !== undefined) {
      const rateRow = await prisma.exchangeRate.findFirst({
        where:   { storeId: t.storeId },
        orderBy: { effectiveFrom: 'desc' },
      })
      if (!rateRow) return err('لا يوجد سعر صرف مسجل — أدخله من الإعدادات', 400)
      usdFields = { exchangeRate: rateRow.rate, amountUsdCents: Math.round((data.amount / rateRow.rate) * 100) }
    }

    const expense = await prisma.expense.update({
      where: { id: params.id, storeId: t.storeId },
      data: {
        ...(data.type       !== undefined ? { type: data.type }                                   : {}),
        ...(data.amount     !== undefined ? { amount: data.amount }                                : {}),
        ...(usdFields ?? {}),
        ...(data.title      !== undefined ? { title: data.title || null }                          : {}),
        ...(data.notes      !== undefined ? { notes: data.notes || null }                          : {}),
        ...(data.date       !== undefined ? { date: new Date(data.date) }                          : {}),
        ...(data.employeeId !== undefined ? { employeeId: data.employeeId || null }                : {}),
        ...(data.branchId   !== undefined ? { branchId: data.branchId || null }                    : {}),
      },
      include: expenseInclude,
    })
    return NextResponse.json(expense)
  } catch (e) {
    await logApiError(req, e)
    const err_ = e as Error & { status?: number }
    if (err_ instanceof z.ZodError) return err(err_.errors[0].message, 422)
    return err(err_.message, err_.status ?? 500)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const t = await requireStore(req)
    requireManager(t)
    await prisma.expense.delete({ where: { id: params.id, storeId: t.storeId } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    await logApiError(req, e)
    const err_ = e as Error & { status?: number }
    return err(err_.message, err_.status ?? 500)
  }
}
