'use client'

import { useEffect, useState, useCallback } from 'react'
import { BarChart2, TrendingUp, ShoppingCart, DollarSign, Download, RefreshCw, Percent, Wallet, Truck, Users, Undo2 } from 'lucide-react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { StInput } from '@/components/shared/StInput'
import { formatUsd, formatSyp } from '@/lib/utils'

type Period = 'today' | 'week' | 'month' | 'custom'
type Report = {
  totalRevenue: number; totalCost: number; totalExpenses: number; totalProfit: number
  invoiceCount: number; avgInvoice: number
  returnsCount: number; returnsRevenue: number; totalDiscounts: number; taxCollected: number
  supplierPaid: number; supplierDebt: number
  customerCollected: number; customerPaid: number; customerDebt: number
  totalCashSyp: number
  dailySales:   { date: string; total: number }[]
  topProducts:  { id: string; name: string; qty: number; revenue: number }[]
  soldItems:    { id: string; date: string; invoiceNumber: string; productName: string; quantity: number; unitPrice: number; total: number; userName: string }[]
}

// كل أرقام التقارير بالدولار (سنتات) — totalUsdCents/amountUsdCents المجمَّدة لحظة كل عملية
const fmt = (amount: number) => formatUsd(amount)
const fmtShort = (cents: number) => {
  const dollars = cents / 100
  if (Math.abs(dollars) >= 1000) return `$${(dollars/1000).toFixed(1)}ك`
  return `$${dollars.toFixed(0)}`
}

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'اليوم'   },
  { key: 'week',  label: 'الأسبوع' },
  { key: 'month', label: 'الشهر'   },
  { key: 'custom',label: 'مخصص'    },
]

const todayStr = () => new Date().toISOString().split('T')[0]

