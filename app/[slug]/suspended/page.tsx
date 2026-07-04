import { PauseCircle } from 'lucide-react'
import { StatusPage } from '@/components/shared/StatusPage'

export default function SuspendedPage() {
  return (
    <StatusPage
      icon={PauseCircle}
      iconColor="amber"
      title="المتجر موقوف مؤقتاً"
      description="تم إيقاف هذا المتجر من قبل إدارة المنصة. يرجى التواصل مع الدعم الفني."
    />
  )
}
