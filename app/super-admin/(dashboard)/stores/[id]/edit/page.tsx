'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowRight, Plus, Pencil, Wrench, CreditCard } from 'lucide-react'
import { SAInput, SASelect, SATextarea } from '@/components/shared/SAInput'
import { Button } from '@/components/ui/button'

type StoreType = { id: string; name: string; icon: string }
type Branch    = { id: string; name: string; address: string | null; phone: string | null }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--white)', border: '1px solid var(--border-color)' }}>
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs mb-1" style={{ color: 'var(--text-2)' }}>{label}</label>
      {children}
    </div>
  )
}

export default function EditStorePage() {
  const router  = useRouter()
  const params  = useParams()
  const storeId = params.id as string

  const [storeTypes,  setStoreTypes]  = useState<StoreType[]>([])
  const [branches,    setBranches]    = useState<Branch[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [success,     setSuccess]     = useState('')
  const [storeSlug,   setStoreSlug]   = useState('')

  const [storeForm, setStoreForm] = useState({
    name: '', phone: '', address: '', storeTypeId: '',
    maintenanceMode: false, maintenanceMessage: '',
  })

  const [branchMode,       setBranchMode]       = useState<'edit' | 'add'>('edit')
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [branchForm,       setBranchForm]       = useState({ name: '', address: '', phone: '' })

  useEffect(() => {
    async function loadAll() {
      const [storeRes, branchRes, typeRes] = await Promise.all([
        fetch(`/api/super-admin/stores/${storeId}`),
        fetch(`/api/super-admin/stores/${storeId}/branches`),
        fetch('/api/super-admin/store-types'),
      ])
      const [store, branchData, typeData] = await Promise.all([
        storeRes.json(), branchRes.json(), typeRes.json(),
      ])
      setStoreTypes(typeData)
      const branchList: Branch[] = Array.isArray(branchData) ? branchData : []
      setBranches(branchList)
      setStoreSlug(store.slug ?? '')
      setStoreForm({
        name:        store.name        ?? '',
        phone:       store.phone       ?? '',
        address:     store.address     ?? '',
        storeTypeId: store.storeTypeId ?? typeData[0]?.id ?? '',
        maintenanceMode:    store.maintenanceMode    ?? false,
        maintenanceMessage: store.maintenanceMessage ?? '',
      })
      if (branchList[0]) {
        setSelectedBranchId(branchList[0].id)
        setBranchForm({ name: branchList[0].name, address: branchList[0].address ?? '', phone: branchList[0].phone ?? '' })
      }
      setPageLoading(false)
    }
    loadAll()
  }, [storeId])

  function selectBranch(id: string) {
    setSelectedBranchId(id)
    const b = branches.find(b => b.id === id)
    if (b) setBranchForm({ name: b.name, address: b.address ?? '', phone: b.phone ?? '' })
  }

  function switchMode(mode: 'edit' | 'add') {
    setBranchMode(mode)
    if (mode === 'add') {
      setBranchForm({ name: '', address: '', phone: '' })
    } else if (branches[0]) {
      selectBranch(selectedBranchId || branches[0].id)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(''); setSuccess('')

    const storeRes = await fetch(`/api/super-admin/stores/${storeId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(storeForm),
    })
    if (!storeRes.ok) {
      const d = await storeRes.json()
      setError(d.error ?? 'خطأ في تحديث المتجر')
      setSaving(false); return
    }

    if (branchMode === 'edit' && selectedBranchId) {
      const res = await fetch(`/api/super-admin/stores/${storeId}/branches/${selectedBranchId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(branchForm),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'خطأ في تحديث الفرع'); setSaving(false); return }
    } else if (branchMode === 'add' && branchForm.name.trim()) {
      const res = await fetch(`/api/super-admin/stores/${storeId}/branches`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(branchForm),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'خطأ في إضافة الفرع'); setSaving(false); return }
    }

    setSaving(false); setSuccess('تم الحفظ بنجاح')
    setTimeout(() => router.push('/super-admin/stores'), 1000)
  }

  if (pageLoading) {
    return <div className="flex items-center justify-center py-32 text-sm" style={{ color: 'var(--text-m)' }}>جارٍ التحميل...</div>
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/super-admin/stores')} className="transition-colors" style={{ color: 'var(--text-2)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-2)')}>
          <ArrowRight size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">تعديل المتجر</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-m)', fontFamily: 'var(--mono)' }}>{storeSlug}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push(`/super-admin/stores/${storeId}/subscription`)}>
          <CreditCard size={14} /> إدارة الاشتراك
        </Button>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <Section title="بيانات المتجر">
          <div className="grid grid-cols-2 gap-4">
            <Field label="اسم المتجر">
              <SAInput value={storeForm.name} onChange={e => setStoreForm(f => ({ ...f, name: e.target.value }))} required placeholder="سوبر ماركت الأمل" />
            </Field>
            <Field label="الهاتف">
              <SAInput value={storeForm.phone} onChange={e => setStoreForm(f => ({ ...f, phone: e.target.value }))} placeholder="+966500000000" />
            </Field>
          </div>
          <Field label="العنوان">
            <SAInput value={storeForm.address} onChange={e => setStoreForm(f => ({ ...f, address: e.target.value }))} placeholder="الرياض، حي النزهة" />
          </Field>
          <Field label="نوع المتجر">
            <SASelect value={storeForm.storeTypeId} onChange={e => setStoreForm(f => ({ ...f, storeTypeId: e.target.value }))}>
              {storeTypes.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
            </SASelect>
          </Field>
        </Section>

        <Section title="صيانة المتجر">
          <button
            type="button"
            onClick={() => setStoreForm(f => ({ ...f, maintenanceMode: !f.maintenanceMode }))}
            className="flex items-center gap-2 text-sm transition-colors"
            style={{ color: storeForm.maintenanceMode ? 'var(--amber)' : 'var(--text-m)' }}
          >
            <Wrench size={16} />
            {storeForm.maintenanceMode ? 'المتجر موقوف للصيانة حالياً' : 'المتجر يعمل بشكل طبيعي'}
            <span
              className="inline-block px-2 py-0.5 rounded text-xs font-medium"
              style={storeForm.maintenanceMode
                ? { background: 'var(--amber-bg)', color: 'var(--amber)' }
                : { background: 'var(--green-bg)', color: 'var(--green)' }}
            >
              {storeForm.maintenanceMode ? 'إيقاف الصيانة' : 'تفعيل الصيانة'}
            </span>
          </button>
          {storeForm.maintenanceMode && (
            <Field label="رسالة الصيانة لهذا المتجر (اختياري — تُستخدم رسالة المنصة العامة إن تُركت فارغة)">
              <SATextarea
                rows={2}
                value={storeForm.maintenanceMessage}
                onChange={e => setStoreForm(f => ({ ...f, maintenanceMessage: e.target.value }))}
                placeholder="هذا المتجر تحت الصيانة مؤقتاً"
              />
            </Field>
          )}
        </Section>

        <Section title="الفرع">
          <div className="flex gap-1 rounded-lg p-1 w-fit" style={{ background: 'var(--diamond)' }}>
            {[
              { mode: 'edit' as const, icon: <Pencil size={12} />, label: 'تعديل فرع موجود' },
              { mode: 'add'  as const, icon: <Plus   size={12} />, label: 'إضافة فرع جديد'  },
            ].map(({ mode, icon, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => switchMode(mode)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                style={branchMode === mode
                  ? { background: 'var(--cerulean)', color: '#FFFFFF' }
                  : { color: 'var(--text-2)' }
                }
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          {branchMode === 'edit' && (
            <Field label="اختر الفرع">
              {branches.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-m)' }}>لا توجد فروع — استخدم وضع الإضافة</p>
              ) : (
                <SASelect value={selectedBranchId} onChange={e => selectBranch(e.target.value)}>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </SASelect>
              )}
            </Field>
          )}

          {(branchMode === 'add' || branches.length > 0) && (
            <div className="grid grid-cols-3 gap-4">
              <Field label="اسم الفرع">
                <SAInput value={branchForm.name} onChange={e => setBranchForm(f => ({ ...f, name: e.target.value }))} required={branchMode === 'add'} placeholder="الفرع الرئيسي" />
              </Field>
              <Field label="العنوان">
                <SAInput value={branchForm.address} onChange={e => setBranchForm(f => ({ ...f, address: e.target.value }))} placeholder="الرياض، حي النزهة" />
              </Field>
              <Field label="الهاتف">
                <SAInput value={branchForm.phone} onChange={e => setBranchForm(f => ({ ...f, phone: e.target.value }))} placeholder="+966500000000" />
              </Field>
            </div>
          )}
        </Section>

        {error && (
          <p className="text-sm rounded-md px-4 py-3" style={{ color: 'var(--red)', background: 'var(--red-bg)', border: '1px solid var(--red)' }}>{error}</p>
        )}
        {success && (
          <p className="text-sm rounded-md px-4 py-3" style={{ color: 'var(--green)', background: 'var(--green-bg)', border: '1px solid var(--green)' }}>{success}</p>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={() => router.push('/super-admin/stores')}
            className="flex-1 py-2.5 rounded-md text-sm transition-colors"
            style={{ border: '1px solid var(--border-color)', color: 'var(--text-2)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--border-l)')}
            onMouseLeave={e => (e.currentTarget.style.background = '')}>
            إلغاء
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 py-2.5 rounded-md text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ background: 'var(--cerulean)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--cerulean-h)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--cerulean)')}>
            {saving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
          </button>
        </div>
      </form>
    </div>
  )
}
