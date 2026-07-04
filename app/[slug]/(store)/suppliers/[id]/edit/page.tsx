'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowRight, Plus, Package, Truck, Save, Trash2, DollarSign, FileText, Calendar } from 'lucide-react'
import { StInput, StSelect } from '@/components/shared/StInput'
import { formatUsd } from '@/lib/utils'

type Category    = { id: string; name: string; color: string }
type ProductRow  = { name: string; barcode: string; price: string; costPrice: string; stock: string; categoryId: string }
type InvRow      = { id: string; invoiceNumber: string; date: string; total: number; amountPaid: number; remaining: number; status: string; payment: string }

const EMPTY_ROW: ProductRow = { name: '', barcode: '', price: '', costPrice: '', stock: '0', categoryId: '' }
// كل المبالغ هنا بالدولار عند الإدخال — تُحوَّل لسنتات قبل الإرسال؛ inv.remaining/total/amountPaid تصل من الـ API بالسنتات أصلاً
const toCents = (v: string) => Math.round(parseFloat(v || '0') * 100)
const fmtNum  = (cents: number) => formatUsd(cents)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })

function StatusChip({ s }: { s: string }) {
  const map: Record<string, [string, string]> = {
    PAID:    ['مسدّد', 'var(--green)'],
    PARTIAL: ['جزئي',  'var(--amber)'],
    UNPAID:  ['غير مسدّد', 'var(--red)'],
  }
  const [label, color] = map[s] ?? map.UNPAID
  return (
    <span style={{ fontSize: '10.5px', fontWeight: 600, color, padding: '2px 7px', borderRadius: '999px', background: color.replace(')', '-bg)').replace('var(--', 'var(--') }}>
      {label}
    </span>
  )
}

