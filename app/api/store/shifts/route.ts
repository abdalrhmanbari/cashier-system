import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStore } from '@/lib/store-auth-helper'
import { logApiError } from '@/lib/logger'

export async function GET(req: NextRequest) {
  try {
    const t = await requireStore(req)
    const { searchParams } = new URL(req.url)
    const myOnly = searchParams.get('mine') === 'true'

    const shifts = await prisma.shift.findMany({
      where: {
        storeId: t.storeId,
        ...(myOnly || t.role === 'CASHIER' ? { userId: t.id } : {}),
      },
      include: {
        user:   { select: { name: true, role: true } },
        branch: { select: { name: true } },
        _count: { select: { sales: true } },
      },
      orderBy: { openedAt: 'desc' },
      take: 50,
    })
    return NextResponse.json(shifts)
  } catch (e) {
    await logApiError(req, e)
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}

// فتح وردية جديدة
export async function POST(req: NextRequest) {
  try {
    const t = await requireStore(req)

    // تحقق أنه لا توجد وردية مفتوحة لهذا المستخدم
    const open = await prisma.shift.findFirst({
      where: { userId: t.id, status: 'OPEN' },
    })
    if (open) {
      return NextResponse.json({ error: 'لديك وردية مفتوحة بالفعل', shiftId: open.id }, { status: 409 })
    }

    const { openingCash, branchId: bodyBranchId } = await req.json()

    // المدير يمكنه اختيار الفرع من الطلب، الكاشير يستخدم فرعه المرتبط
    const resolvedBranchId =
      t.role === 'STORE_MANAGER' ? (bodyBranchId ?? t.branchId) : t.branchId

    if (!resolvedBranchId) {
      return NextResponse.json({ error: 'يرجى تحديد الفرع' }, { status: 400 })
    }

    // تأكد أن الفرع ينتمي لهذا المتجر
    const branch = await prisma.branch.findFirst({
      where: { id: resolvedBranchId, storeId: t.storeId },
    })
    if (!branch) {
      return NextResponse.json({ error: 'الفرع غير موجود' }, { status: 404 })
    }

    const shift = await prisma.shift.create({
      data: {
        storeId:     t.storeId,
        branchId:    resolvedBranchId,
        userId:      t.id,
        openingCash: openingCash ?? 0,
        status:      'OPEN',
      },
      include: {
        user:   { select: { name: true } },
        branch: { select: { name: true } },
      },
    })
    return NextResponse.json(shift, { status: 201 })
  } catch (e) {
    await logApiError(req, e)
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
