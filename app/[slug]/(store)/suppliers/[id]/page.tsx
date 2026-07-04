'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowRight, Truck, Phone, MapPin, DollarSign, FileText, Edit2, Package, Calendar, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { formatUsd } from '@/lib/utils'

type InvoiceItem = { id: string; quantity: number; unitCost: number; total: number; product: { id: string; name: string } }
type Invoice = {
  id: string; invoiceNumber: string; date: string; total: number
  amountPaid: number; remaining: number; status: string
  items: InvoiceItem[]
}
type Supplier = {
  id: string; name: string; phone: string | null; address: string | null
  currentBalance: number; createdAt: string
  _count: { invoices: number }
  invoices: Invoice[]
}

const fmt  = (amount: number) => formatUsd(Math.abs(amount))
const date = (d: string)     => new Date(d).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    PAID:    { label: 'مدفوع',    color: 'var(--green)', bg: 'var(--green-bg)', icon: <CheckCircle size={11} /> },
    PARTIAL: { label: 'جزئي',    color: 'var(--amber)', bg: 'var(--amber-bg)', icon: <Clock size={11} /> },
    UNPAID:  { label: 'غير مدفوع', color: 'var(--red)', bg: 'var(--red-bg)',  icon: <AlertCircle size={11} /> },
  }
  const s = map[status] ?? map.UNPAID
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '999px', background: s.bg, color: s.color, fontSize: '11px', fontWeight: 600 }}>
      {s.icon}{s.label}
    </span>
  )
}

export default function SupplierDetailPage() {
  const router         = useRouter()
  const { slug, id }   = useParams<{ slug: string; id: string }>()
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    fetch(`/api/store/suppliers/${id}`)
      .then(r => r.json())
      .then(d => { setSupplier(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-m)', fontSize: '13px' }} dir="rtl">
      جارٍ التحميل...
    </div>
  )
  if (!supplier) return (
    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--red)', fontSize: '13px' }} dir="rtl">
      المورد غير موجود
    </div>
  )

  const totalPurchased = supplier.invoices.reduce((s, inv) => s + inv.total, 0)
  const totalPaid      = supplier.invoices.reduce((s, inv) => s + inv.amountPaid, 0)

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '860px', margin: '0 auto' }} dir="rtl">

      {/* شريط العنوان */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={() => router.push(`/${slug}/suppliers`)}
          style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', borderRadius: 'var(--r-x)', background: 'var(--white)', color: 'var(--text-2)', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--diamond)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--white)')}
        >
          <ArrowRight size={15} />
        </button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: 'var(--r-s)', background: 'var(--indigo-g)', color: 'var(--indigo)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700 }}>
            {supplier.name.slice(0, 1)}
          </div>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>{supplier.name}</h1>
            <p style={{ fontSize: '11px', color: 'var(--text-m)' }}>مورد منذ {date(supplier.createdAt)}</p>
          </div>
        </div>
        <button
          onClick={() => router.push(`/${slug}/suppliers/${id}/edit`)}
          className="btn-primary"
          style={{ fontSize: '12px', padding: '6px 14px' }}
        >
          <Edit2 size={13} /> تعديل
        </button>
      </div>

      {/* معلومات التواصل */}
      <div className="card" style={{ padding: '14px 16px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        {supplier.phone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-2)', fontSize: '13px' }}>
            <Phone size={14} style={{ color: 'var(--indigo)' }} />
            <span dir="ltr">{supplier.phone}</span>
          </div>
        )}
        {supplier.address && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-2)', fontSize: '13px' }}>
            <MapPin size={14} style={{ color: 'var(--indigo)' }} />
            {supplier.address}
          </div>
        )}
        {!supplier.phone && !supplier.address && (
          <p style={{ fontSize: '13px', color: 'var(--text-m)' }}>لا توجد بيانات تواصل</p>
        )}
      </div>

      {/* إحصائيات */}
      <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: '10px' }}>
        {[
          { label: 'إجمالي الفواتير', value: supplier._count.invoices, icon: FileText,   color: 'var(--indigo)', bg: 'var(--indigo-g)', money: false },
          { label: 'إجمالي المشتريات', value: totalPurchased,           icon: Package,   color: 'var(--teal)',   bg: 'var(--teal-bg)', money: true  },
          { label: 'إجمالي المدفوع',   value: totalPaid,               icon: CheckCircle, color: 'var(--green)', bg: 'var(--green-bg)', money: true  },
          { label: 'المستحق علينا',    value: supplier.currentBalance,  icon: DollarSign, color: supplier.currentBalance > 0 ? 'var(--red)' : 'var(--green)', bg: supplier.currentBalance > 0 ? 'var(--red-bg)' : 'var(--green-bg)', money: true },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: 'var(--r-s)', background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <k.icon size={15} style={{ color: k.color }} />
            </div>
            <div>
              <p style={{ fontSize: '10.5px', color: 'var(--text-m)', marginBottom: '2px' }}>{k.label}</p>
              <p style={{ fontSize: '15px', fontWeight: 700, color: k.money && k.label === 'المستحق علينا' ? k.color : 'var(--text)', fontFamily: k.money ? 'var(--mono)' : undefined }}>
                {k.money ? fmt(k.value) : k.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* قائمة الفواتير */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={13} style={{ color: 'var(--indigo)' }} />
            فواتير التوريد
            <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-m)' }}>({supplier._count.invoices})</span>
          </h2>
        </div>

        {supplier.invoices.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-m)', fontSize: '13px' }}>
            <FileText size={28} style={{ margin: '0 auto 8px', opacity: .3 }} />
            <p>لا توجد فواتير بعد</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '640px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--diamond)' }}>
                {['رقم الفاتورة', 'التاريخ', 'البنود', 'الإجمالي', 'المدفوع', 'المتبقي', 'الحالة'].map(h => (
                  <th key={h} style={{ padding: '8px 14px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--text-m)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {supplier.invoices.map((inv, i) => (
                <tr key={inv.id} style={{ borderBottom: i < supplier.invoices.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--indigo)', fontFamily: 'var(--mono)', fontSize: '12px' }}>#{inv.invoiceNumber}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-2)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={11} style={{ color: 'var(--text-m)' }} />
                      {date(inv.date)}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-2)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {inv.items.slice(0, 2).map(item => (
                        <span key={item.id} style={{ fontSize: '11px', color: 'var(--text-2)' }}>
                          {item.product.name} × {item.quantity}
                        </span>
                      ))}
                      {inv.items.length > 2 && (
                        <span style={{ fontSize: '10px', color: 'var(--text-m)' }}>+{inv.items.length - 2} أخرى</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--text)' }}>{fmt(inv.total)}</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'var(--mono)', color: 'var(--green)' }}>{fmt(inv.amountPaid)}</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'var(--mono)', color: inv.remaining > 0 ? 'var(--red)' : 'var(--text-m)' }}>{fmt(inv.remaining)}</td>
                  <td style={{ padding: '10px 14px' }}><StatusBadge status={inv.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

    </div>
  )
}
