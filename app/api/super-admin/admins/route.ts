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
  name:     z.string().min(2),
  email:    z.string().email(),
  password: z.string().min(8),
})

const updateSchema = z.object({
  id:       z.string().min(1),
  name:     z.string().min(2).optional(),
  email:    z.string().email().optional(),
  password: z.string().min(8).optional(),
})

export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req)

    const admins = await prisma.superAdmin.findMany({
      select: { id: true, name: true, email: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(admins)
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

    const admin = await prisma.superAdmin.create({
      data:   { name: data.name, email: data.email, password: hashed },
      select: { id: true, name: true, email: true, createdAt: true },
    })

    return NextResponse.json(admin, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 422 })
    }
    const msg = (err as Error).message
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ error: 'البريد الإلكتروني مستخدم بالفعل' }, { status: 409 })
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
    if (data.name  !== undefined) updateData.name  = data.name
    if (data.email !== undefined) updateData.email = data.email
    if (data.password) updateData.password = await bcrypt.hash(data.password, 12)

    const admin = await prisma.superAdmin.update({
      where:  { id: data.id },
      data:   updateData,
      select: { id: true, name: true, email: true, createdAt: true },
    })

    return NextResponse.json(admin)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 422 })
    }
    const msg = (err as Error).message
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ error: 'البريد الإلكتروني مستخدم بالفعل' }, { status: 409 })
    }
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