export default function ReportsPage() {
  const [period,     setPeriod]     = useState<Period>('month')
  const [customFrom, setCustomFrom] = useState(todayStr())
  const [customTo,   setCustomTo]   = useState(todayStr())
  const [report,     setReport]     = useState<Report | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [exporting,  setExporting]  = useState(false)

  const load = useCallback(async () => {
    if (period === 'custom' && (!customFrom || !customTo)) return
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ period })
      if (period === 'custom') { params.set('from', customFrom); params.set('to', customTo) }
      const res  = await fetch(`/api/store/reports?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'خطأ'); return }
      setReport(data)
    } catch {
      setError('تعذّر التحميل')
    } finally {
      setLoading(false)
    }
  }, [period, customFrom, customTo])

  useEffect(() => { load() }, [load])

  const exportExcel = async () => {
    if (!report) return
    if (period === 'custom' && (!customFrom || !customTo)) return
    setExporting(true)
    try {
      const params = new URLSearchParams({ period })
      if (period === 'custom') { params.set('from', customFrom); params.set('to', customTo) }
      const res = await fetch(`/api/store/reports/export?${params.toString()}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'تعذّر التصدير')
        return
      }
      const blob        = await res.blob()
      const disposition  = res.headers.get('Content-Disposition') ?? ''
      const match        = disposition.match(/filename\*=UTF-8''([^;]+)/)
      const filename      = match ? decodeURIComponent(match[1]) : `تقرير-${period}-${todayStr()}.xlsx`
      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href = url; a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('تعذّر التصدير')
    } finally {
      setExporting(false)
    }
  }

  // الصف الأول — المؤشرات الرئيسية
  const heroKPIs = report ? [
    { label: 'صافي الإيراد',      value: fmt(report.totalRevenue), icon: ShoppingCart, color: 'var(--indigo)', bg: 'var(--indigo-g)', zero: report.totalRevenue === 0 },
    { label: 'صافي الربح',        value: fmt(report.totalProfit),  icon: TrendingUp,   color: 'var(--green)',  bg: 'var(--green-bg)',  zero: report.totalProfit === 0 },
    { label: 'مقبوض نقداً (ل.س)', value: formatSyp(report.totalCashSyp), icon: Wallet,  color: 'var(--teal)',   bg: 'var(--teal-bg)',   zero: report.totalCashSyp === 0 },
    { label: 'عدد الفواتير',      value: String(report.invoiceCount), icon: BarChart2, color: 'var(--amber)',  bg: 'var(--amber-bg)',  zero: report.invoiceCount === 0 },
  ] : []

  // الصف الثاني — مؤشرات ثانوية
  const secondaryKPIs = report ? [
    { label: 'المرتجعات',         value: `${report.returnsCount} · ${fmt(report.returnsRevenue)}`, icon: Undo2, color: 'var(--red)', bg: 'var(--red-bg)', zero: report.returnsCount === 0 && report.returnsRevenue === 0 },
    { label: 'إجمالي الخصومات',   value: fmt(report.totalDiscounts), icon: Percent, color: 'var(--amber)', bg: 'var(--amber-bg)', zero: report.totalDiscounts === 0 },
    { label: 'المصاريف',          value: fmt(report.totalExpenses),icon: Wallet,       color: 'var(--red)',    bg: 'var(--red-bg)',    zero: report.totalExpenses === 0 },
    { label: 'متوسط الفاتورة',    value: fmt(report.avgInvoice),   icon: Percent,      color: 'var(--purple)', bg: 'var(--purple-bg)', zero: report.avgInvoice === 0 },
    { label: 'هامش الربح %',      value: report.totalRevenue > 0 ? `${Math.round(report.totalProfit / report.totalRevenue * 100)}%` : '—', icon: TrendingUp, color: 'var(--teal)', bg: 'var(--teal-bg)', zero: report.totalRevenue === 0 },
    { label: 'تكلفة المبيعات',    value: fmt(report.totalCost),    icon: DollarSign,   color: 'var(--red)',    bg: 'var(--red-bg)',    zero: report.totalCost === 0 },
    ...(report.taxCollected !== 0 ? [{ label: 'الضريبة المحصلة', value: fmt(report.taxCollected), icon: Percent, color: 'var(--purple)', bg: 'var(--purple-bg)', zero: false }] : []),
  ] : []

  const chartData = (report?.dailySales ?? []).map(d => ({
    date: new Date(d.date).toLocaleDateString('ar-SA', { day: '2-digit', month: '2-digit' }),
    value: d.total,
  }))

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }} dir="rtl">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>التقارير</h1>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {/* Period tabs */}
          <div style={{ display: 'flex', gap: '2px', padding: '3px', borderRadius: 'var(--r-s)', background: 'var(--diamond)' }}>
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                style={{
                  padding: '5px 12px', borderRadius: '6px', fontSize: '12.5px', fontWeight: period === p.key ? 600 : 400,
                  border: 'none', cursor: 'pointer', fontFamily: 'var(--f)',
                  background: period === p.key ? 'var(--indigo)' : 'transparent',
                  color: period === p.key ? '#fff' : 'var(--text-2)',
                  transition: '.12s',
                }}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={load} className="btn-ghost" style={{ padding: '6px 10px' }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button onClick={exportExcel} disabled={!report || exporting} className="btn-outline" style={{ fontSize: '12.5px', padding: '6px 12px', opacity: (!report || exporting) ? .5 : 1, cursor: (!report || exporting) ? 'not-allowed' : 'pointer' }}>
            <Download size={13} /> {exporting ? 'جارٍ التصدير...' : 'تصدير Excel'}
          </button>
        </div>
      </div>

      {period === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '12.5px', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            من
            <StInput type="date" value={customFrom} max={customTo} onChange={e => setCustomFrom(e.target.value)} style={{ width: 'auto' }} />
          </label>
          <label style={{ fontSize: '12.5px', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            إلى
            <StInput type="date" value={customTo} min={customFrom} onChange={e => setCustomTo(e.target.value)} style={{ width: 'auto' }} />
          </label>
        </div>
      )}

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 'var(--r-s)', background: 'var(--red-bg)', color: 'var(--red)', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {error}
          <button onClick={load} style={{ color: 'var(--red)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 500, fontFamily: 'var(--f)' }}>إعادة المحاولة</button>
        </div>
      )}

      {/* KPIs */}
      {loading ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: '10px' }}>
            {Array.from({length:4}).map((_,i) => (
              <div key={i} className="card" style={{ padding: '18px 16px', height: '92px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: 'var(--r-s)', background: 'var(--diamond)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: '11px', borderRadius: '4px', background: 'var(--diamond)', marginBottom: '8px', width: '60%' }} />
                  <div style={{ height: '20px', borderRadius: '4px', background: 'var(--diamond)', width: '80%' }} />
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" style={{ gap: '10px' }}>
            {Array.from({length:6}).map((_,i) => (
              <div key={i} className="card" style={{ padding: '10px 12px', height: '64px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: 'var(--r-s)', background: 'var(--diamond)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: '9px', borderRadius: '4px', background: 'var(--diamond)', marginBottom: '6px', width: '60%' }} />
                  <div style={{ height: '14px', borderRadius: '4px', background: 'var(--diamond)', width: '80%' }} />
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* الصف الأول — مؤشرات رئيسية */}
          <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: '10px' }}>
            {heroKPIs.map(k => (
              <div key={k.label} className="card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '14px', opacity: k.zero ? .5 : 1 }}>
                <div style={{ width: '48px', height: '48px', borderRadius: 'var(--r-s)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: k.bg, flexShrink: 0 }}>
                  <k.icon size={22} style={{ color: k.color }} />
                </div>
                <div>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-m)', marginBottom: '4px' }}>{k.label}</p>
                  <p style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--mono)' }}>{k.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* الصف الثاني — مؤشرات ثانوية */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" style={{ gap: '10px' }}>
            {secondaryKPIs.map(k => (
              <div key={k.label} className="card" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px', opacity: k.zero ? .5 : 1 }}>
                <div style={{ width: '30px', height: '30px', borderRadius: 'var(--r-s)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: k.bg, flexShrink: 0 }}>
                  <k.icon size={14} style={{ color: k.color }} />
                </div>
                <div>
                  <p style={{ fontSize: '10.5px', color: 'var(--text-m)', marginBottom: '2px' }}>{k.label}</p>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--mono)' }}>{k.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* الموردون والعملاء */}
          {report && (
            <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '10px' }}>
              <div className="card" style={{ padding: '12px 14px', opacity: (report.supplierDebt === 0 && report.supplierPaid === 0) ? .5 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: 'var(--r-s)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--indigo-g)', flexShrink: 0 }}>
                    <Truck size={14} style={{ color: 'var(--indigo)' }} />
                  </div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>الموردون</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-m)' }}>مستحق للموردين</p>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--red)', fontFamily: 'var(--mono)' }}>{fmt(report.supplierDebt)}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-m)' }}>مدفوع للموردين</p>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--indigo)', fontFamily: 'var(--mono)' }}>{fmt(report.supplierPaid)}</p>
                </div>
              </div>

              <div className="card" style={{ padding: '12px 14px', opacity: (report.customerDebt === 0 && report.customerPaid === 0 && report.customerCollected === 0) ? .5 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: 'var(--r-s)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--green-bg)', flexShrink: 0 }}>
                    <Users size={14} style={{ color: 'var(--green)' }} />
                  </div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>العملاء</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-m)' }}>مستحق على العملاء</p>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--red)', fontFamily: 'var(--mono)' }}>{fmt(report.customerDebt)}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-m)' }}>تحصيل من العملاء</p>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--mono)' }}>{fmt(report.customerCollected)}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-m)' }}>مسدد للعملاء</p>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--amber)', fontFamily: 'var(--mono)' }}>{fmt(report.customerPaid)}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Charts */}
      {!loading && report && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto]" style={{ gap: '12px' }}>

          {/* Line chart — مبيعات يومية */}
          <div className="card" style={{ padding: '14px 16px' }}>
            <p style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)', marginBottom: '12px' }}>مبيعات الفترة يومياً</p>
            {chartData.length === 0 ? (
              <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-m)', fontSize: '13px' }}>لا توجد بيانات</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData} style={{ direction: 'ltr' }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-l)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-m)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-m)' }} tickLine={false} axisLine={false} tickFormatter={fmtShort} />
                  <Tooltip
                    contentStyle={{ background: 'var(--white)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(v: number) => [fmt(v), 'المبيعات']}
                  />
                  <Line type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Bar chart — أكثر المنتجات */}
          <div className="card w-full lg:w-65" style={{ padding: '14px 16px' }}>
            <p style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)', marginBottom: '12px' }}>أكثر مبيعاً (الإيراد)</p>
            {report.topProducts.length === 0 ? (
              <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-m)', fontSize: '13px' }}>لا توجد بيانات</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={report.topProducts.slice(0,6)} layout="vertical" style={{ direction: 'ltr' }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-m)' }} tickLine={false} axisLine={false} tickFormatter={fmtShort} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: 'var(--text-2)' }} tickLine={false} axisLine={false} width={70} />
                  <Tooltip contentStyle={{ background: 'var(--white)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px' }} formatter={(v: number) => [fmt(v), 'الإيراد']} />
                  <Bar dataKey="revenue" fill="#4f46e5" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* جدول ملخص المنتجات */}
      {!loading && report && report.topProducts.length > 0 && (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
            <p style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>ملخص المنتجات الأكثر مبيعاً</p>
          </div>
          <div className="overflow-x-auto">
          <table className="tbl" style={{ minWidth: '420px' }}>
            <thead>
              <tr>
                <th>#</th><th>المنتج</th><th>الكمية المباعة</th><th>الإيراد</th>
              </tr>
            </thead>
            <tbody>
              {report.topProducts.map((p, i) => (
                <tr key={p.id}>
                  <td style={{ color: 'var(--text-m)', fontSize: '12px' }}>{i + 1}</td>
                  <td style={{ fontWeight: 500, color: 'var(--text)' }}>{p.name}</td>
                  <td style={{ color: 'var(--text-2)' }}>{p.qty}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--indigo)' }}>{fmt(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* جدول تفصيلي: كل المنتجات المباعة خلال الفترة */}
      {!loading && report && (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
            <p style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>تفاصيل المنتجات المباعة ({report.soldItems.length})</p>
          </div>
          {report.soldItems.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-m)', fontSize: '13px' }}>لا توجد مبيعات في هذه الفترة</div>
          ) : (
          <div className="overflow-x-auto" style={{ maxHeight: '420px', overflowY: 'auto' }}>
          <table className="tbl" style={{ minWidth: '640px' }}>
            <thead>
              <tr>
                <th>التاريخ</th><th>اليوم</th><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th><th>البائع</th><th>الفاتورة</th>
              </tr>
            </thead>
            <tbody>
              {report.soldItems.map(item => {
                const d = new Date(item.date)
                return (
                  <tr key={item.id}>
                    <td style={{ fontSize: '12px', color: 'var(--text-2)' }}>{d.toLocaleDateString('ar-SA', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-m)' }}>{d.toLocaleDateString('ar-SA', { weekday: 'long' })}</td>
                    <td style={{ fontWeight: 500, color: 'var(--text)' }}>{item.productName}</td>
                    <td style={{ color: 'var(--text-2)' }}>{item.quantity}</td>
                    <td style={{ fontFamily: 'var(--mono)', color: 'var(--text-2)' }}>{fmt(item.unitPrice)}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--indigo)' }}>{fmt(item.total)}</td>
                    <td style={{ color: 'var(--text-2)' }}>{item.userName}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-m)', fontFamily: 'var(--mono)' }}>{item.invoiceNumber}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
          )}
        </div>
      )}
    </div>
  )
}