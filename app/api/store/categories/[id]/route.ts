import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStore, requireManager } from '@/lib/store-auth-helper'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const t = await requireStore(req)
    requireManager(t)
    const { name, color } = await req.json()
    const cat = await prisma.category.update({
      where: { id: params.id, storeId: t.storeId },
      data: { name, color },
    })
    return NextResponse.json(cat)
  } catch (e) {
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const t = await requireStore(req)
    requireManager(t)
    await prisma.category.delete({
      where: { id: params.id, storeId: t.storeId },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
