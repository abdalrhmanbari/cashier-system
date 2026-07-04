import { Lock } from 'lucide-react'
import { StatusPage } from '@/components/shared/StatusPage'

interface Props {
  params: { slug: string }
}

export default function ForbiddenPage({ params }: Props) {
  return (
    <StatusPage
      icon={Lock}
      iconColor="orange"
      title="غير مصرح لك بالوصول"
      description="هذه الصفحة تتطلب صلاحيات أعلى."
      actionButton={{ label: 'العودة لنقطة البيع', href: `/${params.slug}/pos` }}
    />
  )
}
