'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowRight, Phone, MapPin, CreditCard, TrendingUp, TrendingDown,
  ShoppingBag, Calendar, User, ChevronDown, ChevronUp, Receipt, Wallet,
} from 'lucide-react'
import { formatUsd, formatSyp } from '@/lib/utils'

type Payment = {
  id: string
  amount: number
  method: string
  date: string
}

type SaleItem = {
  quantity: number
  unitPrice: number
  discount: number
  total: number
  product: { name: string }
}

type Sale = {
  id: string
  invoiceNumber: string
  type: string
  status: string
  subtotal: number
  discount: number
  tax: number
  total: number
  amountPaid: number
  remaining: number
  notes: string | null
  createdAt: string
  totalUsdCents: number
  exchangeRate: number
  user: { name: string }
  items: SaleItem[]
  payments: Payment[]
}

type CustomerPayment = {
  id: string
  amount: number
  method: string
  notes: string | null
  date: string
}

type Customer = {
  id: string
  name: string
  phone: string | null
  address: string | null
  creditLimit: number
  currentBalance: number
  createdAt: string
  sales: Sale[]
  payments: CustomerPayment[]
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  COMPLETED: { label: 'مكتملة',  className: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'ملغاة',   className: 'bg-red-100 text-red-700'     },
  REFUNDED:  { label: 'مستردة',  className: 'bg-yellow-100 text-yellow-700' },
}

const TYPE_MAP: Record<string, { label: string; className: string }> = {
  CASH:   { label: 'نقدي', className: 'bg-gray-100 text-gray-600'   },
  CREDIT: { label: 'آجل',  className: 'bg-orange-100 text-orange-600' },
}

const METHOD_MAP: Record<string, string> = {
  CASH:     'نقدي',
  CARD:     'بطاقة',
  TRANSFER: 'تحويل',
}

