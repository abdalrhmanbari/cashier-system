'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { StatusPage } from '@/components/shared/StatusPage'

export default function SuperAdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <StatusPage
      icon={AlertTriangle}
      iconColor="red"
      title="حدث خطأ غير متوقع"
      description="نعتذر عن هذا الخلل. جرّب إعادة المحاولة، وإن تكرر تواصل مع الدعم."
      actionButton={{ label: 'إعادة المحاولة', onClick: reset }}
    />
  )
}
