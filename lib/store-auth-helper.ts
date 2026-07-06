import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { syncExpiredStatus } from '@/lib/subscription'

export type StoreToken = {
  id: string
  role: string
  storeId: string
  storeSlug: string
  storeName: string
  branchId: string | null
}

// ══════════════════════════════════════════
// كاش قصير الأمد لحالة تفعيل المتجر/الاشتراك — بنفس روح كاش الصيانة بـ middleware.ts
// يتفادى استعلام Prisma إضافياً مع كل طلب API لنفس المتجر.
// ══════════════════════════════════════════
type StoreStatus = { blocked: false } | { blocked: true; reason: 'STORE_SUSPENDED' | 'SUBSCRIPTION_EXPIRED' }

const STATUS_CACHE_MS = 45_000
const storeStatusCache = new Map<string, { data: StoreStatus; expiresAt: number }>()

async function getStoreStatus(storeId: string): Promise<StoreStatus> {
  const cached = storeStatusCache.get(storeId)
  if (cached && cached.expiresAt > Date.now()) return cached.data

  await syncExpiredStatus(storeId)
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { isActive: true, subscription: { select: { status: true, endDate: true } } },
  })

  let data: StoreStatus
  if (!store || !store.isActive) {
    data = { blocked: true, reason: 'STORE_SUSPENDED' }
  } else {
    const sub = store.subscription
    const expired = !sub || sub.status === 'EXPIRED' || sub.status === 'SUSPENDED' || sub.status === 'CANCELLED'
      || (sub.status === 'ACTIVE' && sub.endDate < new Date())
    data = expired ? { blocked: true, reason: 'SUBSCRIPTION_EXPIRED' } : { blocked: false }
  }

  storeStatusCache.set(storeId, { data, expiresAt: Date.now() + STATUS_CACHE_MS })
  return data
}

export async function requireStore(req: NextRequest): Promise<StoreToken> {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: 'store.session-token',
  })
  if (!token) throw Object.assign(new Error('UNAUTHORIZED'), { status: 401 })

  const storeId = token.storeId as string
  const status = await getStoreStatus(storeId)
  if (status.blocked) {
    const message = status.reason === 'STORE_SUSPENDED'
      ? 'تم إيقاف هذا المتجر من قبل الإدارة'
      : 'انتهت صلاحية اشتراك المتجر، يرجى التجديد للمتابعة'
    throw Object.assign(new Error(status.reason), { status: 403, message })
  }

  return {
    id:        token.id        as string,
    role:      token.role      as string,
    storeId:   token.storeId   as string,
    storeSlug: token.storeSlug as string,
    storeName: token.storeName as string,
    branchId:  token.branchId  as string | null,
  }
}

export function requireManager(t: StoreToken) {
  if (t.role !== 'STORE_MANAGER') throw Object.assign(new Error('FORBIDDEN'), { status: 403 })
}
