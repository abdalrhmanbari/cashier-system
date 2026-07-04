'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, X } from 'lucide-react'
import { SAInput, SASelect, SATextarea } from '@/components/shared/SAInput'
import { Button } from '@/components/ui/button'

type PlanPrice = {
  id: string
  billingCycle: string
  minBranches: number
  maxBranches: number | null
  priceUsd: number
  discountPct: number
}

type Plan = {
  id: string
  name: string
  description: string | null
  prices: PlanPrice[]
}

const usd = (cents: number) => `$${parseFloat((cents / 100).toFixed(2))}`

function PlanModal({ plan, onClose, onSaved }: { plan: Plan | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(plan?.name ?? '')
  const [description, setDescription] = useState(plan?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!name.trim()) { setError('اسم الخطة مطلوب'); return }
    setSaving(true); setError('')
    try {
      const res = plan
        ? await fetch(`/api/super-admin/plans/${plan.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description }) })
        : await fetch('/api/super-admin/plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description }) })
      if (!res.ok) throw new Error()
      onSaved(); onClose()
    } catch { setError('حدث خطأ، حاول مرة أخرى') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: 'var(--white)', border: '1px solid var(--border-color)' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{plan ? 'تعديل الخطة' : 'إضافة خطة جديدة'}</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--text-2)' }}>اسم الخطة *</label>
            <SAInput value={name} onChange={e => setName(e.target.value)} placeholder="مثال: Basic / Pro / Enterprise" required />
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--text-2)' }}>الوصف</label>
            <SATextarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="وصف مختصر للخطة" />
          </div>
        </div>
        {error && <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>}
        <div className="flex gap-3 pt-1">
          <Button onClick={save} disabled={saving} className="flex-1">
            {saving ? 'جارٍ الحفظ...' : 'حفظ'}
          </Button>
          <Button variant="secondary" onClick={onClose} className="flex-1">
            إلغاء
          </Button>
        </div>
      </div>
    </div>
  )
}

const emptyPrice = { billingCycle: 'MONTHLY', minBranches: '1', maxBranches: '', priceUsd: '', discountPct: '0' }

function PriceModal({ planId, price, onClose, onSaved }: { planId: string; price: PlanPrice | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(price ? {
    billingCycle: price.billingCycle,
    minBranches:  String(price.minBranches),
    maxBranches:  price.maxBranches !== null ? String(price.maxBranches) : '',
    priceUsd:     String(parseFloat((price.priceUsd / 100).toFixed(2))),
    discountPct:  String(price.discountPct),
  } : { ...emptyPrice })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (field: string, val: string) => setForm(f => ({ ...f, [field]: val }))

  async function save() {
    if (!form.priceUsd || Number(form.priceUsd) <= 0) { setError('السعر مطلوب'); return }
    setSaving(true); setError('')
    try {
      const body = { billingCycle: form.billingCycle, minBranches: form.minBranches, maxBranches: form.maxBranches || null, priceUsd: form.priceUsd, discountPct: form.discountPct }
      const res = price
        ? await fetch(`/api/super-admin/plans/${planId}/prices/${price.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch(`/api/super-admin/plans/${planId}/prices`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'خطأ') }
      onSaved(); onClose()
    } catch (e) { setError((e as Error).message || 'حدث خطأ') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: 'var(--white)', border: '1px solid var(--border-color)' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{price ? 'تعديل شريحة السعر' : 'إضافة شريحة سعرية'}</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-sm mb-1" style={{ color: 'var(--text-2)' }}>دورة الفوترة</label>
            <SASelect value={form.billingCycle} onChange={e => set('billingCycle', e.target.value)}>
              <option value="MONTHLY">شهري</option>
              <option value="YEARLY">سنوي</option>
            </SASelect>
          </div>
          {[
            { label: 'الفروع من',              key: 'minBranches', min: 1,    placeholder: '' },
            { label: 'الفروع حتى (فارغ = ∞)', key: 'maxBranches', min: 1,    placeholder: '∞' },
            { label: 'السعر/فرع/شهر ($) *',   key: 'priceUsd',    min: 0,    placeholder: '', step: 0.01 },
            { label: 'الخصم (%)',              key: 'discountPct', min: 0,    placeholder: '', max: 100 },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-sm mb-1" style={{ color: 'var(--text-2)' }}>{f.label}</label>
              <SAInput value={form[f.key as keyof typeof form]} onChange={e => set(f.key, e.target.value)} type="number" min={f.min} max={f.max} step={f.step} placeholder={f.placeholder} />
            </div>
          ))}
        </div>
        {form.priceUsd && Number(form.priceUsd) > 0 && (
          <div className="rounded-md px-4 py-2.5 text-sm" style={{ background: 'var(--diamond)', color: 'var(--text-2)' }}>
            مثال (3 فروع):{' '}
            <span style={{ color: 'var(--cerulean)', fontFamily: 'var(--mono)' }}>
              ${parseFloat((Number(form.priceUsd) * 3 * (1 - Number(form.discountPct || 0) / 100)).toFixed(2))}
            </span>
            {form.billingCycle === 'YEARLY' && <span className="mr-2" style={{ color: 'var(--text-m)' }}>/ سنة</span>}
          </div>
        )}
        {error && <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>}
        <div className="flex gap-3 pt-1">
          <Button onClick={save} disabled={saving} className="flex-1">
            {saving ? 'جارٍ الحفظ...' : 'حفظ'}
          </Button>
          <Button variant="secondary" onClick={onClose} className="flex-1">
            إلغاء
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function PlansPage() {
  const [plans,   setPlans]   = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [open,    setOpen]    = useState<string | null>(null)
  const [planModal,  setPlanModal]  = useState<{ open: boolean; plan: Plan | null }>({ open: false, plan: null })
  const [priceModal, setPriceModal] = useState<{ open: boolean; planId: string; price: PlanPrice | null }>({ open: false, planId: '', price: null })

  async function load() {
    setLoading(true)
    const res = await fetch('/api/super-admin/plans')
    setPlans(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function deletePlan(plan: Plan) {
    if (!confirm(`حذف خطة "${plan.name}"؟`)) return
    await fetch(`/api/super-admin/plans/${plan.id}`, { method: 'DELETE' })
    load()
  }

  async function deletePrice(planId: string, priceId: string) {
    if (!confirm('حذف هذه الشريحة السعرية؟')) return
    await fetch(`/api/super-admin/plans/${planId}/prices/${priceId}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">الخطط والأسعار</h1>
        <Button onClick={() => setPlanModal({ open: true, plan: null })}>
          <Plus size={16} />
          خطة جديدة
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-20" style={{ color: 'var(--text-m)' }}>جارٍ التحميل...</div>
      ) : plans.length === 0 ? (
        <div className="text-center py-20" style={{ color: 'var(--text-m)' }}>لا توجد خطط بعد — أنشئ خطة جديدة</div>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => (
            <div key={plan.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--white)', border: '1px solid var(--border-color)' }}>
              <div className="flex items-center px-5 py-4 gap-3">
                {/* Accordion toggle — kept as raw button due to complex layout */}
                <button
                  onClick={() => setOpen(open === plan.id ? null : plan.id)}
                  className="flex-1 flex items-center justify-between text-right"
                >
                  <div>
                    <p className="font-bold text-lg">{plan.name}</p>
                    {plan.description && <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>{plan.description}</p>}
                  </div>
                  <div className="flex items-center gap-4 ml-3">
                    <span className="text-sm" style={{ color: 'var(--text-2)' }}>{plan.prices.length} شريحة سعرية</span>
                    {open === plan.id ? <ChevronUp size={18} style={{ color: 'var(--text-2)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-2)' }} />}
                  </div>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost-primary" size="icon-sm" onClick={() => setPlanModal({ open: true, plan })}>
                    <Pencil size={15} />
                  </Button>
                  <Button variant="ghost-destructive" size="icon-sm" onClick={() => deletePlan(plan)}>
                    <Trash2 size={15} />
                  </Button>
                </div>
              </div>

              {open === plan.id && (
                <div style={{ borderTop: '1px solid var(--border-color)' }}>
                  {plan.prices.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <tr>
                          {['دورة الفوترة','الفروع من','الفروع حتى','السعر/فرع/شهر','الخصم','مثال (3 فروع)',''].map((h, i) => (
                            <th key={i} className="text-right px-5 py-2 text-xs font-medium" style={{ color: 'var(--text-2)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {plan.prices.map(p => {
                          const example = Math.round(p.priceUsd * 3 * (1 - p.discountPct / 100))
                          return (
                            <tr key={p.id} className="group" style={{ borderTop: '1px solid var(--border-l)' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'var(--border-l)')}
                              onMouseLeave={e => (e.currentTarget.style.background = '')}>
                              <td className="px-5 py-2.5" style={{ color: 'var(--text)' }}>{p.billingCycle === 'MONTHLY' ? 'شهري' : 'سنوي'}</td>
                              <td className="px-5 py-2.5" style={{ color: 'var(--text)' }}>{p.minBranches}</td>
                              <td className="px-5 py-2.5" style={{ color: 'var(--text)' }}>{p.maxBranches ?? '∞'}</td>
                              <td className="px-5 py-2.5 font-medium" style={{ color: 'var(--cerulean)', fontFamily: 'var(--mono)' }}>{usd(p.priceUsd)}</td>
                              <td className="px-5 py-2.5" style={{ color: 'var(--green)' }}>{p.discountPct}%</td>
                              <td className="px-5 py-2.5 font-medium" style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>{usd(example)}</td>
                              <td className="px-5 py-2.5">
                                <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button variant="ghost-primary" size="icon-xs" onClick={() => setPriceModal({ open: true, planId: plan.id, price: p })}>
                                    <Pencil size={13} />
                                  </Button>
                                  <Button variant="ghost-destructive" size="icon-xs" onClick={() => deletePrice(plan.id, p.id)}>
                                    <Trash2 size={13} />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-center text-sm py-5" style={{ color: 'var(--text-m)' }}>لا توجد شرائح سعرية</p>
                  )}
                  <div className="px-5 py-3" style={{ borderTop: '1px solid var(--border-color)' }}>
                    <Button
                      variant="ghost-primary"
                      size="sm"
                      onClick={() => setPriceModal({ open: true, planId: plan.id, price: null })}
                    >
                      <Plus size={15} />
                      إضافة شريحة سعرية
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {planModal.open && (
        <PlanModal plan={planModal.plan} onClose={() => setPlanModal({ open: false, plan: null })} onSaved={load} />
      )}
      {priceModal.open && (
        <PriceModal planId={priceModal.planId} price={priceModal.price} onClose={() => setPriceModal({ open: false, planId: '', price: null })} onSaved={load} />
      )}
    </div>
  )
}
