'use client'

import { SearchX } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { StatusPage } from '@/components/shared/StatusPage'

export default function StoreNotFound() {
  const pathname = usePathname()
  const slug = pathname.split('/').filter(Boolean)[0] ?? ''

  return (
    <StatusPage
      icon={SearchX}
      iconColor="blue"
      title="الصفحة غير موجودة"
      description="الصفحة التي تبحث عنها غير موجودة أو تم نقلها."
      actionButton={{ label: 'العودة لنقطة البيع', href: `/${slug}` }}
    />
  )
}
