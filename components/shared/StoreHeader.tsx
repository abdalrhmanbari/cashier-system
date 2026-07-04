'use client'

import { Sun, Moon, Search } from 'lucide-react'
import { useTheme } from './ThemeProvider'
import { ExchangeRateIndicator } from './ExchangeRateIndicator'
import { ConnectionIndicator } from './ConnectionIndicator'
import { NotificationBell } from './NotificationBell'

interface StoreHeaderProps {
  userName: string
  roleLabel: string
  isManager?: boolean
}

const SITE_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'منصة الكاشير'

export function StoreHeader({ userName, roleLabel, isManager = false }: StoreHeaderProps) {
  const { theme, toggle } = useTheme()

  return (
    <header
      className="px-3 md:px-4"
      style={{
        height: 'var(--th)',
        background: 'var(--white)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        boxShadow: 'var(--sh)',
      }}
    >
      {/* Logo + Store name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '7px',
            background: 'linear-gradient(135deg,var(--indigo),var(--blue))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '12px',
            fontWeight: 700,
          }}
        >
          M
        </div>
        <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>{SITE_NAME}</span>
      </div>

      {/* Divider */}
      <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', flexShrink: 0 }} />

      {/* Search */}
      <div className="hidden md:block" style={{ flex: 1, maxWidth: '300px', position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-m)', pointerEvents: 'none' }} />
        <input
          placeholder="بحث سريع…"
          style={{
            width: '100%',
            background: 'var(--diamond)',
            border: '1px solid transparent',
            borderRadius: 'var(--r-s)',
            padding: '5px 30px 5px 10px',
            fontSize: '13px',
            color: 'var(--text)',
            outline: 'none',
            transition: 'border-color .15s, background .15s',
            fontFamily: 'var(--f)',
          }}
          onFocus={e => { e.currentTarget.style.background = 'var(--white)'; e.currentTarget.style.borderColor = 'var(--indigo)'; }}
          onBlur={e  => { e.currentTarget.style.background = 'var(--diamond)'; e.currentTarget.style.borderColor = 'transparent'; }}
        />
      </div>

      {/* حالة الاتصال */}
      <ConnectionIndicator />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* سعر الصرف */}
      <ExchangeRateIndicator isManager={isManager} />

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

        {/* Notifications — للمدير فقط */}
        {isManager && <NotificationBell />}

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
            <p style={{ fontSize: '11px', color: 'var(--text-m)' }}>{roleLabel}</p>
          </div>
        </div>
      </div>
    </header>
  )
}