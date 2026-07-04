'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowRight, Plus, Package, Truck, Save, Trash2, FileText } from 'lucide-react'
import { StInput, StSelect } from '@/components/shared/StInput'
import { formatUsd } from '@/lib/utils'

type Category = { id: string; name: string; color: string }

type ProductRow = {
  name: string; barcode: string; price: string; costPrice: string; stock: string; categoryId: string
}

const EMPTY_ROW: ProductRow = { name: '', barcode: '', price: '', costPrice: '', stock: '0', categoryId: '' }

// كل المبالغ هنا (سعر البيع/التكلفة/فاتورة التوريد) تُدخل بالدولار وتُحوَّل لسنتات قبل الإرسال
const toCents = (v: string) => Math.round(parseFloat(v || '0') * 100)
const fmtNum  = (cents: number) => formatUsd(cents)

export default function NewSupplierPage() {
  const router   = useRouter()
  const { slug } = useParams<{ slug: string }>()

  const [form,       setForm]       = useState({ name: '', phone: '', address: '' })
  const [rows,       setRows]       = useState<ProductRow[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [inv,        setInv]        = useState({ amount: '', payment: '', dueDate: '' })
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')

  useEffect(() => {
    fetch('/api/store/categories').then(r => r.json()).then(d => { if (Array.isArray(d)) setCategories(d) })
  }, [])

  function addRow()                                               { setRows(r => [...r, { ...EMPTY_ROW }]) }
  function removeRow(i: number)                                   { setRows(r => r.filter((_, idx) => idx !== i)) }
  function updateRow(i: number, key: keyof ProductRow, val: string) {
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [key]: val } : row))
  }

  const invTotal     = toCents(inv.amount)
  const invPayment   = Math.min(toCents(inv.payment), invTotal)
  const invRemain    = invTotal - invPayment
  const hasProducts  = rows.some(r => r.name.trim())

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('اسم المورد مطلوب'); return }
    const validRows = rows.filter(r => r.name.trim())
    if (validRows.length > 0 && invTotal <= 0) { setError('عند إضافة منتجات يجب إدخال قيمة فاتورة التوريد'); return }
    setSaving(true); setError('')

    // 1. create supplier
    const supRes = await fetch('/api/store/suppliers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name.trim(), phone: form.phone.trim() || null, address: form.address.trim() || null }),
    })
    if (!supRes.ok) { setSaving(false); setError('حدث خطأ أثناء حفظ المورد'); return }
    const supplier = await supRes.json()

    // 2. create products and collect IDs for invoice items
    type CreatedProduct = { id: string; costPrice: number; stock: number }
    const createdProducts: CreatedProduct[] = []

    if (validRows.length > 0) {
      const results = await Promise.allSettled(validRows.map(async r => {
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

    // 3. create supplier invoice if amount entered
    if (invTotal > 0) {
      const items = createdProducts
        .filter(p => p.stock > 0 && p.costPrice > 0)
        .map(p => ({ productId: p.id, quantity: p.stock, unitCost: p.costPrice }))

      await fetch('/api/store/supplier-invoices', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierId: supplier.id, total: invTotal, amountPaid: invPayment, items, dueDate: inv.dueDate || null }),
      })
    }

    router.push(`/${slug}/suppliers`)
  }

  const L: React.CSSProperties = { display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '5px' }

  return (
    <div style={{ padding: '16px 20px', maxWidth: '760px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }} dir="rtl">

      {/* شريط العنوان */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button type="button" onClick={() => router.push(`/${slug}/suppliers`)}
          style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', borderRadius: 'var(--r-x)', background: 'var(--white)', color: 'var(--text-2)', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--diamond)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--white)')}>
          <ArrowRight size={15} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <div style={{ width: '30px', height: '30px', borderRadius: 'var(--r-s)', background: 'var(--indigo-g)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Truck size={15} style={{ color: 'var(--indigo)' }} />
          </div>
          <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>مورد جديد</h1>
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
              <StInput value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="مثال: شركة النور للتوزيع" required />
            </div>
            <div>
              <label style={L}>رقم الهاتف</label>
              <StInput value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="05xxxxxxxx" dir="ltr" />
            </div>
            <div>
              <label style={L}>العنوان</label>
              <StInput value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="المدينة، الحي..." />
            </div>
          </div>
          {error && <p style={{ marginTop: '10px', fontSize: '12px', color: 'var(--red)', fontWeight: 500 }}>{error}</p>}
        </div>

        {/* ── البضاعة الواردة ── */}
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Package size={13} style={{ color: 'var(--indigo)' }} />
              إضافة بضاعة للمتجر
              <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-m)' }}>(اختياري)</span>
            </h2>
            <button type="button" onClick={addRow} className="btn-primary" style={{ fontSize: '12px', padding: '5px 12px' }}>
              <Plus size={13} /> أضف منتج
            </button>
          </div>

          {rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-m)', fontSize: '13px' }}>
              <Package size={26} style={{ margin: '0 auto 8px', opacity: .3 }} />
              <p>اضغط "أضف منتج" لإضافة بضاعة هذا المورد للمتجر</p>
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
                      <span style={{ fontSize: '12px', color: 'var(--text-2)', minWidth: '120px', fontWeight: 500 }}>{row.name}</span>
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

        {/* ── فاتورة التوريد ── */}
        <div className="card" style={{ padding: '16px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={13} style={{ color: 'var(--indigo)' }} />
            فاتورة التوريد
            <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-m)' }}>
              {hasProducts ? '(مطلوبة عند إضافة منتجات)' : '(اختياري)'}
            </span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-4" style={{ gap: '12px', alignItems: 'end' }}>
            <div>
              <label style={L}>قيمة الفاتورة ($) {hasProducts && '*'}</label>
              <StInput
                type="number" min="0" step="0.01" placeholder="0.00"
                value={inv.amount}
                onChange={e => setInv(v => ({ ...v, amount: e.target.value }))}
                required={hasProducts}
              />
            </div>
            <div>
              <label style={L}>الدفعة الأولى ($)</label>
              <StInput
                type="number" min="0" step="0.01" placeholder="0.00"
                value={inv.payment}
                onChange={e => setInv(v => ({ ...v, payment: e.target.value }))}
                disabled={!inv.amount || invTotal === 0}
              />
            </div>
            <div>
              <label style={L}>تاريخ الاستحقاق</label>
              <StInput
                type="date"
                value={inv.dueDate}
                onChange={e => setInv(v => ({ ...v, dueDate: e.target.value }))}
                disabled={!inv.amount || invTotal === 0}
              />
            </div>
            <div>
              <label style={L}>الباقي</label>
              <div style={{
                padding: '7px 12px', borderRadius: 'var(--r-s)', border: '1px solid var(--border-color)',
                background: 'var(--diamond)', fontSize: '14px', fontWeight: 700, fontFamily: 'var(--mono)',
                color: invRemain > 0 ? 'var(--red)' : invTotal > 0 ? 'var(--green)' : 'var(--text-m)',
              }}>
                {fmtNum(invRemain)}
              </div>
            </div>
          </div>
          {invTotal > 0 && (
            <p style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-m)' }}>
              {invRemain === 0
                ? '✓ الفاتورة مسددة بالكامل'
                : `سيُضاف ${fmtNum(invRemain)} إلى رصيد المورد المستحق`}
            </p>
          )}
        </div>

        {/* أزرار الحفظ */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-outline" onClick={() => router.push(`/${slug}/suppliers`)} style={{ padding: '8px 20px' }}>
            إلغاء
          </button>
          <button type="submit" className="btn-primary" disabled={saving} style={{ padding: '8px 24px' }}>
            <Save size={14} />
            {saving ? 'جارٍ الحفظ...' : 'حفظ المورد'}
          </button>
        </div>

      </form>
    </div>
  )
}
