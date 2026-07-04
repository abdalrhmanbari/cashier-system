import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

async function requireSuperAdmin(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: 'super-admin.session-token',
  })
  if (!token) throw new Error('UNAUTHORIZED')
}

const createSchema = z.object({
  storeId:  z.string().min(1),
  name:     z.string().min(2),
  email:    z.string().email(),
  password: z.string().min(8),
  role:     z.enum(['STORE_MANAGER', 'CASHIER']),
  branchId: z.string().optional(),
})

const updateSchema = z.object({
  id:       z.string().min(1),
  name:     z.string().min(2).optional(),
  email:    z.string().email().optional(),
  password: z.string().min(8).optional(),
  role:     z.enum(['STORE_MANAGER', 'CASHIER']).optional(),
  branchId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req)

    const { searchParams } = new URL(req.url)
    const storeId = searchParams.get('storeId') || undefined
    const role    = searchParams.get('role')    || undefined

    const users = await prisma.storeUser.findMany({
      where: {
        ...(storeId ? { storeId } : {}),
        ...(role    ? { role }    : {}),
      },
      select: {
        id:        true,
        name:      true,
        email:     true,
        role:      true,
        isActive:  true,
        createdAt: true,
        store:     { select: { id: true, name: true, slug: true } },
        branch:    { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(users)
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSuperAdmin(req)
    const body = await req.json()
    const data = createSchema.parse(body)

    const hashed = await bcrypt.hash(data.password, 12)

    const user = await prisma.storeUser.create({
      data: {
        storeId:  data.storeId,
        name:     data.name,
        email:    data.email,
        password: hashed,
        role:     data.role,
        branchId: data.branchId || null,
      },
      select: {
        id:        true,
        name:      true,
        email:     true,
        role:      true,
        isActive:  true,
        createdAt: true,
        store:     { select: { id: true, name: true, slug: true } },
        branch:    { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(user, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 422 })
    }
    const msg = (err as Error).message
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ error: 'البريد الإلكتروني مستخدم بالفعل في هذا المتجر' }, { status: 409 })
    }
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireSuperAdmin(req)
    const body = await req.json()
    const data = updateSchema.parse(body)

    const updateData: Record<string, unknown> = {}
    if (data.name     !== undefined) updateData.name     = data.name
    if (data.email    !== undefined) updateData.email    = data.email
    if (data.role     !== undefined) updateData.role     = data.role
    if (data.isActive !== undefined) updateData.isActive = data.isActive
    if (data.branchId !== undefined) updateData.branchId = data.branchId
    if (data.password) updateData.password = await bcrypt.hash(data.password, 12)

    const user = await prisma.storeUser.update({
      where: { id: data.id },
      data:  updateData,
      select: {
        id:        true,
        name:      true,
        email:     true,
        role:      true,
        isActive:  true,
        createdAt: true,
        store:     { select: { id: true, name: true, slug: true } },
        branch:    { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(user)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 422 })
    }
    const msg = (err as Error).message
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireSuperAdmin(req)
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 422 })

    await prisma.storeUser.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = (err as Error).message
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