export default function EditSupplierPage() {
  const router       = useRouter()
  const { slug, id } = useParams<{ slug: string; id: string }>()

  const [form,       setForm]       = useState({ name: '', phone: '', address: '' })
  const [invRows,    setInvRows]    = useState<InvRow[]>([])
  const [rows,       setRows]       = useState<ProductRow[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [newInv,     setNewInv]     = useState({ amount: '', payment: '' })
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')

  useEffect(() => {
    Promise.all([
      fetch(`/api/store/suppliers/${id}`).then(r => r.json()),
      fetch('/api/store/categories').then(r => r.json()),
    ]).then(([supplier, cats]) => {
      if (supplier?.id) {
        setForm({ name: supplier.name, phone: supplier.phone ?? '', address: supplier.address ?? '' })
        // load invoices with remaining balance
        const unpaid: InvRow[] = (supplier.invoices ?? [])
          .filter((inv: InvRow) => inv.remaining > 0)
          .map((inv: InvRow) => ({ ...inv, payment: '' }))
        setInvRows(unpaid)
      }
      if (Array.isArray(cats)) setCategories(cats)
      setLoading(false)
    })
  }, [id])

  function addRow()                                               { setRows(r => [...r, { ...EMPTY_ROW }]) }
  function removeRow(i: number)                                   { setRows(r => r.filter((_, idx) => idx !== i)) }
  function updateRow(i: number, key: keyof ProductRow, val: string) {
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [key]: val } : row))
  }
  function setInvPayment(i: number, val: string) {
    setInvRows(r => r.map((row, idx) => idx === i ? { ...row, payment: val } : row))
  }

  // total payments being made across all invoices
  const totalPayments = invRows.reduce((s, r) => s + Math.min(toCents(r.payment), r.remaining), 0)

  const newInvTotal   = toCents(newInv.amount)
  const newInvPayment = Math.min(toCents(newInv.payment), newInvTotal)
  const newInvRemain  = newInvTotal - newInvPayment
  const hasNewProducts = rows.some(r => r.name.trim())

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('اسم المورد مطلوب'); return }
    const valid = rows.filter(r => r.name.trim())
    if (valid.length > 0 && newInvTotal <= 0) { setError('عند إضافة منتجات جديدة يجب إدخال قيمة فاتورة التوريد'); return }
    setSaving(true); setError('')

    // 1. update supplier info
    const res = await fetch(`/api/store/suppliers/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name.trim(), phone: form.phone.trim() || null, address: form.address.trim() || null }),
    })
    if (!res.ok) { setSaving(false); setError('حدث خطأ أثناء الحفظ'); return }

    // 2. apply per-invoice payments
    const invoicesToPay = invRows.filter(r => toCents(r.payment) > 0)
    if (invoicesToPay.length > 0) {
      await Promise.allSettled(invoicesToPay.map(r =>
        fetch(`/api/store/supplier-invoices/${r.id}/pay`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: Math.min(toCents(r.payment), r.remaining) }),
        })
      ))
    }

    // 3. add new products and collect IDs for invoice items
    type CreatedProduct = { id: string; costPrice: number; stock: number }
    const createdProducts: CreatedProduct[] = []

    if (valid.length > 0) {
      const results = await Promise.allSettled(valid.map(async r => {
        const res = await fetch('/api/store/products', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: r.name.trim(), barcode: r.barcode.trim() || null,
            price: toCents(r.price), costPrice: toCents(r.costPrice),
            stock: parseInt(r.stock || '0', 10), minStock: 5,
            categoryId: r.categoryId || null,
          }),
        })
        if (!res.ok) return null
        const p = await res.json()
        return { id: p.id, costPrice: toCents(r.costPrice), stock: parseInt(r.stock || '0', 10) }
      }))
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) createdProducts.push(r.value)
      }
    }

    // 4. create supplier invoice for the new products
    if (newInvTotal > 0) {
      const items = createdProducts
        .filter(p => p.stock > 0 && p.costPrice > 0)
        .map(p => ({ productId: p.id, quantity: p.stock, unitCost: p.costPrice }))

      await fetch('/api/store/supplier-invoices', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierId: id, total: newInvTotal, amountPaid: newInvPayment, items }),
      })
    }

    router.push(`/${slug}/suppliers/${id}`)
  }

  const L: React.CSSProperties = { display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '5px' }

  if (loading) return (
    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-m)', fontSize: '13px' }} dir="rtl">
      جارٍ التحميل...
    </div>
  )

  return (
    <div style={{ padding: '16px 20px', maxWidth: '780px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }} dir="rtl">

      {/* شريط العنوان */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button type="button" onClick={() => router.push(`/${slug}/suppliers/${id}`)}
          style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', borderRadius: 'var(--r-x)', background: 'var(--white)', color: 'var(--text-2)', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--diamond)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--white)')}>
          <ArrowRight size={15} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <div style={{ width: '30px', height: '30px', borderRadius: 'var(--r-s)', background: 'var(--indigo-g)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: 'var(--indigo)' }}>
            {form.name.slice(0, 1) || '?'}
          </div>
          <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>تعديل: {form.name || '...'}</h1>
        </div>
      </div>

      <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* ── بيانات المورد ── */}
        <div className="card" style={{ padding: '16px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Truck size={13} style={{ color: 'var(--indigo)' }} /> بيانات المورد
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '10px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={L}>اسم المورد *</label>
              <StInput value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label style={L}>رقم الهاتف</label>
              <StInput value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} dir="ltr" />
            </div>
            <div>
              <label style={L}>العنوان</label>
              <StInput value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
          </div>
          {error && <p style={{ marginTop: '10px', fontSize: '12px', color: 'var(--red)', fontWeight: 500 }}>{error}</p>}
        </div>

        {/* ── الفواتير غير المسددة ── */}
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          {/* header */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <DollarSign size={13} style={{ color: 'var(--red)' }} />
              الفواتير غير المسددة
              {invRows.length > 0 && (
                <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-m)' }}>({invRows.length})</span>
              )}
            </h2>
            {totalPayments > 0 && (
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--green)', background: 'var(--green-bg)', padding: '2px 10px', borderRadius: '999px' }}>
                إجمالي الدفعات: {fmtNum(totalPayments)}
              </span>
            )}
          </div>

          {invRows.length === 0 ? (
            <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-m)', fontSize: '13px' }}>
              <DollarSign size={26} style={{ margin: '0 auto 8px', opacity: .25 }} />
              <p style={{ fontWeight: 500 }}>لا توجد فواتير غير مسددة</p>
              <p style={{ fontSize: '11px', marginTop: '3px' }}>جميع فواتير هذا المورد مسددة بالكامل</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <div style={{ minWidth: '640px' }}>
                  {/* رأس الجدول */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr 1fr 1fr 1.2fr', gap: '0', padding: '7px 16px', background: 'var(--diamond)', borderBottom: '1px solid var(--border-color)' }}>
                    {['رقم الفاتورة', 'التاريخ', 'الإجمالي', 'المدفوع', 'الباقي', 'الدفعة ($)'].map(h => (
                      <span key={h} style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-m)' }}>{h}</span>
                    ))}
                  </div>

                  {/* صفوف الفواتير */}
                  {invRows.map((inv, i) => {
                    const payInt   = Math.min(toCents(inv.payment), inv.remaining)
                    const afterPay = inv.remaining - payInt
                    return (
                      <div key={inv.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr 1fr 1fr 1.2fr', gap: '0', padding: '10px 16px', alignItems: 'center', borderBottom: i < invRows.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <FileText size={12} style={{ color: 'var(--indigo)', flexShrink: 0 }} />
                          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--indigo)', fontFamily: 'var(--mono)' }}>#{inv.invoiceNumber}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-2)', fontSize: '12px' }}>
                          <Calendar size={11} style={{ color: 'var(--text-m)' }} />
                          {fmtDate(inv.date)}
                        </div>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--text-2)' }}>{fmtNum(inv.total)}</span>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--green)' }}>{fmtNum(inv.amountPaid)}</span>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', fontWeight: 700, color: afterPay === 0 ? 'var(--green)' : 'var(--red)' }}>
                          {fmtNum(afterPay)}
                        </span>
                        <StInput
                          type="number" min="0" step="0.01" placeholder="0.00"
                          max={inv.remaining / 100}
                          value={inv.payment}
                          onChange={e => setInvPayment(i, e.target.value)}
                          style={{ fontSize: '13px' }}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ملخص */}
              {totalPayments > 0 && (
                <div style={{ padding: '10px 16px', background: 'var(--green-bg)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '20px', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-2)' }}>إجمالي الدفعات:</span>
                  <span style={{ fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--mono)' }}>{fmtNum(totalPayments)}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── إضافة منتجات جديدة ── */}
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Package size={13} style={{ color: 'var(--indigo)' }} />
              إضافة منتجات جديدة للمتجر
              <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-m)' }}>(اختياري)</span>
            </h2>
            <button type="button" onClick={addRow} className="btn-primary" style={{ fontSize: '12px', padding: '5px 12px' }}>
              <Plus size={13} /> أضف منتج
            </button>
          </div>

          {rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-m)', fontSize: '13px' }}>
              <Package size={26} style={{ margin: '0 auto 8px', opacity: .3 }} />
              <p>اضغط "أضف منتج" لإضافة منتجات من هذا المورد للمتجر</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="overflow-x-auto">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '640px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 32px', gap: '8px', padding: '0 2px' }}>
                    {['اسم المنتج', 'باركود', 'سعر البيع ($)', 'سعر التكلفة ($)', 'الكمية', ''].map(h => (
                      <span key={h} style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-m)' }}>{h}</span>
                    ))}
                  </div>
                  {rows.map((row, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 32px', gap: '8px', alignItems: 'center' }}>
                      <StInput placeholder="اسم المنتج *" value={row.name} onChange={e => updateRow(i, 'name', e.target.value)} />
                      <StInput placeholder="—" value={row.barcode} onChange={e => updateRow(i, 'barcode', e.target.value)} dir="ltr" />
                      <StInput placeholder="0.00" type="number" min="0" step="0.01" value={row.price} onChange={e => updateRow(i, 'price', e.target.value)} />
                      <StInput placeholder="0.00" type="number" min="0" step="0.01" value={row.costPrice} onChange={e => updateRow(i, 'costPrice', e.target.value)} />
                      <StInput placeholder="0" type="number" min="0" value={row.stock} onChange={e => updateRow(i, 'stock', e.target.value)} />
                      <button type="button" onClick={() => removeRow(i)}
                        style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', borderRadius: 'var(--r-x)', background: 'var(--red-bg)', color: 'var(--red)', cursor: 'pointer', flexShrink: 0 }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              {categories.length > 0 && rows.some(r => r.name.trim()) && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <p style={{ fontSize: '11px', color: 'var(--text-m)' }}>التصنيف لكل منتج:</p>
                  {rows.map((row, i) => !row.name.trim() ? null : (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-2)', minWidth: '100px', fontWeight: 500 }}>{row.name}</span>
                      <StSelect value={row.categoryId} onChange={e => updateRow(i, 'categoryId', e.target.value)} style={{ flex: 1 }}>
                        <option value="">بدون تصنيف</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </StSelect>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── فاتورة التوريد للمنتجات الجديدة ── */}
        {hasNewProducts && (
          <div className="card" style={{ padding: '16px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={13} style={{ color: 'var(--indigo)' }} />
              فاتورة التوريد
              <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-m)' }}>(مطلوبة عند إضافة منتجات)</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: '12px', alignItems: 'end' }}>
              <div>
                <label style={L}>قيمة الفاتورة ($) *</label>
                <StInput
                  type="number" min="0" step="0.01" placeholder="0.00"
                  value={newInv.amount}
                  onChange={e => setNewInv(v => ({ ...v, amount: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label style={L}>الدفعة الأولى ($)</label>
                <StInput
                  type="number" min="0" step="0.01" placeholder="0.00"
                  value={newInv.payment}
                  onChange={e => setNewInv(v => ({ ...v, payment: e.target.value }))}
                  disabled={!newInv.amount || newInvTotal === 0}
                />
              </div>
              <div>
                <label style={L}>الباقي</label>
                <div style={{
                  padding: '7px 12px', borderRadius: 'var(--r-s)', border: '1px solid var(--border-color)',
                  background: 'var(--diamond)', fontSize: '14px', fontWeight: 700, fontFamily: 'var(--mono)',
                  color: newInvRemain > 0 ? 'var(--red)' : newInvTotal > 0 ? 'var(--green)' : 'var(--text-m)',
                }}>
                  {fmtNum(newInvRemain)}
                </div>
              </div>
            </div>
            {newInvTotal > 0 && (
              <p style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-m)' }}>
                {newInvRemain === 0
                  ? '✓ الفاتورة مسددة بالكامل'
                  : `سيُضاف ${fmtNum(newInvRemain)} إلى رصيد المورد المستحق`}
              </p>
            )}
          </div>
        )}

        {/* أزرار الحفظ */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-outline" onClick={() => router.push(`/${slug}/suppliers/${id}`)} style={{ padding: '8px 20px' }}>
            إلغاء
          </button>
          <button type="submit" className="btn-primary" disabled={saving} style={{ padding: '8px 24px' }}>
            <Save size={14} />
            {saving ? 'جارٍ الحفظ...' : 'حفظ'}
          </button>
        </div>

      </form>
    </div>
  )
}
