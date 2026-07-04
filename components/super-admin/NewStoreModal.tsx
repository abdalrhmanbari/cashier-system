'use client'

import { useEffect, useState } from 'react'
import { X, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Currency  = { id: string; code: string; name: string; symbol: string }
type StoreType = { id: string; name: string; icon: string }
type Plan      = { id: string; name: string; description: string | null }

export default function NewStoreModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [currencies,  setCurrencies]  = useState<Currency[]>([])
  const [storeTypes,  setStoreTypes]  = useState<StoreType[]>([])
  const [plans,       setPlans]       = useState<Plan[]>([])
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [showPass,    setShowPass]    = useState(false)

  const [form, setForm] = useState({
    name:            '',
    slug:            '',
    phone:           '',
    address:         '',
    taxRate:         '0',
    currencyId:      '',
    storeTypeId:     '',
    planId:          '',
    billingCycle:    'MONTHLY' as 'MONTHLY' | 'YEARLY',
    branchCount:     '1',
    managerName:     '',
    managerEmail:    '',
    managerPassword: '',
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/super-admin/currencies').then(r => r.json()),
      fetch('/api/super-admin/store-types').then(r => r.json()),
      fetch('/api/super-admin/plans').then(r => r.json()),
    ]).then(([c, st, p]) => {
      setCurrencies(c)
      setStoreTypes(st)
      setPlans(p)
      setForm(f => ({
        ...f,
        currencyId:  c[0]?.id ?? '',
        storeTypeId: st[0]?.id ?? '',
        planId:      p[0]?.id ?? '',
      }))
    })
  }, [])

  function set(key: keyof typeof form, val: string) {
    setForm(f => ({ ...f, [key]: val }))
    if (key === 'name') {
      setForm(f => ({
        ...f,
        name: val,
        slug: val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      }))
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/super-admin/stores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        taxRate:    parseFloat(form.taxRate) || 0,
        branchCount: parseInt(form.branchCount) || 1,
      }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error ?? 'خطأ غير معروف'); return }
    onCreated()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" dir="rtl">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="font-bold text-lg">متجر جديد</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          {/* Name + Slug */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="اسم المتجر">
              <input value={form.name} onChange={e => set('name', e.target.value)} required
                className="input" placeholder="سوبر ماركت الأمل" />
            </Field>
            <Field label="الـ Slug (رابط)">
              <input value={form.slug} onChange={e => set('slug', e.target.value)} required
                className="input font-mono" placeholder="alamal" dir="ltr" />
            </Field>
          </div>

          {/* Phone + Tax */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="الهاتف">
              <input value={form.phone} onChange={e => set('phone', e.target.value)}
                className="input" placeholder="+966500000000" />
            </Field>
            <Field label="نسبة الضريبة (0.15 = 15%)">
              <input value={form.taxRate} onChange={e => set('taxRate', e.target.value)}
                type="number" step="0.01" min="0" max="1" className="input" placeholder="0.15" />
            </Field>
          </div>

          {/* Address */}
          <Field label="العنوان">
            <input value={form.address} onChange={e => set('address', e.target.value)}
              className="input" placeholder="الرياض، حي النزهة" />
          </Field>

          {/* Currency + StoreType */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="العملة">
              <select value={form.currencyId} onChange={e => set('currencyId', e.target.value)} className="input">
                {currencies.map(c => (
                  <option key={c.id} value={c.id}>{c.symbol} {c.name} ({c.code})</option>
                ))}
              </select>
            </Field>
            <Field label="نوع المتجر">
              <select value={form.storeTypeId} onChange={e => set('storeTypeId', e.target.value)} className="input">
                {storeTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* بيانات مدير المتجر */}
          <div className="border-t border-gray-800 pt-4">
            <p className="text-xs text-gray-400 mb-3 font-medium">بيانات دخول مدير المتجر</p>
            <div className="space-y-3">
              <Field label="اسم المدير">
                <input value={form.managerName} onChange={e => set('managerName', e.target.value)} required
                  className="input" placeholder="أحمد المحمد" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="البريد الإلكتروني">
                  <input value={form.managerEmail} onChange={e => set('managerEmail', e.target.value)} required
                    type="email" className="input" placeholder="manager@store.com" dir="ltr" />
                </Field>
                <Field label="كلمة المرور">
                  <div className="relative">
                    <input
                      value={form.managerPassword}
                      onChange={e => set('managerPassword', e.target.value)}
                      required
                      type={showPass ? 'text' : 'password'}
                      className="input w-full pl-9"
                      placeholder="••••••••"
                      dir="ltr"
                      minLength={8}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setShowPass(v => !v)}
                      className="absolute left-2 top-1/2 -translate-y-1/2"
                    >
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </Button>
                  </div>
                </Field>
              </div>
            </div>
          </div>

          {/* Plan + BillingCycle + Branches */}
          <div className="grid grid-cols-3 gap-4">
            <Field label="الخطة">
              <select value={form.planId} onChange={e => set('planId', e.target.value)} className="input">
                {plans.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </Field>
            <Field label="دورة الفوترة">
              <select value={form.billingCycle} onChange={e => set('billingCycle', e.target.value as 'MONTHLY' | 'YEARLY')} className="input">
                <option value="MONTHLY">شهري</option>
                <option value="YEARLY">سنوي</option>
              </select>
            </Field>
            <Field label="عدد الفروع">
              <input value={form.branchCount} onChange={e => set('branchCount', e.target.value)}
                type="number" min="1" className="input" />
            </Field>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              إلغاء
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'جارٍ الإنشاء...' : 'إنشاء المتجر'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  )
}
