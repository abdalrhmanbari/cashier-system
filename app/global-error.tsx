'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import './globals.css'
import { StatusPage } from '@/components/shared/StatusPage'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="ar" dir="rtl">
      <body>
        <StatusPage
          icon={AlertTriangle}
          iconColor="red"
          title="حدث خطأ غير متوقع"
          description="نعتذر عن هذا الخلل. جرّب إعادة المحاولة، وإن تكرر تواصل مع الدعم."
          actionButton={{ label: 'إعادة المحاولة', onClick: reset }}
        />
      </body>
    </html>
  )
}
