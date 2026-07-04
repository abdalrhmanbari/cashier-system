'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, Plus, Pencil, Trash2, X, ToggleLeft, ToggleRight, Users, ShieldCheck } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { SAInput, SASelect } from '@/components/shared/SAInput'
import { Button } from '@/components/ui/button'

type StoreUser = {
  id: string; name: string; email: string; role: string; isActive: boolean; createdAt: string
  store: { id: string; name: string; slug: string }
  branch: { id: string; name: string } | null
}
type SuperAdmin   = { id: string; name: string; email: string; createdAt: string }
type StoreOption  = { id: string; name: string; slug: string }
type BranchOption = { id: string; name: string }

const ROLE: Record<string, { label: string; bg: string; color: string }> = {
  STORE_MANAGER: { label: 'مدير متجر', bg: 'var(--cerulean-g)',  color: 'var(--cerulean)' },
  CASHIER:       { label: 'كاشير',     bg: 'var(--teal-bg)',     color: 'var(--teal)'     },
}

type UserForm = { storeId: string; name: string; email: string; password: string; role: string; branchId: string; isActive: boolean }
const EMPTY_USER: UserForm = { storeId: '', name: '', email: '', password: '', role: 'CASHIER', branchId: '', isActive: true }

function UserModal({ initial, stores, onClose, onSave }: { initial: StoreUser | null; stores: StoreOption[]; onClose: () => void; onSave: (u: StoreUser) => void }) {
  const isEdit = !!initial
  const [form, setForm]     = useState<UserForm>(isEdit ? { storeId: initial.store.id, name: initial.name, email: initial.email, password: '', role: initial.role, branchId: initial.branch?.id ?? '', isActive: initial.isActive } : { ...EMPTY_USER })
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [error,    setError]    = useState('')
  const [saving,   setSaving]   = useState(false)

  const set = (k: keyof UserForm, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!form.storeId) { setBranches([]); return }
    fetch(`/api/super-admin/stores/${form.storeId}/branches`).then(r => r.json()).then(d => setBranches(Array.isArray(d) ? d : []))
  }, [form.storeId])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setSaving(true)
    const body: Record<string, unknown> = isEdit
      ? { id: initial!.id, name: form.name, email: form.email, role: form.role, branchId: form.branchId || null, isActive: form.isActive, ...(form.password ? { password: form.password } : {}) }
      : { storeId: form.storeId, name: form.name, email: form.email, password: form.password, role: form.role, branchId: form.branchId || undefined }
    const res  = await fetch('/api/super-admin/users', { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'خطأ'); return }
    onSave(data)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl shadow-2xl" style={{ background: 'var(--white)', border: '1px solid var(--border-color)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <h2 className="font-semibold">{isEdit ? 'تعديل المستخدم' : 'إضافة مستخدم'}</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          {!isEdit && (
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-2)' }}>المتجر *</label>
              <SASelect value={form.storeId} onChange={e => { set('storeId', e.target.value); set('branchId', '') }} required>
                <option value="">اختر متجراً...</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name} ({s.slug})</option>)}
              </SASelect>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'name',  label: 'الاسم *',            type: 'text',  req: true },
              { key: 'email', label: 'البريد الإلكتروني *', type: 'email', req: true },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-2)' }}>{f.label}</label>
                <SAInput type={f.type} value={(form as Record<string, unknown>)[f.key] as string} onChange={e => set(f.key as keyof UserForm, e.target.value)} required={f.req} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-2)' }}>{isEdit ? 'كلمة مرور جديدة (اختياري)' : 'كلمة المرور *'}</label>
              <SAInput type="password" value={form.password} onChange={e => set('password', e.target.value)} required={!isEdit} minLength={8} placeholder={isEdit ? 'اتركها فارغة للإبقاء' : ''} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-2)' }}>الدور *</label>
              <SASelect value={form.role} onChange={e => set('role', e.target.value)}>
                <option value="CASHIER">كاشير</option>
                <option value="STORE_MANAGER">مدير متجر</option>
              </SASelect>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-2)' }}>الفرع</label>
              <SASelect value={form.branchId} onChange={e => set('branchId', e.target.value)} disabled={!form.storeId && !isEdit}>
                <option value="">بدون فرع محدد</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </SASelect>
            </div>
            {isEdit && (
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div
                    onClick={() => set('isActive', !form.isActive)}
                    className="w-10 h-5 rounded-full flex items-center px-0.5 cursor-pointer transition-colors"
                    style={{ background: form.isActive ? 'var(--cerulean)' : 'var(--border-color)' }}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                  <span className="text-sm" style={{ color: 'var(--text)' }}>{form.isActive ? 'مفعّل' : 'معطّل'}</span>
                </label>
              </div>
            )}
          </div>
          {error && <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>}
          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>إلغاء</Button>
            <Button type="submit" disabled={saving} size="sm">
              {saving ? '...' : isEdit ? 'حفظ التعديلات' : 'إضافة'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

type AdminForm = { name: string; email: string; password: string }

function AdminModal({ initial, onClose, onSave }: { initial: SuperAdmin | null; onClose: () => void; onSave: (a: SuperAdmin) => void }) {
  const isEdit = !!initial
  const [form,   setForm]   = useState<AdminForm>({ name: initial?.name ?? '', email: initial?.email ?? '', password: '' })
  const [error,  setError]  = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k: keyof AdminForm, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setSaving(true)
    const body: Record<string, unknown> = isEdit
      ? { id: initial!.id, name: form.name, email: form.email, ...(form.password ? { password: form.password } : {}) }
      : { name: form.name, email: form.email, password: form.password }
    const res  = await fetch('/api/super-admin/admins', { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'خطأ'); return }
    onSave(data)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl shadow-2xl" style={{ background: 'var(--white)', border: '1px solid var(--border-color)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <h2 className="font-semibold">{isEdit ? 'تعديل مدير النظام' : 'إضافة مدير نظام'}</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          {[
            { key: 'name',  label: 'الاسم *',            type: 'text',     req: true },
            { key: 'email', label: 'البريد الإلكتروني *', type: 'email',    req: true },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-2)' }}>{f.label}</label>
              <SAInput type={f.type} value={(form as Record<string, string>)[f.key]} onChange={e => set(f.key as keyof AdminForm, e.target.value)} required={f.req} />
            </div>
          ))}
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-2)' }}>{isEdit ? 'كلمة مرور جديدة (اختياري)' : 'كلمة المرور *'}</label>
            <SAInput type="password" value={form.password} onChange={e => set('password', e.target.value)} required={!isEdit} minLength={8} placeholder={isEdit ? 'اتركها فارغة للإبقاء' : ''} />
          </div>
          {error && <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>}
          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>إلغاء</Button>
            <Button type="submit" disabled={saving} size="sm">
              {saving ? '...' : isEdit ? 'حفظ التعديلات' : 'إضافة'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteConfirm({ name, onClose, onConfirm }: { name: string; onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center space-y-4" style={{ background: 'var(--white)', border: '1px solid var(--border-color)' }}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto" style={{ background: 'var(--red-bg)' }}>
          <Trash2 size={20} style={{ color: 'var(--red)' }} />
        </div>
        <div>
          <p className="font-semibold">حذف المستخدم</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>هل أنت متأكد من حذف <span style={{ color: 'var(--text)' }}>{name}</span>؟ لا يمكن التراجع.</p>
        </div>
        <div className="flex gap-2 justify-center">
          <Button variant="ghost" size="sm" onClick={onClose}>إلغاء</Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>حذف</Button>
        </div>
      </div>
    </div>
  )
}

type Tab = 'store-users' | 'super-admins'

export default function UsersPage() {
  const [tab, setTab] = useState<Tab>('store-users')

  const [users,      setUsers]      = useState<StoreUser[]>([])
  const [usersLoad,  setUsersLoad]  = useState(true)
  const [search,     setSearch]     = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [userModal,  setUserModal]  = useState<StoreUser | null | 'new'>(null)
  const [deleteUser, setDeleteUser] = useState<StoreUser | null>(null)
  const [stores,     setStores]     = useState<StoreOption[]>([])

  const [admins,      setAdmins]      = useState<SuperAdmin[]>([])
  const [adminsLoad,  setAdminsLoad]  = useState(true)
  const [adminModal,  setAdminModal]  = useState<SuperAdmin | null | 'new'>(null)
  const [adminSearch, setAdminSearch] = useState('')

  const loadUsers = useCallback(async () => {
    setUsersLoad(true)
    const p = new URLSearchParams(); if (roleFilter) p.set('role', roleFilter)
    const res = await fetch(`/api/super-admin/users?${p}`)
    const data = await res.json()
    setUsers(Array.isArray(data) ? data : [])
    setUsersLoad(false)
  }, [roleFilter])

  const loadAdmins = useCallback(async () => {
    setAdminsLoad(true)
    const res = await fetch('/api/super-admin/admins'); const data = await res.json()
    setAdmins(Array.isArray(data) ? data : []); setAdminsLoad(false)
  }, [])

  const loadStores = useCallback(async () => {
    const res = await fetch('/api/super-admin/stores'); const data = await res.json()
    setStores(Array.isArray(data) ? data.map((s: StoreOption) => ({ id: s.id, name: s.name, slug: s.slug })) : [])
  }, [])

  useEffect(() => { loadUsers() },  [loadUsers])
  useEffect(() => { loadAdmins() }, [loadAdmins])
  useEffect(() => { loadStores() }, [loadStores])

  async function toggleActive(id: string, current: boolean) {
    const res = await fetch('/api/super-admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, isActive: !current }) })
    if (res.ok) setUsers(u => u.map(x => x.id === id ? { ...x, isActive: !current } : x))
  }

  async function handleDelete() {
    if (!deleteUser) return
    await fetch(`/api/super-admin/users?id=${deleteUser.id}`, { method: 'DELETE' })
    setUsers(u => u.filter(x => x.id !== deleteUser.id))
    setDeleteUser(null)
  }

  const filteredUsers  = users.filter(u => u.name.includes(search)  || u.email.includes(search)  || u.store.name.includes(search))
  const filteredAdmins = admins.filter(a => a.name.includes(adminSearch) || a.email.includes(adminSearch))

  const total = users.length, active = users.filter(u => u.isActive).length
  const managers = users.filter(u => u.role === 'STORE_MANAGER').length
  const cashiers = users.filter(u => u.role === 'CASHIER').length

  return (
    <>
      <div className="space-y-5">
        <h1 className="text-xl font-bold">المستخدمون</h1>

        {/* Tab switcher — kept as raw buttons due to dynamic active state */}
        <div className="flex gap-1 rounded-xl p-1 w-fit" style={{ background: 'var(--diamond)' }}>
          {([
            { id: 'store-users',  label: 'مستخدمو المتاجر', icon: Users       },
            { id: 'super-admins', label: 'مدراء النظام',    icon: ShieldCheck },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={tab === id ? { background: 'var(--cerulean)', color: '#FFFFFF' } : { color: 'var(--text-2)' }}>
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {/* Store Users Tab */}
        {tab === 'store-users' && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'الإجمالي',    value: total,    color: 'var(--text)'         },
                { label: 'نشطون',       value: active,   color: 'var(--green)'    },
                { label: 'مديرو متاجر', value: managers, color: 'var(--cerulean)' },
                { label: 'كاشيرون',     value: cashiers, color: 'var(--teal)'     },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: 'var(--white)', border: '1px solid var(--border-color)' }}>
                  <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-m)' }}>{s.label}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-m)' }} />
                <SAInput value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو البريد أو المتجر..."
                  style={{ paddingRight: '36px' }} />
              </div>
              <SASelect value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ width: 'auto' }}>
                <option value="">جميع الأدوار</option>
                <option value="STORE_MANAGER">مدير متجر</option>
                <option value="CASHIER">كاشير</option>
              </SASelect>
              <Button onClick={() => setUserModal('new')} className="shrink-0">
                <Plus size={15} />
                إضافة مستخدم
              </Button>
            </div>

            <DataTable
              data={filteredUsers as unknown as Record<string, unknown>[]}
              loading={usersLoad}
              searchable={false}
              emptyMessage="لا توجد نتائج"
              columns={[
                {
                  key: 'name',
                  label: 'المستخدم',
                  render: (_, row) => {
                    const user = row as unknown as StoreUser
                    return (
                      <>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-m)' }}>{user.email}</p>
                      </>
                    )
                  },
                },
                {
                  key: 'store',
                  label: 'المتجر',
                  render: (_, row) => {
                    const user = row as unknown as StoreUser
                    return (
                      <>
                        <p style={{ color: 'var(--text)' }}>{user.store.name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-m)', fontFamily: 'var(--mono)' }}>{user.store.slug}</p>
                      </>
                    )
                  },
                },
                { key: 'branch', label: 'الفرع', render: (_, row) => <span className="text-xs" style={{ color: 'var(--text-2)' }}>{(row as unknown as StoreUser).branch?.name ?? '—'}</span> },
                {
                  key: 'role',
                  label: 'الدور',
                  render: (_, row) => {
                    const user = row as unknown as StoreUser
                    const role = ROLE[user.role] ?? { label: user.role, bg: 'var(--border-l)', color: 'var(--text-2)' }
                    return <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ background: role.bg, color: role.color }}>{role.label}</span>
                  },
                },
                {
                  key: 'isActive',
                  label: 'الحالة',
                  render: (_, row) => {
                    const user = row as unknown as StoreUser
                    return (
                      <button onClick={() => toggleActive(user.id, user.isActive)}
                        className="flex items-center gap-1.5 text-xs transition-colors"
                        style={{ color: user.isActive ? 'var(--green)' : 'var(--text-m)' }}>
                        {user.isActive ? <><ToggleRight size={18} /> مفعّل</> : <><ToggleLeft size={18} /> معطّل</>}
                      </button>
                    )
                  },
                },
                { key: 'createdAt', label: 'تاريخ الإنشاء', render: (_, row) => <span className="text-xs" style={{ color: 'var(--text-m)' }}>{new Date((row as unknown as StoreUser).createdAt).toLocaleDateString('ar-SA')}</span> },
              ]}
              actions={(row) => {
                const user = row as unknown as StoreUser
                return (
                  <>
                    <Button variant="ghost-primary" size="icon-xs" onClick={() => setUserModal(user)} title="تعديل">
                      <Pencil size={14} />
                    </Button>
                    <Button variant="ghost-destructive" size="icon-xs" onClick={() => setDeleteUser(user)} title="حذف">
                      <Trash2 size={14} />
                    </Button>
                  </>
                )
              }}
              actionsLabel=""
            />
          </div>
        )}

        {/* Super Admins Tab */}
        {tab === 'super-admins' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-m)' }} />
                <SAInput value={adminSearch} onChange={e => setAdminSearch(e.target.value)} placeholder="بحث بالاسم أو البريد..."
                  style={{ paddingRight: '36px' }} />
              </div>
              <Button onClick={() => setAdminModal('new')} className="shrink-0">
                <Plus size={15} />
                إضافة مدير نظام
              </Button>
            </div>

            <DataTable
              data={filteredAdmins as unknown as Record<string, unknown>[]}
              loading={adminsLoad}
              searchable={false}
              emptyMessage="لا توجد نتائج"
              columns={[
                { key: 'name',      label: 'الاسم',              render: (_, row) => <span className="font-medium" style={{ color: 'var(--text)' }}>{(row as unknown as SuperAdmin).name}</span> },
                { key: 'email',     label: 'البريد الإلكتروني',  render: (_, row) => <span style={{ color: 'var(--text-2)' }}>{(row as unknown as SuperAdmin).email}</span> },
                { key: 'role',      label: 'الدور',              render: () => <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ background: 'var(--purple-bg)', color: 'var(--purple)' }}>Super Admin</span> },
                { key: 'createdAt', label: 'تاريخ الإنشاء',      render: (_, row) => <span className="text-xs" style={{ color: 'var(--text-m)' }}>{new Date((row as unknown as SuperAdmin).createdAt).toLocaleDateString('ar-SA')}</span> },
              ]}
              actions={(row) => {
                const admin = row as unknown as SuperAdmin
                return (
                  <Button variant="ghost-primary" size="icon-xs" onClick={() => setAdminModal(admin)} title="تعديل">
                    <Pencil size={14} />
                  </Button>
                )
              }}
              actionsLabel=""
            />
          </div>
        )}
      </div>

      {userModal !== null && (
        <UserModal initial={userModal === 'new' ? null : userModal} stores={stores}
          onClose={() => setUserModal(null)}
          onSave={saved => { setUsers(u => userModal === 'new' ? [saved, ...u] : u.map(x => x.id === saved.id ? saved : x)); setUserModal(null) }} />
      )}
      {adminModal !== null && (
        <AdminModal initial={adminModal === 'new' ? null : adminModal}
          onClose={() => setAdminModal(null)}
          onSave={saved => { setAdmins(a => adminModal === 'new' ? [saved, ...a] : a.map(x => x.id === saved.id ? saved : x)); setAdminModal(null) }} />
      )}
      {deleteUser && <DeleteConfirm name={deleteUser.name} onClose={() => setDeleteUser(null)} onConfirm={handleDelete} />}
    </>
  )
}
