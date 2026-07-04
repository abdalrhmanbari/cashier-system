import { SearchX } from 'lucide-react'
import { StatusPage } from '@/components/shared/StatusPage'

export default function SuperAdminNotFound() {
  return (
    <StatusPage
      icon={SearchX}
      iconColor="blue"
      title="الصفحة غير موجودة"
      description="الصفحة التي تبحث عنها غير موجودة أو تم نقلها."
      actionButton={{ label: 'العودة للوحة السوبر أدمن', href: '/super-admin' }}
    />
  )
}
