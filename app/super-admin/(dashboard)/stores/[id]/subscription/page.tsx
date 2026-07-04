'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowRight, RefreshCw, RotateCw, Wallet, X } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { SAInput, SASelect, SATextarea } from '@/components/shared/SAInput'
import { Button } from '@/components/ui/button'
import { formatUsd } from '@/lib/utils'

type StoreBrief = { id: string; name: string; slug: string }

type Payment = {
  id: string
  amountUsd: number
  method: string
  referenceNumber: string | null
  paidAt: string
  notes: string | null
  confirmedBy: string | null
}

type Renewal = {
  id: string
  fromDate: string
  toDate: string
  branchCount: number
  priceUsd: number
  billingCycle: string
  renewedAt: string
}

type Subscription = {
  id: string
  status: string
  startDate: string
  endDate: string
  autoRenew: boolean
  branchCount: number
  priceUsd: number
  notes: string | null
  billingCycle: string
  plan: { id: string; name: string }
  payments: Payment[]
  renewals: Renewal[]
}

const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  ACTIVE:    { label: 'نشط',    bg: 'var(--green-bg)',  color: 'var(--green)'  },
  TRIAL:     { label: 'تجريبي', bg: 'var(--blue-bg)',   color: 'var(--blue)'   },
  EXPIRED:   { label: 'منتهي',  bg: 'var(--amber-bg)',  color: 'var(--amber)'  },
  SUSPENDED: { label: 'موقوف',  bg: 'var(--red-bg)',    color: 'var(--red)'    },
  CANCELLED: { label: 'ملغي',   bg: 'var(--border-l)',  color: 'var(--text-2)' },
}

const CYCLE_LABEL: Record<string, string> = { MONTHLY: 'شهري', YEARLY: 'سنوي' }
const METHOD_LABEL: Record<string, string> = { CASH: 'نقدي', CARD: 'بطاقة', TRANSFER: 'تحويل' }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs mb-1" style={{ color: 'var(--text-2)' }}>{label}</label>
      {children}
    </div>
  )
}

