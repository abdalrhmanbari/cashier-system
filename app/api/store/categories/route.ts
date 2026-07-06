import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStore, requireManager } from '@/lib/store-auth-helper'

export async function GET(req: NextRequest) {
  try {
    const t    = await requireStore(req)
    const cats = await prisma.category.findMany({
      where:   { storeId: t.storeId },
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(cats)
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const t    = await requireStore(req)
    requireManager(t)
    const { name, color, imageUrl } = await req.json()
    const cat = await prisma.category.create({
      data: { name, color: color ?? '#6366f1', imageUrl: imageUrl || null, storeId: t.storeId },
    })
    return NextResponse.json(cat, { status: 201 })
  } catch (e) {
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
