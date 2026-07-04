import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export const {
  handlers: superAdminHandlers,
  auth: superAdminAuth,
  signIn: superAdminSignIn,
  signOut: superAdminSignOut,
} = NextAuth({
  basePath: '/api/super-admin-auth',
  providers: [
    Credentials({
      credentials: {
        email:    { type: 'email' },
        password: { type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const admin = await prisma.superAdmin.findUnique({
          where: { email: credentials.email as string },
          select: { id: true, name: true, email: true, password: true },
        })

        if (!admin) return null

        const valid = await bcrypt.compare(credentials.password as string, admin.password)
        if (!valid) return null

        return { id: admin.id, name: admin.name, email: admin.email }
      },
    }),
  ],
  cookies: {
    sessionToken: {
      name: 'super-admin.session-token',
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
        token.id   = user.id
        token.type = 'SUPER_ADMIN'
      }
      return token
    },
    async session({ session, token }) {
      session.user.id   = token.id as string
      session.user.type = 'SUPER_ADMIN'
      return session
    },
  },
  pages: {
    signIn: '/super-admin/login',
    error:  '/super-admin/login',
  },
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
})

// نوع الجلسة موحّد في auth-store.ts
