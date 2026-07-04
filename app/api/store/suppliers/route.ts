import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStore, requireManager } from '@/lib/store-auth-helper'
import { logApiError } from '@/lib/logger'

export async function GET(req: NextRequest) {
  try {
    const t = await requireStore(req)
    requireManager(t)
    const suppliers = await prisma.supplier.findMany({
      where: { storeId: t.storeId },
      include: {
        _count: { select: { invoices: true } },
        invoices: { select: { date: true }, orderBy: { date: 'desc' }, take: 1 },
      },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(suppliers)
  } catch (e) {
    await logApiError(req, e)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const t    = await requireStore(req)
    requireManager(t)
    const body = await req.json()
    const { name, phone, address } = body
    if (!name?.trim()) return NextResponse.json({ error: 'اسم المورد مطلوب' }, { status: 400 })
    const supplier = await prisma.supplier.create({
      data: { name: name.trim(), phone: phone?.trim() || null, address: address?.trim() || null, storeId: t.storeId },
    })
    return NextResponse.json(supplier, { status: 201 })
  } catch (e) {
    await logApiError(req, e)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}