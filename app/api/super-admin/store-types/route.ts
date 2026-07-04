import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

async function auth(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: 'super-admin.session-token' })
  if (!token) throw new Error('UNAUTHORIZED')
}

export async function GET(req: NextRequest) {
  try {
    await auth(req)
    const data = await prisma.storeType.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await auth(req)
    const { name, icon, description } = await req.json()
    const data = await prisma.storeType.create({ data: { name, icon, description } })
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    const msg = (err as Error).message
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: 'خطأ' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await auth(req)
    const { id, isActive } = await req.json()
    const data = await prisma.storeType.update({ where: { id }, data: { isActive } })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'خطأ' }, { status: 500 })
  }
}
