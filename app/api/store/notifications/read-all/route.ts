import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStore, requireManager } from '@/lib/store-auth-helper'

export async function PATCH(req: NextRequest) {
  try {
    const t = await requireStore(req)
    requireManager(t)

    await prisma.notification.updateMany({
      where: { storeId: t.storeId, targetRole: 'MANAGER', isRead: false },
      data: { isRead: true },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
