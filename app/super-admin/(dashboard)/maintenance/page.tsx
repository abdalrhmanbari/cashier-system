'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Wrench } from 'lucide-react'
import { SAInput, SASelect, SATextarea } from '@/components/shared/SAInput'
import { Button } from '@/components/ui/button'

type Settings = {
  maintenanceEnabled: boolean
  maintenanceMessage: string
  maintenanceEndsAt: string | null
  maintenanceActivatedAt: string | null
  maintenanceGraceMinutes: number
  activeStoreCount: number
}

const GRACE_LABEL: Record<number, string> = { 0: 'فوري (بلا مهلة)', 10: '10 دقائق', 30: '30 دقيقة' }

function toLocalInputValue(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function MaintenancePage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [message, setMessage]   = useState('')
  const [endsAt, setEndsAt]     = useState('')
  const [grace, setGrace]       = useState(0)
  const [saving, setSaving]     = useState(false)
  const [confirmEnable, setConfirmEnable] = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')

  async function load() {
    const res = await fetch('/api/super-admin/maintenance')
    const data = await res.json()
    setSettings(data)
    setMessage(data.maintenanceMessage ?? '')
    setEndsAt(toLocalInputValue(data.maintenanceEndsAt))
    setGrace(data.maintenanceGraceMinutes ?? 0)
  }

  useEffect(() => { load() }, [])

  async function apply(enabled: boolean) {
    setSaving(true); setError(''); setSuccess('')
    const res = await fetch('/api/super-admin/maintenance', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled,
        message: message.trim() || undefined,
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        graceMinutes: grace,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'خطأ'); return }
    setSuccess(enabled ? 'تم تفعيل وضع الصيانة العام' : 'تم إيقاف وضع الصيانة العام')
    setConfirmEnable(false)
    load()
  }

  if (!settings) {
    return <div className="flex items-center justify-center py-32 text-sm" style={{ color: 'var(--text-m)' }}>جارٍ التحميل...</div>
  }

  return (
    <div className="max-w-2xl space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'var(--amber-bg)' }}>
          <Wrench className="w-5 h-5" style={{ color: 'var(--amber)' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold">صيانة المنصة العامة</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-m)' }}>
            عند التفعيل تُحجب كل المتاجر ({settings.activeStoreCount} متجر نشط) — لوحة السوبر أدمن تبقى تعمل دائماً.
          </p>
        </div>
      </div>

      <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--white)', border: '1px solid var(--border-color)' }}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">الحالة الحالية</span>
          <span
            className="inline-block px-2.5 py-1 rounded text-xs font-medium"
            style={settings.maintenanceEnabled
              ? { background: 'var(--amber-bg)', color: 'var(--amber)' }
              : { background: 'var(--green-bg)', color: 'var(--green)' }}
          >
            {settings.maintenanceEnabled ? 'الصيانة مفعّلة' : 'النظام يعمل بشكل طبيعي'}
          </span>
        </div>

        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-2)' }}>رسالة الصيانة</label>
          <SATextarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={3}
            placeholder="النظام تحت الصيانة، سنعود قريباً"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-2)' }}>الوقت المتوقع للعودة (اختياري)</label>
            <SAInput type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-2)' }}>مهلة السماح للجلسات النشطة</label>
            <SASelect value={String(grace)} onChange={e => setGrace(Number(e.target.value))}>
              {Object.entries(GRACE_LABEL).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </SASelect>
          </div>
        </div>

        {error && (
          <p className="text-sm rounded-md px-4 py-3" style={{ color: 'var(--red)', background: 'var(--red-bg)', border: '1px solid var(--red)' }}>{error}</p>
        )}
        {success && (
          <p className="text-sm rounded-md px-4 py-3" style={{ color: 'var(--green)', background: 'var(--green-bg)', border: '1px solid var(--green)' }}>{success}</p>
        )}

        <div className="flex gap-3 pt-2">
          {settings.maintenanceEnabled ? (
            <Button onClick={() => apply(false)} disabled={saving} variant="primary">
              {saving ? '...' : 'إيقاف وضع الصيانة'}
            </Button>
          ) : !confirmEnable ? (
            <Button onClick={() => setConfirmEnable(true)} variant="destructive">
              تفعيل وضع الصيانة
            </Button>
          ) : (
            <div className="w-full space-y-3 rounded-md p-4" style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber)' }}>
              <p className="text-sm flex items-start gap-2" style={{ color: 'var(--text)' }}>
                <AlertTriangle size={16} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: '2px' }} />
                سيتأثر {settings.activeStoreCount} متجر نشط. الجلسات الحالية تُمهَل {GRACE_LABEL[grace]}، ثم تُحوَّل الكل لصفحة الصيانة. متأكد من التفعيل؟
              </p>
              <div className="flex gap-2">
                <Button onClick={() => apply(true)} disabled={saving} variant="destructive" size="sm">
                  {saving ? '...' : 'نعم، فعّل الصيانة'}
                </Button>
                <Button onClick={() => setConfirmEnable(false)} variant="ghost" size="sm">إلغاء</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
