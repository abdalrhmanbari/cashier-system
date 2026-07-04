'use client'

import { useEffect, useState } from 'react'
import { Plus, ToggleLeft, ToggleRight, ExternalLink, GitBranch, X, Pencil, Wrench, CreditCard } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { DataTable } from '@/components/shared/DataTable'
import { SAInput } from '@/components/shared/SAInput'
import { Button } from '@/components/ui/button'

type Store = {
  id: string
  name: string
  slug: string
  phone: string | null
  isActive: boolean
  maintenanceMode: boolean
  createdAt: string
  storeType:    { name: string; icon: string }
  subscription: { status: string; endDate: string; plan: { name: string } } | null
  _count:       { branches: number; users: number }
}

type Branch = {
  id: string
  name: string
  address: string | null
  phone: string | null
  isActive: boolean
  _count: { users: number }
}

const STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  ACTIVE:    { label: 'نشط',    bg: 'var(--green-bg)',  color: 'var(--green)'  },
  TRIAL:     { label: 'تجريبي', bg: 'var(--blue-bg)',   color: 'var(--blue)'   },
  EXPIRED:   { label: 'منتهي',  bg: 'var(--amber-bg)',  color: 'var(--amber)'  },
  SUSPENDED: { label: 'موقوف',  bg: 'var(--red-bg)',    color: 'var(--red)'    },
  CANCELLED: { label: 'ملغي',   bg: 'var(--border-l)',  color: 'var(--text-2)' },
}

