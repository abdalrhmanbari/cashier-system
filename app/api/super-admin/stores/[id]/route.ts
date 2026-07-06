import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

async function requireSuperAdmin(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: 'super-admin.session-token',
  })
  if (!token) throw new Error('UNAUTHORIZED')
  return token
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSuperAdmin(req)
    const store = await prisma.store.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        storeType: { select: { name: true, icon: true } },
      },
    })
    return NextResponse.json(store)
  } catch (err) {
    const msg = (err as Error).message
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: 'غير موجود' }, { status: 404 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = await requireSuperAdmin(req)
    const body = await req.json()

    const allowed = ['name', 'phone', 'address', 'isActive', 'storeTypeId', 'maintenanceMode', 'maintenanceMessage']
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) data[key] = body[key]
    }

    const before = 'maintenanceMode' in data
      ? await prisma.store.findUnique({ where: { id: params.id }, select: { maintenanceMode: true } })
      : null

    const store = await prisma.store.update({
      where: { id: params.id },
      data,
    })

    if (before && before.maintenanceMode !== store.maintenanceMode) {
      const admin = await prisma.superAdmin.findUnique({ where: { id: token.id as string }, select: { name: true, email: true } })
      try {
        await prisma.auditLog.create({
          data: {
            action:     store.maintenanceMode ? 'ENABLE_STORE_MAINTENANCE' : 'DISABLE_STORE_MAINTENANCE',
            resource:   'STORE',
            resourceId: store.id,
            storeId:    store.id,
            superAdminId: token.id as string,
            newData:    JSON.stringify({ adminName: admin?.name, adminEmail: admin?.email, message: store.maintenanceMessage }),
          },
        })
      } catch (e) {
        logger.error('فشل تسجيل AuditLog', { action: 'STORE_MAINTENANCE_TOGGLE', storeId: store.id, err: (e as Error)?.message })
      }
    }

    return NextResponse.json(store)
  } catch (err) {
    const msg = (err as Error).message
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
