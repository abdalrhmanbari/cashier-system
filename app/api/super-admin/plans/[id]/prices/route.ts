import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

async function auth(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: 'super-admin.session-token' })
  if (!token) throw new Error('UNAUTHORIZED')
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await auth(req)
    const { billingCycle, minBranches, maxBranches, priceUsd, discountPct } = await req.json()
    const price = await prisma.planPrice.create({
      data: {
        planId: params.id,
        billingCycle,
        minBranches: Number(minBranches),
        maxBranches: maxBranches ? Number(maxBranches) : null,
        priceUsd: Math.round(Number(priceUsd) * 100),
        discountPct: Number(discountPct ?? 0),
      },
    })
    return NextResponse.json(price, { status: 201 })
  } catch (err) {
    const msg = (err as Error).message
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: 'خطأ — قد تكون الشريحة مكررة' }, { status: 400 })
  }
}
