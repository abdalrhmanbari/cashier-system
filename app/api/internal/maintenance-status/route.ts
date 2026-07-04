import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPlatformSettings } from '@/lib/maintenance'

// يُستدعى من middleware.ts فقط (بيئة Edge لا تدعم Prisma+SQLite مباشرة) — بيانات غير حساسة، لا حاجة لمصادقة
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const slug    = searchParams.get('slug')
  const storeId = searchParams.get('storeId')

  const [settings, store] = await Promise.all([
    getPlatformSettings(),
    slug || storeId
      ? prisma.store.findUnique({
          where:  slug ? { slug } : { id: storeId! },
          select: { maintenanceMode: true, maintenanceMessage: true },
        })
      : Promise.resolve(null),
  ])

  return NextResponse.json({
    global: {
      enabled:      settings.maintenanceEnabled,
      message:      settings.maintenanceMessage,
      endsAt:       settings.maintenanceEndsAt,
      activatedAt:  settings.maintenanceActivatedAt,
      graceMinutes: settings.maintenanceGraceMinutes,
    },
    store: store
      ? { maintenanceMode: store.maintenanceMode, maintenanceMessage: store.maintenanceMessage }
      : null,
    storeExists: slug || storeId ? store !== null : null,
  })
}
