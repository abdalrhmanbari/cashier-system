'use client'

import { useEffect, useState, useCallback } from 'react'
import { ClipboardList, Search, X, ArrowUpDown } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { StInput, StSelect } from '@/components/shared/StInput'

type MovementType = 'SALE' | 'SALE_RETURN' | 'PURCHASE' | 'ADJUSTMENT' | 'DAMAGE'

type Product  = { id: string; name: string; barcode: string | null; stock: number }
type Branch   = { id: string; name: string }
type Movement = {
  id: string; type: MovementType; quantity: number; quantityAfter: number
  note: string | null; createdAt: string
  product: { id: string; name: string; barcode: string | null }
  branch: { id: string; name: string } | null
  storeUser: { id: string; name: string }
  sale: { id: string; invoiceNumber: string } | null
}

const TYPE_LABEL: Record<MovementType, string> = {
  SALE:         'بيع',
  SALE_RETURN:  'إرجاع بيع',
  PURCHASE:     'شراء',
  ADJUSTMENT:   'تسوية جرد',
  DAMAGE:       'تالف',
}

const TYPE_COLOR: Record<MovementType, string> = {
  SALE:        'var(--red)',
  SALE_RETURN: 'var(--green)',
  PURCHASE:    'var(--indigo)',
  ADJUSTMENT:  'var(--amber)',
  DAMAGE:      'var(--red)',
}

const fmt = (n: number) => String(parseFloat(n.toFixed(2)))

