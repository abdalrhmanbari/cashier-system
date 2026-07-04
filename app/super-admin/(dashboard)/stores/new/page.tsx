'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { SAInput, SASelect } from '@/components/shared/SAInput'

type StoreType = { id: string; name: string; icon: string }
type Plan      = { id: string; name: string; description: string | null }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs mb-1" style={{ color: 'var(--text-2)' }}>{label}</label>
      {children}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--white)', border: '1px solid var(--border-color)' }}>
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</h2>
      {children}
    </div>
  )
}

export default function NewStorePage() {
  const router = useRouter()

  const [storeTypes, setStoreTypes] = useState<StoreType[]>([])
  const [plans,      setPlans]      = useState<Plan[]>([])
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [showPass,   setShowPass]   = useState(false)

  const [form, setForm] = useState({
    name: '', slug: '', phone: '', address: '',
    storeTypeId: '', planId: '',
    billingCycle: 'MONTHLY' as 'MONTHLY' | 'YEARLY',
    branchCount: '1',
    managerName: '', managerEmail: '', managerPassword: '',
    branchName: 'الفرع الرئيسي', branchAddress: '', branchPhone: '',
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/super-admin/store-types').then(r => r.json()),
      fetch('/api/super-admin/plans').then(r => r.json()),
    ]).then(([st, p]) => {
      setStoreTypes(st); setPlans(p)
      setForm(f => ({ ...f, storeTypeId: st[0]?.id ?? '', planId: p[0]?.id ?? '' }))
    })
  }, [])

  function set(key: keyof typeof form, val: string) {
    if (key === 'name') {
      setForm(f => ({ ...f, name: val, slug: val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') }))
    } else {
      setForm(f => ({ ...f, [key]: val }))
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/super-admin/stores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, branchCount: parseInt(form.branchCount) || 1 }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error ?? 'خطأ غير معروف'); return }
    router.push('/super-admin/stores')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/super-admin/stores')} className="transition-colors" style={{ color: 'var(--text-2)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-2)')}>
          <ArrowRight size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold">متجر جديد</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-m)' }}>أدخل بيانات المتجر وحساب المدير</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <Section title="بيانات المتجر">
          <div className="grid grid-cols-2 gap-4">
            <Field label="اسم المتجر">
              <SAInput value={form.name} onChange={e => set('name', e.target.value)} required placeholder="سوبر ماركت الأمل" />
            </Field>
            <Field label="الـ Slug (رابط)">
              <SAInput value={form.slug} onChange={e => set('slug', e.target.value)} required placeholder="alamal" dir="ltr" style={{ fontFamily: 'var(--mono)' }} />
            </Field>
          </div>
          <Field label="الهاتف">
            <SAInput value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+966500000000" />
          </Field>
          <Field label="العنوان">
            <SAInput value={form.address} onChange={e => set('address', e.target.value)} placeholder="الرياض، حي النزهة" />
          </Field>
          <Field label="نوع المتجر">
            <SASelect value={form.storeTypeId} onChange={e => set('storeTypeId', e.target.value)}>
              {storeTypes.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
            </SASelect>
          </Field>
        </Section>

        <Section title="حساب مدير المتجر">
          <Field label="اسم المدير">
            <SAInput value={form.managerName} onChange={e => set('managerName', e.target.value)} required placeholder="أحمد المحمد" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="البريد الإلكتروني">
              <SAInput value={form.managerEmail} onChange={e => set('managerEmail', e.target.value)} required type="email" placeholder="manager@store.com" dir="ltr" />
            </Field>
            <Field label="كلمة المرور">
              <div className="relative">
                <SAInput value={form.managerPassword} onChange={e => set('managerPassword', e.target.value)} required
                  type={showPass ? 'text' : 'password'} placeholder="••••••••" dir="ltr" minLength={8}
                  style={{ paddingLeft: '36px' }} />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--text-m)' }}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>
          </div>
        </Section>

        <Section title="الاشتراك">
          <div className="grid grid-cols-3 gap-4">
            <Field label="الخطة">
              <SASelect value={form.planId} onChange={e => set('planId', e.target.value)}>
                {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </SASelect>
            </Field>
            <Field label="دورة الفوترة">
              <SASelect value={form.billingCycle} onChange={e => set('billingCycle', e.target.value as 'MONTHLY' | 'YEARLY')}>
                <option value="MONTHLY">شهري</option>
                <option value="YEARLY">سنوي</option>
              </SASelect>
            </Field>
            <Field label="عدد الفروع">
              <SAInput value={form.branchCount} onChange={e => set('branchCount', e.target.value)} type="number" min={1} />
            </Field>
          </div>
        </Section>

        <Section title="الفرع الأول">
          <div className="grid grid-cols-3 gap-4">
            <Field label="اسم الفرع">
              <SAInput value={form.branchName} onChange={e => set('branchName', e.target.value)} placeholder="الفرع الرئيسي" />
            </Field>
            <Field label="العنوان">
              <SAInput value={form.branchAddress} onChange={e => set('branchAddress', e.target.value)} placeholder="الرياض، حي النزهة" />
            </Field>
            <Field label="الهاتف">
              <SAInput value={form.branchPhone} onChange={e => set('branchPhone', e.target.value)} placeholder="+966500000000" />
            </Field>
          </div>
        </Section>

        {error && (
          <p className="text-sm rounded-md px-4 py-3" style={{ color: 'var(--red)', background: 'var(--red-bg)', border: '1px solid var(--red)' }}>
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={() => router.push('/super-admin/stores')}
            className="flex-1 py-2.5 rounded-md text-sm transition-colors"
            style={{ border: '1px solid var(--border-color)', color: 'var(--text-2)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--border-l)')}
            onMouseLeave={e => (e.currentTarget.style.background = '')}>
            إلغاء
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 py-2.5 rounded-md text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ background: 'var(--cerulean)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--cerulean-h)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--cerulean)')}>
            {loading ? 'جارٍ الإنشاء...' : 'إنشاء المتجر'}
          </button>
        </div>
      </form>
    </div>
  )
}
