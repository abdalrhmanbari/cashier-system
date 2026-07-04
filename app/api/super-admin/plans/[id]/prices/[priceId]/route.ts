import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

async function auth(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: 'super-admin.session-token' })
  if (!token) throw new Error('UNAUTHORIZED')
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; priceId: string } },
) {
  try {
    await auth(req)
    const { billingCycle, minBranches, maxBranches, priceUsd, discountPct } = await req.json()
    const data: Record<string, unknown> = {}
    if (billingCycle !== undefined) data.billingCycle = billingCycle
    if (minBranches !== undefined) data.minBranches = Number(minBranches)
    if (maxBranches !== undefined) data.maxBranches = maxBranches ? Number(maxBranches) : null
    if (priceUsd !== undefined) data.priceUsd = Math.round(Number(priceUsd) * 100)
    if (discountPct !== undefined) data.discountPct = Number(discountPct)
    const price = await prisma.planPrice.update({ where: { id: params.priceId }, data })
    return NextResponse.json(price)
  } catch (err) {
    const msg = (err as Error).message
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; priceId: string } },
) {
  try {
    await auth(req)
    await prisma.planPrice.delete({ where: { id: params.priceId } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = (err as Error).message
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
