'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'

export type NotificationItem = {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  isRead: boolean
  createdAt: string
}

type NotificationContextValue = {
  notifications: NotificationItem[]
  unreadCount: number
  loading: boolean
  /** إعادة الجلب من الخادم — تُستخدم كـ polling كل 60 ثانية وعند فتح القائمة يدوياً */
  refresh: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

const POLL_MS = 60_000

type Scope = 'store' | 'super-admin'

const API_BASE: Record<Scope, string> = {
  store: '/api/store/notifications',
  'super-admin': '/api/super-admin/notifications',
}

export function NotificationProvider({ children, scope = 'store' }: { children: React.ReactNode; scope?: Scope }) {
  const { data: session } = useSession()
  // الكاشير لا يرى إشعارات — كل الأنواع الحالية مخصصة للمدير أو السوبر أدمن فقط
  const enabled = scope === 'super-admin'
    ? session?.user?.type === 'SUPER_ADMIN'
    : session?.user?.role === 'STORE_MANAGER'

  const base = API_BASE[scope]

  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!enabled) { setLoading(false); return }
    const res = await fetch(`${base}?limit=20`)
    if (res.ok) {
      const data = await res.json()
      setNotifications(Array.isArray(data.notifications) ? data.notifications : [])
      setUnreadCount(data.unreadCount ?? 0)
    }
    setLoading(false)
  }, [enabled, base])

  useEffect(() => {
    if (!enabled) { setLoading(false); return }
    refresh()
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [enabled, refresh])

  const markRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)))
    setUnreadCount(c => Math.max(0, c - 1))
    await fetch(`${base}/${id}/read`, { method: 'PATCH' })
  }, [base])

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    setUnreadCount(0)
    await fetch(`${base}/read-all`, { method: 'PATCH' })
  }, [base])

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, loading, refresh, markRead, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications يجب أن يُستخدم داخل NotificationProvider')
  return ctx
}
