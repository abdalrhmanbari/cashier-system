'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, ToggleLeft, ToggleRight, Pencil, X, Building2, Users, Settings, DollarSign, AlertTriangle, Percent, Info } from 'lucide-react'
import { SessionProvider } from 'next-auth/react'
import { DataTable } from '@/components/shared/DataTable'
import { StInput, StSelect } from '@/components/shared/StInput'
import { useExchangeRate } from '@/components/shared/ExchangeRateContext'

type Branch    = { id: string; name: string; address: string | null; phone: string | null; isActive: boolean; _count: { users: number } }
type StoreUser = { id: string; name: string; email: string; role: string; isActive: boolean; branchId: string | null; branch: { name: string } | null }

const ROLE_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  STORE_MANAGER: { label: 'مدير المتجر', bg: 'var(--indigo-l)', color: 'var(--indigo)' },
  CASHIER:       { label: 'كاشير',       bg: 'var(--teal-bg)',  color: 'var(--teal)'   },
}
const EMPTY_EDIT = { name: '', email: '', password: '', role: 'CASHIER', branchId: '' }

type TabKey = 'branches' | 'users' | 'exchange' | 'tax' | 'discount'
const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'branches', label: 'الفروع',              icon: Building2  },
  { key: 'users',    label: 'المستخدمون',         icon: Users      },
  { key: 'exchange', label: 'سعر الصرف والعملات', icon: DollarSign },
  { key: 'tax',      label: 'الضريبة',            icon: Percent    },
  { key: 'discount', label: 'سقف الخصم',           icon: AlertTriangle },
]

type RateRow = { id: string; rate: number; effectiveFrom: string; createdBy: { name: string } }
const HOUR = 60 * 60 * 1000

