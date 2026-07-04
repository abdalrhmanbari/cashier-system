import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

async function requireSuperAdmin(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: 'super-admin.session-token',
  })
  if (!token) throw new Error('UNAUTHORIZED')
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSuperAdmin(req)
    const branches = await prisma.branch.findMany({
      where:   { storeId: params.id },
      include: { _count: { select: { users: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(branches)
  } catch (err) {
    const msg = (err as Error).message
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSuperAdmin(req)
    const { name, address, phone } = await req.json()
    if (!name || name.trim().length < 2) {
      return NextResponse.json({ error: 'اسم الفرع مطلوب (حرفان على الأقل)' }, { status: 422 })
    }
    const branch = await prisma.branch.create({
      data: {
        name:    name.trim(),
        address: address?.trim() || null,
        phone:   phone?.trim()   || null,
        storeId: params.id,
      },
    })
    return NextResponse.json(branch, { status: 201 })
  } catch (err) {
    const msg = (err as Error).message
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
