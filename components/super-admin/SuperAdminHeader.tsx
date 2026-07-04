'use client'

import { Sun, Moon, ShieldCheck } from 'lucide-react'
import { useTheme } from '@/components/shared/ThemeProvider'
import { NotificationBell } from '@/components/shared/NotificationBell'

interface SuperAdminHeaderProps {
  userName: string
}

const SITE_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'منصة الكاشير'

export function SuperAdminHeader({ userName }: SuperAdminHeaderProps) {
  const { theme, toggle } = useTheme()

  return (
    <header
      style={{
        height: 'var(--th)',
        background: 'var(--white)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        paddingInline: '16px',
        gap: '12px',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        boxShadow: 'var(--sh)',
      }}
    >
      {/* Logo + Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '7px',
          background: 'linear-gradient(135deg,var(--indigo),var(--blue))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff',
        }}>
          <ShieldCheck size={14} />
        </div>
        <div style={{ lineHeight: 1.2 }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>لوحة التحكم</p>
          <p style={{ fontSize: '11px', color: 'var(--text-m)' }}>{SITE_NAME}</p>
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', flexShrink: 0 }} />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {/* Dark mode toggle */}
        <button
          onClick={toggle}
          title={theme === 'dark' ? 'وضع فاتح' : 'وضع داكن'}
          style={{
            width: '32px', height: '32px', borderRadius: 'var(--r-x)', border: 'none',
            background: 'transparent', color: 'var(--text-2)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background .12s, color .12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--diamond)'; e.currentTarget.style.color = 'var(--text)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)'; }}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* Notifications */}
        <NotificationBell scope="super-admin" />

        {/* Divider */}
        <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 4px' }} />

        {/* User avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'default' }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '9999px',
            background: 'var(--indigo-l)', color: 'var(--indigo)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 700,
          }}>
            {userName.slice(0, 1)}
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{userName}</p>
            <p style={{ fontSize: '11px', color: 'var(--text-m)' }}>مدير المنصة</p>
          </div>
        </div>
      </div>
    </header>
  )
}
