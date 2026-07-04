'use client'

import { SessionProvider } from 'next-auth/react'
import { ExchangeRateProvider } from '@/components/shared/ExchangeRateContext'
import { NotificationProvider } from '@/components/shared/NotificationContext'
import { ConnectionToast } from '@/components/shared/ConnectionToast'

export default function StoreClientWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider basePath="/api/store-auth">
      <ExchangeRateProvider>
        <NotificationProvider>
          {children}
          <ConnectionToast />
        </NotificationProvider>
      </ExchangeRateProvider>
    </SessionProvider>
  )
}