export default function StoreSubscriptionPage() {
  const router  = useRouter()
  const params  = useParams()
  const storeId = params.id as string

  const [store,   setStore]   = useState<StoreBrief | null>(null)
  const [sub,     setSub]     = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)

  // تجديد
  const [renewOpen,    setRenewOpen]    = useState(false)
  const [renewMode,    setRenewMode]    = useState<'cycle' | 'custom'>('cycle')
  const [renewCycle,   setRenewCycle]   = useState<'MONTHLY' | 'YEARLY'>('MONTHLY')
  const [customDays,   setCustomDays]   = useState('')
  const [priceOverride, setPriceOverride] = useState('')
  const [renewNotes,   setRenewNotes]   = useState('')
  const [renewSaving,  setRenewSaving]  = useState(false)
  const [renewError,   setRenewError]   = useState('')

  // دفعة جديدة
  const [showPayForm, setShowPayForm] = useState(false)
  const [payAmount,   setPayAmount]   = useState('')
  const [payMethod,   setPayMethod]   = useState<'CASH' | 'CARD' | 'TRANSFER'>('CASH')
  const [payRef,      setPayRef]      = useState('')
  const [payNotes,    setPayNotes]    = useState('')
  const [paySaving,   setPaySaving]   = useState(false)
  const [payError,    setPayError]    = useState('')

  const [success, setSuccess] = useState('')

  async function load() {
    setLoading(true)
    const [storeRes, subRes] = await Promise.all([
      fetch(`/api/super-admin/stores/${storeId}`),
      fetch(`/api/super-admin/stores/${storeId}/subscription`),
    ])
    const [storeData, subData] = await Promise.all([storeRes.json(), subRes.json()])
    setStore(storeData)
    if (subRes.ok) {
      setSub(subData)
      setRenewCycle(subData.billingCycle === 'YEARLY' ? 'YEARLY' : 'MONTHLY')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [storeId])

  function openRenew() {
    setRenewMode('cycle')
    setCustomDays('')
    setPriceOverride('')
    setRenewNotes('')
    setRenewError('')
    setRenewOpen(true)
  }

  async function submitRenew(e: React.FormEvent) {
    e.preventDefault()
    setRenewSaving(true); setRenewError('')
    const body: Record<string, unknown> = {}
    if (renewMode === 'cycle') body.billingCycle = renewCycle
    else body.customDays = Number(customDays)
    if (priceOverride.trim()) body.priceUsd = Math.round(parseFloat(priceOverride) * 100)
    if (renewNotes.trim()) body.notes = renewNotes.trim()

    const res = await fetch(`/api/super-admin/stores/${storeId}/subscription/renew`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json()
    setRenewSaving(false)
    if (!res.ok) { setRenewError(data.error ?? 'حدث خطأ أثناء التجديد'); return }
    setSub(data)
    setRenewOpen(false)
    setSuccess('تم تجديد الاشتراك بنجاح — المتجر أصبح نشطاً فوراً')
    setTimeout(() => setSuccess(''), 4000)
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault()
    const amount = Math.round(parseFloat(payAmount) * 100)
    if (!amount || amount <= 0) { setPayError('أدخل مبلغاً صحيحاً'); return }
    setPaySaving(true); setPayError('')

    const res = await fetch(`/api/super-admin/stores/${storeId}/subscription/payments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountUsd: amount, method: payMethod, referenceNumber: payRef.trim() || undefined, notes: payNotes.trim() || undefined }),
    })
    const data = await res.json()
    setPaySaving(false)
    if (!res.ok) { setPayError(data.error ?? 'حدث خطأ أثناء تسجيل الدفعة'); return }
    setSub(s => s ? { ...s, payments: [data, ...s.payments] } : s)
    setPayAmount(''); setPayRef(''); setPayNotes(''); setShowPayForm(false)
    setSuccess('تم تسجيل الدفعة بنجاح')
    setTimeout(() => setSuccess(''), 4000)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-32 text-sm" style={{ color: 'var(--text-m)' }}>جارٍ التحميل...</div>
  }

  if (!sub || !store) {
    return (
      <div className="max-w-2xl mx-auto space-y-4" dir="rtl">
        <p className="text-sm" style={{ color: 'var(--text-m)' }}>لا يوجد اشتراك مرتبط بهذا المتجر.</p>
        <Button variant="outline" size="sm" onClick={() => router.push('/super-admin/stores')}>
          <ArrowRight size={14} /> رجوع للمتاجر
        </Button>
      </div>
    )
  }

  const status  = STATUS[sub.status] ?? STATUS.CANCELLED
  const expired = new Date(sub.endDate) < new Date()

  return (
    <div className="max-w-3xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/super-admin/stores')} className="transition-colors" style={{ color: 'var(--text-2)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-2)')}>
            <ArrowRight size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold">اشتراك {store.name}</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-m)', fontFamily: 'var(--mono)' }}>{store.slug}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw size={14} /> تحديث
        </Button>
      </div>

      {success && (
        <p className="text-sm rounded-md px-4 py-3" style={{ color: 'var(--green)', background: 'var(--green-bg)', border: '1px solid var(--green)' }}>{success}</p>
      )}

      {/* بطاقة تفاصيل الاشتراك */}
      <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--white)', border: '1px solid var(--border-color)' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">تفاصيل الاشتراك</h2>
          <span className="inline-block px-2.5 py-1 rounded text-xs font-medium" style={{ background: status.bg, color: status.color }}>
            {status.label}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs" style={{ color: 'var(--text-m)' }}>الخطة</p>
            <p className="font-medium mt-0.5">{sub.plan.name}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'var(--text-m)' }}>ينتهي في</p>
            <p className="font-medium mt-0.5" style={{ color: expired ? 'var(--red)' : 'var(--text)' }}>
              {new Date(sub.endDate).toLocaleDateString('ar-SA')}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'var(--text-m)' }}>دورة الفوترة</p>
            <p className="font-medium mt-0.5">{CYCLE_LABEL[sub.billingCycle] ?? sub.billingCycle}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'var(--text-m)' }}>عدد الفروع</p>
            <p className="font-medium mt-0.5">{sub.branchCount}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'var(--text-m)' }}>السعر الحالي</p>
            <p className="font-medium mt-0.5" style={{ fontFamily: 'var(--mono)' }}>{formatUsd(sub.priceUsd)}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'var(--text-m)' }}>تجديد تلقائي</p>
            <p className="font-medium mt-0.5">{sub.autoRenew ? 'مفعّل' : 'غير مفعّل'}</p>
          </div>
        </div>

        {sub.notes && (
          <p className="text-xs rounded-md px-3 py-2" style={{ background: 'var(--diamond)', color: 'var(--text-2)' }}>{sub.notes}</p>
        )}

        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={openRenew}>
            <RotateCw size={14} /> تجديد الاشتراك
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowPayForm(f => !f)}>
            <Wallet size={14} /> تسجيل دفعة
          </Button>
        </div>

        {/* نموذج تسجيل دفعة */}
        {showPayForm && (
          <form onSubmit={submitPayment} className="pt-3 space-y-3" style={{ borderTop: '1px solid var(--border-l)' }}>
            <div className="grid grid-cols-3 gap-3">
              <Field label="المبلغ ($) *">
                <SAInput type="number" min={0.01} step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} required dir="ltr" placeholder="0.00" />
              </Field>
              <Field label="طريقة الدفع">
                <SASelect value={payMethod} onChange={e => setPayMethod(e.target.value as typeof payMethod)}>
                  {(['CASH', 'CARD', 'TRANSFER'] as const).map(m => (
                    <option key={m} value={m}>{METHOD_LABEL[m]}</option>
                  ))}
                </SASelect>
              </Field>
              <Field label="رقم مرجعي (اختياري)">
                <SAInput value={payRef} onChange={e => setPayRef(e.target.value)} />
              </Field>
            </div>
            <Field label="ملاحظات (اختياري)">
              <SATextarea rows={2} value={payNotes} onChange={e => setPayNotes(e.target.value)} />
            </Field>
            {payError && (
              <p className="text-sm rounded-md px-3 py-2" style={{ color: 'var(--red)', background: 'var(--red-bg)' }}>{payError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowPayForm(false)}>إلغاء</Button>
              <Button type="submit" size="sm" disabled={paySaving}>{paySaving ? '...' : 'حفظ الدفعة'}</Button>
            </div>
          </form>
        )}
      </div>

      {/* سجل الدفعات */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">سجل الدفعات</h2>
        <DataTable
          data={sub.payments as unknown as Record<string, unknown>[]}
          searchable={false}
          emptyMessage="لا توجد دفعات مسجّلة"
          columns={[
            { key: 'paidAt', label: 'التاريخ', render: (_, row) => new Date((row as unknown as Payment).paidAt).toLocaleDateString('ar-SA') },
            { key: 'amountUsd', label: 'المبلغ', render: (_, row) => <span style={{ fontFamily: 'var(--mono)' }}>{formatUsd((row as unknown as Payment).amountUsd)}</span> },
            { key: 'method', label: 'الطريقة', render: (_, row) => METHOD_LABEL[(row as unknown as Payment).method] ?? (row as unknown as Payment).method },
            { key: 'referenceNumber', label: 'رقم مرجعي', render: (_, row) => (row as unknown as Payment).referenceNumber ?? '—' },
            { key: 'confirmedBy', label: 'سجّلها', render: (_, row) => (row as unknown as Payment).confirmedBy ?? '—' },
          ]}
        />
      </div>

      {/* سجل التجديدات */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">سجل التجديدات</h2>
        <DataTable
          data={sub.renewals as unknown as Record<string, unknown>[]}
          searchable={false}
          emptyMessage="لا توجد تجديدات سابقة"
          columns={[
            { key: 'renewedAt', label: 'تاريخ التجديد', render: (_, row) => new Date((row as unknown as Renewal).renewedAt).toLocaleDateString('ar-SA') },
            { key: 'fromDate', label: 'من', render: (_, row) => new Date((row as unknown as Renewal).fromDate).toLocaleDateString('ar-SA') },
            { key: 'toDate', label: 'إلى', render: (_, row) => new Date((row as unknown as Renewal).toDate).toLocaleDateString('ar-SA') },
            { key: 'billingCycle', label: 'الدورة', render: (_, row) => CYCLE_LABEL[(row as unknown as Renewal).billingCycle] ?? (row as unknown as Renewal).billingCycle },
            { key: 'priceUsd', label: 'السعر', render: (_, row) => <span style={{ fontFamily: 'var(--mono)' }}>{formatUsd((row as unknown as Renewal).priceUsd)}</span> },
          ]}
        />
      </div>

      {/* Renew Dialog */}
      {renewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="absolute inset-0 bg-black/60" onClick={() => setRenewOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl shadow-2xl" style={{ background: 'var(--white)', border: '1px solid var(--border-color)' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <h2 className="font-semibold">تجديد الاشتراك</h2>
              <Button variant="ghost" size="icon-sm" onClick={() => setRenewOpen(false)}><X size={18} /></Button>
            </div>

            <form onSubmit={submitRenew} className="px-6 py-4 space-y-4">
              <p className="text-xs" style={{ color: 'var(--text-m)' }}>
                إن كان الاشتراك ما زال سارياً، تُضاف المدة الجديدة بعد تاريخ انتهائه الحالي. إن كان منتهياً، تبدأ المدة من اليوم.
              </p>

              <div className="flex gap-1 rounded-lg p-1 w-fit" style={{ background: 'var(--diamond)' }}>
                {[
                  { mode: 'cycle' as const,  label: 'حسب دورة الفوترة' },
                  { mode: 'custom' as const, label: 'مدة مخصصة (أيام)' },
                ].map(({ mode, label }) => (
                  <button key={mode} type="button" onClick={() => setRenewMode(mode)}
                    className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                    style={renewMode === mode ? { background: 'var(--cerulean)', color: '#FFFFFF' } : { color: 'var(--text-2)' }}>
                    {label}
                  </button>
                ))}
              </div>

              {renewMode === 'cycle' ? (
                <Field label="دورة الفوترة">
                  <SASelect value={renewCycle} onChange={e => setRenewCycle(e.target.value as 'MONTHLY' | 'YEARLY')}>
                    <option value="MONTHLY">شهري (30 يوم)</option>
                    <option value="YEARLY">سنوي (365 يوم)</option>
                  </SASelect>
                </Field>
              ) : (
                <Field label="عدد الأيام">
                  <SAInput type="number" min={1} value={customDays} onChange={e => setCustomDays(e.target.value)} required dir="ltr" placeholder="90" />
                </Field>
              )}

              <Field label="السعر الجديد ($) — اتركه فارغاً للإبقاء على السعر الحالي">
                <SAInput type="number" min={0} step="0.01" value={priceOverride} onChange={e => setPriceOverride(e.target.value)} dir="ltr" placeholder={formatUsd(sub.priceUsd)} />
              </Field>

              <Field label="ملاحظات (اختياري)">
                <SATextarea rows={2} value={renewNotes} onChange={e => setRenewNotes(e.target.value)} />
              </Field>

              {renewError && (
                <p className="text-sm rounded-md px-3 py-2" style={{ color: 'var(--red)', background: 'var(--red-bg)' }}>{renewError}</p>
              )}

              <div className="flex gap-2 justify-end pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => setRenewOpen(false)}>إلغاء</Button>
                <Button type="submit" size="sm" disabled={renewSaving}>{renewSaving ? '...' : 'تأكيد التجديد'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
