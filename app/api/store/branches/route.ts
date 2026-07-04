import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStore, requireManager } from '@/lib/store-auth-helper'

export async function GET(req: NextRequest) {
  try {
    const t        = await requireStore(req)
    requireManager(t)
    const branches = await prisma.branch.findMany({
      where:   { storeId: t.storeId },
      include: { _count: { select: { users: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(branches)
  } catch (e) {
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const t    = await requireStore(req)
    requireManager(t)
    const { id, isActive } = await req.json()
    const branch = await prisma.branch.update({
      where: { id, storeId: t.storeId },
      data:  { isActive },
    })
    return NextResponse.json(branch)
  } catch (e) {
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
