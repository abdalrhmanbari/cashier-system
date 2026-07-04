'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Plus, Search, X, RotateCcw, Undo2, Banknote, FileText, Package, Loader2 } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { StInput, StTextarea } from '@/components/shared/StInput'

type SaleItem = {
  id: string; quantity: number; unitPrice: number; discount: number; total: number; netLineTotal: number; lineTax: number
  productId: string
  product: { name: string }
  returnItems: { quantity: number }[]
}
type Sale = {
  id: string; invoiceNumber: string; total: number; createdAt: string
  customer: { id: string; name: string } | null
  items: SaleItem[]
}
type SaleReturn = {
  id: string; returnNumber: string; reason: string | null; refundMethod: string
  total: number; createdAt: string
  sale: { invoiceNumber: string }
  customer: { name: string } | null
  user: { name: string }
  items: { id: string; quantity: number; unitPrice: number; total: number; product: { name: string } }[]
}
type Draft = Record<string, number> // saleItemId -> qty to return

const fmt = (amount: number) => String(parseFloat(Math.abs(amount).toFixed(2)))

export default function ReturnsPage() {
  const [returns,   setReturns]   = useState<SaleReturn[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')

  const [showForm,  setShowForm]  = useState(false)
  const [invoiceQ,  setInvoiceQ]  = useState('')
  const [results,   setResults]   = useState<Sale[]>([])
  const [searching, setSearching] = useState(false)
  const [sale,      setSale]      = useState<Sale | null>(null)
  const [draft,     setDraft]     = useState<Draft>({})
  const [reason,    setReason]    = useState('')
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'CREDIT_NOTE'>('CASH')
  const [saving,    setSaving]    = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetch('/api/store/returns').then(r => r.json())
    setReturns(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() {
    setInvoiceQ(''); setResults([]); setSale(null); setDraft({})
    setReason(''); setRefundMethod('CASH'); setFormError(''); setShowForm(true)
  }

  function closeForm() { setShowForm(false) }

  useEffect(() => {
    if (!showForm || sale) return
    const q = invoiceQ.trim()
    if (!q) { setResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      const data = await fetch(`/api/store/sales?q=${encodeURIComponent(q)}&limit=10`).then(r => r.json())
      setResults(Array.isArray(data) ? data : [])
      setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [invoiceQ, showForm, sale])

  function pickSale(s: Sale) {
    setSale(s); setResults([]); setDraft({}); setFormError('')
    if (!s.customer) setRefundMethod('CASH')
  }

  function remainingQty(item: SaleItem) {
    const returned = item.returnItems.reduce((sum, r) => sum + r.quantity, 0)
    return item.quantity - returned
  }

  function setQty(itemId: string, qty: number, max: number) {
    const clamped = Math.max(0, Math.min(qty, max))
    setDraft(d => {
      const next = { ...d }
      if (clamped <= 0) delete next[itemId]
      else next[itemId] = clamped
      return next
    })
  }

  // معاينة المبلغ المسترجَع — نفس منطق الخادم: نصيب الكمية المرجعة من (netLineTotal + lineTax) شاملاً الضريبة، وليس unitPrice الكامل
  const draftTotal = useMemo(() => {
    if (!sale) return 0
    return Object.entries(draft).reduce((sum, [itemId, qty]) => {
      const item = sale.items.find(i => i.id === itemId)
      if (!item) return sum
      const netRefund = Math.round((item.netLineTotal * qty) / item.quantity)
      const taxRefund  = Math.round((item.lineTax     * qty) / item.quantity)
      return sum + netRefund + taxRefund
    }, 0)
  }, [draft, sale])

  async function submitReturn(e: React.FormEvent) {
    e.preventDefault()
    if (!sale) return
    const items = Object.entries(draft).map(([saleItemId, quantity]) => ({ saleItemId, quantity }))
    if (items.length === 0) { setFormError('اختر كمية عنصر واحد على الأقل للاسترجاع'); return }

    setSaving(true); setFormError('')
    const res = await fetch('/api/store/returns', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saleId: sale.id, reason: reason.trim() || null, refundMethod, items }),
    })
    if (!res.ok) { const err = await res.json(); setFormError(err.error ?? 'حدث خطأ'); setSaving(false); return }
    const created: SaleReturn = await res.json()
    setReturns(prev => [created, ...prev])
    setSaving(false); setShowForm(false)
  }

  const filtered = returns.filter(r => !search
    || r.returnNumber.includes(search)
    || r.sale.invoiceNumber.includes(search)
    || r.customer?.name.includes(search))

  const totalRefunded = returns.reduce((s, r) => s + r.total, 0)
  const cashCount   = returns.filter(r => r.refundMethod === 'CASH').length
  const creditCount = returns.filter(r => r.refundMethod === 'CREDIT_NOTE').length

  const KPIs = [
    { label: 'إجمالي المرتجعات',  value: returns.length,  icon: RotateCcw, color: 'var(--indigo)', bg: 'var(--indigo-g)', fmt: false },
    { label: 'إجمالي المبالغ',    value: totalRefunded,   icon: Banknote,  color: 'var(--red)',     bg: 'var(--red-bg)',   fmt: true  },
    { label: 'استرجاع نقدي',      value: cashCount,       icon: Banknote,  color: 'var(--green)',   bg: 'var(--green-bg)', fmt: false },
    { label: 'إشعار دائن',        value: creditCount,     icon: FileText,  color: 'var(--purple)',  bg: 'var(--purple-bg)',fmt: false },
  ]

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }} dir="rtl">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>استرجاع المنتجات</h1>
        <button className="btn-primary" onClick={openNew} style={{ fontSize: '13px', padding: '6px 14px' }}>
          <Plus size={14} /> مرتجع جديد
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
                {k.fmt ? fmt(k.value) : k.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: '280px' }}>
        <Search size={13} style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-m)', pointerEvents: 'none' }} />
        <StInput value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث برقم المرتجع أو الفاتورة أو العميل..." style={{ paddingRight: '28px' }} />
      </div>

      {/* Table */}
      <DataTable
        data={filtered as unknown as Record<string, unknown>[]}
        loading={loading} searchable={false}
        emptyMessage="لا توجد مرتجعات"
        emptyIcon={<Undo2 size={28} />}
        columns={[
          {
            key: 'returnNumber', label: 'رقم المرتجع',
            render: (_, row) => {
              const r = row as unknown as SaleReturn
              return (
                <div>
                  <p style={{ fontWeight: 600, fontFamily: 'var(--mono)', color: 'var(--text)' }}>{r.returnNumber}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-m)', marginTop: '2px' }}>فاتورة {r.sale.invoiceNumber}</p>
                </div>
              )
            },
          },
          {
            key: 'customer', label: 'العميل',
            render: (_, row) => {
              const r = row as unknown as SaleReturn
              return r.customer ? <span style={{ color: 'var(--text-2)' }}>{r.customer.name}</span> : <span style={{ color: 'var(--text-m)' }}>—</span>
            },
          },
          {
            key: 'items', label: 'الأصناف',
            render: (_, row) => {
              const r = row as unknown as SaleReturn
              return <span style={{ color: 'var(--text-2)', fontSize: '13px' }}>{r.items.reduce((s, i) => s + i.quantity, 0)} قطعة</span>
            },
          },
          {
            key: 'refundMethod', label: 'طريقة الاسترجاع',
            render: (_, row) => {
              const r = row as unknown as SaleReturn
              return r.refundMethod === 'CASH'
                ? <span className="badge" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>نقدي</span>
                : <span className="badge" style={{ background: 'var(--purple-bg)', color: 'var(--purple)' }}>إشعار دائن</span>
            },
          },
          {
            key: 'total', label: 'المبلغ',
            render: (_, row) => <span style={{ fontWeight: 600, fontFamily: 'var(--mono)', color: 'var(--red)' }}>{fmt((row as unknown as SaleReturn).total)}</span>,
          },
          {
            key: 'createdAt', label: 'التاريخ',
            render: (_, row) => <span style={{ fontSize: '12.5px', color: 'var(--text-2)' }}>{new Date((row as unknown as SaleReturn).createdAt).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</span>,
          },
          {
            key: 'user', label: 'بواسطة',
            render: (_, row) => <span style={{ fontSize: '12.5px', color: 'var(--text-m)' }}>{(row as unknown as SaleReturn).user.name}</span>,
          },
        ]}
      />

      {/* ═══ مودال مرتجع جديد ═══ */}
      {showForm && (
        <div className="modal-backdrop" dir="rtl">
          <div className="modal-box" style={{ maxWidth: '560px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
              <h2 style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Undo2 size={16} style={{ color: 'var(--indigo)' }} /> مرتجع جديد
              </h2>
              <button onClick={closeForm} style={{ color: 'var(--text-m)', border: 'none', background: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            {!sale ? (
              /* ── خطوة 1: البحث عن الفاتورة ── */
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>ابحث برقم الفاتورة</label>
                  <div style={{ position: 'relative' }}>
                    <Search size={13} style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-m)' }} />
                    <StInput value={invoiceQ} onChange={e => setInvoiceQ(e.target.value)} placeholder="INV-2026-0001" autoFocus dir="ltr" style={{ paddingRight: '28px' }} />
                  </div>
                </div>
                <div style={{ minHeight: '120px' }}>
                  {searching && <p style={{ fontSize: '12.5px', color: 'var(--text-m)', display: 'flex', alignItems: 'center', gap: '6px' }}><Loader2 size={13} className="animate-spin" /> جارٍ البحث...</p>}
                  {!searching && invoiceQ.trim() && results.length === 0 && (
                    <p style={{ fontSize: '12.5px', color: 'var(--text-m)' }}>لا توجد فواتير مطابقة</p>
                  )}
                  {!searching && results.map(s => (
                    <button key={s.id} type="button" onClick={() => pickSale(s)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px', marginBottom: '6px', borderRadius: 'var(--r-s)',
                        border: '1px solid var(--border-color)', background: 'var(--white)', cursor: 'pointer',
                        fontFamily: 'var(--f)', textAlign: 'right',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--diamond)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--white)')}
                    >
                      <div>
                        <p style={{ fontWeight: 600, fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--text)' }}>{s.invoiceNumber}</p>
                        <p style={{ fontSize: '11.5px', color: 'var(--text-m)', marginTop: '2px' }}>
                          {s.customer?.name ?? 'عميل نقدي'} · {new Date(s.createdAt).toLocaleDateString('ar-EG')}
                        </p>
                      </div>
                      <span style={{ fontWeight: 600, fontFamily: 'var(--mono)', color: 'var(--indigo)' }}>{fmt(s.total)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* ── خطوة 2: اختيار الأصناف ── */
              <form onSubmit={submitReturn} style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderRadius: 'var(--r-s)', background: 'var(--indigo-g)', border: '1px solid var(--indigo)' }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>{sale.invoiceNumber}</p>
                    <p style={{ fontSize: '11.5px', color: 'var(--text-2)', marginTop: '2px' }}>{sale.customer?.name ?? 'عميل نقدي'}</p>
                  </div>
                  <button type="button" onClick={() => { setSale(null); setDraft({}) }} style={{ fontSize: '12px', color: 'var(--indigo)', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--f)' }}>
                    تغيير الفاتورة
                  </button>
                </div>

                {formError && <p style={{ fontSize: '12.5px', padding: '7px 10px', borderRadius: 'var(--r-s)', background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red)' }}>{formError}</p>}

                <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {sale.items.map(item => {
                    const max = remainingQty(item)
                    const qty = draft[item.id] ?? 0
                    return (
                      <div key={item.id} style={{
                        display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px',
                        borderRadius: 'var(--r-s)', border: '1px solid var(--border-color)',
                        opacity: max === 0 ? 0.5 : 1,
                      }}>
                        <Package size={14} style={{ color: 'var(--text-m)', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product.name}</p>
                          <p style={{ fontSize: '11px', color: 'var(--text-m)' }}>
                            بيع: {item.quantity} × {fmt(item.unitPrice)} · متاح للاسترجاع: {max}
                          </p>
                        </div>
                        <StInput
                          type="number" min={0} max={max} value={qty || ''}
                          placeholder="0"
                          disabled={max === 0}
                          onChange={e => setQty(item.id, Number(e.target.value), max)}
                          style={{ width: '64px', textAlign: 'center', flexShrink: 0 }}
                        />
                      </div>
                    )
                  })}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '5px' }}>طريقة الاسترجاع</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '6px' }}>
                    <button type="button" onClick={() => setRefundMethod('CASH')}
                      style={{ padding: '8px', borderRadius: 'var(--r-x)', fontSize: '12.5px', cursor: 'pointer', fontFamily: 'var(--f)', fontWeight: refundMethod === 'CASH' ? 600 : 400, border: refundMethod === 'CASH' ? '2px solid var(--green)' : '2px solid var(--border-color)', background: refundMethod === 'CASH' ? 'var(--green-bg)' : 'transparent', color: refundMethod === 'CASH' ? 'var(--green)' : 'var(--text-2)' }}>
                      استرجاع نقدي
                    </button>
                    <button type="button" onClick={() => sale.customer && setRefundMethod('CREDIT_NOTE')} disabled={!sale.customer}
                      title={!sale.customer ? 'يتطلب عميلاً مسجّلاً' : undefined}
                      style={{ padding: '8px', borderRadius: 'var(--r-x)', fontSize: '12.5px', cursor: sale.customer ? 'pointer' : 'not-allowed', fontFamily: 'var(--f)', fontWeight: refundMethod === 'CREDIT_NOTE' ? 600 : 400, border: refundMethod === 'CREDIT_NOTE' ? '2px solid var(--purple)' : '2px solid var(--border-color)', background: refundMethod === 'CREDIT_NOTE' ? 'var(--purple-bg)' : 'transparent', color: refundMethod === 'CREDIT_NOTE' ? 'var(--purple)' : 'var(--text-m)', opacity: sale.customer ? 1 : 0.5 }}>
                      إشعار دائن للعميل
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>سبب الاسترجاع</label>
                  <StTextarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="اختياري..." />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderRadius: 'var(--r-s)', background: 'var(--diamond)' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>إجمالي المبلغ المسترجع</span>
                  <span style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--red)' }}>{fmt(draftTotal)}</span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={closeForm}>إلغاء</button>
                  <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={saving || draftTotal === 0}>
                    {saving ? 'جارٍ التنفيذ...' : 'تأكيد الاسترجاع'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
