'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, X, Clock, TrendingUp, Banknote, Hash, Timer } from 'lucide-react'
import { useSession, SessionProvider } from 'next-auth/react'
import { DataTable } from '@/components/shared/DataTable'
import { StInput, StSelect, StTextarea } from '@/components/shared/StInput'
import { formatSyp } from '@/lib/utils'

type Branch = { id: string; name: string; isActive: boolean }
type Shift  = {
  id: string; status: string; openedAt: string; closedAt: string | null
  openingCash: number; expectedCash: number; actualCash: number | null
  difference: number | null; notes: string | null
  user: { name: string; role: string }; branch: { name: string }; _count: { sales: number }
}

// كل مبالغ الوردية بالليرة السورية حصراً — كل مقبوضات POS ليرة
const fmt = (amount: number) => formatSyp(amount)

function ShiftsContent() {
  const { data: session } = useSession()
  const [shifts,         setShifts]         = useState<Shift[]>([])
  const [openShift,      setOpenShift]      = useState<Shift | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [showOpen,       setShowOpen]       = useState(false)
  const [showClose,      setShowClose]      = useState(false)
  const [openCash,       setOpenCash]       = useState('0')
  const [actualCash,     setActualCash]     = useState('0')
  const [closeNotes,     setCloseNotes]     = useState('')
  const [saving,         setSaving]         = useState(false)
  const [branches,       setBranches]       = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')

  const isManager = session?.user.role === 'STORE_MANAGER'

  const load = useCallback(async () => {
    setLoading(true)
    const url  = isManager ? '/api/store/shifts' : '/api/store/shifts?mine=true'
    const data = await fetch(url).then(r => r.json())
    const arr  = Array.isArray(data) ? data : []
    setShifts(arr)
    setOpenShift(arr.find((s: Shift) => s.status === 'OPEN' && s.user.name === session?.user.name) ?? null)
    setLoading(false)
  }, [isManager, session?.user.name])

  useEffect(() => { if (session) load() }, [load, session])

  async function openOpenModal() {
    setShowOpen(true)
    if (isManager && branches.length === 0) {
      const data = await fetch('/api/store/branches').then(r => r.json())
      const active = (Array.isArray(data) ? data : []).filter((b: Branch) => b.isActive)
      setBranches(active); if (active.length === 1) setSelectedBranch(active[0].id)
    }
  }

  async function openShiftFn(e: React.FormEvent) {
    e.preventDefault()
    if (isManager && branches.length > 1 && !selectedBranch) { alert('يرجى اختيار الفرع'); return }
    setSaving(true)
    const body: Record<string, unknown> = { openingCash: Math.round(parseFloat(openCash)) }
    if (isManager && selectedBranch) body.branchId = selectedBranch
    const res  = await fetch('/api/store/shifts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json(); setSaving(false)
    if (!res.ok) { alert(json.error); return }
    setShowOpen(false); setOpenCash('0'); setSelectedBranch(''); load()
  }

  async function closeShiftFn(e: React.FormEvent) {
    e.preventDefault(); if (!openShift) return; setSaving(true)
    await fetch(`/api/store/shifts/${openShift.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actualCash: Math.round(parseFloat(actualCash)), notes: closeNotes || null }) })
    setSaving(false); setShowClose(false); load()
  }

  const diffColor = (d: number | null) =>
    d === null ? 'var(--text-m)' : d > 0 ? 'var(--green)' : d < 0 ? 'var(--red)' : 'var(--text-2)'

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }} dir="rtl">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>الورديات</h1>
        {openShift ? (
          <button className="btn-danger" onClick={() => setShowClose(true)} style={{ fontSize: '13px', padding: '6px 14px', background: 'var(--red)', color: '#fff' }}>
            <X size={14} /> إغلاق الوردية
          </button>
        ) : (
          <button className="btn-primary" onClick={openOpenModal} style={{ fontSize: '13px', padding: '6px 14px', background: 'var(--green)' }}>
            <Plus size={14} /> فتح وردية
          </button>
        )}
      </div>

      {/* بطاقة الوردية المفتوحة */}
      {openShift && (
        <div style={{ borderRadius: 'var(--r)', border: '1px solid var(--green)', background: 'var(--green-bg)', padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '9999px', background: 'var(--green)', animation: 'pulse 2s infinite' }} />
            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--green)' }}>وردية مفتوحة — {openShift.branch.name}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: '8px' }}>
            {[
              { icon: Timer,    label: 'وقت الفتح',       value: new Date(openShift.openedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) },
              { icon: Banknote, label: 'النقد الافتتاحي', value: fmt(openShift.openingCash), mono: true },
              { icon: Hash,     label: 'عدد الفواتير',    value: String(openShift._count.sales) },
              { icon: TrendingUp, label: 'إجمالي المبيعات', value: fmt(openShift.expectedCash), mono: true },
            ].map(stat => (
              <div key={stat.label} className="card" style={{ padding: '8px 10px', borderRadius: 'var(--r-s)' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-m)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                  <stat.icon size={11} />{stat.label}
                </p>
                <p style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)', fontFamily: stat.mono ? 'var(--mono)' : undefined }}>{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* جدول الورديات */}
      <DataTable
        data={shifts as unknown as Record<string, unknown>[]}
        loading={loading} searchable={false}
        emptyMessage="لا توجد ورديات بعد"
        columns={[
          {
            key: 'status', label: 'الحالة',
            render: (_, row) => {
              const s = row as unknown as Shift
              return s.status === 'OPEN'
                ? <span className="badge" style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green)' }}><span style={{ width: '5px', height: '5px', borderRadius: '9999px', background: 'var(--green)', display: 'inline-block' }} /> مفتوحة</span>
                : <span className="badge" style={{ background: 'var(--diamond)', color: 'var(--text-m)' }}><Clock size={10} /> مغلقة</span>
            },
          },
          { key: 'user',     label: 'الموظف',        render: (_, row) => <span style={{ fontWeight: 500, color: 'var(--text)' }}>{(row as unknown as Shift).user.name}</span> },
          { key: 'branch',   label: 'الفرع',          render: (_, row) => <span style={{ color: 'var(--text-2)' }}>{(row as unknown as Shift).branch.name}</span> },
          { key: 'openedAt', label: 'وقت الفتح',     render: (_, row) => <span style={{ fontSize: '12px', color: 'var(--text-m)' }}>{new Date((row as unknown as Shift).openedAt).toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span> },
          { key: 'closedAt', label: 'وقت الإغلاق',   render: (_, row) => { const s = row as unknown as Shift; return <span style={{ fontSize: '12px', color: 'var(--text-m)' }}>{s.closedAt ? new Date(s.closedAt).toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</span> } },
          { key: '_count',   label: 'الفواتير',       render: (_, row) => <span style={{ fontWeight: 600, color: 'var(--text)' }}>{(row as unknown as Shift)._count.sales}</span> },
          { key: 'openingCash', label: 'النقد الافتتاحي', render: (_, row) => <span style={{ color: 'var(--text-2)', fontFamily: 'var(--mono)' }}>{fmt((row as unknown as Shift).openingCash)}</span> },
          ...(isManager ? [{
            key: 'difference' as const, label: 'الفرق',
            render: (_: unknown, row: Record<string, unknown>) => {
              const s = row as unknown as Shift
              return <span style={{ fontWeight: 600, fontFamily: 'var(--mono)', color: diffColor(s.difference) }}>
                {s.difference !== null ? `${s.difference >= 0 ? '+' : ''}${fmt(s.difference)}` : '—'}
              </span>
            },
          }] : []),
        ]}
      />

      {/* مودال فتح وردية */}
      {showOpen && (
        <div className="modal-backdrop" dir="rtl">
          <div className="modal-box" style={{ maxWidth: '360px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
              <h2 style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>فتح وردية جديدة</h2>
              <button onClick={() => setShowOpen(false)} style={{ color: 'var(--text-m)', border: 'none', background: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={openShiftFn} style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {isManager && branches.length > 1 && (
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>الفرع</label>
                  <StSelect value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} required>
                    <option value="">اختر الفرع...</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </StSelect>
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>النقد الافتتاحي (ل.س)</label>
                <StInput type="number" min={0} value={openCash} onChange={e => setOpenCash(e.target.value)} dir="ltr" />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowOpen(false)}>إلغاء</button>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center', background: 'var(--green)' }} disabled={saving}>
                  {saving ? 'جارٍ الفتح...' : 'فتح الوردية'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* مودال إغلاق وردية */}
      {showClose && openShift && (
        <div className="modal-backdrop" dir="rtl">
          <div className="modal-box" style={{ maxWidth: '360px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
              <h2 style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>إغلاق الوردية</h2>
              <button onClick={() => setShowClose(false)} style={{ color: 'var(--text-m)', border: 'none', background: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={closeShiftFn} style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ background: 'var(--diamond)', borderRadius: 'var(--r-s)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-2)' }}>عدد الفواتير</span>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>{openShift._count.sales}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-2)' }}>النقد الافتتاحي</span>
                  <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>{fmt(openShift.openingCash)}</span>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>النقد الفعلي في الصندوق (ل.س)</label>
                <StInput type="number" min={0} value={actualCash} onChange={e => setActualCash(e.target.value)} dir="ltr" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>ملاحظات</label>
                <StTextarea value={closeNotes} onChange={e => setCloseNotes(e.target.value)} rows={2} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowClose(false)}>إلغاء</button>
                <button type="submit" className="btn-danger" style={{ flex: 1, justifyContent: 'center', background: 'var(--red)', color: '#fff' }} disabled={saving}>
                  {saving ? 'جارٍ الإغلاق...' : 'إغلاق الوردية'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ShiftsPage() {
  return (
    <SessionProvider basePath="/api/store-auth">
      <ShiftsContent />
    </SessionProvider>
  )
}