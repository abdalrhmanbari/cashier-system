import { redirect } from 'next/navigation'
import { Wrench } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getPlatformSettings } from '@/lib/maintenance'
import { StatusPage } from '@/components/shared/StatusPage'

interface Props {
  params: { slug: string }
}

export default async function MaintenancePage({ params }: Props) {
  const [settings, store] = await Promise.all([
    getPlatformSettings(),
    prisma.store.findUnique({
      where:  { slug: params.slug },
      select: { maintenanceMode: true, maintenanceMessage: true },
    }),
  ])

  const storeLevel = store?.maintenanceMode ?? false

  // الصيانة انتهت فعلياً (أُوقفت من لوحة الإدارة) — لا تُبقِ المستخدم عالقاً هنا
  if (!storeLevel && !settings.maintenanceEnabled) {
    redirect(`/${params.slug}`)
  }

  const message = storeLevel
    ? (store?.maintenanceMessage || settings.maintenanceMessage)
    : settings.maintenanceMessage
  const endsAt = !storeLevel && settings.maintenanceEndsAt ? settings.maintenanceEndsAt : null

  return (
    <StatusPage
      icon={Wrench}
      iconColor="amber"
      title="النظام تحت الصيانة"
      description={message}
      extra={endsAt && (
        <p className="text-sm" style={{ color: 'var(--text-m)' }}>
          الوقت المتوقع للعودة: {new Date(endsAt).toLocaleString('ar-SA')}
        </p>
      )}
      actionButton={{ label: 'إعادة المحاولة', href: `/${params.slug}/maintenance` }}
    />
  )
}
