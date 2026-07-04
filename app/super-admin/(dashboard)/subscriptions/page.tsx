'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { SASelect } from '@/components/shared/SAInput'
import { Button } from '@/components/ui/button'

type Subscription = {
  id: string
  status: string
  billingCycle: string
  branchCount: number
  priceUsd: number
  endDate: string
  notes: string | null
  store: { name: string; slug: string }
  plan: { name: string }
  payments: { amountUsd: number; paidAt: string }[]
}

const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  ACTIVE:    { label: 'نشط',    bg: 'var(--green-bg)',  color: 'var(--green)'  },
  TRIAL:     { label: 'تجريبي', bg: 'var(--blue-bg)',   color: 'var(--blue)'   },
  EXPIRED:   { label: 'منتهي',  bg: 'var(--amber-bg)',  color: 'var(--amber)'  },
  SUSPENDED: { label: 'موقوف',  bg: 'var(--red-bg)',    color: 'var(--red)'    },
  CANCELLED: { label: 'ملغي',   bg: 'var(--border-l)',  color: 'var(--text-2)' },
}

const CYCLE_LABEL: Record<string, string> = {
  MONTHLY: 'شهري',
  YEARLY:  'سنوي',
}

export default function SubscriptionsPage() {
  const [subs,    setSubs]    = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('ALL')

  async function load() {
    setLoading(true)
    const q   = filter !== 'ALL' ? `?status=${filter}` : ''
    const res = await fetch(`/api/super-admin/subscriptions${q}`)
    setSubs(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  async function changeStatus(id: string, status: string) {
    await fetch('/api/super-admin/subscriptions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    load()
  }

  const usd = (cents: number) => `$${parseFloat((cents / 100).toFixed(2))}`

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">الاشتراكات</h1>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw size={14} />
          تحديث
        </Button>
      </div>

      {/* Filter chips — kept as raw buttons due to dynamic active state */}
      <div className="flex gap-2 flex-wrap">
        {['ALL', 'ACTIVE', 'TRIAL', 'EXPIRED', 'SUSPENDED', 'CANCELLED'].map(s => {
          const info = STATUS[s]
          const isActive = filter === s
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
              style={isActive
                ? { background: 'var(--cerulean)', color: '#FFFFFF' }
                : { background: 'var(--border-l)', color: 'var(--text-2)', border: '1px solid var(--border-color)' }
              }
            >
              {s === 'ALL' ? 'الكل' : (info?.label ?? s)}
            </button>
          )
        })}
      </div>

      <DataTable
        data={subs as unknown as Record<string, unknown>[]}
        loading={loading}
        searchable={false}
        emptyMessage="لا توجد اشتراكات"
        columns={[
          {
            key: 'store',
            label: 'المتجر',
            render: (_, row) => {
              const sub = row as unknown as Subscription
              return (
                <>
                  <p className="font-medium">{sub.store.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-m)', fontFamily: 'var(--mono)' }}>{sub.store.slug}</p>
                </>
              )
            },
          },
          {
            key: 'plan',
            label: 'الخطة',
            render: (_, row) => <span style={{ color: 'var(--text)' }}>{(row as unknown as Subscription).plan.name}</span>,
          },
          {
            key: 'billingCycle',
            label: 'الفوترة / الفروع',
            render: (_, row) => {
              const sub = row as unknown as Subscription
              return (
                <>
                  <p style={{ color: 'var(--text-2)' }}>{CYCLE_LABEL[sub.billingCycle]}</p>
                  <p className="text-xs" style={{ color: 'var(--text-2)' }}>{sub.branchCount} {sub.branchCount === 1 ? 'فرع' : 'فروع'}</p>
                </>
              )
            },
          },
          {
            key: 'priceUsd',
            label: 'السعر',
            render: (_, row) => (
              <span className="font-medium" style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>
                {usd((row as unknown as Subscription).priceUsd)}
              </span>
            ),
          },
          {
            key: 'endDate',
            label: 'ينتهي في',
            render: (_, row) => {
              const sub = row as unknown as Subscription
              const expired = new Date(sub.endDate) < new Date()
              return (
                <span style={{ color: expired ? 'var(--red)' : 'var(--text)' }}>
                  {new Date(sub.endDate).toLocaleDateString('ar-SA')}
                </span>
              )
            },
          },
          {
            key: 'status',
            label: 'الحالة',
            render: (_, row) => {
              const sub = row as unknown as Subscription
              const info = STATUS[sub.status] ?? STATUS.CANCELLED
              return (
                <span
                  className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                  style={{ background: info.bg, color: info.color }}
                >
                  {info.label}
                </span>
              )
            },
          },
          {
            key: 'id',
            label: 'تغيير الحالة',
            render: (_, row) => {
              const sub = row as unknown as Subscription
              return (
                <SASelect
                  defaultValue=""
                  onChange={e => { if (e.target.value) changeStatus(sub.id, e.target.value) }}
                  style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '6px' }}
                >
                  <option value="">تغيير...</option>
                  {['ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED'].map(s => (
                    <option key={s} value={s}>{STATUS[s].label}</option>
                  ))}
                </SASelect>
              )
            },
          },
        ]}
      />
    </div>
  )
}
