'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Plus, Truck, Phone, Trash2, DollarSign, Edit2 } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { formatUsd } from '@/lib/utils'

type Supplier = {
  id: string; name: string; phone: string | null; address: string | null
  currentBalance: number; createdAt: string
  _count: { invoices: number }
  invoices: { date: string }[]
}

const fmt = (amount: number) => formatUsd(Math.abs(amount))

export default function SuppliersPage() {
  const router   = useRouter()
  const { slug } = useParams<{ slug: string }>()

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading,   setLoading]   = useState(true)
  const [deleting,  setDeleting]  = useState<Supplier | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetch('/api/store/suppliers').then(r => r.json())
    setSuppliers(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function confirmDelete() {
    if (!deleting) return
    await fetch(`/api/store/suppliers/${deleting.id}`, { method: 'DELETE' })
    setSuppliers(s => s.filter(x => x.id !== deleting.id))
    setDeleting(null)
  }

  const totalBalance = suppliers.reduce((s, x) => s + x.currentBalance, 0)

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }} dir="rtl">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>الموردون</h1>
        <button
          className="btn-primary"
          onClick={() => router.push(`/${slug}/suppliers/new`)}
          style={{ fontSize: '13px', padding: '6px 14px' }}
        >
          <Plus size={14} /> مورد جديد
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3" style={{ gap: '10px' }}>
        {[
          { label: 'إجمالي الموردين', value: suppliers.length, icon: Truck, color: 'var(--indigo)', bg: 'var(--indigo-g)', money: false },
          { label: 'مستحقات علينا',   value: totalBalance,    icon: DollarSign, color: 'var(--red)', bg: 'var(--red-bg)', money: true },
          { label: 'عدد التوريدات',   value: suppliers.reduce((s,x) => s + x._count.invoices, 0), icon: Phone, color: 'var(--teal)', bg: 'var(--teal-bg)', money: false },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: 'var(--r-s)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: k.bg, flexShrink: 0 }}>
              <k.icon size={16} style={{ color: k.color }} />
            </div>
            <div>
              <p style={{ fontSize: '11px', color: 'var(--text-m)', marginBottom: '2px' }}>{k.label}</p>
              <p style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text)', fontFamily: k.money ? 'var(--mono)' : undefined }}>
                {k.money ? fmt(k.value) : k.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <DataTable
        data={suppliers as unknown as Record<string, unknown>[]}
        loading={loading} searchable exportFilename="suppliers"
        searchKeys={['name' as never, 'phone' as never]}
        emptyMessage="لا يوجد موردون بعد"
        columns={[
          {
            key: 'name', label: 'المورد',
            render: (_, row) => {
              const s = row as unknown as Supplier
              return (
                <button
                  onClick={() => router.push(`/${slug}/suppliers/${s.id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'right' }}
                >
                  <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--indigo-g)', color: 'var(--indigo)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
                    {s.name.slice(0,1)}
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, color: 'var(--indigo)', fontSize: '13px' }}>{s.name}</p>
                    {s.address && <p style={{ fontSize: '11px', color: 'var(--text-m)' }}>{s.address}</p>}
                  </div>
                </button>
              )
            },
          },
          {
            key: 'phone', label: 'الهاتف',
            render: (_, row) => {
              const s = row as unknown as Supplier
              return s.phone
                ? <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-2)', fontSize: '13px' }}><Phone size={11} style={{ color: 'var(--text-m)' }} />{s.phone}</span>
                : <span style={{ color: 'var(--text-m)' }}>—</span>
            },
          },
          {
            key: 'invoices', label: 'آخر توريد',
            render: (_, row) => {
              const s = row as unknown as Supplier
              const last = s.invoices?.[0]
              return last
                ? <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{new Date(last.date).toLocaleDateString('ar-SA')}</span>
                : <span style={{ color: 'var(--text-m)', fontSize: '12px' }}>لا يوجد</span>
            },
          },
          {
            key: '_count', label: 'الفواتير',
            render: (_, row) => <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{(row as unknown as Supplier)._count.invoices}</span>,
          },
          {
            key: 'currentBalance', label: 'الرصيد المستحق',
            render: (_, row) => {
              const s = row as unknown as Supplier
              if (s.currentBalance === 0) return <span className="badge" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>مسدّد</span>
              return <span style={{ fontWeight: 600, color: 'var(--red)', fontFamily: 'var(--mono)' }}>{fmt(s.currentBalance)}</span>
            },
          },
        ]}
        actions={row => {
          const s = row as unknown as Supplier
          return (
            <>
              <button
                onClick={() => router.push(`/${slug}/suppliers/${s.id}/edit`)}
                style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--r-x)', border: '1px solid var(--border-color)', background: 'var(--white)', color: 'var(--text-2)', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--diamond)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--white)')}
              >
                <Edit2 size={13} />
              </button>
              <button
                onClick={() => setDeleting(s)}
                style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--r-x)', border: '1px solid var(--border-color)', background: 'var(--red-bg)', color: 'var(--red)', cursor: 'pointer' }}
              >
                <Trash2 size={13} />
              </button>
            </>
          )
        }}
        actionsLabel=""
      />

      {/* مودال الحذف */}
      {deleting && (
        <div className="modal-backdrop" dir="rtl">
          <div className="modal-box" style={{ maxWidth: '340px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '9999px', background: 'var(--red-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trash2 size={16} style={{ color: 'var(--red)' }} />
              </div>
              <h3 style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>تأكيد الحذف</h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '14px' }}>
              هل تريد حذف <strong style={{ color: 'var(--text)' }}>{deleting.name}</strong>؟ لا يمكن التراجع.
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