export default function InventoryPage() {
  const [movements, setMovements] = useState<Movement[]>([])
  const [products,  setProducts]  = useState<Product[]>([])
  const [branches,  setBranches]  = useState<Branch[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')

  const [productFilter, setProductFilter] = useState('')
  const [branchFilter,  setBranchFilter]  = useState('')
  const [typeFilter,    setTypeFilter]    = useState<'' | MovementType>('')
  const [fromFilter,    setFromFilter]    = useState('')
  const [toFilter,      setToFilter]      = useState('')

  const [showAdjust, setShowAdjust] = useState(false)
  const [adjustType, setAdjustType] = useState<'ADJUSTMENT' | 'DAMAGE'>('ADJUSTMENT')
  const [adjProduct, setAdjProduct] = useState('')
  const [adjBranch,  setAdjBranch]  = useState('')
  const [actualQty,  setActualQty]  = useState('')
  const [damageQty,  setDamageQty]  = useState('')
  const [note,       setNote]       = useState('')
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (productFilter) params.set('productId', productFilter)
    if (branchFilter)  params.set('branchId', branchFilter)
    if (typeFilter)    params.set('type', typeFilter)
    if (fromFilter)    params.set('from', fromFilter)
    if (toFilter)      params.set('to', toFilter)

    const [mv, pr, br] = await Promise.all([
      fetch(`/api/store/inventory?${params}`).then(r => r.json()),
      fetch('/api/store/products').then(r => r.json()),
      fetch('/api/store/branches').then(r => r.json()),
    ])
    setMovements(Array.isArray(mv) ? mv : [])
    setProducts(Array.isArray(pr) ? pr : [])
    setBranches(Array.isArray(br) ? br : [])
    setLoading(false)
  }, [productFilter, branchFilter, typeFilter, fromFilter, toFilter])

  useEffect(() => { load() }, [load])

  function openAdjust() {
    setError(''); setAdjustType('ADJUSTMENT'); setAdjProduct(''); setAdjBranch('')
    setActualQty(''); setDamageQty(''); setNote(''); setShowAdjust(true)
  }

  const selectedProduct = products.find(p => p.id === adjProduct) ?? null
  const diff = selectedProduct && actualQty !== ''
    ? Number(actualQty) - selectedProduct.stock
    : null

  async function saveAdjust(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    const body: Record<string, unknown> = {
      productId: adjProduct,
      type:      adjustType,
      branchId:  adjBranch || null,
      note:      note || null,
    }
    if (adjustType === 'ADJUSTMENT') body.actualQuantity = Number(actualQty)
    else body.quantity = Number(damageQty)

    const res  = await fetch('/api/store/inventory', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'حدث خطأ'); return }
    setShowAdjust(false); load()
  }

  const filtered = movements.filter(m => {
    if (!search) return true
    const q = search.trim()
    return m.product.name.includes(q) || m.product.barcode?.includes(q) || m.storeUser.name.includes(q)
  })

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }} dir="rtl">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>حركة المخزون</h1>
        <button className="btn-primary" onClick={openAdjust} style={{ fontSize: '13px', padding: '6px 14px' }}>
          <ArrowUpDown size={14} /> تسوية جرد
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
          <Search size={13} style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-m)', pointerEvents: 'none' }} />
          <StInput value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالمنتج أو المستخدم..." style={{ paddingRight: '28px' }} />
        </div>
        <StSelect value={productFilter} onChange={e => setProductFilter(e.target.value)} style={{ width: 'auto', minWidth: '160px' }}>
          <option value="">كل المنتجات</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </StSelect>
        <StSelect value={branchFilter} onChange={e => setBranchFilter(e.target.value)} style={{ width: 'auto', minWidth: '140px' }}>
          <option value="">كل الفروع</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </StSelect>
        <StSelect value={typeFilter} onChange={e => setTypeFilter(e.target.value as '' | MovementType)} style={{ width: 'auto', minWidth: '140px' }}>
          <option value="">كل الأنواع</option>
          {(Object.keys(TYPE_LABEL) as MovementType[]).map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </StSelect>
        <StInput type="date" value={fromFilter} onChange={e => setFromFilter(e.target.value)} style={{ width: 'auto' }} />
        <StInput type="date" value={toFilter} onChange={e => setToFilter(e.target.value)} style={{ width: 'auto' }} />
      </div>

      {/* Table */}
      <DataTable
        data={filtered as unknown as Record<string, unknown>[]}
        loading={loading}
        searchable={false}
        exportable={true}
        exportFilename="inventory"
        emptyMessage="لا توجد حركات مخزون"
        emptyIcon={<ClipboardList size={28} />}
        columns={[
          {
            key: 'type', label: 'النوع',
            render: (_, row) => {
              const m = row as unknown as Movement
              return (
                <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '9999px', fontSize: '11.5px', fontWeight: 500, background: `${TYPE_COLOR[m.type]}20`, color: TYPE_COLOR[m.type] }}>
                  {TYPE_LABEL[m.type]}
                </span>
              )
            },
          },
          {
            key: 'product', label: 'المنتج',
            render: (_, row) => {
              const m = row as unknown as Movement
              return <span style={{ fontWeight: 500, color: 'var(--text)' }}>{m.product.name}</span>
            },
          },
          {
            key: 'quantity', label: 'الكمية',
            render: (_, row) => {
              const m = row as unknown as Movement
              return (
                <span style={{ fontWeight: 600, fontFamily: 'var(--mono)', color: m.quantity >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {m.quantity >= 0 ? '+' : ''}{fmt(m.quantity)}
                </span>
              )
            },
          },
          {
            key: 'quantityAfter', label: 'الرصيد بعدها',
            render: (_, row) => <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-2)' }}>{fmt((row as unknown as Movement).quantityAfter)}</span>,
          },
          {
            key: 'branch', label: 'الفرع',
            render: (_, row) => <span style={{ fontSize: '12.5px', color: 'var(--text-2)' }}>{(row as unknown as Movement).branch?.name ?? '—'}</span>,
          },
          {
            key: 'storeUser', label: 'بواسطة',
            render: (_, row) => <span style={{ fontSize: '12.5px', color: 'var(--text-2)' }}>{(row as unknown as Movement).storeUser.name}</span>,
          },
          {
            key: 'createdAt', label: 'التاريخ',
            render: (_, row) => <span style={{ fontSize: '12.5px', color: 'var(--text-m)' }}>{new Date((row as unknown as Movement).createdAt).toLocaleString('ar-SA')}</span>,
          },
          {
            key: 'note', label: 'ملاحظات',
            render: (_, row) => <span style={{ fontSize: '12.5px', color: 'var(--text-m)' }}>{(row as unknown as Movement).note ?? '—'}</span>,
          },
        ]}
      />

      {/* ═══ مودال تسوية الجرد ═══ */}
      {showAdjust && (
        <div className="modal-backdrop" dir="rtl">
          <div className="modal-box" style={{ maxWidth: '460px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
              <h2 style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>تسوية جرد / تسجيل تالف</h2>
              <button onClick={() => setShowAdjust(false)} style={{ color: 'var(--text-m)', border: 'none', background: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={saveAdjust} style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {error && (
                <div style={{ padding: '8px 10px', borderRadius: 'var(--r-s)', background: 'var(--red-bg)', color: 'var(--red)', fontSize: '12.5px' }}>{error}</div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>نوع الحركة *</label>
                <StSelect value={adjustType} onChange={e => setAdjustType(e.target.value as 'ADJUSTMENT' | 'DAMAGE')} required>
                  <option value="ADJUSTMENT">تسوية جرد (كمية فعلية)</option>
                  <option value="DAMAGE">تسجيل تالف</option>
                </StSelect>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>المنتج *</label>
                <StSelect value={adjProduct} onChange={e => setAdjProduct(e.target.value)} required>
                  <option value="">اختر المنتج...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} (الرصيد الحالي: {fmt(p.stock)})</option>)}
                </StSelect>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>الفرع</label>
                <StSelect value={adjBranch} onChange={e => setAdjBranch(e.target.value)}>
                  <option value="">بدون تحديد</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </StSelect>
              </div>

              {adjustType === 'ADJUSTMENT' ? (
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>الكمية الفعلية المعدودة *</label>
                  <StInput type="number" min={0} required value={actualQty} onChange={e => setActualQty(e.target.value)} />
                  {diff !== null && (
                    <p style={{ marginTop: '6px', fontSize: '12.5px', fontWeight: 600, color: diff === 0 ? 'var(--text-m)' : diff > 0 ? 'var(--green)' : 'var(--red)' }}>
                      الفرق: {diff >= 0 ? '+' : ''}{fmt(diff)}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>كمية التالف *</label>
                  <StInput type="number" min={1} required value={damageQty} onChange={e => setDamageQty(e.target.value)} />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>ملاحظات</label>
                <StInput value={note} onChange={e => setNote(e.target.value)} placeholder="اختياري" />
              </div>

              <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
                <button type="button" className="btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowAdjust(false)}>إلغاء</button>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={saving}>
                  {saving ? 'جارٍ الحفظ...' : 'حفظ الحركة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
