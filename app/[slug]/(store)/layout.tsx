import { redirect } from 'next/navigation'
import { storeAuth } from '@/lib/auth-store'
import { prisma } from '@/lib/prisma'
import { getPlatformSettings, maintenanceCutoverAt } from '@/lib/maintenance'
import { checkSupplierInvoicesDue, checkSubscriptionExpiring } from '@/lib/notifications'
import AppSidebar from '@/components/shared/AppSidebar'
import { StoreHeader } from '@/components/shared/StoreHeader'
import { MaintenanceBanner } from '@/components/shared/MaintenanceBanner'
import StoreClientWrapper from '@/components/store/ClientWrapper'

interface Props {
  children: React.ReactNode
  params: { slug: string }
}

const ROLE_LABEL: Record<string, string> = {
  STORE_MANAGER: 'مدير المتجر',
  CASHIER:       'كاشير',
}

export default async function StoreLayout({ children, params }: Props) {
  const { slug } = params
  const session  = await storeAuth()

  if (!session || session.user.storeSlug !== slug) redirect(`/${slug}/login`)

  const store = await prisma.store.findUnique({
    where: { slug },
    select: {
      id: true, name: true, isActive: true,
      maintenanceMode: true, maintenanceMessage: true,
      subscription: { select: { status: true, endDate: true } },
    },
  })

  if (!store) redirect(`/${slug}/store-not-found`)
  if (!store.isActive) redirect(`/${slug}/suspended`)
  if (store.maintenanceMode) redirect(`/${slug}/maintenance`)

  const sub = store.subscription
  if (!sub) redirect(`/${slug}/suspended`)

  const expired = sub.status === 'EXPIRED' || (sub.status === 'ACTIVE' && sub.endDate < new Date())
  if (sub.status === 'SUSPENDED' || sub.status === 'CANCELLED') redirect(`/${slug}/suspended`)
  if (expired) redirect(`/${slug}/expired`)

  const platformSettings = await getPlatformSettings()
  let banner: { message: string; cutoverAt: string } | null = null
  if (platformSettings.maintenanceEnabled) {
    const activatedAt = platformSettings.maintenanceActivatedAt ?? new Date()
    const cutover = maintenanceCutoverAt(activatedAt, platformSettings.maintenanceGraceMinutes)
    if (Date.now() >= cutover.getTime()) redirect(`/${slug}/maintenance`)
    banner = { message: platformSettings.maintenanceMessage, cutoverAt: cutover.toISOString() }
  }

  const role = (session.user.role ?? 'CASHIER') as 'STORE_MANAGER' | 'CASHIER'

  // إشعارات لوحة المدير — best-effort، لا تُفشل تحميل الصفحة أبداً
  if (role === 'STORE_MANAGER') {
    await checkSupplierInvoicesDue(store.id)
    await checkSubscriptionExpiring(store.id, sub)
  }

  return (
    <StoreClientWrapper>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--diamond)' }} dir="rtl">
        {banner && <MaintenanceBanner message={banner.message} cutoverAt={banner.cutoverAt} />}
        {/* Top header */}
        <StoreHeader
          userName={session.user.name ?? ''}
          roleLabel={ROLE_LABEL[role] ?? 'مستخدم'}
          isManager={role === 'STORE_MANAGER'}
        />
        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <AppSidebar
            role={role}
            userName={session.user.name ?? ''}
            slug={slug}
            storeName={store.name}
          />
          <main className="pb-16 md:pb-0" style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>{children}</main>
        </div>
      </div>
    </StoreClientWrapper>
  )
}