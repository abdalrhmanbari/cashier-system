'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Plus, Search, Edit2, Trash2, X, CreditCard, Users, DollarSign, Phone, MapPin, TrendingDown, TrendingUp } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { StInput } from '@/components/shared/StInput'
import { formatUsd } from '@/lib/utils'

type Customer = {
  id: string; name: string; phone: string | null; address: string | null
  creditLimit: number; currentBalance: number; debtLimitUsdCents: number | null; createdAt: string
  _count: { sales: number }
}
type BalanceType = 'none' | 'debt' | 'credit'
type FilterType  = 'all' | 'debt' | 'credit' | 'settled'

// creditLimit/balanceAmount/debtLimit هنا بالدولار (وليس سنتات) لسهولة الإدخال — تُحوَّل لسنتات قبل الإرسال للـ API
const EMPTY_FORM = { name: '', phone: '', address: '', creditLimit: 0, debtLimit: '' as number | '', balanceType: 'none' as BalanceType, balanceAmount: 0 }
const fmt = (amount: number) => formatUsd(Math.abs(amount))

export default function CustomersPage() {
  const { slug }                    = useParams<{ slug: string }>()
  const [customers,  setCustomers]  = useState<Customer[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [filter,     setFilter]     = useState<FilterType>('all')
  const [showForm,   setShowForm]   = useState(false)
  const [editing,    setEditing]    = useState<Customer | null>(null)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [saving,     setSaving]     = useState(false)
  const [formError,  setFormError]  = useState('')
  const [payTarget,  setPayTarget]  = useState<Customer | null>(null)
  const [payAmount,  setPayAmount]  = useState('')
  const [payMethod,  setPayMethod]  = useState<'CASH' | 'CARD' | 'TRANSFER'>('CASH')
  const [payLoading, setPayLoading] = useState(false)
  const [payError,   setPayError]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetch('/api/store/customers').then(r => r.json())
    setCustomers(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openNew()    { setEditing(null); setForm(EMPTY_FORM); setFormError(''); setShowForm(true) }
  function openEdit(c: Customer) {
    setEditing(c)
    setForm({ name: c.name, phone: c.phone ?? '', address: c.address ?? '', creditLimit: c.creditLimit / 100,
      debtLimit: c.debtLimitUsdCents != null ? c.debtLimitUsdCents / 100 : '',
      balanceType: c.currentBalance > 0 ? 'debt' : c.currentBalance < 0 ? 'credit' : 'none',
      balanceAmount: Math.abs(c.currentBalance) / 100 })
    setFormError(''); setShowForm(true)
  }

  async function saveForm(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setFormError('')
    const balanceCents  = Math.round(form.balanceAmount * 100)
    const currentBalance = form.balanceType === 'debt' ? balanceCents : form.balanceType === 'credit' ? -balanceCents : 0
    const url = editing ? `/api/store/customers/${editing.id}` : '/api/store/customers'
    const debtLimitUsdCents = form.debtLimit === '' ? null : Math.round(Number(form.debtLimit) * 100)
    const res = await fetch(url, { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name.trim(), phone: form.phone.trim() || null, address: form.address.trim() || null, creditLimit: Math.round(form.creditLimit * 100), currentBalance, debtLimitUsdCents }) })
    if (!res.ok) { const err = await res.json(); setFormError(err.error ?? 'حدث خطأ'); setSaving(false); return }
    const saved: Customer = await res.json()
    setCustomers(prev => editing ? prev.map(c => c.id === saved.id ? saved : c) : [saved, ...prev])
    setSaving(false); setShowForm(false)
  }

  async function deleteCustomer(c: Customer) {
    if (!confirm(`هل تريد حذف العميل "${c.name}"؟`)) return
    const res = await fetch(`/api/store/customers/${c.id}`, { method: 'DELETE' })
    if (!res.ok) { const err = await res.json(); alert(err.error ?? 'حدث خطأ'); return }
    setCustomers(prev => prev.filter(x => x.id !== c.id))
  }

  function openPayment(c: Customer) { setPayTarget(c); setPayAmount(''); setPayMethod('CASH'); setPayError('') }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault(); if (!payTarget) return
    const amount = Math.round(parseFloat(payAmount) * 100)
    if (!amount || amount <= 0) { setPayError('أدخل مبلغاً صحيحاً'); return }
    const bal = payTarget.currentBalance
    if (bal > 0 && amount > bal) { setPayError('المبلغ أكبر من الدين المستحق'); return }
    if (bal < 0 && amount > Math.abs(bal)) { setPayError('المبلغ أكبر من الرصيد المستحق'); return }
    setPayLoading(true); setPayError('')
    const payment = bal > 0 ? amount : -amount
    const res = await fetch(`/api/store/customers/${payTarget.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment, method: payMethod }) })
    if (!res.ok) { const err = await res.json(); setPayError(err.error ?? 'حدث خطأ'); setPayLoading(false); return }
    const updated: Customer = await res.json()
    setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c))
    setPayLoading(false); setPayTarget(null)
  }

  const filtered = customers.filter(c => {
    const bySrc = !search || c.name.includes(search) || c.phone?.includes(search)
    const byFil = filter === 'all' ? true : filter === 'debt' ? c.currentBalance > 0 : filter === 'credit' ? c.currentBalance < 0 : c.currentBalance === 0
    return bySrc && byFil
  })

  const totalDebt   = customers.filter(c => c.currentBalance > 0).reduce((s, c) => s + c.currentBalance, 0)
  const totalCredit = customers.filter(c => c.currentBalance < 0).reduce((s, c) => s + c.currentBalance, 0)
  const withDebt    = customers.filter(c => c.currentBalance > 0).length
  const withCredit  = customers.filter(c => c.currentBalance < 0).length

  const FILTERS: { key: FilterType; label: string; count: number }[] = [
    { key: 'all',     label: 'الكل',      count: customers.length },
    { key: 'debt',    label: 'عليهم دين', count: withDebt         },
    { key: 'credit',  label: 'لهم رصيد',  count: withCredit       },
    { key: 'settled', label: 'مسدّدون',   count: customers.length - withDebt - withCredit },
  ]

  const KPIs = [
    { label: 'إجمالي العملاء', value: customers.length, icon: Users,       color: 'var(--indigo)', bg: 'var(--indigo-g)', fmt: false },
    { label: 'دين على العملاء', value: totalDebt,        icon: TrendingUp,  color: 'var(--red)',     bg: 'var(--red-bg)',   fmt: true  },
    { label: 'رصيد للعملاء',   value: Math.abs(totalCredit), icon: TrendingDown, color: 'var(--info)',  bg: 'var(--blue-bg)', fmt: true },
    { label: 'صافي المديونية', value: totalDebt + totalCredit, icon: DollarSign, color: 'var(--amber)', bg: 'var(--amber-bg)', fmt: true },
  ]

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }} dir="rtl">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>العملاء</h1>
        <button className="btn-primary" onClick={openNew} style={{ fontSize: '13px', padding: '6px 14px' }}>
          <Plus size={14} /> عميل جديد
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: '10px' }}>
        {KPIs.map(k => (
          <div key={k.label} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: 'var(--r-s)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: k.bg, flexShrink: 0 }}>
              <k.icon size={16} style={{ color: k.color }} />
            </div>
            <div>
              <p style={{ fontSize: '11px', color: 'var(--text-m)', marginBottom: '2px' }}>{k.label}</p>
              <p style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text)', fontFamily: k.fmt ? 'var(--mono)' : undefined }}>
                {k.fmt ? fmt(k.value as number) : k.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters + Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '2px', padding: '3px', borderRadius: 'var(--r-s)', background: 'var(--diamond)' }}>
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px',
                borderRadius: '6px', fontSize: '12.5px', fontWeight: filter === f.key ? 600 : 400,
                border: 'none', cursor: 'pointer', fontFamily: 'var(--f)',
                background: filter === f.key ? 'var(--white)' : 'transparent',
                color: filter === f.key ? 'var(--text)' : 'var(--text-2)',
                boxShadow: filter === f.key ? 'var(--sh)' : 'none',
                transition: '.12s',
              }}>
              {f.label}
              <span style={{ fontSize: '11px', padding: '1px 5px', borderRadius: '9999px', background: filter === f.key ? 'var(--indigo-g)' : 'transparent', color: filter === f.key ? 'var(--indigo)' : 'var(--text-m)' }}>{f.count}</span>
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', flex: 1, minWidth: '180px', maxWidth: '280px' }}>
          <Search size={13} style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-m)', pointerEvents: 'none' }} />
          <StInput value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الهاتف..." style={{ paddingRight: '28px' }} />
        </div>
      </div>

      {/* Table */}
      <DataTable
        data={filtered as unknown as Record<string, unknown>[]}
        loading={loading} searchable={false}
        emptyMessage="لا يوجد عملاء"
        columns={[
          {
            key: 'name', label: 'العميل',
            render: (_, row) => {
              const c = row as unknown as Customer
              return (
                <div>
                  <p style={{ fontWeight: 500, color: 'var(--text)' }}>{c.name}</p>
                  {c.address && <p style={{ fontSize: '11px', color: 'var(--text-m)', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}><MapPin size={10} />{c.address}</p>}
                </div>
              )
            },
          },
          {
            key: 'phone', label: 'الهاتف',
            render: (_, row) => {
              const c = row as unknown as Customer
              return c.phone
                ? <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-2)', fontSize: '13px' }}><Phone size={11} style={{ color: 'var(--text-m)' }} />{c.phone}</span>
                : <span style={{ color: 'var(--text-m)' }}>—</span>
            },
          },
          { key: '_count', label: 'المبيعات', render: (_, row) => <span style={{ color: 'var(--text-2)' }}>{(row as unknown as Customer)._count.sales}</span> },
          {
            key: 'creditLimit', label: 'حد الائتمان',
            render: (_, row) => {
              const c = row as unknown as Customer
              return c.creditLimit > 0
                ? <span style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: 'var(--mono)' }}>{fmt(c.creditLimit)}</span>
                : <span style={{ color: 'var(--text-m)' }}>—</span>
            },
          },
          {
            key: 'currentBalance', label: 'الرصيد',
            render: (_, row) => {
              const c = row as unknown as Customer; const bal = c.currentBalance
              const over = c.creditLimit > 0 && bal > c.creditLimit
              if (bal === 0) return <span className="badge" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>✓ مسدّد</span>
              if (bal > 0)   return (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-m)' }}>عليه</span>
                  <span style={{ fontWeight: 600, fontFamily: 'var(--mono)', color: over ? 'var(--red)' : 'var(--amber)' }}>{fmt(bal)}</span>
                  {over && <span className="badge" style={{ background: 'var(--red-bg)', color: 'var(--red)', fontSize: '10px' }}>تجاوز الحد</span>}
                </span>
              )
              return (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-m)' }}>له</span>
                  <span style={{ fontWeight: 600, fontFamily: 'var(--mono)', color: 'var(--info)' }}>{fmt(bal)}</span>
                </span>
              )
            },
          },
        ]}
        actions={row => {
          const c = row as unknown as Customer; const bal = c.currentBalance
          return (
            <>
              {bal !== 0 && (
                <button onClick={() => openPayment(c)} title={bal > 0 ? 'تسجيل دفعة' : 'تسجيل سداد'}
                  style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--r-x)', border: '1px solid var(--border-color)', background: 'var(--green-bg)', color: 'var(--green)', cursor: 'pointer' }}>
                  <CreditCard size={13} />
                </button>
              )}
              <button onClick={() => openEdit(c)}
                style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--r-x)', border: '1px solid var(--border-color)', background: 'var(--white)', color: 'var(--text-2)', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--diamond)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--white)')}>
                <Edit2 size={13} />
              </button>
              <button onClick={() => deleteCustomer(c)}
                style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--r-x)', border: '1px solid var(--border-color)', background: 'var(--red-bg)', color: 'var(--red)', cursor: 'pointer' }}>
                <Trash2 size={13} />
              </button>
            </>
          )
        }}
        actionsLabel=""
      />

      {/* ═══ مودال العميل ═══ */}
      {showForm && (
        <div className="modal-backdrop" dir="rtl">
          <div className="modal-box" style={{ maxWidth: '460px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
              <h2 style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>{editing ? 'تعديل بيانات العميل' : 'عميل جديد'}</h2>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--text-m)', border: 'none', background: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={saveForm} style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {formError && <p style={{ fontSize: '12.5px', padding: '7px 10px', borderRadius: 'var(--r-s)', background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red)' }}>{formError}</p>}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>الاسم *</label>
                <StInput value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>الهاتف</label>
                  <StInput value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} dir="ltr" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>حد الائتمان ($)</label>
                  <StInput type="number" min={0} step="0.01" value={form.creditLimit} onChange={e => setForm(f => ({ ...f, creditLimit: Number(e.target.value) }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>سقف الدين ($)</label>
                  <StInput type="number" min={0} step="0.01" placeholder="بلا سقف تنبيه" value={form.debtLimit}
                    onChange={e => setForm(f => ({ ...f, debtLimit: e.target.value === '' ? '' : Number(e.target.value) }))} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>العنوان / المنطقة</label>
                <StInput value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              {/* رصيد ابتدائي */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--r-s)', padding: '10px 12px' }}>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>الرصيد الابتدائي</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px' }}>
                  {([
                    { key: 'none',   label: 'لا يوجد',   col: 'var(--text-2)', bgA: 'var(--diamond)',   bA: 'var(--border-color)' },
                    { key: 'debt',   label: 'عليه دين',  col: 'var(--red)',    bgA: 'var(--red-bg)',   bA: 'var(--red)'  },
                    { key: 'credit', label: 'له رصيد',   col: 'var(--info)',   bgA: 'var(--blue-bg)',  bA: 'var(--info)' },
                  ] as const).map(opt => (
                    <button key={opt.key} type="button" onClick={() => setForm(f => ({ ...f, balanceType: opt.key }))}
                      style={{
                        padding: '7px', borderRadius: 'var(--r-x)', fontSize: '12px', fontWeight: form.balanceType === opt.key ? 600 : 400,
                        cursor: 'pointer', border: form.balanceType === opt.key ? `2px solid ${opt.bA}` : '2px solid var(--border-color)',
                        background: form.balanceType === opt.key ? opt.bgA : 'transparent',
                        color: form.balanceType === opt.key ? opt.col : 'var(--text-m)',
                        transition: '.12s', fontFamily: 'var(--f)',
                      }}>{opt.label}</button>
                  ))}
                </div>
                {form.balanceType !== 'none' && (
                  <div style={{ marginTop: '8px' }}>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>المبلغ ($) *</label>
                    <StInput type="number" min={0.01} step="0.01" value={form.balanceAmount || ''} onChange={e => setForm(f => ({ ...f, balanceAmount: Number(e.target.value) }))} required placeholder="0" />
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowForm(false)}>إلغاء</button>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={saving}>
                  {saving ? 'جارٍ الحفظ...' : editing ? 'حفظ التعديلات' : 'إضافة العميل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ مودال الدفعة ═══ */}
      {payTarget && (
        <div className="modal-backdrop" dir="rtl">
          <div className="modal-box" style={{ maxWidth: '360px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
              <h2 style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CreditCard size={15} style={{ color: payTarget.currentBalance > 0 ? 'var(--green)' : 'var(--info)' }} />
                {payTarget.currentBalance > 0 ? 'تسجيل دفعة من العميل' : 'تسجيل سداد للعميل'}
              </h2>
              <button onClick={() => setPayTarget(null)} style={{ color: 'var(--text-m)', border: 'none', background: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <form onSubmit={submitPayment} style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ padding: '9px 12px', borderRadius: 'var(--r-s)', background: payTarget.currentBalance > 0 ? 'var(--amber-bg)' : 'var(--blue-bg)', border: `1px solid ${payTarget.currentBalance > 0 ? 'var(--amber)' : 'var(--info)'}` }}>
                <p style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>{payTarget.name}</p>
                <p style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '2px' }}>
                  {payTarget.currentBalance > 0 ? 'دين مستحق: ' : 'رصيد للعميل: '}
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: payTarget.currentBalance > 0 ? 'var(--amber)' : 'var(--info)' }}>{fmt(payTarget.currentBalance)}</span>
                </p>
              </div>
              {payError && <p style={{ fontSize: '12px', padding: '6px 10px', borderRadius: 'var(--r-s)', background: 'var(--red-bg)', color: 'var(--red)' }}>{payError}</p>}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '5px' }}>طريقة الدفع</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '5px' }}>
                  {(['CASH', 'CARD', 'TRANSFER'] as const).map(m => (
                    <button key={m} type="button" onClick={() => setPayMethod(m)}
                      style={{ padding: '6px', borderRadius: 'var(--r-x)', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--f)', border: payMethod === m ? '2px solid var(--indigo)' : '2px solid var(--border-color)', background: payMethod === m ? 'var(--indigo-g)' : 'transparent', color: payMethod === m ? 'var(--indigo)' : 'var(--text-2)', fontWeight: payMethod === m ? 600 : 400 }}>
                      {m === 'CASH' ? 'نقدي' : m === 'CARD' ? 'بطاقة' : 'تحويل'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>المبلغ ($) *</label>
                <StInput type="number" min={0.01} step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} required autoFocus placeholder="0" dir="ltr" />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setPayTarget(null)}>إلغاء</button>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center', background: payTarget.currentBalance > 0 ? 'var(--green)' : 'var(--info)' }} disabled={payLoading}>
                  {payLoading ? 'جارٍ التسجيل...' : 'تأكيد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}