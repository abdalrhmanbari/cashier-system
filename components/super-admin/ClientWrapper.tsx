'use client'

import { SessionProvider } from 'next-auth/react'
import { NotificationProvider } from '@/components/shared/NotificationContext'

export default function SuperAdminClientWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider basePath="/api/super-admin-auth">
      <NotificationProvider scope="super-admin">
        {children}
      </NotificationProvider>
    </SessionProvider>
  )
}
