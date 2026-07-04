'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Edit2, Trash2, AlertTriangle, X, Tag, Check } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { StInput, StSelect } from '@/components/shared/StInput'
import { formatUsd, formatSyp } from '@/lib/utils'

type Category = { id: string; name: string; color: string; _count?: { products: number } }
type Product  = {
  id: string; name: string; barcode: string | null; price: number; priceCurrency: string; costPrice: number
  stock: number; minStock: number; lowStockThreshold: number | null; isActive: boolean; hasDiscount: boolean
  discountType: string | null; discountValue: number; category: Category | null
}

const EMPTY: Omit<Product, 'id' | 'isActive' | 'category' | 'priceCurrency'> = {
  name: '', barcode: '', price: 0, costPrice: 0, stock: 0,
  minStock: 5, lowStockThreshold: null, hasDiscount: false, discountType: null, discountValue: 0,
}

const PRESET_COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#64748b']

/** يعرض السعر بعملة المنتج الخاصة (priceCurrency) — وليس إعداد المتجر الحالي */
const fmtPrice = (p: { price: number; priceCurrency: string }) =>
  p.priceCurrency === 'SYP' ? formatSyp(p.price) : formatUsd(p.price)

/* ─── small icon button ─── */
function IconBtn({ onClick, danger, children }: { onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      style={{
        width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 'var(--r-x)', border: '1px solid var(--border-color)', background: 'var(--white)',
        color: danger ? 'var(--red)' : 'var(--text-2)', cursor: 'pointer', transition: 'background .12s, border-color .12s',
        fontFamily: 'var(--f)',
      }}
      onMouseEnter={e => { const el = e.currentTarget; el.style.background = danger ? 'var(--red-bg)' : 'var(--diamond)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--white)'; }}
    >
      {children}
    </button>
  )
}

