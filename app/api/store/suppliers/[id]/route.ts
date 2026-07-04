import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStore, requireManager } from '@/lib/store-auth-helper'
import { logApiError } from '@/lib/logger'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const t = await requireStore(req)
    requireManager(t)
    const supplier = await prisma.supplier.findUnique({
      where: { id: params.id, storeId: t.storeId },
      include: {
        _count: { select: { invoices: true } },
        invoices: {
          include: {
            items: { include: { product: { select: { id: true, name: true } } } },
            payments: true,
          },
          orderBy: { date: 'desc' },
        },
      },
    })
    if (!supplier) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(supplier)
  } catch (e) {
    await logApiError(req, e)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const t    = await requireStore(req)
    requireManager(t)
    const body = await req.json()
    const { name, phone, address } = body
    const supplier = await prisma.supplier.update({
      where: { id: params.id, storeId: t.storeId },
      data: { name: name?.trim(), phone: phone?.trim() || null, address: address?.trim() || null },
    })
    return NextResponse.json(supplier)
  } catch (e) {
    await logApiError(req, e)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const t = await requireStore(req)
    requireManager(t)
    await prisma.supplier.delete({ where: { id: params.id, storeId: t.storeId } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    await logApiError(req, e)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}