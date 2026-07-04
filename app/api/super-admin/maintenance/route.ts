import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { getPlatformSettings, GRACE_MINUTES_OPTIONS } from '@/lib/maintenance'
import { z } from 'zod'

async function requireSuperAdmin(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: 'super-admin.session-token',
  })
  if (!token) throw new Error('UNAUTHORIZED')
  return token
}

export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req)
    const [settings, activeStoreCount] = await Promise.all([
      getPlatformSettings(),
      prisma.store.count({
        where: { isActive: true, subscription: { status: { in: ['ACTIVE', 'TRIAL'] } } },
      }),
    ])
    return NextResponse.json({ ...settings, activeStoreCount })
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
}

const schema = z.object({
  enabled:      z.boolean(),
  message:      z.string().trim().min(1).max(500).optional(),
  endsAt:       z.string().datetime().nullable().optional(),
  graceMinutes: z.number().int().refine(v => (GRACE_MINUTES_OPTIONS as readonly number[]).includes(v)).optional(),
})

export async function PATCH(req: NextRequest) {
  try {
    const token = await requireSuperAdmin(req)
    const body = await req.json()
    const data = schema.parse(body)

    const admin = await prisma.superAdmin.findUnique({
      where:  { id: token.id as string },
      select: { name: true, email: true },
    })

    const current = await getPlatformSettings()

    const updated = await prisma.platformSetting.update({
      where: { id: 'singleton' },
      data: {
        maintenanceEnabled: data.enabled,
        ...(data.message      !== undefined ? { maintenanceMessage: data.message } : {}),
        ...(data.endsAt       !== undefined ? { maintenanceEndsAt: data.endsAt ? new Date(data.endsAt) : null } : {}),
        ...(data.graceMinutes !== undefined ? { maintenanceGraceMinutes: data.graceMinutes } : {}),
        // نضبط لحظة التفعيل فقط عند التحوّل من معطّل إلى مفعّل — الحساب في السيرفر دائماً
        ...(data.enabled && !current.maintenanceEnabled ? { maintenanceActivatedAt: new Date() } : {}),
        ...(!data.enabled ? { maintenanceActivatedAt: null } : {}),
      },
    })

    if (data.enabled !== current.maintenanceEnabled) {
      const activeStoreCount = await prisma.store.count({
        where: { isActive: true, subscription: { status: { in: ['ACTIVE', 'TRIAL'] } } },
      })
      await prisma.auditLog.create({
        data: {
          action:   data.enabled ? 'ENABLE_MAINTENANCE' : 'DISABLE_MAINTENANCE',
          resource: 'PLATFORM_SETTING',
          newData: JSON.stringify({
            adminName: admin?.name, adminEmail: admin?.email,
            message: updated.maintenanceMessage, endsAt: updated.maintenanceEndsAt,
            graceMinutes: updated.maintenanceGraceMinutes, activeStoreCount,
          }),
        },
      })
    }

    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 422 })
    }
    const msg = (err as Error).message
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
