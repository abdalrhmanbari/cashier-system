'use client'

import { useSyncExternalStore } from 'react'

export type ConnectionStatus = 'online' | 'offline' | 'checking'

const PING_URL         = '/api/store/ping'
const POLL_MS          = 25_000  // فحص دوري كل 25 ثانية
const PING_TIMEOUT_MS  = 3_500   // مهلة الطلب الواحد
const DEBOUNCE_MS      = 4_000   // تثبيت قبل إعلان تغيّر الحالة (منع الوميض عند اتصال متقطع)

let announced: ConnectionStatus = 'checking'
let pendingTarget: ConnectionStatus | null = null
let pendingTimer: ReturnType<typeof setTimeout> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let subscriberCount = 0
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach(l => l())
}

function clearPending() {
  if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null }
  pendingTarget = null
}

/** يُستدعى من الفحص الدوري، ومن أي كود مستقبلي (POS) بعد نجاح/فشل طلب API فعلي بخطأ شبكة */
export function reportConnectionResult(success: boolean) {
  const raw: ConnectionStatus = success ? 'online' : 'offline'

  if (raw === announced) { clearPending(); return }

  // أول تحديد للحالة (بعد 'checking') يُعلَن فوراً بلا تثبيت
  if (announced === 'checking') {
    announced = raw
    clearPending()
    notify()
    return
  }

  if (pendingTarget === raw) return // التثبيت جارٍ بالفعل نحو نفس الهدف

  clearPending()
  pendingTarget = raw
  pendingTimer = setTimeout(() => {
    announced = raw
    pendingTarget = null
    pendingTimer = null
    notify()
  }, DEBOUNCE_MS)
}

async function ping() {
  try {
    const controller = new AbortController()
    const timeoutId  = setTimeout(() => controller.abort(), PING_TIMEOUT_MS)
    const res = await fetch(PING_URL, { method: 'GET', cache: 'no-store', signal: controller.signal })
    clearTimeout(timeoutId)
    reportConnectionResult(res.ok)
  } catch {
    reportConnectionResult(false)
  }
}

// أحداث المتصفح online/offline: مجرد محفّز لفحص فوري، وليست مصدر الحقيقة
function handleBrowserEvent() {
  ping()
}

function start() {
  if (pollTimer) return
  ping()
  pollTimer = setInterval(ping, POLL_MS)
  window.addEventListener('online', handleBrowserEvent)
  window.addEventListener('offline', handleBrowserEvent)
}

function stop() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  window.removeEventListener('online', handleBrowserEvent)
  window.removeEventListener('offline', handleBrowserEvent)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  subscriberCount++
  if (subscriberCount === 1) start()
  return () => {
    listeners.delete(listener)
    subscriberCount--
    if (subscriberCount === 0) stop()
  }
}

function getSnapshot(): ConnectionStatus {
  return announced
}

function getServerSnapshot(): ConnectionStatus {
  return 'checking'
}

export function useConnectionStatus() {
  const status = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return { status }
}
