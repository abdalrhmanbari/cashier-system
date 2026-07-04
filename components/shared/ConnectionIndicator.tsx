'use client'

import { useConnectionStatus } from '@/hooks/useConnectionStatus'

export function ConnectionIndicator() {
  const { status } = useConnectionStatus()

  const label = status === 'offline' ? 'غير متصل' : status === 'checking' ? 'جارٍ التحقق' : 'متصل'
  const color = status === 'offline' ? 'var(--red)' : 'var(--text-m)'
  const dot   = status === 'offline' ? 'var(--red)' : status === 'checking' ? 'var(--text-m)' : 'var(--green)'

  return (
    <div
      title={status === 'offline' ? 'غير متصل بالإنترنت' : 'متصل بالإنترنت'}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0,
        fontSize: '12px', fontWeight: 500, color, fontFamily: 'var(--f)',
      }}
    >
      <span
        className={status === 'offline' ? 'conn-dot conn-dot-pulse' : 'conn-dot'}
        style={{ background: dot }}
      />
      <span className="hidden sm:inline">{label}</span>
    </div>
  )
}
