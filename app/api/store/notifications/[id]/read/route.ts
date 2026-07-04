import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStore, requireManager } from '@/lib/store-auth-helper'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const t = await requireStore(req)
    requireManager(t)

    const notification = await prisma.notification.findFirst({
      where: { id: params.id, storeId: t.storeId },
      select: { id: true },
    })
    if (!notification) return NextResponse.json({ error: 'الإشعار غير موجود' }, { status: 404 })

    const updated = await prisma.notification.update({
      where: { id: params.id },
      data: { isRead: true },
    })
    return NextResponse.json(updated)
  } catch (e) {
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
