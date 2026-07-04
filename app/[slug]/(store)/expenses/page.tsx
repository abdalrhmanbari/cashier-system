'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Plus, Search, Edit2, Trash2, X, Wallet, Banknote, HandCoins, Receipt } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { StInput, StSelect, StTextarea } from '@/components/shared/StInput'
import { formatSyp, formatUsd } from '@/lib/utils'

type ExpenseType = 'SALARY' | 'ADVANCE' | 'STORE'

type Employee = { id: string; name: string }
type Expense = {
  id: string; type: ExpenseType; amount: number; title: string | null
  notes: string | null; date: string; amountUsdCents: number | null
  employee: Employee | null; user: { id: string; name: string }
}

const TYPE_LABEL: Record<ExpenseType, string> = {
  SALARY:  'راتب',
  ADVANCE: 'دفعة من الراتب',
  STORE:   'مصاريف المحل',
}

const TYPE_COLOR: Record<ExpenseType, string> = {
  SALARY:  'var(--indigo)',
  ADVANCE: 'var(--amber)',
  STORE:   'var(--red)',
}

const TYPE_ICON: Record<ExpenseType, React.ElementType> = {
  SALARY:  Banknote,
  ADVANCE: HandCoins,
  STORE:   Receipt,
}

const EMPTY = {
  type: 'STORE' as ExpenseType,
  amount: 0,
  title: '',
  notes: '',
  date: new Date().toISOString().slice(0, 10),
  employeeId: '',
}

const fmt = (amount: number) => formatSyp(amount)

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

