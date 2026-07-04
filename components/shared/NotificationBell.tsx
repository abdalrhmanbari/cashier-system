'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Bell, CheckCheck } from 'lucide-react'
import { useNotifications, type NotificationItem } from './NotificationContext'

const TYPE_DOT_COLOR: Record<string, string> = {
  LOW_STOCK:             'var(--amber)',
  STALE_EXCHANGE_RATE:   'var(--amber)',
  CUSTOMER_DEBT_LIMIT:   'var(--red)',
  SUPPLIER_INVOICE_DUE:  'var(--red)',
  SHIFT_DIFFERENCE:      'var(--indigo)',
  SUBSCRIPTION_EXPIRING: 'var(--red)',
  BACKUP_STALE:          'var(--red)',
  DISK_SPACE_LOW:        'var(--amber)',
  HIGH_ERROR_RATE:       'var(--red)',
  DB_SIZE_WARNING:       'var(--amber)',
}

function timeAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (min < 1)  return 'الآن'
  if (min < 60) return `منذ ${min} د`
  const hr = Math.floor(min / 60)
  if (hr < 24)  return `منذ ${hr} س`
  return `منذ ${Math.floor(hr / 24)} يوم`
}

export function NotificationBell({ scope = 'store' }: { scope?: 'store' | 'super-admin' }) {
  const { notifications, unreadCount, refresh, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { slug } = useParams<{ slug?: string }>()

  function toggle() {
    setOpen(o => {
      if (!o) refresh()
      return !o
    })
  }

  async function onClickItem(n: NotificationItem) {
    if (!n.isRead) await markRead(n.id)
    setOpen(false)
    if (n.link) router.push(scope === 'super-admin' ? `/super-admin${n.link}` : `/${slug}${n.link}`)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={toggle}
        title="الإشعارات"
        style={{
          width: '32px', height: '32px', borderRadius: 'var(--r-x)', border: 'none',
          background: open ? 'var(--diamond)' : 'transparent', color: open ? 'var(--text)' : 'var(--text-2)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
          transition: 'background .12s, color .12s',
        }}
        onMouseEnter={e => { if (!open) { e.currentTarget.style.background = 'var(--diamond)'; e.currentTarget.style.color = 'var(--text)' } }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)' } }}
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '4px', right: '4px',
            minWidth: '14px', height: '14px', padding: '0 3px', borderRadius: '9999px',
            background: 'var(--red)', border: '1px solid var(--white)',
            fontSize: '9px', fontWeight: 700, color: '#fff', lineHeight: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 45 }} />
          <div
            dir="rtl"
            style={{
              position: 'absolute', top: 'calc(100% + 8px)', left: 0,
              width: 'min(360px, 92vw)', maxHeight: '70vh', overflowY: 'auto',
              background: 'var(--white)', border: '1px solid var(--border-color)',
              borderRadius: 'var(--r)', boxShadow: 'var(--sh)', zIndex: 46,
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderBottom: '1px solid var(--border-color)',
              position: 'sticky', top: 0, background: 'var(--white)',
            }}>
              <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)' }}>الإشعارات</span>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead()}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', border: 'none', background: 'none', color: 'var(--indigo)', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--f)' }}
                >
                  <CheckCheck size={12} /> تعليم الكل كمقروء
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-m)', fontSize: '12.5px' }}>
                لا توجد إشعارات
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => onClickItem(n)}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: '3px', width: '100%', textAlign: 'right',
                    padding: '10px 14px', border: 'none', borderBottom: '1px solid var(--border-color)',
                    background: n.isRead ? 'transparent' : 'var(--indigo-g)',
                    cursor: 'pointer', fontFamily: 'var(--f)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '9999px', background: TYPE_DOT_COLOR[n.type] ?? 'var(--indigo)', flexShrink: 0, opacity: n.isRead ? 0.35 : 1 }} />
                    <span style={{ fontSize: '12.5px', fontWeight: n.isRead ? 500 : 700, color: 'var(--text)' }}>{n.title}</span>
                  </div>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-2)', margin: 0, paddingRight: '12px' }}>{n.body}</p>
                  <span style={{ fontSize: '10px', color: 'var(--text-m)', paddingRight: '12px' }}>{timeAgo(n.createdAt)}</span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
