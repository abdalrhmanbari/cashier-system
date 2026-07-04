import { redirect } from 'next/navigation'
import { superAdminAuth } from '@/lib/auth-super-admin'
import { prisma } from '@/lib/prisma'
import { checkBackupStale, checkDiskSpaceLow, checkHighErrorRate, checkDbSizeWarning } from '@/lib/notifications'
import AppSidebar from '@/components/shared/AppSidebar'
import SuperAdminClientWrapper from '@/components/super-admin/ClientWrapper'
import { SuperAdminHeader } from '@/components/super-admin/SuperAdminHeader'

const ERROR_LOG_RETENTION_DAYS = 30

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await superAdminAuth()
  if (!session) redirect('/super-admin/login')

  // تنبيهات منصّة + احتفاظ ErrorLog — best-effort، لا تُفشل تحميل اللوحة أبداً
  await Promise.all([
    checkBackupStale(),
    checkDiskSpaceLow(),
    checkHighErrorRate(),
    checkDbSizeWarning(),
    prisma.errorLog
      .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - ERROR_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000) } } })
      .catch(e => console.error('[error-log-retention]', e)),
  ])

  return (
    <SuperAdminClientWrapper>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--diamond)' }} dir="rtl">
        <SuperAdminHeader userName={session.user.name ?? ''} />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <AppSidebar
            role="SUPER_ADMIN"
            userName={session.user.name ?? ''}
          />
          <main style={{ flex: 1, overflowY: 'auto', minWidth: 0, padding: '24px' }}>{children}</main>
        </div>
      </div>
    </SuperAdminClientWrapper>
  )
}