export default function CustomerDetailPage() {
  const { slug, id } = useParams<{ slug: string; id: string }>()
  const router        = useRouter()

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/store/customers/${id}`)
    if (!res.ok) { setError('تعذّر تحميل بيانات العميل'); setLoading(false); return }
    const data = await res.json()
    setCustomer(data)
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  function toggleExpand(saleId: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(saleId) ? next.delete(saleId) : next.add(saleId)
      return next
    })
  }

  // الرصيد وحد الائتمان ودفعات التسديد كلها بالدولار (سنتات) — بيانات الفواتير (subtotal/total/...) بالليرة السورية
  const fmt = (amount: number) => formatUsd(Math.abs(amount))
  const fmtSyp = (amount: number) => formatSyp(amount)

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })

  const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400" dir="rtl">
        جارٍ التحميل...
      </div>
    )
  }

  if (error || !customer) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400" dir="rtl">
        <p>{error || 'العميل غير موجود'}</p>
        <button onClick={() => router.push(`/${slug}/customers`)} className="text-indigo-600 hover:underline text-sm">
          العودة للعملاء
        </button>
      </div>
    )
  }

  const bal          = customer.currentBalance
  const totalSales   = customer.sales.reduce((s, x) => s + x.total, 0)
  const totalPaid    = customer.sales.reduce((s, x) => s + x.amountPaid, 0)
  const creditSales  = customer.sales.filter(s => s.type === 'CREDIT').length

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto" dir="rtl">

      {/* Back */}
      <button
        onClick={() => router.push(`/${slug}/customers`)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 transition-colors"
      >
        <ArrowRight size={16} />
        العودة للعملاء
      </button>

      {/* Customer Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
            {customer.phone && (
              <p className="flex items-center gap-1.5 text-gray-500 text-sm">
                <Phone size={14} />
                {customer.phone}
              </p>
            )}
            {customer.address && (
              <p className="flex items-center gap-1.5 text-gray-500 text-sm">
                <MapPin size={14} />
                {customer.address}
              </p>
            )}
            <p className="flex items-center gap-1.5 text-gray-400 text-xs">
              <Calendar size={12} />
              عميل منذ {fmtDate(customer.createdAt)}
            </p>
          </div>

          {/* Balance Badge */}
          <div className={`rounded-xl px-5 py-3 text-center min-w-36 ${
            bal === 0
              ? 'bg-green-50 border border-green-200'
              : bal > 0
              ? 'bg-orange-50 border border-orange-200'
              : 'bg-blue-50 border border-blue-200'
          }`}>
            <p className="text-xs text-gray-500 mb-1">الرصيد الحالي</p>
            {bal === 0 ? (
              <p className="text-lg font-bold text-green-600">مسدّد ✓</p>
            ) : bal > 0 ? (
              <>
                <p className="text-lg font-bold text-orange-600">{fmt(bal)}</p>
                <p className="text-xs text-orange-400 flex items-center justify-center gap-1 mt-0.5">
                  <TrendingUp size={11} /> دين على العميل
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-blue-600">{fmt(bal)}</p>
                <p className="text-xs text-blue-400 flex items-center justify-center gap-1 mt-0.5">
                  <TrendingDown size={11} /> رصيد للعميل
                </p>
              </>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-gray-100">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{customer.sales.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">إجمالي الفواتير</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-indigo-600">{fmtSyp(totalSales)}</p>
            <p className="text-xs text-gray-400 mt-0.5">إجمالي المشتريات</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{fmtSyp(totalPaid)}</p>
            <p className="text-xs text-gray-400 mt-0.5">مدفوع عند نقطة البيع</p>
            <p className="text-[10px] text-gray-300 mt-0.5">لا يشمل تسديدات الدين اللاحقة — انظر سجل الدفعات</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-500">{creditSales}</p>
            <p className="text-xs text-gray-400 mt-0.5">مشتريات آجلة</p>
          </div>
        </div>

        {customer.creditLimit > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <CreditCard size={14} className="text-gray-400" />
            <span className="text-xs text-gray-500">حد الائتمان:</span>
            <span className="text-xs font-semibold text-gray-700">{fmt(customer.creditLimit)}</span>
            {bal > customer.creditLimit && (
              <span className="text-xs text-red-500 font-medium">(تجاوز الحد)</span>
            )}
          </div>
        )}
      </div>

      {/* Sales List */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <ShoppingBag size={16} />
          سجل الفواتير
          <span className="text-xs font-normal text-gray-400">({customer.sales.length})</span>
        </h2>

        {customer.sales.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-14 text-center text-gray-400 text-sm shadow-sm">
            لا توجد فواتير لهذا العميل
          </div>
        ) : (
          customer.sales.map(sale => {
            const isOpen    = expanded.has(sale.id)
            const status    = STATUS_MAP[sale.status] ?? STATUS_MAP.COMPLETED
            const type      = TYPE_MAP[sale.type]   ?? TYPE_MAP.CASH

            return (
              <div key={sale.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Sale Row */}
                <button
                  onClick={() => toggleExpand(sale.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-right"
                >
                  <Receipt size={16} className="text-gray-400 shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 font-mono text-sm">
                        #{sale.invoiceNumber}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.className}`}>
                        {status.label}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${type.className}`}>
                        {type.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />
                        {fmtDateTime(sale.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <User size={11} />
                        {sale.user.name}
                      </span>
                      <span>{sale.items.length} صنف</span>
                    </div>
                  </div>

                  <div className="text-left shrink-0 space-y-0.5">
                    <p className="font-bold text-gray-900">{fmtSyp(sale.total)}</p>
                    {sale.type === 'CREDIT' && (
                      <p className="text-xs text-gray-400">≈ {fmt(sale.totalUsdCents)}</p>
                    )}
                    {sale.remaining > 0 && (
                      <p className="text-xs text-red-500" title="لا يعكس تسديدات الدين اللاحقة — الرصيد الفعلي أعلى الصفحة">متبقي عند البيع: {fmtSyp(sale.remaining)}</p>
                    )}
                  </div>

                  {isOpen ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                </button>

                {/* Expanded Details */}
                {isOpen && (
                  <div className="border-t border-gray-100 divide-y divide-gray-100">
                    {/* Items */}
                    <div className="px-5 py-4">
                      <p className="text-xs font-semibold text-gray-500 mb-3">الأصناف</p>
                      <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-400">
                            <th className="text-right pb-2">الصنف</th>
                            <th className="text-center pb-2">الكمية</th>
                            <th className="text-center pb-2">السعر</th>
                            <th className="text-center pb-2">الخصم</th>
                            <th className="text-left pb-2">الإجمالي</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {sale.items.map((item, i) => (
                            <tr key={i} className="text-gray-700">
                              <td className="py-1.5">{item.product.name}</td>
                              <td className="text-center py-1.5">{item.quantity}</td>
                              <td className="text-center py-1.5 font-mono">{fmtSyp(item.unitPrice)}</td>
                              <td className="text-center py-1.5 font-mono">{item.discount > 0 ? fmtSyp(item.discount) : '—'}</td>
                              <td className="text-left py-1.5 font-mono font-medium">{fmtSyp(item.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="px-5 py-3 bg-gray-50 flex justify-end">
                      <div className="space-y-1 text-xs min-w-48">
                        {sale.discount > 0 && (
                          <div className="flex justify-between text-gray-500">
                            <span>خصم</span>
                            <span className="font-mono text-red-500">- {fmtSyp(sale.discount)}</span>
                          </div>
                        )}
                        {sale.tax > 0 && (
                          <div className="flex justify-between text-gray-500">
                            <span>ضريبة</span>
                            <span className="font-mono">+ {fmtSyp(sale.tax)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-gray-800 border-t border-gray-200 pt-1">
                          <span>الإجمالي</span>
                          <span className="font-mono">{fmtSyp(sale.total)}</span>
                        </div>
                        <div className="flex justify-between text-gray-400">
                          <span>سعر الصرف وقت البيع</span>
                          <span className="font-mono">{sale.exchangeRate.toLocaleString('en-US')} ل.س</span>
                        </div>
                        <div className="flex justify-between text-green-600">
                          <span>المدفوع عند البيع</span>
                          <span className="font-mono">{fmtSyp(sale.amountPaid)}</span>
                        </div>
                        {sale.remaining > 0 && (
                          <div className="flex justify-between text-red-500 font-semibold" title="لا يعكس تسديدات الدين اللاحقة — الرصيد الفعلي أعلى الصفحة">
                            <span>متبقي عند البيع</span>
                            <span className="font-mono">{fmtSyp(sale.remaining)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Payments */}
                    {sale.payments.length > 0 && (
                      <div className="px-5 py-4">
                        <p className="text-xs font-semibold text-gray-500 mb-3 flex items-center gap-1">
                          <CreditCard size={12} />
                          الدفعات ({sale.payments.length})
                        </p>
                        <div className="space-y-2">
                          {sale.payments.map(p => (
                            <div key={p.id} className="flex items-center justify-between text-xs bg-green-50 rounded-lg px-3 py-2">
                              <span className="text-gray-500">{fmtDateTime(p.date)}</span>
                              <span className="text-gray-600 bg-white border border-gray-100 rounded px-2 py-0.5">
                                {METHOD_MAP[p.method] ?? p.method}
                              </span>
                              <span className="font-semibold font-mono text-green-700">{fmtSyp(p.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {sale.notes && (
                      <div className="px-5 py-3 bg-yellow-50">
                        <p className="text-xs text-yellow-700"><span className="font-semibold">ملاحظة:</span> {sale.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* سجل دفعات السداد — بالدولار */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <Wallet size={16} />
          سجل الدفعات
          <span className="text-xs font-normal text-gray-400">({customer.payments.length})</span>
        </h2>
        {customer.payments.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-10 text-center text-gray-400 text-sm shadow-sm">
            لا توجد دفعات مسجّلة
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
            {customer.payments.map(p => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">{fmtDateTime(p.date)}</p>
                  {p.notes && <p className="text-xs text-gray-400 mt-0.5">{p.notes}</p>}
                </div>
                <span className="text-gray-600 bg-gray-50 border border-gray-100 rounded px-2 py-0.5 text-xs">
                  {METHOD_MAP[p.method] ?? p.method}
                </span>
                <span className={`font-semibold font-mono ${p.amount > 0 ? 'text-green-600' : 'text-blue-600'}`}>
                  {p.amount > 0 ? '+' : '-'} {fmt(p.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
