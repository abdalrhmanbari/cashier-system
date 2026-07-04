'use client'

import { useEffect, useRef, useState } from 'react'
import { Wifi, WifiOff, X } from 'lucide-react'
import { useConnectionStatus, type ConnectionStatus } from '@/hooks/useConnectionStatus'

type ToastState = { type: 'online' | 'offline' } | null

export function ConnectionToast() {
  const { status } = useConnectionStatus()
  const prevRef = useRef<ConnectionStatus>('checking')
  const [toast, setToast] = useState<ToastState>(null)

  useEffect(() => {
    const prev = prevRef.current
    if (prev !== status) {
      // نتجاهل الانتقال الأول الخارج من 'checking' — ليس تغيّر حالة حقيقياً
      if (prev !== 'checking') {
        if (status === 'offline') setToast({ type: 'offline' })
        else if (status === 'online') setToast({ type: 'online' })
      }
      prevRef.current = status
    }
  }, [status])

  useEffect(() => {
    if (toast?.type === 'online') {
      const t = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(t)
    }
  }, [toast])

  if (!toast) return null

  const isOffline = toast.type === 'offline'

  return (
    <div
      className={`toast toast-enter ${isOffline ? 'error' : 'success'}`}
      dir="rtl"
      style={{
        position: 'fixed', top: '16px', right: '16px', zIndex: 100,
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '12px 14px', minWidth: '240px', maxWidth: '320px',
        fontSize: '13px', fontWeight: 500, fontFamily: 'var(--f)',
      }}
    >
      {isOffline ? <WifiOff size={16} /> : <Wifi size={16} />}
      <span style={{ flex: 1 }}>{isOffline ? 'انقطع الاتصال بالإنترنت' : 'عاد الاتصال'}</span>
      <button
        onClick={() => setToast(null)}
        title="إغلاق"
        style={{ background: 'none', border: 'none', color: 'inherit', opacity: 0.7, cursor: 'pointer', display: 'flex', flexShrink: 0 }}
      >
        <X size={14} />
      </button>
    </div>
  )
}