export default function ProductsPage() {
  const [products,   setProducts]   = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [catFilter,  setCatFilter]  = useState('')
  const [lowOnly,    setLowOnly]    = useState(false)
  const [editing,    setEditing]    = useState<Product | null>(null)
  const [showForm,   setShowForm]   = useState(false)
  const [form,       setForm]       = useState<typeof EMPTY & { categoryId?: string }>(EMPTY)
  const [saving,     setSaving]     = useState(false)
  const [deleting,   setDeleting]   = useState<Product | null>(null)

  const [showCatModal, setShowCatModal] = useState(false)
  const [catForm,      setCatForm]      = useState({ name: '', color: PRESET_COLORS[0] })
  const [catSaving,    setCatSaving]    = useState(false)
  const [editingCat,   setEditingCat]   = useState<Category | null>(null)
  const [editCatForm,  setEditCatForm]  = useState({ name: '', color: '' })
  const [pricingCurrency, setPricingCurrency] = useState('USD')

  const load = useCallback(async () => {
    setLoading(true)
    const [pr, ca, st] = await Promise.all([
      fetch('/api/store/products').then(r => r.json()),
      fetch('/api/store/categories').then(r => r.json()),
      fetch('/api/store/settings').then(r => r.json()),
    ])
    setProducts(Array.isArray(pr) ? pr : [])
    setCategories(Array.isArray(ca) ? ca : [])
    setPricingCurrency(st?.pricingCurrency ?? 'USD')
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openNew()  { setEditing(null); setForm(EMPTY); setShowForm(true) }
  function openEdit(p: Product) {
    setEditing(p)
    setForm({ name: p.name, barcode: p.barcode ?? '', price: p.price, costPrice: p.costPrice, stock: p.stock, minStock: p.minStock, lowStockThreshold: p.lowStockThreshold, hasDiscount: p.hasDiscount, discountType: p.discountType, discountValue: p.discountValue, categoryId: p.category?.id })
    setShowForm(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    await fetch(editing ? `/api/store/products/${editing.id}` : '/api/store/products', {
      method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, barcode: form.barcode || null }),
    })
    setSaving(false); setShowForm(false); load()
  }

  async function confirmDelete() {
    if (!deleting) return
    await fetch(`/api/store/products/${deleting.id}`, { method: 'DELETE' })
    setProducts(p => p.filter(x => x.id !== deleting.id)); setDeleting(null)
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault(); if (!catForm.name.trim()) return; setCatSaving(true)
    const res = await fetch('/api/store/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(catForm) })
    const cat = await res.json()
    setCategories(prev => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)))
    setCatForm({ name: '', color: PRESET_COLORS[0] }); setCatSaving(false)
  }

  async function saveEditCat(id: string) {
    await fetch(`/api/store/categories/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editCatForm) })
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...editCatForm } : c)); setEditingCat(null)
  }

  const filtered = products.filter(p => {
    const bySearch = !search    || p.name.includes(search)  || p.barcode?.includes(search)
    const byCat    = !catFilter || p.category?.id === catFilter
    const byLow    = !lowOnly   || p.stock <= p.minStock
    return bySearch && byCat && byLow
  })

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }} dir="rtl">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>المنتجات</h1>
        <div style={{ display: 'flex', gap: '7px' }}>
          <button className="btn-outline" onClick={() => setShowCatModal(true)} style={{ fontSize: '13px', padding: '6px 12px' }}>
            <Tag size={14} /> التصنيفات
          </button>
          <button className="btn-primary" onClick={openNew} style={{ fontSize: '13px', padding: '6px 14px' }}>
            <Plus size={14} /> منتج جديد
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
          <Search size={13} style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-m)', pointerEvents: 'none' }} />
          <StInput value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الباركود..." style={{ paddingRight: '28px' }} />
        </div>
        <StSelect value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ width: 'auto', minWidth: '140px' }}>
          <option value="">كل التصنيفات</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </StSelect>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'var(--text-2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)} style={{ accentColor: 'var(--amber)' }} />
          <AlertTriangle size={13} style={{ color: 'var(--amber)' }} />
          مخزون منخفض فقط
        </label>
      </div>

      {/* Table */}
      <DataTable
        data={filtered as unknown as Record<string, unknown>[]}
        loading={loading}
        searchable={false}
        exportable={true}
        exportFilename="products"
        emptyMessage="لا توجد منتجات"
        columns={[
          {
            key: 'name', label: 'المنتج',
            render: (_, row) => {
              const p = row as unknown as Product
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: p.category?.color ? `${p.category.color}20` : 'var(--diamond)', color: p.category?.color ?? 'var(--text-m)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
                    {p.name.slice(0,1)}
                  </div>
                  <span style={{ fontWeight: 500, color: 'var(--text)' }}>{p.name}</span>
                </div>
              )
            },
          },
          {
            key: 'category', label: 'التصنيف',
            render: (_, row) => {
              const p = row as unknown as Product
              return p.category
                ? <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '9999px', fontSize: '11.5px', fontWeight: 500, background: `${p.category.color}20`, color: p.category.color }}>{p.category.name}</span>
                : <span style={{ color: 'var(--text-m)' }}>—</span>
            },
          },
          {
            key: 'barcode', label: 'الباركود',
            render: (_, row) => <span style={{ fontSize: '12px', color: 'var(--text-m)', fontFamily: 'var(--mono)' }}>{(row as unknown as Product).barcode ?? '—'}</span>,
          },
          {
            key: 'price', label: 'السعر',
            render: (_, row) => {
              const p = row as unknown as Product
              return (
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--indigo)', fontFamily: 'var(--mono)' }}>{fmtPrice(p)}</span>
                  {p.priceCurrency !== pricingCurrency && (
                    <span className="badge" title="عملة مخالفة لإعداد المتجر الحالي" style={{ background: 'var(--amber-bg)', color: 'var(--amber)', fontSize: '10px' }}>{p.priceCurrency}</span>
                  )}
                </span>
              )
            },
          },
          {
            key: 'costPrice', label: 'التكلفة',
            render: (_, row) => <span style={{ color: 'var(--text-2)', fontFamily: 'var(--mono)' }}>{fmtPrice({ price: (row as unknown as Product).costPrice, priceCurrency: (row as unknown as Product).priceCurrency })}</span>,
          },
          {
            key: 'stock', label: 'المخزون',
            render: (_, row) => {
              const p = row as unknown as Product
              const low = p.stock <= p.minStock
              return (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: low ? 'var(--red)' : p.stock === 0 ? 'var(--red)' : 'var(--text)' }}>
                  {low && <AlertTriangle size={11} style={{ color: 'var(--amber)' }} />}
                  {p.stock}
                </span>
              )
            },
          },
        ]}
        actions={row => {
          const p = row as unknown as Product
          return (
            <>
              <IconBtn onClick={() => openEdit(p)}><Edit2 size={13} /></IconBtn>
              <IconBtn onClick={() => setDeleting(p)} danger><Trash2 size={13} /></IconBtn>
            </>
          )
        }}
        actionsLabel=""
      />

      {/* ═══ مودال المنتج ═══ */}
      {showForm && (
        <div className="modal-backdrop" dir="rtl">
          <div className="modal-box" style={{ maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
              <h2 style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>{editing ? 'تعديل المنتج' : 'منتج جديد'}</h2>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--text-m)', border: 'none', background: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={save} style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '10px' }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>اسم المنتج *</label>
                  <StInput value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>الباركود</label>
                  <StInput value={form.barcode ?? ''} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} dir="ltr" style={{ fontFamily: 'var(--mono)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>التصنيف</label>
                  <StSelect value={form.categoryId ?? ''} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value || undefined }))}>
                    <option value="">بدون تصنيف</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </StSelect>
                </div>
                {editing && editing.priceCurrency !== pricingCurrency && (
                  <div style={{ gridColumn: '1/-1', padding: '7px 10px', borderRadius: 'var(--r-s)', background: 'var(--amber-bg)', color: 'var(--amber)', fontSize: '12px' }}>
                    هذا المنتج مسعّر بـ {editing.priceCurrency === 'USD' ? 'الدولار' : 'الليرة السورية'} حالياً، بينما إعداد المتجر {pricingCurrency === 'USD' ? 'الدولار' : 'الليرة السورية'}.
                    تعديل السعر هنا سيحوّل عملته إلى إعداد المتجر الحالي.
                  </div>
                )}
                {[
                  { label: `سعر البيع (${(editing?.priceCurrency ?? pricingCurrency) === 'USD' ? '$' : 'ل.س'}) *`, key: 'price',    req: true, money: true  },
                  { label: `سعر التكلفة (${(editing?.priceCurrency ?? pricingCurrency) === 'USD' ? '$' : 'ل.س'})`, key: 'costPrice', req: false, money: true },
                  { label: 'المخزون الحالي',        key: 'stock',    req: false, money: false },
                  { label: 'حد التنبيه (أدنى)',      key: 'minStock', req: false, money: false },
                ].map(f => {
                  const raw = (form as unknown as Record<string, number>)[f.key]
                  const usdMoney = f.money && (editing?.priceCurrency ?? pricingCurrency) === 'USD'
                  const displayValue = usdMoney ? raw / 100 : raw
                  return (
                    <div key={f.key}>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>{f.label}</label>
                      <StInput type="number" min={0} step={usdMoney ? '0.01' : '1'} required={f.req}
                        value={displayValue}
                        onChange={e => {
                          const n = Number(e.target.value)
                          setForm(ff => ({ ...ff, [f.key]: usdMoney ? Math.round(n * 100) : Math.round(n) }))
                        }} />
                    </div>
                  )
                })}
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>حد التنبيه للمخزون</label>
                  <StInput type="number" min={0} step="1" placeholder="بلا تنبيه"
                    value={form.lowStockThreshold ?? ''}
                    onChange={e => {
                      const raw = e.target.value
                      setForm(ff => ({ ...ff, lowStockThreshold: raw === '' ? null : Math.max(0, Math.round(Number(raw))) }))
                    }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
                <button type="button" className="btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowForm(false)}>إلغاء</button>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={saving}>
                  {saving ? 'جارٍ الحفظ...' : editing ? 'حفظ التعديلات' : 'إضافة المنتج'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ مودال الحذف ═══ */}
      {deleting && (
        <div className="modal-backdrop" dir="rtl">
          <div className="modal-box" style={{ maxWidth: '360px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '9999px', background: 'var(--red-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trash2 size={16} style={{ color: 'var(--red)' }} />
              </div>
              <h3 style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>تأكيد الحذف</h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '14px' }}>
              هل تريد حذف <strong style={{ color: 'var(--text)' }}>{deleting.name}</strong>؟ لا يمكن التراجع عن هذه العملية.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setDeleting(null)}>إلغاء</button>
              <button className="btn-danger" style={{ flex: 1, justifyContent: 'center', background: 'var(--red)', color: '#fff' }} onClick={confirmDelete}>حذف</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ مودال التصنيفات ═══ */}
      {showCatModal && (
        <div className="modal-backdrop" dir="rtl">
          <div className="modal-box" style={{ maxWidth: '440px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
              <h2 style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Tag size={15} style={{ color: 'var(--indigo)' }} /> إدارة التصنيفات
              </h2>
              <button onClick={() => { setShowCatModal(false); setEditingCat(null) }} style={{ color: 'var(--text-m)', border: 'none', background: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            {/* إضافة جديد */}
            <div style={{ padding: '12px 16px', background: 'var(--diamond)', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
              <p style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--text-m)', marginBottom: '8px' }}>إضافة تصنيف جديد</p>
              <form onSubmit={addCategory} style={{ display: 'flex', gap: '7px', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <StInput value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} placeholder="اسم التصنيف..." required />
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: '120px' }}>
                  {PRESET_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setCatForm(f => ({ ...f, color: c }))}
                      style={{ width: '18px', height: '18px', borderRadius: '9999px', background: c, border: catForm.color === c ? '2px solid var(--text)' : '2px solid transparent', cursor: 'pointer', transition: 'transform .1s' }}
                      onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.2)')}
                      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')} />
                  ))}
                </div>
                <button type="submit" className="btn-primary" disabled={catSaving} style={{ fontSize: '12.5px', padding: '6px 12px', whiteSpace: 'nowrap' }}>
                  <Plus size={13} /> إضافة
                </button>
              </form>
            </div>
            {/* قائمة التصنيفات */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {categories.length === 0 && <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-m)', padding: '24px 0' }}>لا توجد تصنيفات بعد</p>}
              {categories.map(cat => (
                <div key={cat.id} className="card" style={{ padding: '9px 12px' }}>
                  {editingCat?.id === cat.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                      <StInput value={editCatForm.name} onChange={e => setEditCatForm(f => ({ ...f, name: e.target.value }))} />
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {PRESET_COLORS.map(c => (
                          <button key={c} type="button" onClick={() => setEditCatForm(f => ({ ...f, color: c }))}
                            style={{ width: '18px', height: '18px', borderRadius: '9999px', background: c, border: editCatForm.color === c ? '2px solid var(--text)' : '2px solid transparent', cursor: 'pointer' }} />
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn-primary" style={{ fontSize: '12px', padding: '5px 12px' }} onClick={() => saveEditCat(cat.id)}>
                          <Check size={12} /> حفظ
                        </button>
                        <button className="btn-ghost" onClick={() => setEditingCat(null)} style={{ fontSize: '12px' }}>إلغاء</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '9999px', background: cat.color, display: 'inline-block' }} />
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>{cat.name}</span>
                        {cat._count !== undefined && <span style={{ fontSize: '11.5px', color: 'var(--text-m)' }}>{cat._count.products} منتج</span>}
                      </div>
                      <IconBtn onClick={() => { setEditingCat(cat); setEditCatForm({ name: cat.name, color: cat.color }) }}>
                        <Edit2 size={12} />
                      </IconBtn>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}