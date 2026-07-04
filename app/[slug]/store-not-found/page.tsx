import { Link2Off } from 'lucide-react'
import { StatusPage } from '@/components/shared/StatusPage'

export default function StoreNotFoundPage() {
  return (
    <StatusPage
      icon={Link2Off}
      iconColor="blue"
      title="المتجر غير موجود"
      description="تأكد من صحة الرابط."
    />
  )
}
