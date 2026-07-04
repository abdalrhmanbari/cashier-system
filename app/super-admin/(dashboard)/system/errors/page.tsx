'use client'

import { useEffect, useState, useCallback } from 'react'
import { FileWarning, X, Search } from 'lucide-react'
import { SASelect, SAInput } from '@/components/shared/SAInput'
import { DataTable } from '@/components/shared/DataTable'

type ErrorRow = {
  id: string
  type: string
  message: string
  stackTrace: string | null
  apiRoute: string
  method: string
  statusCode: number
  storeId: string | null
  storeName: string | null
  userId: string | null
  userAgent: string | null
  ip: string | null
  createdAt: string
}

type Period = 'all' | 'today' | 'week' | 'month'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'all',   label: 'الكل'    },
  { key: 'today', label: 'اليوم'   },
  { key: 'week',  label: 'الأسبوع' },
  { key: 'month', label: 'الشهر'   },
]

function statusBadge(code: number) {
  const style = code >= 500
    ? { background: 'var(--red-bg)', color: 'var(--red)' }
    : code >= 400
    ? { background: 'var(--amber-bg)', color: 'var(--amber)' }
    : { background: 'var(--diamond)', color: 'var(--text-2)' }
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={style}>{code}</span>
  )
}

export default function SystemErrorsPage() {
  const [storeId,     setStoreId]     = useState('')
  const [type,        setType]        = useState('')
  const [statusCode,  setStatusCode]  = useState('')
  const [period,      setPeriod]      = useState<Period>('all')
  const [q,           setQ]           = useState('')

  const [errors,   setErrors]   = useState<ErrorRow[]>([])
  const [stores,   setStores]   = useState<{ id: string; name: string }[]>([])
  const [types,    setTypes]    = useState<string[]>([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState<ErrorRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (storeId)    params.set('storeId', storeId)
    if (type)       params.set('type', type)
    if (statusCode) params.set('statusCode', statusCode)
    if (period !== 'all') params.set('period', period)
    if (q.trim())   params.set('q', q.trim())

    const res = await fetch(`/api/super-admin/errors?${params.toString()}`)
    if (res.ok) {
      const data = await res.json()
      setErrors(data.errors)
      setStores(data.stores)
      setTypes(data.types)
      setTotal(data.total)
    }
    setLoading(false)
  }, [storeId, type, statusCode, period, q])

  useEffect(() => {
    const id = setTimeout(load, 300)
    return () => clearTimeout(id)
  }, [load])

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'var(--red-bg)' }}>
          <FileWarning className="w-5 h-5" style={{ color: 'var(--red)' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold">سجل الأخطاء</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-m)' }}>
            {total} خطأ مسجَّل — محفوظة لآخر 30 يوماً فقط
          </p>
        </div>
      </div>

      {/* أدوات الفلترة */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative" style={{ minWidth: '200px' }}>
          <Search size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-m)' }} />
          <SAInput
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="بحث بالرسالة أو المسار..."
            style={{ paddingRight: '30px' }}
          />
        </div>
        <SASelect value={storeId} onChange={e => setStoreId(e.target.value)} style={{ width: 'auto' }}>
          <option value="">كل المتاجر</option>
          {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </SASelect>
        <SASelect value={type} onChange={e => setType(e.target.value)} style={{ width: 'auto' }}>
          <option value="">كل الأنواع</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </SASelect>
        <SAInput
          value={statusCode}
          onChange={e => setStatusCode(e.target.value.replace(/\D/g, ''))}
          placeholder="Status code"
          style={{ width: '110px' }}
        />
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className="px-3 py-1.5 rounded text-xs font-medium"
              style={period === p.key
                ? { background: 'var(--indigo)', color: '#fff' }
                : { background: 'var(--diamond)', color: 'var(--text-2)' }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <DataTable<ErrorRow>
        data={errors}
        loading={loading}
        searchable={false}
        pageSize={20}
        emptyMessage="لا توجد أخطاء مطابقة"
        columns={[
          { key: 'createdAt', label: 'التاريخ', render: v => new Date(v as string).toLocaleString('ar-EG') },
          { key: 'statusCode', label: 'الحالة', render: v => statusBadge(v as number) },
          { key: 'type', label: 'النوع' },
          { key: 'storeName', label: 'المتجر', render: v => (v as string) ?? '—' },
          {
            key: 'apiRoute', label: 'المسار',
            render: (v, row) => <span style={{ fontFamily: 'monospace', fontSize: '12px', direction: 'ltr', display: 'inline-block' }}>{row.method} {v as string}</span>,
          },
          { key: 'message', label: 'الرسالة', render: v => <span title={v as string}>{(v as string).length > 60 ? (v as string).slice(0, 60) + '…' : v as string}</span> },
        ]}
        actions={row => (
          <button onClick={() => setSelected(row)} className="btn-outline" style={{ fontSize: '12px', padding: '4px 10px' }}>
            التفاصيل
          </button>
        )}
      />

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal-box" style={{ maxWidth: '640px', padding: '20px' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">تفاصيل الخطأ</h2>
              <button onClick={() => setSelected(null)} style={{ color: 'var(--text-m)', border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2 text-sm" style={{ color: 'var(--text)' }}>
              <Row label="الوقت"    value={new Date(selected.createdAt).toLocaleString('ar-EG')} />
              <Row label="النوع"    value={selected.type} />
              <Row label="الحالة"   value={String(selected.statusCode)} />
              <Row label="المسار"   value={`${selected.method} ${selected.apiRoute}`} />
              <Row label="المتجر"   value={selected.storeName ?? '—'} />
              <Row label="الرسالة"  value={selected.message} />
              <Row label="عنوان IP" value={selected.ip ?? '—'} />
              <Row label="المتصفح" value={selected.userAgent ?? '—'} />
            </div>
            <div className="mt-3">
              <p className="text-xs mb-1" style={{ color: 'var(--text-m)' }}>Stack Trace</p>
              <pre style={{
                whiteSpace: 'pre-wrap', fontSize: '11px', overflow: 'auto', maxHeight: '40vh',
                background: 'var(--diamond)', padding: '12px', borderRadius: '8px', direction: 'ltr', textAlign: 'left',
              }}>
                {selected.stackTrace ?? 'لا يوجد stack trace لهذا الخطأ'}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span style={{ color: 'var(--text-m)', flexShrink: 0, minWidth: '80px' }}>{label}</span>
      <span style={{ wordBreak: 'break-word' }}>{value}</span>
    </div>
  )
}