function SettingsContent() {
  const [tab,       setTab]       = useState<TabKey>('branches')
  const [branches,  setBranches]  = useState<Branch[]>([])
  const [users,     setUsers]     = useState<StoreUser[]>([])
  const [branches2, setBranches2] = useState<Branch[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showUser,  setShowUser]  = useState(false)
  const [userForm,  setUserForm]  = useState({ name: '', email: '', password: '', role: 'CASHIER', branchId: '' })
  const [saving,    setSaving]    = useState(false)
  const [editUser,  setEditUser]  = useState<StoreUser | null>(null)
  const [editForm,  setEditForm]  = useState(EMPTY_EDIT)

  // ── سعر الصرف والعملات ── تغيير السعر نفسه يتم حصراً من dialog المؤشر في الرأس؛ هنا عرض فقط
  const { current: currentRate } = useExchangeRate()
  const [rateHistory,  setRateHistory]  = useState<RateRow[]>([])
  const [roundingRule, setRoundingRule] = useState('500')
  const [pricingCurrency, setPricingCurrency] = useState('USD')
  const [settingsSaving,  setSettingsSaving]  = useState(false)
  const [pendingCurrency, setPendingCurrency] = useState<string | null>(null)

  // ── الضريبة ── taxRate يُخزَّن بالخادم بنقاط أساس (1500=15%)، ويُعرض/يُعدَّل هنا كنسبة مئوية
  const [taxEnabled, setTaxEnabled] = useState(false)
  const [taxRatePct, setTaxRatePct] = useState('0')
  const [taxName,    setTaxName]    = useState('ضريبة')
  const [taxSaving,  setTaxSaving]  = useState(false)

  // ── سقف الخصم ── basis points بالخادم (1500=15%)، نص فارغ = بلا سقف (null)
  const [maxDiscountCashierPct, setMaxDiscountCashierPct] = useState('')
  const [maxDiscountManagerPct, setMaxDiscountManagerPct] = useState('')
  const [discountCapSaving, setDiscountCapSaving] = useState(false)

  const loadExchange = useCallback(async () => {
    const [rateRes, settingsRes] = await Promise.all([
      fetch('/api/store/exchange-rate').then(r => r.json()),
      fetch('/api/store/settings').then(r => r.json()),
    ])
    setRateHistory(Array.isArray(rateRes?.history) ? rateRes.history : [])
    setRoundingRule(settingsRes?.roundingRule ?? '500')
    setPricingCurrency(settingsRes?.pricingCurrency ?? 'USD')
    setTaxEnabled(!!settingsRes?.taxEnabled)
    setTaxRatePct(String((settingsRes?.taxRate ?? 0) / 100))
    setTaxName(settingsRes?.taxName ?? 'ضريبة')
    setMaxDiscountCashierPct(settingsRes?.maxDiscountPercentCashier != null ? String(settingsRes.maxDiscountPercentCashier / 100) : '')
    setMaxDiscountManagerPct(settingsRes?.maxDiscountPercentManager != null ? String(settingsRes.maxDiscountPercentManager / 100) : '')
  }, [])

  useEffect(() => { if (tab === 'exchange' || tab === 'tax' || tab === 'discount') loadExchange() }, [tab, loadExchange])

  async function saveDiscountCap(patch: { maxDiscountPercentCashier?: number | null; maxDiscountPercentManager?: number | null }) {
    setDiscountCapSaving(true)
    await fetch('/api/store/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    setDiscountCapSaving(false)
  }

  function submitDiscountCapCashier(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = maxDiscountCashierPct.trim()
    const pct = trimmed === '' ? null : Math.max(0, Math.min(100, parseFloat(trimmed) || 0))
    setMaxDiscountCashierPct(pct === null ? '' : String(pct))
    saveDiscountCap({ maxDiscountPercentCashier: pct === null ? null : Math.round(pct * 100) })
  }

  function submitDiscountCapManager(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = maxDiscountManagerPct.trim()
    const pct = trimmed === '' ? null : Math.max(0, Math.min(100, parseFloat(trimmed) || 0))
    setMaxDiscountManagerPct(pct === null ? '' : String(pct))
    saveDiscountCap({ maxDiscountPercentManager: pct === null ? null : Math.round(pct * 100) })
  }

  async function saveTax(patch: { taxEnabled?: boolean; taxRate?: number; taxName?: string }) {
    setTaxSaving(true)
    await fetch('/api/store/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    setTaxSaving(false)
  }

  function toggleTaxEnabled() {
    const next = !taxEnabled
    setTaxEnabled(next); saveTax({ taxEnabled: next })
  }

  function submitTaxRate(e: React.FormEvent) {
    e.preventDefault()
    const pct = Math.max(0, Math.min(100, parseFloat(taxRatePct) || 0))
    const basisPoints = Math.round(pct * 100)
    setTaxRatePct(String(pct)); saveTax({ taxRate: basisPoints })
  }

  function submitTaxName(e: React.FormEvent) {
    e.preventDefault()
    const name = taxName.trim() || 'ضريبة'
    setTaxName(name); saveTax({ taxName: name })
  }

  const rateStale = currentRate ? Date.now() - new Date(currentRate.effectiveFrom).getTime() > 24 * HOUR : false

  async function saveRoundingRule(value: string) {
    setRoundingRule(value); setSettingsSaving(true)
    await fetch('/api/store/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roundingRule: value }) })
    setSettingsSaving(false)
  }

  function requestCurrencyChange(value: string) {
    if (value === pricingCurrency) return
    setPendingCurrency(value)
  }

  async function confirmCurrencyChange() {
    if (!pendingCurrency) return
    setSettingsSaving(true)
    await fetch('/api/store/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pricingCurrency: pendingCurrency }) })
    setPricingCurrency(pendingCurrency); setPendingCurrency(null); setSettingsSaving(false)
  }

  async function loadBranches() {
    const data = await fetch('/api/store/branches').then(r => r.json())
    const arr  = Array.isArray(data) ? data : []
    setBranches(arr); setBranches2(arr)
  }

  async function loadUsers() {
    const data = await fetch('/api/store/users').then(r => r.json())
    setUsers(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([loadBranches(), loadUsers()]).finally(() => setLoading(false))
  }, [])

  async function toggleBranch(id: string, current: boolean) {
    await fetch('/api/store/branches', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, isActive: !current }) })
    setBranches(b => b.map(br => br.id === id ? { ...br, isActive: !current } : br))
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const res  = await fetch('/api/store/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...userForm, branchId: userForm.branchId || null }) })
    const json = await res.json(); setSaving(false)
    if (!res.ok) { alert(json.error); return }
    setShowUser(false); setUserForm({ name: '', email: '', password: '', role: 'CASHIER', branchId: '' }); loadUsers()
  }

  async function toggleUser(id: string, current: boolean) {
    const res  = await fetch('/api/store/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, isActive: !current }) })
    const json = await res.json()
    if (res.ok) setUsers(u => u.map(us => us.id === id ? { ...us, isActive: json.isActive } : us))
  }

  function openEdit(u: StoreUser) {
    setEditUser(u); setEditForm({ name: u.name, email: u.email, password: '', role: u.role, branchId: u.branchId ?? '' })
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault(); if (!editUser) return; setSaving(true)
    const body: Record<string, unknown> = { id: editUser.id, name: editForm.name, email: editForm.email, role: editForm.role, branchId: editForm.branchId || null }
    if (editForm.password) body.password = editForm.password
    const res  = await fetch('/api/store/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json(); setSaving(false)
    if (!res.ok) { alert(json.error); return }
    setUsers(u => u.map(us => us.id === editUser.id ? json : us)); setEditUser(null)
  }

  const Label = ({ children }: { children: React.ReactNode }) => (
    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>{children}</label>
  )

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }} dir="rtl">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Settings size={16} style={{ color: 'var(--indigo)' }} />
        <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>الإعدادات</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2px', padding: '3px', borderRadius: 'var(--r-s)', background: 'var(--diamond)', width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: tab === t.key ? 600 : 400,
              border: 'none', cursor: 'pointer', fontFamily: 'var(--f)',
              background: tab === t.key ? 'var(--white)' : 'transparent',
              color: tab === t.key ? 'var(--text)' : 'var(--text-2)',
              boxShadow: tab === t.key ? 'var(--sh)' : 'none',
              transition: '.12s',
            }}>
            <t.icon size={13} style={{ color: tab === t.key ? 'var(--indigo)' : undefined }} />
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-m)', fontSize: '13px' }}>جارٍ التحميل...</div>
      ) : tab === 'branches' ? (

        /* ─── Branches ─── */
        <DataTable
          data={branches as unknown as Record<string, unknown>[]}
          searchable={false}
          emptyMessage="لا توجد فروع"
          columns={[
            { key: 'name',    label: 'الاسم',        render: (_, row) => <span style={{ fontWeight: 500, color: 'var(--text)' }}>{(row as unknown as Branch).name}</span> },
            { key: 'address', label: 'العنوان',      render: (_, row) => <span style={{ color: 'var(--text-2)' }}>{(row as unknown as Branch).address ?? '—'}</span> },
            { key: 'phone',   label: 'الهاتف',       render: (_, row) => <span style={{ color: 'var(--text-2)' }}>{(row as unknown as Branch).phone ?? '—'}</span> },
            { key: '_count',  label: 'المستخدمون',  align: 'center', render: (_, row) => <span style={{ color: 'var(--text-2)' }}>{(row as unknown as Branch)._count.users}</span> },
            {
              key: 'isActive', label: 'الحالة', align: 'center',
              render: (_, row) => {
                const b = row as unknown as Branch
                return (
                  <button onClick={() => toggleBranch(b.id, b.isActive)}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: b.isActive ? 'var(--green)' : 'var(--text-m)', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--f)', margin: '0 auto' }}>
                    {b.isActive ? <><ToggleRight size={16} /> مفعّل</> : <><ToggleLeft size={16} /> معطّل</>}
                  </button>
                )
              },
            },
          ]}
        />

      ) : tab === 'users' ? (

        /* ─── Users ─── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-primary" style={{ fontSize: '13px', padding: '6px 14px' }}
              onClick={() => { setShowUser(v => !v); setUserForm({ name: '', email: '', password: '', role: 'CASHIER', branchId: '' }) }}>
              <Plus size={14} /> مستخدم جديد
            </button>
          </div>

          {showUser && (
            <div className="card" style={{ padding: '14px 16px', background: 'var(--diamond)', borderColor: 'var(--border-color)' }}>
              <form onSubmit={addUser} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '8px' }}>
                  <div>
                    <Label>الاسم *</Label>
                    <StInput value={userForm.name} onChange={e => setUserForm(p => ({ ...p, name: e.target.value }))} required />
                  </div>
                  <div>
                    <Label>البريد الإلكتروني *</Label>
                    <StInput type="email" value={userForm.email} onChange={e => setUserForm(p => ({ ...p, email: e.target.value }))} required dir="ltr" />
                  </div>
                  <div>
                    <Label>كلمة المرور *</Label>
                    <StInput type="password" value={userForm.password} onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))} required minLength={6} dir="ltr" />
                  </div>
                  <div>
                    <Label>الدور</Label>
                    <StSelect value={userForm.role} onChange={e => setUserForm(p => ({ ...p, role: e.target.value }))}>
                      <option value="CASHIER">كاشير</option>
                      <option value="STORE_MANAGER">مدير متجر</option>
                    </StSelect>
                  </div>
                  {userForm.role === 'CASHIER' && (
                    <div style={{ gridColumn: '1/-1' }}>
                      <Label>الفرع</Label>
                      <StSelect value={userForm.branchId} onChange={e => setUserForm(p => ({ ...p, branchId: e.target.value }))}>
                        <option value="">اختر الفرع</option>
                        {branches2.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </StSelect>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-ghost" onClick={() => setShowUser(false)}>إلغاء</button>
                  <button type="submit" className="btn-primary" style={{ fontSize: '13px' }} disabled={saving}>
                    {saving ? 'جارٍ الإضافة...' : 'إضافة المستخدم'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <DataTable
            data={users as unknown as Record<string, unknown>[]}
            searchable={false}
            emptyMessage="لا يوجد مستخدمون"
            columns={[
              { key: 'name',  label: 'الاسم',  render: (_, row) => <span style={{ fontWeight: 500, color: 'var(--text)' }}>{(row as unknown as StoreUser).name}</span> },
              { key: 'email', label: 'البريد', render: (_, row) => <span style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: 'var(--mono)' }}>{(row as unknown as StoreUser).email}</span> },
              {
                key: 'role', label: 'الدور',
                render: (_, row) => {
                  const u = row as unknown as StoreUser
                  const r = ROLE_LABEL[u.role] ?? { label: u.role, bg: 'var(--diamond)', color: 'var(--text-2)' }
                  return <span className="badge" style={{ background: r.bg, color: r.color }}>{r.label}</span>
                },
              },
              { key: 'branch', label: 'الفرع', render: (_, row) => <span style={{ color: 'var(--text-2)' }}>{(row as unknown as StoreUser).branch?.name ?? '—'}</span> },
              {
                key: 'isActive', label: 'الحالة', align: 'center',
                render: (_, row) => {
                  const u = row as unknown as StoreUser
                  return (
                    <button onClick={() => toggleUser(u.id, u.isActive)}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: u.isActive ? 'var(--green)' : 'var(--text-m)', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--f)', margin: '0 auto' }}>
                      {u.isActive ? <><ToggleRight size={15} /> مفعّل</> : <><ToggleLeft size={15} /> معطّل</>}
                    </button>
                  )
                },
              },
            ]}
            actions={row => {
              const u = row as unknown as StoreUser
              return (
                <button onClick={() => openEdit(u)}
                  style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--r-x)', border: '1px solid var(--border-color)', background: 'var(--white)', color: 'var(--text-2)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--diamond)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--white)')}>
                  <Pencil size={13} />
                </button>
              )
            }}
            actionsLabel=""
          />
        </div>

      ) : tab === 'tax' ? (

        /* ─── الضريبة ─── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '480px' }}>
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: taxEnabled ? '14px' : 0 }}>
              <div>
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>تفعيل الضريبة</p>
                <p style={{ fontSize: '12px', color: 'var(--text-m)', marginTop: '2px' }}>
                  عند التعطيل أو كون النسبة صفراً — لا تُحسب أي ضريبة ولا تظهر في نقطة البيع أو الفاتورة أو التقارير.
                </p>
              </div>
              <button onClick={toggleTaxEnabled} disabled={taxSaving}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', fontWeight: 600, color: taxEnabled ? 'var(--green)' : 'var(--text-m)', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--f)', flexShrink: 0 }}>
                {taxEnabled ? <><ToggleRight size={22} /> مفعّلة</> : <><ToggleLeft size={22} /> معطّلة</>}
              </button>
            </div>

            {taxEnabled && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
                <form onSubmit={submitTaxRate} style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <Label>نسبة الضريبة (%)</Label>
                    <StInput type="number" min={0} max={100} step={0.01} value={taxRatePct} onChange={e => setTaxRatePct(e.target.value)} placeholder="15" dir="ltr" />
                  </div>
                  <button type="submit" className="btn-primary" disabled={taxSaving} style={{ fontSize: '13px' }}>
                    {taxSaving ? 'جارٍ الحفظ...' : 'حفظ'}
                  </button>
                </form>

                <form onSubmit={submitTaxName} style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <Label>اسم الضريبة (يظهر على الفاتورة)</Label>
                    <StInput value={taxName} onChange={e => setTaxName(e.target.value)} placeholder="ضريبة القيمة المضافة" />
                  </div>
                  <button type="submit" className="btn-primary" disabled={taxSaving} style={{ fontSize: '13px' }}>
                    {taxSaving ? 'جارٍ الحفظ...' : 'حفظ'}
                  </button>
                </form>

                <p style={{ fontSize: '11.5px', color: 'var(--text-m)' }}>
                  تغيير النسبة أو الاسم يسري على الفواتير الجديدة فقط — الفواتير السابقة تبقى محفوظة بما حُسب لحظة إصدارها.
                </p>
              </div>
            )}
          </div>
        </div>

      ) : tab === 'discount' ? (

        /* ─── سقف الخصم ─── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '480px' }}>
          <div className="card" style={{ padding: '16px' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>سقف الخصم الأقصى لكل دور</p>
            <p style={{ fontSize: '12px', color: 'var(--text-m)', marginBottom: '14px' }}>
              نسبة الخصم الإجمالية المسموحة بالفاتورة (خصم الأصناف + خصم الفاتورة معاً) لكل دور. اترك الحقل فارغاً لإلغاء السقف (بلا حد أقصى). يُفرض على الخادم مباشرة عند إنشاء أي فاتورة.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <form onSubmit={submitDiscountCapCashier} style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <Label>سقف الكاشير (%)</Label>
                  <StInput type="number" min={0} max={100} step={0.01} value={maxDiscountCashierPct}
                    onChange={e => setMaxDiscountCashierPct(e.target.value)} placeholder="بلا سقف" dir="ltr" />
                </div>
                <button type="submit" className="btn-primary" disabled={discountCapSaving} style={{ fontSize: '13px' }}>
                  {discountCapSaving ? 'جارٍ الحفظ...' : 'حفظ'}
                </button>
              </form>

              <form onSubmit={submitDiscountCapManager} style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <Label>سقف المدير (%)</Label>
                  <StInput type="number" min={0} max={100} step={0.01} value={maxDiscountManagerPct}
                    onChange={e => setMaxDiscountManagerPct(e.target.value)} placeholder="بلا سقف" dir="ltr" />
                </div>
                <button type="submit" className="btn-primary" disabled={discountCapSaving} style={{ fontSize: '13px' }}>
                  {discountCapSaving ? 'جارٍ الحفظ...' : 'حفظ'}
                </button>
              </form>
            </div>
          </div>
        </div>

      ) : (

        /* ─── سعر الصرف والعملات ─── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '640px' }}>

          {rateStale && currentRate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: 'var(--r-s)', background: 'var(--amber-bg)', border: '1px solid var(--amber)', color: 'var(--amber)', fontSize: '13px' }}>
              <AlertTriangle size={15} />
              مرّ أكثر من 24 ساعة على آخر تحديث لسعر الصرف — يُفضّل تحديثه.
            </div>
          )}

          <div className="card" style={{ padding: '16px' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginBottom: '12px' }}>سعر الصرف الحالي</p>
            {currentRate ? (
              <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '10px' }}>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '18px', color: 'var(--indigo)' }}>{currentRate.rate.toLocaleString('en-US')} ل.س</span> لكل دولار — بواسطة {currentRate.createdBy.name}
              </p>
            ) : (
              <p style={{ fontSize: '13px', color: 'var(--text-m)', marginBottom: '10px' }}>لا يوجد سعر صرف مسجل بعد</p>
            )}
            <p style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-m)' }}>
              <Info size={13} /> لتغيير السعر استخدم المؤشر أعلى الشاشة
            </p>
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginBottom: '12px' }}>إعدادات العملة</p>
            <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '10px' }}>
              <div>
                <Label>قاعدة التقريب (ليرة سورية)</Label>
                <StSelect value={roundingRule} onChange={e => saveRoundingRule(e.target.value)} disabled={settingsSaving}>
                  <option value="100">أقرب 100</option>
                  <option value="500">أقرب 500</option>
                  <option value="1000">أقرب 1000</option>
                </StSelect>
              </div>
              <div>
                <Label>عملة تسعير المنتجات</Label>
                <StSelect value={pricingCurrency} onChange={e => requestCurrencyChange(e.target.value)} disabled={settingsSaving}>
                  <option value="USD">دولار (USD)</option>
                  <option value="SYP">ليرة سورية (SYP)</option>
                </StSelect>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
              <p style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>سجل أسعار الصرف</p>
            </div>
            {rateHistory.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-m)', fontSize: '13px' }}>لا يوجد سجل بعد</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead><tr><th>السعر</th><th>التاريخ</th><th>أدخله</th></tr></thead>
                  <tbody>
                    {rateHistory.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--text)' }}>{r.rate.toLocaleString('en-US')} ل.س</td>
                        <td style={{ fontSize: '12.5px', color: 'var(--text-2)' }}>{new Date(r.effectiveFrom).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                        <td style={{ fontSize: '12.5px', color: 'var(--text-m)' }}>{r.createdBy.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* مودال تأكيد تغيير عملة التسعير */}
      {pendingCurrency && (
        <div className="modal-backdrop" dir="rtl">
          <div className="modal-box" style={{ maxWidth: '380px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '9999px', background: 'var(--amber-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={16} style={{ color: 'var(--amber)' }} />
              </div>
              <h3 style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>تغيير عملة تسعير المنتجات</h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '14px' }}>
              المنتجات الموجودة ستبقى بعملتها الحالية، والمنتجات الجديدة فقط ستُدخل بالعملة الجديدة ({pendingCurrency === 'USD' ? 'دولار' : 'ليرة سورية'}).
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setPendingCurrency(null)}>إلغاء</button>
              <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={confirmCurrencyChange}>تأكيد</button>
            </div>
          </div>
        </div>
      )}

      {/* مودال تعديل المستخدم */}
      {editUser && (
        <div className="modal-backdrop" dir="rtl">
          <div className="modal-box" style={{ maxWidth: '460px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
              <h2 style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>تعديل المستخدم</h2>
              <button onClick={() => setEditUser(null)} style={{ color: 'var(--text-m)', border: 'none', background: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={saveEdit} style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '8px' }}>
                <div>
                  <Label>الاسم *</Label>
                  <StInput value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} required />
                </div>
                <div>
                  <Label>البريد الإلكتروني *</Label>
                  <StInput type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} required dir="ltr" />
                </div>
                <div>
                  <Label>كلمة المرور الجديدة</Label>
                  <StInput type="password" value={editForm.password} onChange={e => setEditForm(p => ({ ...p, password: e.target.value }))} dir="ltr" placeholder="اتركها فارغة لعدم التغيير" />
                </div>
                <div>
                  <Label>الدور</Label>
                  <StSelect value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value, branchId: '' }))}>
                    <option value="CASHIER">كاشير</option>
                    <option value="STORE_MANAGER">مدير متجر</option>
                  </StSelect>
                </div>
                {editForm.role === 'CASHIER' && (
                  <div style={{ gridColumn: '1/-1' }}>
                    <Label>الفرع</Label>
                    <StSelect value={editForm.branchId} onChange={e => setEditForm(p => ({ ...p, branchId: e.target.value }))}>
                      <option value="">بدون فرع</option>
                      {branches2.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </StSelect>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
                <button type="button" className="btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setEditUser(null)}>إلغاء</button>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={saving}>
                  {saving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SettingsPage() {
  return (
    <SessionProvider basePath="/api/store-auth">
      <SettingsContent />
    </SessionProvider>
  )
}