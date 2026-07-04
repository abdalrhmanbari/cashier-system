import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStore } from '@/lib/store-auth-helper'

// نسخة مختصرة من قائمة العملاء لاختيار عميل أثناء البيع الآجل في الـ POS — متاحة لأي مستخدم متجر (بما فيهم الكاشير)
export async function GET(req: NextRequest) {
  try {
    const t = await requireStore(req)
    const customers = await prisma.customer.findMany({
      where:   { storeId: t.storeId },
      select:  { id: true, name: true, phone: true, currentBalance: true },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(customers)
  } catch (e) {
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
