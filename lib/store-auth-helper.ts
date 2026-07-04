import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export type StoreToken = {
  id: string
  role: string
  storeId: string
  storeSlug: string
  storeName: string
  branchId: string | null
}

export async function requireStore(req: NextRequest): Promise<StoreToken> {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: 'store.session-token',
  })
  if (!token) throw Object.assign(new Error('UNAUTHORIZED'), { status: 401 })
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
