'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { SessionProvider, useSession } from 'next-auth/react'
import {
  ScanLine, Search, Plus, Minus, Trash2, ShoppingCart, X,
  Banknote, CalendarClock, Clock, CheckCircle2, Receipt, AlertCircle, User,
} from 'lucide-react'
import { formatSyp, formatUsd } from '@/lib/utils'
import { printReceipt } from '@/lib/print/receipt'
import { useExchangeRate } from '@/components/shared/ExchangeRateContext'

type Category = { id: string; name: string; color: string; imageUrl?: string | null }
type Product  = {
  id: string; name: string; barcode: string | null; price: number; priceCurrency: string
  stock: number; hasDiscount: boolean; discountType: string | null; discountValue: number
  category: Category | null
}
type CartItem = Product & { qty: number; lineTotalSyp: number }
type Shift    = { id: string; status: string; branchId: string }
type Customer = { id: string; name: string; phone: string | null; currentBalance: number }

const TILE_COLORS = [
  { bg: 'var(--indigo-g)',  color: 'var(--indigo)'  },
  { bg: 'var(--green-bg)', color: 'var(--green)'  },
  { bg: 'var(--amber-bg)', color: 'var(--amber)'  },
  { bg: 'var(--purple-bg)',color: 'var(--purple)' },
  { bg: 'var(--teal-bg)',  color: 'var(--teal)'   },
  { bg: 'var(--pink-bg)',  color: 'var(--pink)'   },
]

/** السعر النهائي للمنتج بعملته الخاصة (بعد تطبيق الخصم إن وُجد) */
function calcFinalPrice(p: Product): number {
  if (!p.hasDiscount || !p.discountValue) return p.price
  if (p.discountType === 'PERCENTAGE') return Math.round(p.price * (1 - p.discountValue / 100))
  if (p.discountType === 'FIXED')      return Math.max(0, p.price - p.discountValue)
  return p.price
}

/** تحويل السعر النهائي للمنتج إلى ليرة سورية حسب عملته الأصلية */
function priceToSyp(p: Product, rate: number): number {
  const price = calcFinalPrice(p)
  return p.priceCurrency === 'USD' ? Math.round((price / 100) * rate) : price
}

