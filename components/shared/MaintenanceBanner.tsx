'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  message: string
  // ISO — لحظة قطع الجلسات النشطة (وقت التفعيل + مهلة السماح)، محسوبة بالسيرفر
  cutoverAt: string
}

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function MaintenanceBanner({ message, cutoverAt }: Props) {
  const cutoverMs = new Date(cutoverAt).getTime()
  const [remaining, setRemaining] = useState(() => cutoverMs - Date.now())

  useEffect(() => {
    const interval = setInterval(() => {
      const left = cutoverMs - Date.now()
      setRemaining(left)
      if (left <= 0) {
        clearInterval(interval)
        window.location.reload()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [cutoverMs])

  const minutesLeft = Math.max(0, Math.ceil(remaining / 60_000))

  return (
    <div
      className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium"
      style={{ background: 'var(--amber)', color: '#1a1200' }}
      dir="rtl"
    >
      <AlertTriangle size={16} />
      <span>
        سيدخل النظام وضع الصيانة خلال {minutesLeft} {minutesLeft === 1 ? 'دقيقة' : 'دقائق'} ({formatRemaining(remaining)}) — أنهِ عملياتك الحالية. {message}
      </span>
    </div>
  )
}
