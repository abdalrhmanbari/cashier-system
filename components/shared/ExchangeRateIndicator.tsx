'use client'

import { useState } from 'react'
import { TrendingUp, AlertTriangle, X } from 'lucide-react'
import { useExchangeRate } from './ExchangeRateContext'

const HOUR = 60 * 60 * 1000

export function ExchangeRateIndicator({ isManager }: { isManager: boolean }) {
  const { current, loading, applyRate } = useExchangeRate()
  const [showDialog, setShowDialog] = useState(false)
  const [rateInput, setRateInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const stale = current ? Date.now() - new Date(current.effectiveFrom).getTime() > 24 * HOUR : false

  function openDialog() {
    if (!isManager) return
    setRateInput(current ? String(current.rate) : '')
    setError('')
    setShowDialog(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const rate = Math.round(parseFloat(rateInput))
    if (!rate || rate <= 0) { setError('أدخل سعراً صحيحاً'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/store/exchange-rate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rate }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'حدث خطأ'); return }
    applyRate(data)
    setShowDialog(false)
  }

  if (loading) return null

  return (
    <>
      <button
        onClick={openDialog}
        title={isManager ? 'تحديث سعر الصرف' : 'سعر الصرف الحالي'}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px',
          borderRadius: 'var(--r-x)', border: `1px solid ${!current ? 'var(--red)' : stale ? 'var(--amber)' : 'var(--border-color)'}`,
          background: !current ? 'var(--red-bg)' : stale ? 'var(--amber-bg)' : 'var(--diamond)',
          color: !current ? 'var(--red)' : stale ? 'var(--amber)' : 'var(--text-2)',
          cursor: isManager ? 'pointer' : 'default', fontFamily: 'var(--f)', fontSize: '12.5px', fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {!current ? <AlertTriangle size={13} /> : <TrendingUp size={13} />}
        {current ? (
          <span style={{ fontFamily: 'var(--mono)' }}>$1 = {current.rate.toLocaleString('en-US')} ل.س</span>
        ) : (
          <span>لا يوجد سعر صرف</span>
        )}
        {stale && current && <span style={{ fontSize: '10.5px' }}>(قديم)</span>}
      </button>

      {showDialog && (
        <div className="modal-backdrop" dir="rtl" onClick={() => setShowDialog(false)}>
          <div className="modal-box" style={{ maxWidth: '340px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
              <h2 style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>تحديث سعر الصرف</h2>
              <button onClick={() => setShowDialog(false)} style={{ color: 'var(--text-m)', border: 'none', background: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={submit} style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {current && (
                <p style={{ fontSize: '12px', color: 'var(--text-m)' }}>
                  السعر الحالي: <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--text)' }}>{current.rate.toLocaleString('en-US')} ل.س</span> — بواسطة {current.createdBy.name}
                </p>
              )}
              {error && <p style={{ fontSize: '12px', padding: '6px 10px', borderRadius: 'var(--r-s)', background: 'var(--red-bg)', color: 'var(--red)' }}>{error}</p>}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>كم ليرة سورية لكل دولار؟</label>
                <input type="number" min={1} value={rateInput} onChange={e => setRateInput(e.target.value)} autoFocus dir="ltr" required
                  style={{ width: '100%', border: '1px solid var(--border-color)', borderRadius: 'var(--r-s)', background: 'var(--diamond)', padding: '10px 12px', fontSize: '18px', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--mono)', outline: 'none', textAlign: 'center' }} />
              </div>
              <button type="submit" className="btn-primary" style={{ justifyContent: 'center' }} disabled={saving}>
                {saving ? 'جارٍ الحفظ...' : 'حفظ السعر الجديد'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