export default function StoresPage() {
  const router = useRouter()
  const [stores, setStores]   = useState<Store[]>([])
  const [loading, setLoading] = useState(true)

  const [branchStore, setBranchStore]       = useState<Store | null>(null)
  const [branches, setBranches]             = useState<Branch[]>([])
  const [branchLoading, setBranchLoading]   = useState(false)
  const [showForm, setShowForm]             = useState(false)
  const [form, setForm]                     = useState({ name: '', address: '', phone: '' })
  const [saving, setSaving]                 = useState(false)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/super-admin/stores')
    const data = await res.json()
    setStores(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggleActive(id: string, current: boolean) {
    await fetch(`/api/super-admin/stores/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !current }),
    })
    setStores(s => s.map(st => st.id === id ? { ...st, isActive: !current } : st))
  }

  async function openBranches(store: Store) {
    setBranchStore(store)
    setShowForm(false)
    setForm({ name: '', address: '', phone: '' })
    setBranchLoading(true)
    const res = await fetch(`/api/super-admin/stores/${store.id}/branches`)
    const data = await res.json()
    setBranches(Array.isArray(data) ? data : [])
    setBranchLoading(false)
  }

  function closeBranches() {
    setBranchStore(null)
    setBranches([])
    setShowForm(false)
  }

  async function addBranch(e: React.FormEvent) {
    e.preventDefault()
    if (!branchStore) return
    setSaving(true)
    const res = await fetch(`/api/super-admin/stores/${branchStore.id}/branches`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { alert(data.error); return }
    setForm({ name: '', address: '', phone: '' })
    setShowForm(false)
    setBranches(b => [...b, { ...data, _count: { users: 0 } }])
    setStores(s => s.map(st =>
      st.id === branchStore.id
        ? { ...st, _count: { ...st._count, branches: st._count.branches + 1 } }
        : st
    ))
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">المتاجر</h1>
          <Button onClick={() => router.push('/super-admin/stores/new')}>
            <Plus size={16} />
            متجر جديد
          </Button>
        </div>

        <DataTable
          data={stores as unknown as Record<string, unknown>[]}
          loading={loading}
          searchable
          searchKeys={['name', 'slug'] as never[]}
          emptyMessage="لا توجد متاجر"
          columns={[
            {
              key: 'name',
              label: 'المتجر',
              render: (_, row) => {
                const store = row as unknown as Store
                return (
                  <>
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium">{store.name}</p>
                      {store.maintenanceMode && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{ background: 'var(--amber-bg)', color: 'var(--amber)' }}
                          title="موقوف للصيانة"
                        >
                          <Wrench size={10} />
                          صيانة
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-m)', fontFamily: 'var(--mono)' }}>{store.slug}</p>
                  </>
                )
              },
            },
            {
              key: 'storeType',
              label: 'النوع',
              render: (_, row) => {
                const store = row as unknown as Store
                return <p style={{ color: 'var(--text-2)' }}>{store.storeType.icon} {store.storeType.name}</p>
              },
            },
            {
              key: 'subscription',
              label: 'الخطة',
              render: (_, row) => {
                const store = row as unknown as Store
                return <span style={{ color: 'var(--text)' }}>{store.subscription?.plan.name ?? '—'}</span>
              },
            },
            {
              key: 'subscriptionStatus',
              label: 'الاشتراك',
              render: (_, row) => {
                const store = row as unknown as Store
                const sub = store.subscription
                if (!sub) return <span className="text-xs" style={{ color: 'var(--text-m)' }}>—</span>
                const status = STATUS_LABEL[sub.status] ?? STATUS_LABEL.CANCELLED
                const endDate = new Date(sub.endDate).toLocaleDateString('ar-SA')
                return (
                  <>
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                      style={{ background: status.bg, color: status.color }}
                    >
                      {status.label}
                    </span>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-m)' }}>حتى {endDate}</p>
                  </>
                )
              },
            },
            {
              key: '_count',
              label: 'الفروع / المستخدمون',
              align: 'center',
              render: (_, row) => {
                const store = row as unknown as Store
                return (
                  <Button
                    variant="ghost-primary"
                    size="xs"
                    onClick={() => openBranches(store)}
                    title="إدارة الفروع"
                  >
                    <GitBranch size={13} />
                    {store._count.branches} / {store._count.users}
                  </Button>
                )
              },
            },
            {
              key: 'isActive',
              label: 'الحالة',
              render: (_, row) => {
                const store = row as unknown as Store
                return (
                  <button
                    onClick={() => toggleActive(store.id, store.isActive)}
                    className="flex items-center gap-1.5 text-xs transition-colors"
                    style={{ color: store.isActive ? 'var(--green)' : 'var(--text-m)' }}
                  >
                    {store.isActive
                      ? <><ToggleRight size={18} /> مفعّل</>
                      : <><ToggleLeft  size={18} /> معطّل</>}
                  </button>
                )
              },
            },
          ]}
          actions={(row) => {
            const store = row as unknown as Store
            return (
              <>
                <Button
                  variant="ghost-primary"
                  size="icon-xs"
                  onClick={() => router.push(`/super-admin/stores/${store.id}/edit`)}
                  title="تعديل المتجر"
                >
                  <Pencil size={14} />
                </Button>
                <Button
                  variant="ghost-primary"
                  size="icon-xs"
                  onClick={() => router.push(`/super-admin/stores/${store.id}/subscription`)}
                  title="إدارة الاشتراك"
                >
                  <CreditCard size={14} />
                </Button>
                <a
                  href={`/${store.slug}/login`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center justify-center h-6 w-6 text-muted-foreground hover:text-primary transition-colors"
                >
                  <ExternalLink size={14} />
                </a>
              </>
            )
          }}
          actionsLabel=""
        />
      </div>

      {/* Branch Modal */}
      {branchStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="absolute inset-0 bg-black/60" onClick={closeBranches} />
          <div
            className="relative w-full max-w-xl rounded-2xl shadow-2xl"
            style={{ background: 'var(--white)', border: '1px solid var(--border-color)' }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <h2 className="font-semibold">فروع {branchStore.name}</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-m)', fontFamily: 'var(--mono)' }}>{branchStore.slug}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => { setShowForm(f => !f); setForm({ name: '', address: '', phone: '' }) }}
                >
                  <Plus size={13} />
                  فرع جديد
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={closeBranches}>
                  <X size={18} />
                </Button>
              </div>
            </div>

            {/* Add Branch Form */}
            {showForm && (
              <form onSubmit={addBranch} className="px-6 py-4 space-y-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: 'name',    label: 'اسم الفرع *', required: true  },
                    { key: 'address', label: 'العنوان',      required: false },
                    { key: 'phone',   label: 'الهاتف',       required: false },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-2)' }}>{f.label}</label>
                      <SAInput
                        value={(form as Record<string, string>)[f.key]}
                        onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                        required={f.required}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowForm(false)}
                  >
                    إلغاء
                  </Button>
                  <Button
                    type="submit"
                    disabled={saving}
                    size="sm"
                  >
                    {saving ? '...' : 'إضافة الفرع'}
                  </Button>
                </div>
              </form>
            )}

            {/* Branch List */}
            <div className="max-h-80 overflow-y-auto">
              {branchLoading ? (
                <div className="text-center py-10 text-sm" style={{ color: 'var(--text-m)' }}>جارٍ التحميل...</div>
              ) : branches.length === 0 ? (
                <div className="text-center py-10 text-sm" style={{ color: 'var(--text-m)' }}>لا توجد فروع</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0" style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--white)' }}>
                    <tr>
                      {['الاسم','العنوان','الهاتف','المستخدمون'].map((h, i) => (
                        <th key={i} className={`${i === 0 ? 'text-right px-6' : i === 3 ? 'text-center px-4' : 'text-right px-4'} py-2 text-xs font-medium`} style={{ color: 'var(--text-m)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {branches.map(b => (
                      <tr key={b.id} style={{ borderTop: '1px solid var(--border-l)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--border-l)')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}>
                        <td className="px-6 py-2.5 font-medium">{b.name}</td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-2)' }}>{b.address ?? '—'}</td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-2)' }}>{b.phone ?? '—'}</td>
                        <td className="px-4 py-2.5 text-center text-xs" style={{ color: 'var(--text-2)' }}>{b._count.users}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
