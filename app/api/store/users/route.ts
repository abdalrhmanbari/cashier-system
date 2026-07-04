import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStore, requireManager } from '@/lib/store-auth-helper'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const createSchema = z.object({
  name:     z.string().min(2),
  email:    z.string().email(),
  password: z.string().min(6),
  role:     z.enum(['STORE_MANAGER', 'CASHIER']),
  branchId: z.string().optional().nullable(),
})

const userSelect = {
  id: true, name: true, email: true, role: true,
  isActive: true, branchId: true, createdAt: true,
  branch: { select: { name: true } },
} as const

export async function GET(req: NextRequest) {
  try {
    const t     = await requireStore(req)
    requireManager(t)
    const users = await prisma.storeUser.findMany({
      where:   { storeId: t.storeId },
      select:  userSelect,
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(users)
  } catch (e) {
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const t    = await requireStore(req)
    requireManager(t)
    const body = await req.json()
    const data = createSchema.parse(body)

    const hashed = await bcrypt.hash(data.password, 12)
    const user   = await prisma.storeUser.create({
      data: {
        name:     data.name,
        email:    data.email,
        password: hashed,
        role:     data.role,
        branchId: data.branchId ?? null,
        storeId:  t.storeId,
      },
      select: userSelect,
    })
    return NextResponse.json(user, { status: 201 })
  } catch (e) {
    const err = e as Error & { status?: number }
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors[0].message }, { status: 422 })
    if (err.message?.includes('Unique')) return NextResponse.json({ error: 'البريد الإلكتروني مستخدم' }, { status: 409 })
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const t    = await requireStore(req)
    requireManager(t)
    const body = await req.json()
    const { id, isActive, name, email, password, role, branchId } = body

    // toggle-only path
    if (typeof isActive === 'boolean' && !name && !email && !role) {
      const user = await prisma.storeUser.update({
        where:  { id, storeId: t.storeId },
        data:   { isActive },
        select: userSelect,
      })
      return NextResponse.json(user)
    }

    // full edit path
    if (email && !z.string().email().safeParse(email).success) {
      return NextResponse.json({ error: 'بريد إلكتروني غير صالح' }, { status: 422 })
    }
    if (password && password.length < 6) {
      return NextResponse.json({ error: 'كلمة المرور 6 أحرف على الأقل' }, { status: 422 })
    }

    const data: Record<string, unknown> = {}
    if (name)                   data.name     = name
    if (email)                  data.email    = email
    if (role)                   data.role     = role
    if ('branchId' in body)     data.branchId = branchId ?? null
    if (typeof isActive === 'boolean') data.isActive = isActive
    if (password)               data.password = await bcrypt.hash(password, 12)

    const user = await prisma.storeUser.update({
      where:  { id, storeId: t.storeId },
      data,
      select: userSelect,
    })
    return NextResponse.json(user)
  } catch (e) {
    const err = e as Error & { status?: number }
    if (err.message?.includes('Unique')) return NextResponse.json({ error: 'البريد الإلكتروني مستخدم بالفعل' }, { status: 409 })
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
