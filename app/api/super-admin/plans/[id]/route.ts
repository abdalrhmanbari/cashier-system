import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

async function auth(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: 'super-admin.session-token' })
  if (!token) throw new Error('UNAUTHORIZED')
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await auth(req)
    const { name, description, isActive } = await req.json()
    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (description !== undefined) data.description = description
    if (isActive !== undefined) data.isActive = isActive
    const plan = await prisma.plan.update({ where: { id: params.id }, data })
    return NextResponse.json(plan)
  } catch (err) {
    const msg = (err as Error).message
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await auth(req)
    await prisma.plan.update({ where: { id: params.id }, data: { isActive: false } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = (err as Error).message
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