export default function ExpensesPage() {
  const [expenses,  setExpenses]  = useState<Expense[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [typeFilter,setTypeFilter]= useState<'' | ExpenseType>('')
  const [editing,   setEditing]   = useState<Expense | null>(null)
  const [showForm,  setShowForm]  = useState(false)
  const [form,      setForm]      = useState(EMPTY)
  const [saving,    setSaving]    = useState(false)
  const [deleting,  setDeleting]  = useState<Expense | null>(null)
  const [error,     setError]     = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const url = typeFilter ? `/api/store/expenses?type=${typeFilter}` : '/api/store/expenses'
    const [ex, us] = await Promise.all([
      fetch(url).then(r => r.json()),
      fetch('/api/store/users').then(r => r.json()),
    ])
    setExpenses(Array.isArray(ex) ? ex : [])
    setEmployees(Array.isArray(us) ? us : [])
    setLoading(false)
  }, [typeFilter])

  useEffect(() => { load() }, [load])

  function openNew() { setEditing(null); setError(''); setForm(EMPTY); setShowForm(true) }
  function openEdit(x: Expense) {
    setEditing(x); setError('')
    setForm({
      type: x.type, amount: x.amount, title: x.title ?? '', notes: x.notes ?? '',
      date: x.date.slice(0, 10), employeeId: x.employee?.id ?? '',
    })
    setShowForm(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    const res = await fetch(editing ? `/api/store/expenses/${editing.id}` : '/api/store/expenses', {
      method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        title:      form.title || null,
        notes:      form.notes || null,
        employeeId: form.type === 'STORE' ? null : (form.employeeId || null),
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'حدث خطأ'); return }
    setShowForm(false); load()
  }

  async function confirmDelete() {
    if (!deleting) return
    await fetch(`/api/store/expenses/${deleting.id}`, { method: 'DELETE' })
    setExpenses(p => p.filter(x => x.id !== deleting.id)); setDeleting(null)
  }

  const filtered = expenses.filter(x => {
    if (!search) return true
    const q = search.trim()
    return x.title?.includes(q) || x.employee?.name.includes(q) || TYPE_LABEL[x.type].includes(q)
  })

  const totals = useMemo(() => {
    const by: Record<ExpenseType, number> = { SALARY: 0, ADVANCE: 0, STORE: 0 }
    let all = 0
    for (const x of expenses) { by[x.type] += x.amount; all += x.amount }
    return { ...by, all }
  }, [expenses])

  const STAT_CARDS: { key: ExpenseType | 'all'; label: string; value: number; color: string; bg: string; icon: React.ElementType }[] = [
    { key: 'all',    label: 'إجمالي المصاريف',  value: totals.all,    color: 'var(--text)',   bg: 'var(--diamond)',  icon: Wallet      },
    { key: 'SALARY', label: TYPE_LABEL.SALARY,   value: totals.SALARY, color: TYPE_COLOR.SALARY, bg: 'var(--indigo-g)', icon: TYPE_ICON.SALARY },
    { key: 'ADVANCE',label: TYPE_LABEL.ADVANCE,  value: totals.ADVANCE,color: TYPE_COLOR.ADVANCE,bg: 'var(--amber-bg)', icon: TYPE_ICON.ADVANCE },
    { key: 'STORE',  label: TYPE_LABEL.STORE,    value: totals.STORE,  color: TYPE_COLOR.STORE,  bg: 'var(--red-bg)',   icon: TYPE_ICON.STORE  },
  ]

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }} dir="rtl">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>المصاريف</h1>
        <button className="btn-primary" onClick={openNew} style={{ fontSize: '13px', padding: '6px 14px' }}>
          <Plus size={14} /> مصروف جديد
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: '10px' }}>
        {STAT_CARDS.map(c => {
          const Icon = c.icon
          return (
            <div key={c.key} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: 'var(--r-s)', background: c.bg, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={16} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: '11px', color: 'var(--text-m)' }}>{c.label}</p>
                <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--mono)' }}>{fmt(c.value)}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
          <Search size={13} style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-m)', pointerEvents: 'none' }} />
          <StInput value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالعنوان أو الموظف..." style={{ paddingRight: '28px' }} />
        </div>
        <StSelect value={typeFilter} onChange={e => setTypeFilter(e.target.value as '' | ExpenseType)} style={{ width: 'auto', minWidth: '160px' }}>
          <option value="">كل الأنواع</option>
          <option value="SALARY">راتب</option>
          <option value="ADVANCE">دفعة من الراتب</option>
          <option value="STORE">مصاريف المحل</option>
        </StSelect>
      </div>

      {/* Table */}
      <DataTable
        data={filtered as unknown as Record<string, unknown>[]}
        loading={loading}
        searchable={false}
        exportable={true}
        exportFilename="expenses"
        emptyMessage="لا توجد مصاريف"
        columns={[
          {
            key: 'type', label: 'النوع',
            render: (_, row) => {
              const x = row as unknown as Expense
              return (
                <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '9999px', fontSize: '11.5px', fontWeight: 500, background: `${TYPE_COLOR[x.type]}20`, color: TYPE_COLOR[x.type] }}>
                  {TYPE_LABEL[x.type]}
                </span>
              )
            },
          },
          {
            key: 'title', label: 'البيان',
            render: (_, row) => {
              const x = row as unknown as Expense
              return <span style={{ fontWeight: 500, color: 'var(--text)' }}>{x.employee?.name ?? x.title ?? '—'}</span>
            },
          },
          {
            key: 'amount', label: 'المبلغ',
            render: (_, row) => {
              const x = row as unknown as Expense
              return (
                <span>
                  <span style={{ fontWeight: 600, color: 'var(--indigo)', fontFamily: 'var(--mono)' }}>{fmt(x.amount)}</span>
                  {x.amountUsdCents !== null && (
                    <span style={{ fontSize: '11px', color: 'var(--text-m)', marginRight: '5px' }}>(≈ {formatUsd(x.amountUsdCents)})</span>
                  )}
                </span>
              )
            },
          },
          {
            key: 'date', label: 'التاريخ',
            render: (_, row) => <span style={{ fontSize: '12.5px', color: 'var(--text-2)' }}>{new Date((row as unknown as Expense).date).toLocaleDateString('ar-SA')}</span>,
          },
          {
            key: 'notes', label: 'ملاحظات',
            render: (_, row) => <span style={{ fontSize: '12.5px', color: 'var(--text-m)' }}>{(row as unknown as Expense).notes ?? '—'}</span>,
          },
        ]}
        actions={row => {
          const x = row as unknown as Expense
          return (
            <>
              <IconBtn onClick={() => openEdit(x)}><Edit2 size={13} /></IconBtn>
              <IconBtn onClick={() => setDeleting(x)} danger><Trash2 size={13} /></IconBtn>
            </>
          )
        }}
        actionsLabel=""
      />

      {/* ═══ مودال المصروف ═══ */}
      {showForm && (
        <div className="modal-backdrop" dir="rtl">
          <div className="modal-box" style={{ maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
              <h2 style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>{editing ? 'تعديل المصروف' : 'مصروف جديد'}</h2>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--text-m)', border: 'none', background: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={save} style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {error && (
                <div style={{ padding: '8px 10px', borderRadius: 'var(--r-s)', background: 'var(--red-bg)', color: 'var(--red)', fontSize: '12.5px' }}>{error}</div>
              )}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>نوع المصروف *</label>
                <StSelect value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as ExpenseType }))} required>
                  <option value="STORE">مصاريف المحل</option>
                  <option value="SALARY">راتب</option>
                  <option value="ADVANCE">دفعة من الراتب</option>
                </StSelect>
              </div>

              {form.type !== 'STORE' ? (
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>الموظف *</label>
                  <StSelect value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} required>
                    <option value="">اختر الموظف...</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </StSelect>
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>البيان</label>
                  <StInput value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="مثال: فاتورة كهرباء، إيجار المحل..." />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>المبلغ (ل.س) *</label>
                  <StInput type="number" min={1} required value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>التاريخ *</label>
                  <StInput type="date" required value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>ملاحظات</label>
                <StTextarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
                <button type="button" className="btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowForm(false)}>إلغاء</button>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={saving}>
                  {saving ? 'جارٍ الحفظ...' : editing ? 'حفظ التعديلات' : 'إضافة المصروف'}
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
              هل تريد حذف هذا المصروف ({fmt(deleting.amount)})؟ لا يمكن التراجع عن هذه العملية.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setDeleting(null)}>إلغاء</button>
              <button className="btn-danger" style={{ flex: 1, justifyContent: 'center', background: 'var(--red)', color: '#fff' }} onClick={confirmDelete}>حذف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
