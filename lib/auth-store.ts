import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

const LOCKOUT_ATTEMPTS = 5
const LOCKOUT_MINUTES  = 15

async function failedAttempts(email: string) {
  const since = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000)
  return prisma.loginAttempt.count({
    where: { email, success: false, createdAt: { gte: since } },
  })
}

async function record(email: string, success: boolean, ip?: string) {
  await prisma.loginAttempt.create({ data: { email, success, ip } })
}

export const {
  handlers: storeHandlers,
  auth: storeAuth,
  signIn: storeSignIn,
  signOut: storeSignOut,
} = NextAuth({
  basePath: '/api/store-auth',
  providers: [
    Credentials({
      credentials: {
        email:    { type: 'email' },
        password: { type: 'password' },
        slug:     { type: 'text' },
        ip:       { type: 'text' },
      },
      async authorize(credentials) {
        const { email, password, slug, ip } = credentials as Record<string, string>
        if (!email || !password || !slug) return null

        if ((await failedAttempts(email)) >= LOCKOUT_ATTEMPTS) {
          await record(email, false, ip)
          throw new Error('LOCKED')
        }

        const user = await prisma.storeUser.findFirst({
          where: {
            email,
            store: { slug },
            isActive: true,
          },
          select: {
            id: true, name: true, email: true,
            password: true, role: true,
            branchId: true,
            store: { select: { id: true, slug: true, name: true } },
          },
        })

        if (!user) {
          await record(email, false, ip)
          return null
        }

        const valid = await bcrypt.compare(password, user.password)
        if (!valid) {
          await record(email, false, ip)
          return null
        }

        await record(email, true, ip)

        return {
          id:        user.id,
          name:      user.name,
          email:     user.email,
          role:      user.role,
          storeId:   user.store.id,
          storeSlug: user.store.slug,
          storeName: user.store.name,
          branchId:  user.branchId,
        }
      },
    }),
  ],
  cookies: {
    sessionToken: {
      name: 'store.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as typeof user & {
          role: string; storeId: string; storeSlug: string
          storeName: string; branchId: string | null
        }
        token.id        = u.id
        token.type      = 'STORE_USER'
        token.role      = u.role
        token.storeId   = u.storeId
        token.storeSlug = u.storeSlug
        token.storeName = u.storeName
        token.branchId  = u.branchId
      }
      return token
    },
    async session({ session, token }) {
      session.user.id        = token.id        as string
      session.user.type      = 'STORE_USER'
      session.user.role      = token.role      as string
      session.user.storeId   = token.storeId   as string
      session.user.storeSlug = token.storeSlug as string
      session.user.storeName = token.storeName as string
      session.user.branchId  = token.branchId  as string | null
      return session
    },
  },
  pages: {
    // لا نضع signIn هنا لأن كل متجر له مسار تسجيل دخول مختلف
  },
  session: { strategy: 'jwt', maxAge: 12 * 60 * 60 }, // 12 ساعة = وردية + هامش
})

declare module 'next-auth' {
  interface Session {
    user: {
      id:         string
      name:       string
      email:      string
      // SUPER_ADMIN: 'SUPER_ADMIN' | STORE_USER: 'STORE_USER'
      type:       string
      // حقول المتجر — موجودة فقط في STORE_USER
      role?:      string
      storeId?:   string
      storeSlug?: string
      storeName?: string
      branchId?:  string | null
    }
  }
}
