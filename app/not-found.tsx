import { SearchX } from 'lucide-react'
import { StatusPage } from '@/components/shared/StatusPage'

export default function NotFound() {
  return (
    <StatusPage
      icon={SearchX}
      iconColor="blue"
      title="الصفحة غير موجودة"
      description="الصفحة التي تبحث عنها غير موجودة أو تم نقلها."
      actionButton={{ label: 'الصفحة الرئيسية', href: '/' }}
    />
  )
}
