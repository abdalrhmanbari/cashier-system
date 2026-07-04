import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

async function requireSuperAdmin(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: 'super-admin.session-token',
  })
  if (!token) throw new Error('UNAUTHORIZED')
}

const createSchema = z.object({
  name:            z.string().min(2),
  slug:            z.string().min(2).regex(/^[a-z0-9-]+$/, 'slug: أحرف صغيرة وأرقام وشرطة فقط'),
  phone:           z.string().optional(),
  address:         z.string().optional(),
  storeTypeId:     z.string(),
  planId:          z.string(),
  billingCycle:    z.enum(['MONTHLY', 'YEARLY']),
  branchCount:     z.number().int().min(1).default(1),
  managerName:     z.string().min(2),
  managerEmail:    z.string().email('بريد إلكتروني غير صالح'),
  managerPassword: z.string().min(8, 'كلمة المرور 8 أحرف على الأقل'),
  branchName:      z.string().min(2).optional(),
  branchAddress:   z.string().optional(),
  branchPhone:     z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req)
    const stores = await prisma.store.findMany({
      include: {
        storeType:    { select: { name: true, icon: true } },
        subscription: { select: { status: true, endDate: true, plan: { select: { name: true } } } },
        _count:       { select: { branches: true, users: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(stores)
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSuperAdmin(req)
    const body = await req.json()
    const data = createSchema.parse(body)

    // حساب السعر
    const plan = await prisma.plan.findUnique({
      where: { id: data.planId },
      include: { prices: true },
    })
    if (!plan) return NextResponse.json({ error: 'الخطة غير موجودة' }, { status: 400 })

    const priceRow = plan.prices
      .filter(p => p.billingCycle === data.billingCycle)
      .filter(p => p.minBranches <= data.branchCount)
      .filter(p => !p.maxBranches || p.maxBranches >= data.branchCount)
      .sort((a, b) => b.minBranches - a.minBranches)[0]

    if (!priceRow) {
      return NextResponse.json({ error: 'لا يوجد سعر لهذا الخيار' }, { status: 400 })
    }

    const base     = priceRow.priceUsd * data.branchCount
    const discount = Math.round(base * priceRow.discountPct / 100)
    const priceUsd = base - discount

    const endDate = new Date()
    if (data.billingCycle === 'MONTHLY') endDate.setMonth(endDate.getMonth() + 1)
    else endDate.setFullYear(endDate.getFullYear() + 1)

    const hashedPassword = await bcrypt.hash(data.managerPassword, 12)

    const store = await prisma.store.create({
      data: {
        name:        data.name,
        slug:        data.slug,
        phone:       data.phone,
        address:     data.address,
        storeTypeId: data.storeTypeId,
        branches: {
          create: [{
            name:    data.branchName?.trim()    || 'الفرع الرئيسي',
            address: data.branchAddress?.trim() || null,
            phone:   data.branchPhone?.trim()   || null,
          }],
        },
        subscription: {
          create: {
            planId:      data.planId,
            billingCycle: data.billingCycle,
            branchCount: data.branchCount,
            priceUsd,
            endDate,
            status: 'ACTIVE',
          },
        },
        users: {
          create: [{
            name:     data.managerName,
            email:    data.managerEmail,
            password: hashedPassword,
            role:     'STORE_MANAGER',
          }],
        },
      },
      include: { subscription: true },
    })

    return NextResponse.json(store, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 422 })
    }
    const msg = (err as Error).message
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    if (msg.includes('Unique constraint') || msg.includes('slug')) {
      return NextResponse.json({ error: 'الـ slug مستخدم بالفعل' }, { status: 409 })
    }
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