function PosContent() {
  const { data: session } = useSession()

  const [products,   setProducts]   = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [customers,  setCustomers]  = useState<Customer[]>([])
  const [cart,       setCart]       = useState<CartItem[]>([])
  const [query,      setQuery]      = useState('')
  const [catFilter,  setCatFilter]  = useState('')
  const [loading,    setLoading]    = useState(true)
  const [openShift,  setOpenShift]  = useState<Shift | null>(null)

  const { rate, refresh: refreshRate } = useExchangeRate()
  const [pricingCurrency, setPricingCurrency]  = useState<'USD' | 'SYP'>('USD')
  const [taxEnabled,      setTaxEnabled]       = useState(false)
  const [taxRateBp,       setTaxRateBp]        = useState(0)
  const [taxName,         setTaxName]          = useState('ضريبة')
  const [maxDiscountCashierBp, setMaxDiscountCashierBp] = useState<number | null>(null)
  const [maxDiscountManagerBp, setMaxDiscountManagerBp] = useState<number | null>(null)

  const [payMethod,  setPayMethod]  = useState<'CASH' | 'CREDIT'>('CASH')
  const [discount,   setDiscount]   = useState(0)

  const [cartOpen,     setCartOpen]     = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [amountPaid,   setAmountPaid]   = useState('')
  const [processing,   setProcessing]   = useState(false)

  const [lastReceipt, setLastReceipt] = useState<{
    invoiceNumber: string; totalSyp: number; totalUsdCents: number; change: number
    subtotal: number; discount: number; tax: number; taxName: string
    items: { name: string; quantity: number; unitPrice: number; total: number }[]
    exchangeRate: number; customerName?: string
  } | null>(null)

  const [selectedCustomer,     setSelectedCustomer]     = useState<Customer | null>(null)
  const [customerSearch,       setCustomerSearch]       = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const customerRef = useRef<HTMLDivElement>(null)

  const loadData = useCallback(async () => {
    const [pr, ca, cu, st] = await Promise.all([
      fetch('/api/store/products').then(r => r.json()),
      fetch('/api/store/categories').then(r => r.json()),
      fetch('/api/store/customers/lookup').then(r => r.json()),
      fetch('/api/store/settings').then(r => r.json()),
    ])
    setProducts(Array.isArray(pr) ? pr : [])
    setCategories(Array.isArray(ca) ? ca : [])
    setCustomers(Array.isArray(cu) ? cu : [])
    setPricingCurrency(st?.pricingCurrency === 'SYP' ? 'SYP' : 'USD')
    setTaxEnabled(!!st?.taxEnabled)
    setTaxRateBp(st?.taxRate ?? 0)
    setTaxName(st?.taxName ?? 'ضريبة')
    setMaxDiscountCashierBp(typeof st?.maxDiscountPercentCashier === 'number' ? st.maxDiscountPercentCashier : null)
    setMaxDiscountManagerBp(typeof st?.maxDiscountPercentManager === 'number' ? st.maxDiscountPercentManager : null)
    setLoading(false)
  }, [])

  const checkShift = useCallback(async () => {
    const data = await fetch('/api/store/shifts?mine=true').then(r => r.json())
    const mine = Array.isArray(data) ? data.find((s: Shift) => s.status === 'OPEN') : null
    setOpenShift(mine ?? null)
  }, [])

  useEffect(() => { if (session) { loadData(); checkShift() } }, [session, loadData, checkShift])

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (customerRef.current && !customerRef.current.contains(e.target as Node))
        setShowCustomerDropdown(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  useEffect(() => {
    let buf = ''; let timer: ReturnType<typeof setTimeout>
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && buf.length > 3) {
        const p = products.find(pr => pr.barcode === buf)
        if (p) addToCart(p)
        buf = ''; return
      }
      if (e.key.length === 1) {
        buf += e.key; clearTimeout(timer)
        timer = setTimeout(() => { buf = '' }, 300)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, rate])

  function addToCart(p: Product) {
    if (!rate) return
    const lineTotalSyp = priceToSyp(p, rate)
    setCart(prev => {
      const ex = prev.find(c => c.id === p.id)
      if (ex) {
        if (ex.qty >= p.stock) return prev
        return prev.map(c => c.id === p.id ? { ...c, qty: c.qty + 1, lineTotalSyp: lineTotalSyp * (c.qty + 1) } : c)
      }
      if (p.stock <= 0) return prev
      return [...prev, { ...p, qty: 1, lineTotalSyp }]
    })
  }

  function changeQty(id: string, delta: number) {
    if (!rate) return
    setCart(prev =>
      prev.map(c => {
        if (c.id !== id) return c
        const nq = c.qty + delta
        if (nq <= 0) return null as unknown as CartItem
        return { ...c, qty: nq, lineTotalSyp: priceToSyp(c, rate) * nq }
      }).filter(Boolean)
    )
  }

  function removeLine(id: string) { setCart(prev => prev.filter(c => c.id !== id)) }

  function deleteInvoice() {
    if (cart.length === 0) return
    setDeleteConfirmOpen(true)
  }

  function confirmDeleteInvoice() {
    setCart([]); setDiscount(0); setSelectedCustomer(null); setCustomerSearch('')
    setCartOpen(false); setDeleteConfirmOpen(false)
  }

  // إن تغيّر سعر الصرف وبالسلة أصناف بعملة USD، أعِد حساب معادلها بالليرة فوراً دون انتظار تعديل الكمية
  useEffect(() => {
    if (!rate) return
    setCart(prev => prev.map(c => ({ ...c, lineTotalSyp: priceToSyp(c, rate) * c.qty })))
  }, [rate])

  const subtotal      = cart.reduce((s, c) => s + c.lineTotalSyp, 0)
  const netAfterDiscount = Math.max(0, subtotal - discount)
  // تنبيه UX فقط — الفرض الفعلي بالسيرفر (app/api/store/sales/route.ts)
  const discountCapBp = session?.user?.role === 'STORE_MANAGER' ? maxDiscountManagerBp : maxDiscountCashierBp
  const discountPercentBp = subtotal > 0 ? Math.round((discount / subtotal) * 10000) : 0
  const discountOverCap = discountCapBp != null && discountPercentBp > discountCapBp
  const taxActive     = taxEnabled && taxRateBp > 0
  // معاينة تقريبية — القيمة النهائية الدقيقة (بعد تقريب الفاتورة) تُحسب في الخادم وتُعرض في شاشة النجاح
  const taxPreview    = taxActive ? Math.round((netAfterDiscount * taxRateBp) / 10000) : 0
  const total         = netAfterDiscount + taxPreview
  const totalUsdCentsPreview = rate ? Math.round((total / rate) * 100) : 0
  const itemCount  = cart.reduce((s, c) => s + c.qty, 0)

  const filtered = useMemo(() =>
    products.filter(p => {
      const byCat   = !catFilter || p.category?.id === catFilter
      const byQuery = !query.trim() || p.name.includes(query.trim()) || p.barcode?.includes(query.trim())
      return byCat && byQuery
    }), [products, catFilter, query])

  const filteredCustomers = customers.filter(c =>
    !customerSearch || c.name.includes(customerSearch) || c.phone?.includes(customerSearch)
  )

  function openCheckout() {
    if (cart.length === 0 || !openShift || !rate) return
    setAmountPaid(''); setCartOpen(false); setCheckoutOpen(true)
  }

  async function checkout() {
    if (!openShift) { alert('افتح وردية أولاً'); return }
    if (!rate) { alert('لا يوجد سعر صرف مسجل — يرجى إبلاغ المدير'); return }
    if (cart.length === 0) return
    if (payMethod === 'CREDIT' && !selectedCustomer) { alert('يجب اختيار عميل للبيع الآجل'); return }
    const paid = payMethod === 'CASH' ? Math.round(parseFloat(amountPaid || '0')) : 0
    if (payMethod === 'CASH' && paid < total) { alert('المبلغ المدفوع أقل من الإجمالي'); return }
    setProcessing(true)
    const res = await fetch('/api/store/sales', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shiftId: openShift.id, type: payMethod, discount,
        amountPaid: paid, customerId: selectedCustomer?.id ?? null,
        items: cart.map(c => ({ productId: c.id, quantity: c.qty, discount: 0 })),
      }),
    })
    const json = await res.json(); setProcessing(false)
    if (!res.ok) { alert(json.error ?? 'خطأ في إتمام البيع'); return }
    // شبكة أمان: إن استخدم السيرفر سعراً غير الذي تعرضه الشاشة (تغيّر من جهاز آخر) حدّث السياق فوراً
    if (typeof json.exchangeRate === 'number' && json.exchangeRate !== rate) refreshRate()
    setLastReceipt({
      invoiceNumber: json.invoiceNumber,
      totalSyp:      json.totalSyp,
      totalUsdCents: json.totalUsdCents,
      exchangeRate:  json.exchangeRate,
      change:        Math.max(0, paid - json.totalSyp),
      customerName:  selectedCustomer?.name,
      subtotal:      json.subtotal,
      discount:      json.discount,
      tax:           json.tax,
      taxName:       json.taxName ?? 'ضريبة',
      items: (json.items as { product: { name: string }; quantity: number; unitPrice: number; total: number }[])
        .map(it => ({ name: it.product.name, quantity: it.quantity, unitPrice: it.unitPrice, total: it.total })),
    })
    setCart([]); setDiscount(0); setAmountPaid(''); setSelectedCustomer(null); setCustomerSearch('')
    setCheckoutOpen(false); setCartOpen(false); loadData()
  }

  function newInvoice() {
    setCart([]); setDiscount(0); setPayMethod('CASH')
    setSelectedCustomer(null); setCustomerSearch(''); setLastReceipt(null); setCartOpen(false)
  }

  function printLastReceipt() {
    if (!lastReceipt) return
    printReceipt({
      invoiceNumber: lastReceipt.invoiceNumber,
      date: new Date(),
      items: lastReceipt.items,
      subtotal: lastReceipt.subtotal,
      discount: lastReceipt.discount,
      tax: lastReceipt.tax,
      taxName: lastReceipt.taxName,
      total: lastReceipt.totalSyp,
      amountPaid: lastReceipt.totalSyp + lastReceipt.change,
      change: lastReceipt.change,
      cashierName: session?.user?.name ?? '',
      customerName: lastReceipt.customerName,
      totalUsdCents: lastReceipt.totalUsdCents,
      exchangeRate: lastReceipt.exchangeRate,
      pricingCurrency,
    })
  }

  /* ─── محتوى لوحة السلة — يُستخدم في اللوحة الجانبية (سطح المكتب) وفي المودال (الجوال) ─── */
  const cartPanelBody = (
    <>
      {/* رأس الفاتورة */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: '1px solid var(--border-color)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <ShoppingCart size={16} style={{ color: 'var(--indigo)' }} />
          <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>الفاتورة الحالية</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ background: 'var(--diamond)', color: 'var(--text-2)', padding: '2px 8px', borderRadius: '9999px', fontSize: '12px', fontWeight: 500 }}>
            {itemCount} صنف
          </span>
          {cart.length > 0 && (
            <button onClick={deleteInvoice} title="حذف الفاتورة"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: 'var(--r-s)', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-m)', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-bg)'; e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'var(--red)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-m)'; e.currentTarget.style.borderColor = 'var(--border-color)' }}>
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* أصناف السلة */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {cart.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-m)', gap: '6px', padding: '32px 0' }}>
            <ShoppingCart size={40} style={{ opacity: .2 }} />
            <p style={{ fontSize: '13px' }}>السلة فارغة</p>
            <p style={{ fontSize: '11.5px' }}>اضغط على المنتجات للإضافة</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {cart.map(l => (
              <div key={l.id} style={{
                padding: '8px 10px', borderRadius: 'var(--r-s)',
                border: '1px solid var(--border-color)', background: 'var(--diamond)',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px', marginBottom: '6px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', flex: 1, lineHeight: 1.3 }}>{l.name}</p>
                  <button onClick={() => removeLine(l.id)} style={{ color: 'var(--text-m)', border: 'none', background: 'none', cursor: 'pointer', padding: '1px', flexShrink: 0, lineHeight: 1 }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)') }
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-m)')}>
                    <Trash2 size={13} />
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <button onClick={() => changeQty(l.id, -1)}
                      style={{ width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '5px', border: '1px solid var(--border-color)', background: 'var(--white)', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'var(--f)' }}>
                      <Minus size={11} />
                    </button>
                    <span style={{ width: '24px', textAlign: 'center', fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{l.qty}</span>
                    <button onClick={() => changeQty(l.id, +1)} disabled={l.qty >= l.stock}
                      style={{ width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '5px', border: '1px solid var(--border-color)', background: 'var(--white)', color: 'var(--text-2)', cursor: 'pointer', opacity: l.qty >= l.stock ? .4 : 1, fontFamily: 'var(--f)' }}>
                      <Plus size={11} />
                    </button>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--mono)' }}>{formatSyp(l.lineTotalSyp)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* تذييل الفاتورة */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-color)' }}>

        {/* طريقة الدفع */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' }}>
          {([['CASH', 'نقدي', <Banknote key="c" size={14} />, 'var(--indigo)', 'var(--indigo-l)'],
             ['CREDIT', 'آجل', <CalendarClock key="a" size={14} />, 'var(--amber)', 'var(--amber-bg)']] as const).map(([mode, label, Icon, activeColor, activeBg]) => (
            <button key={mode} onClick={() => setPayMethod(mode as 'CASH' | 'CREDIT')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                padding: '7px', borderRadius: 'var(--r-s)', fontSize: '13px', fontWeight: payMethod === mode ? 600 : 400,
                cursor: 'pointer', border: payMethod === mode ? `2px solid ${activeColor}` : '2px solid var(--border-color)',
                background: payMethod === mode ? activeBg : 'transparent',
                color: payMethod === mode ? activeColor : 'var(--text-2)',
                transition: '.12s', fontFamily: 'var(--f)',
              }}>
              {Icon}{label}
            </button>
          ))}
        </div>

        {/* أرقام */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '13px', marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-2)' }}>
            <span>الإجمالي الفرعي</span>
            <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>{formatSyp(subtotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-2)' }}>
            <span>الخصم (ل.س)</span>
            <input type="number" min={0} value={discount || ''} onChange={e => setDiscount(Number(e.target.value)||0)}
              placeholder="0" dir="ltr"
              style={{ width: '80px', border: '1px solid var(--border-color)', borderRadius: '5px', background: 'var(--diamond)', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: '13px', padding: '3px 7px', outline: 'none', textAlign: 'center' }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--indigo)'}
              onBlur={e  => e.currentTarget.style.borderColor = 'var(--border-color)'} />
          </div>
          {discountOverCap && (
            <div style={{ fontSize: '11.5px', color: 'var(--red, #dc2626)', textAlign: 'right' }}>
              نسبة الخصم ({(discountPercentBp / 100).toFixed(1)}%) تتجاوز سقفك المسموح ({(discountCapBp! / 100).toFixed(1)}%) — سيُرفض الطلب من الخادم
            </div>
          )}
          {taxActive && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-2)' }}>
              <span>{taxName}</span>
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>{formatSyp(taxPreview)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
            <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>الإجمالي</span>
            <span style={{ fontWeight: 800, fontSize: '20px', color: 'var(--indigo)', fontFamily: 'var(--mono)' }}>{formatSyp(total)}</span>
          </div>
          {pricingCurrency === 'USD' && rate && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '11.5px', color: 'var(--text-m)' }}>
              ≈ {formatUsd(totalUsdCentsPreview)}
            </div>
          )}
        </div>

        {/* أزرار */}
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px' }}>
          <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '9px 12px', borderRadius: 'var(--r-s)', border: '1px solid var(--border-color)', color: 'var(--text-2)', background: 'transparent', cursor: 'pointer', fontSize: '12.5px', fontFamily: 'var(--f)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--diamond)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <Clock size={14} /> تعليق
          </button>
          <button onClick={openCheckout} disabled={cart.length === 0 || !openShift || !rate}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px', borderRadius: 'var(--r-s)', background: 'var(--indigo)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '14px', opacity: (cart.length === 0 || !openShift || !rate) ? .5 : 1, transition: 'background .15s', fontFamily: 'var(--f)' }}
            onMouseEnter={e => { if (cart.length && openShift && rate) (e.currentTarget as HTMLElement).style.background = 'var(--indigo-h)'; }}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--indigo)'}>
            إتمام الدفع ✓
          </button>
        </div>
      </div>
    </>
  )

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-m)' }}>
        جارٍ التحميل...
      </div>
    )
  }

  /* ─────────────────────────────────── RENDER ─────────────────────────────────── */
  return (
    <div className="flex flex-col md:flex-row" style={{ height: '100%', background: 'var(--diamond)', overflow: 'hidden' }} dir="rtl">

      {/* ═══ منطقة المنتجات ═══ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

        {/* شريط أعلى — بحث + وردية */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '8px 12px',
          background: 'var(--white)', borderBottom: '1px solid var(--border-color)',
          flexWrap: 'wrap',
        }}>
          {/* حقل البحث / الباركود */}
          <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
            <ScanLine size={14} style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--indigo)', pointerEvents: 'none' }} />
            <input
              type="text" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="امسح الباركود أو اكتب اسم المنتج..."
              className="field" style={{ paddingRight: '30px', paddingTop: '6px', paddingBottom: '6px' }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-m)', border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={13} />
              </button>
            )}
          </div>

          {!rate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: 'var(--r-x)', background: 'var(--red-bg)', border: '1px solid var(--red)', color: 'var(--red)', fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap' }}>
              <AlertCircle size={12} /> لا يوجد سعر صرف مسجل
            </div>
          )}

          {/* حالة الوردية */}
          {openShift ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: 'var(--r-x)', background: 'var(--green-bg)', border: '1px solid var(--green)', color: 'var(--green)', fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '9999px', background: 'var(--green)', display: 'inline-block' }} />
              وردية مفتوحة
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: 'var(--r-x)', background: 'var(--amber-bg)', border: '1px solid var(--amber)', color: 'var(--amber)', fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap' }}>
              <AlertCircle size={12} /> لا توجد وردية
            </div>
          )}
        </div>

        {/* تبويبات التصنيفات */}
        <div style={{
          display: 'flex', gap: '6px', overflowX: 'auto', padding: '7px 12px',
          background: 'var(--white)', borderBottom: '1px solid var(--border-color)',
          scrollbarWidth: 'none',
        }}>
          {[{ id: '', name: 'الكل' }, ...categories].map(c => (
            <button key={c.id}
              onClick={() => setCatFilter(c.id)}
              style={{
                flexShrink: 0, padding: '4px 12px', borderRadius: '9999px', fontSize: '12.5px',
                fontWeight: catFilter === c.id ? 600 : 400, border: 'none', cursor: 'pointer',
                background: catFilter === c.id ? 'var(--indigo)' : 'var(--diamond)',
                color: catFilter === c.id ? '#fff' : 'var(--text-2)',
                transition: 'background .12s, color .12s',
                fontFamily: 'var(--f)',
              }}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* شبكة المنتجات */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
          {filtered.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-m)', gap: '8px' }}>
              <Search size={36} style={{ opacity: .3 }} />
              <p style={{ fontSize: '13px' }}>لا توجد منتجات مطابقة</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: '8px' }}>
              {filtered.map((p, i) => {
                const tc     = TILE_COLORS[i % TILE_COLORS.length]
                const price  = calcFinalPrice(p)
                const priceSyp = rate ? priceToSyp(p, rate) : 0
                const inCart = cart.find(c => c.id === p.id)
                const out    = p.stock <= 0

                return (
                  <button key={p.id} onClick={() => addToCart(p)} disabled={out || !rate}
                    style={{
                      position: 'relative', display: 'flex', flexDirection: 'column', textAlign: 'right',
                      background: 'var(--white)', borderRadius: 'var(--r-s)',
                      border: inCart ? `2px solid var(--indigo)` : '1px solid var(--border-color)',
                      padding: '0', cursor: (out || !rate) ? 'not-allowed' : 'pointer',
                      opacity: (out || !rate) ? .55 : 1, transition: 'box-shadow .12s, border-color .12s',
                      boxShadow: inCart ? '0 0 0 3px var(--indigo-g)' : 'var(--sh)',
                      fontFamily: 'var(--f)',
                    }}
                    className="   "
                    onMouseEnter={e => { if (!out) (e.currentTarget as HTMLElement).style.boxShadow = 'var(--sh-m)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = inCart ? '0 0 0 3px var(--indigo-g)' : 'var(--sh)'; }}
                  >
                    {/* صورة الفئة أو مربع الأحرف */}
                    {p.category?.imageUrl ? (
                      <img src={p.category.imageUrl} alt={p.category.name}
                        style={{ height: '80px', width: '100%', borderTopRightRadius: 'var(--r-x)', borderTopLeftRadius:'var(--r-x)', marginBottom: '8px', objectFit: 'cover' }} />
                    ) : (
                      <div style={{
                        height: '80px', width: '100%', borderTopRightRadius: 'var(--r-x)', borderTopLeftRadius:'var(--r-x)', marginBottom: '8px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: tc.bg, color: tc.color, fontSize: '18px', fontWeight: 700,
                      }}>
                        {p.name.split(' ').slice(0, 2).map(w => w[0]).join('')}
                      </div>
                    )}

                    {/* شارة الكمية */}
                    {inCart && (
                      <div style={{
                        position: 'absolute', top: '7px', left: '7px',
                        width: '18px', height: '18px', borderRadius: '9999px',
                        background: 'var(--indigo)', color: '#fff', fontSize: '10px',
                        fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{inCart.qty}</div>
                    )}
                      <div className=' p-2'>

                    <p style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--text)', lineHeight: 1.3, marginBottom: '6px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {p.name}
                    </p>
                    <div className=' flex justify-between flex-row-reverse '>
                    {p.priceCurrency === 'USD' ? (
                      <>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--indigo)', fontFamily: 'var(--mono)', marginTop: 'auto' }}>
                          {formatUsd(price)}
                        </p>
                        <p style={{ fontSize: '10.5px', color: 'var(--text-m)', fontFamily: 'var(--mono)' }}>
                          {rate ? formatSyp(priceSyp) : '—'}
                        </p>
                      </>
                    ) : (
                      <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--indigo)', fontFamily: 'var(--mono)', marginTop: 'auto' }}>
                        {formatSyp(price)}
                      </p>
                    )}
                    </div>
                    <p style={{ fontSize: '11px', color: out ? 'var(--red)' : 'var(--text-m)', marginTop: '2px' }}>
                      {out ? 'غير متوفر' : `المتاح: ${p.stock}`}
                    </p>
              </div>
                  </button>
                )
              })}
            </div>
          )}
          </div>
      </div>

      {/* ═══ سلة الفاتورة — سطح المكتب ═══ */}
      <div className="hidden md:flex md:w-90" style={{
        flexShrink: 0, flexDirection: 'column',
        background: 'var(--white)', borderRight: '1px solid var(--border-color)',
        boxShadow: 'var(--sh-m)',
      }}>
        {cartPanelBody}
      </div>

      {/* ═══ شريط السلة العائم — الجوال ═══ */}
      {cart.length > 0 && !cartOpen && (
        <button onClick={() => setCartOpen(true)}
          className="flex md:hidden fixed z-30"
          style={{
            bottom: '64px', insetInlineStart: '8px', insetInlineEnd: '8px',
            alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px', borderRadius: 'var(--r)', background: 'var(--indigo)', color: '#fff',
            border: 'none', cursor: 'pointer', boxShadow: 'var(--sh-l)', fontFamily: 'var(--f)',
          }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '14px' }}>
            <ShoppingCart size={16} /> {itemCount} صنف
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '15px', fontFamily: 'var(--mono)' }}>
            {formatSyp(total)}
            <span style={{ fontSize: '12px', fontWeight: 500, opacity: .85, fontFamily: 'var(--f)' }}>عرض السلة ›</span>
          </span>
        </button>
      )}

      {/* ═══ مودال السلة — الجوال ═══ */}
      {cartOpen && (
        <div className="modal-backdrop md:hidden" dir="rtl" style={{ alignItems: 'flex-end' }} onClick={() => setCartOpen(false)}>
          <div className="modal-box" style={{ maxWidth: '480px', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>السلة</span>
              <button onClick={() => setCartOpen(false)} style={{ color: 'var(--text-m)', border: 'none', background: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            {cartPanelBody}
          </div>
        </div>
      )}

      {/* ═══ مودال إتمام البيع ═══ */}
      {checkoutOpen && (
        <div className="modal-backdrop" dir="rtl">
          <div className="modal-box" style={{ maxWidth: '380px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
              <h2 style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>إتمام البيع</h2>
              <button onClick={() => setCheckoutOpen(false)} style={{ color: 'var(--text-m)', border: 'none', background: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* ملخص */}
              <div style={{ background: 'var(--diamond)', borderRadius: 'var(--r-s)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {cart.map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                    <span style={{ color: 'var(--text-2)' }}>{c.name} × {c.qty}</span>
                    <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>{formatSyp(c.lineTotalSyp)}</span>
                  </div>
                ))}
                {discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--green)' }}>
                    <span>خصم</span><span style={{ fontFamily: 'var(--mono)' }}>- {formatSyp(discount)}</span>
                  </div>
                )}
                {taxActive && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--text-2)' }}>
                    <span>{taxName}</span><span style={{ fontFamily: 'var(--mono)' }}>{formatSyp(taxPreview)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '7px', borderTop: '1px solid var(--border-color)', fontWeight: 700 }}>
                  <span style={{ color: 'var(--text)' }}>الإجمالي</span>
                  <span style={{ color: 'var(--indigo)', fontFamily: 'var(--mono)' }}>{formatSyp(total)}</span>
                </div>
                {pricingCurrency === 'USD' && rate && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '11px', color: 'var(--text-m)' }}>
                    ≈ {formatUsd(totalUsdCentsPreview)} — سعر الصرف {rate.toLocaleString('en-US')}
                  </div>
                )}
              </div>

              {/* اختيار عميل */}
              <div ref={customerRef} style={{ position: 'relative' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '5px' }}>
                  <User size={12} style={{ display: 'inline', marginLeft: '3px' }} />
                  العميل {payMethod === 'CREDIT' && <span style={{ color: 'var(--red)' }}>*</span>}
                </label>
                {selectedCustomer ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', borderRadius: 'var(--r-s)', background: 'var(--indigo-g)', border: '1px solid var(--indigo)' }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--indigo)' }}>{selectedCustomer.name}</p>
                    <button onClick={() => { setSelectedCustomer(null); setCustomerSearch('') }} style={{ color: 'var(--indigo)', border: 'none', background: 'none', cursor: 'pointer' }}><X size={13} /></button>
                  </div>
                ) : (
                  <>
                    <div style={{ position: 'relative' }}>
                      <Search size={13} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-m)', pointerEvents: 'none' }} />
                      <input value={customerSearch}
                        onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true) }}
                        onFocus={() => setShowCustomerDropdown(true)}
                        placeholder="ابحث عن عميل..."
                        className="field" style={{ paddingRight: '28px', paddingTop: '6px', paddingBottom: '6px', fontSize: '13px' }} />
                    </div>
                    {showCustomerDropdown && filteredCustomers.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', insetInline: 0, zIndex: 10, marginTop: '3px', borderRadius: 'var(--r-s)', boxShadow: 'var(--sh-l)', background: 'var(--white)', border: '1px solid var(--border-color)', maxHeight: '140px', overflowY: 'auto' }}>
                        {filteredCustomers.slice(0, 6).map(c => (
                          <button key={c.id} type="button"
                            onMouseDown={() => { setSelectedCustomer(c); setCustomerSearch(''); setShowCustomerDropdown(false) }}
                            style={{ width: '100%', textAlign: 'right', padding: '7px 10px', display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--text)', border: 'none', background: 'none', cursor: 'pointer', borderBottom: '1px solid var(--border-l)', fontFamily: 'var(--f)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--diamond)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                            <span style={{ fontWeight: 500 }}>{c.name}</span>
                            {c.phone && <span style={{ color: 'var(--text-m)', fontSize: '11.5px' }}>{c.phone}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* المبلغ المستلم */}
              {payMethod === 'CASH' && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '5px' }}>المبلغ المستلم (ل.س)</label>
                  <input type="number" min={0} value={amountPaid}
                    onChange={e => setAmountPaid(e.target.value)} autoFocus dir="ltr"
                    placeholder={String(total)}
                    style={{ width: '100%', border: '1px solid var(--border-color)', borderRadius: 'var(--r-s)', background: 'var(--diamond)', padding: '10px 12px', fontSize: '20px', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--mono)', outline: 'none', textAlign: 'center', transition: 'border-color .15s' }}
                    onFocus={e => e.currentTarget.style.borderColor = 'var(--indigo)'}
                    onBlur={e  => e.currentTarget.style.borderColor = 'var(--border-color)'} />
                  {amountPaid && parseFloat(amountPaid) >= total && (
                    <p style={{ textAlign: 'center', fontSize: '12.5px', marginTop: '4px', color: 'var(--green)', fontWeight: 500 }}>
                      الباقي: {formatSyp(Math.round(parseFloat(amountPaid)) - total)}
                    </p>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '5px', marginTop: '7px' }}>
                    {[total, ...([5000,10000,20000,50000].filter(v=>v>total))].slice(0,4).map(v=>(
                      <button key={v} onClick={() => setAmountPaid(String(v))}
                        style={{ padding: '5px', fontSize: '11.5px', fontFamily: 'var(--mono)', border: '1px solid var(--border-color)', borderRadius: 'var(--r-x)', background: 'var(--white)', color: 'var(--text-2)', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--diamond)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'var(--white)')}>
                        {formatSyp(v)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {payMethod === 'CREDIT' && selectedCustomer && (
                <div style={{ padding: '8px 10px', borderRadius: 'var(--r-s)', background: 'var(--amber-bg)', border: '1px solid var(--amber)', color: 'var(--amber)', fontSize: '12px' }}>
                  سيُضاف <strong>{formatUsd(totalUsdCentsPreview)}</strong> إلى دين {selectedCustomer.name} الآجل
                </div>
              )}

              <button onClick={checkout}
                disabled={processing || discountOverCap || (payMethod==='CASH' && (!amountPaid||parseFloat(amountPaid)<total)) || (payMethod==='CREDIT'&&!selectedCustomer)}
                className="btn-primary" style={{ width: '100%', justifyContent: 'center', background: 'var(--green)', padding: '10px', fontSize: '14px', fontWeight: 700, borderRadius: 'var(--r-s)', opacity: processing ? .7 : 1 }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '.85')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                {processing ? 'جارٍ الحفظ...' : '✓ تأكيد البيع'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ مودال تأكيد حذف الفاتورة ═══ */}
      {deleteConfirmOpen && (
        <div className="modal-backdrop" dir="rtl">
          <div className="modal-box" style={{ maxWidth: '340px', textAlign: 'center', padding: '24px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '9999px', background: 'var(--red-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <Trash2 size={26} style={{ color: 'var(--red)' }} />
            </div>
            <h3 style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text)' }}>حذف الفاتورة؟</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-m)', marginTop: '6px', marginBottom: '18px' }}>
              سيتم إفراغ السلة بالكامل وحذف كل الأصناف المضافة.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button onClick={() => setDeleteConfirmOpen(false)} className="btn-outline" style={{ justifyContent: 'center' }}>
                تراجع
              </button>
              <button onClick={confirmDeleteInvoice} className="btn-primary" style={{ justifyContent: 'center', background: 'var(--red)' }}>
                حذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ شاشة نجاح الدفع ═══ */}
      {lastReceipt && (
        <div className="modal-backdrop" dir="rtl">
          <div className="modal-box" style={{ maxWidth: '340px', textAlign: 'center', padding: '24px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '9999px', background: 'var(--green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <CheckCircle2 size={28} style={{ color: 'var(--green)' }} />
            </div>
            <h3 style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text)' }}>تمت العملية بنجاح</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-m)', fontFamily: 'var(--mono)', marginTop: '4px', marginBottom: '14px' }}>{lastReceipt.invoiceNumber}</p>

            <div style={{ background: 'var(--diamond)', borderRadius: 'var(--r-s)', padding: '12px', marginBottom: '14px' }}>
              <p style={{ fontSize: '11.5px', color: 'var(--text-m)', marginBottom: '4px' }}>المبلغ الإجمالي</p>
              <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--mono)' }}>{formatSyp(lastReceipt.totalSyp)}</p>
              {pricingCurrency === 'USD' && (
                <p style={{ fontSize: '12px', color: 'var(--text-m)', marginTop: '2px' }}>≈ {formatUsd(lastReceipt.totalUsdCents)}</p>
              )}
              {lastReceipt.tax > 0 && (
                <p style={{ fontSize: '11.5px', color: 'var(--text-m)', marginTop: '2px' }}>
                  {lastReceipt.taxName}: {formatSyp(lastReceipt.tax)} (ضمن الإجمالي)
                </p>
              )}
              {lastReceipt.change > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-color)', fontSize: '12.5px', color: 'var(--green)' }}>
                  <span>الباقي للعميل</span>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>{formatSyp(lastReceipt.change)}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button onClick={printLastReceipt} className="btn-outline" style={{ justifyContent: 'center' }}>
                <Receipt size={14} /> طباعة
              </button>
              <button onClick={newInvoice} className="btn-primary" style={{ justifyContent: 'center', background: 'var(--indigo)' }}>
                فاتورة جديدة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PosPage() {
  return (
    <SessionProvider basePath="/api/store-auth">
      <PosContent />
    </SessionProvider>
  )
}
