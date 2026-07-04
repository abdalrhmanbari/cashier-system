import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStore, requireManager } from '@/lib/store-auth-helper'
import { logApiError } from '@/lib/logger'
import { z } from 'zod'

const schema = z.object({
  type:       z.enum(['SALARY', 'ADVANCE', 'STORE']),
  amount:     z.number().int().min(1),
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

export async function GET(req: NextRequest) {
  try {
    const t = await requireStore(req)
    requireManager(t)
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const from = searchParams.get('from')
    const to   = searchParams.get('to')

    const expenses = await prisma.expense.findMany({
      where: {
        storeId: t.storeId,
        ...(type ? { type } : {}),
        ...(from || to ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
      },
      include: expenseInclude,
      orderBy: { date: 'desc' },
    })

    return NextResponse.json(expenses)
  } catch (e) {
    await logApiError(req, e)
    const err_ = e as Error & { status?: number }
    return err(err_.message, err_.status ?? 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const t = await requireStore(req)
    requireManager(t)
    const body = await req.json()
    const data = schema.parse(body)

    if ((data.type === 'SALARY' || data.type === 'ADVANCE') && !data.employeeId) {
      return err('اختر الموظف', 422)
    }

    const rateRow = await prisma.exchangeRate.findFirst({
      where:   { storeId: t.storeId },
      orderBy: { effectiveFrom: 'desc' },
    })
    if (!rateRow) return err('لا يوجد سعر صرف مسجل — أدخله من الإعدادات', 400)

    const expense = await prisma.expense.create({
      data: {
        type:       data.type,
        amount:     data.amount,
        exchangeRate:   rateRow.rate,
        amountUsdCents: Math.round((data.amount / rateRow.rate) * 100),
        title:      data.title || null,
        notes:      data.notes || null,
        date:       data.date ? new Date(data.date) : new Date(),
        employeeId: data.type === 'STORE' ? null : data.employeeId,
        branchId:   data.branchId || null,
        storeId:    t.storeId,
        userId:     t.id,
      },
      include: expenseInclude,
    })
    return NextResponse.json(expense, { status: 201 })
  } catch (e) {
    await logApiError(req, e)
    const err_ = e as Error & { status?: number }
    if (err_ instanceof z.ZodError) return err(err_.errors[0].message, 422)
    return err(err_.message, err_.status ?? 500)
  }
}
