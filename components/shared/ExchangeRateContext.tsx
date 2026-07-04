'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

export type RateRow = { id: string; rate: number; effectiveFrom: string; createdBy: { name: string } }

type ExchangeRateContextValue = {
  rate: number | null
  current: RateRow | null
  loading: boolean
  /** إعادة الجلب من الخادم — تُستخدم كشبكة أمان (polling) وعند اكتشاف تقادم السعر المعروض */
  refresh: () => Promise<void>
  /** تحديث فوري للسياق بعد حفظ سعر جديد من dialog المؤشر — بلا إعادة جلب */
  applyRate: (row: RateRow) => void
}

const ExchangeRateContext = createContext<ExchangeRateContextValue | null>(null)

const POLL_MS = 60_000

export function ExchangeRateProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<RateRow | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const res = await fetch('/api/store/exchange-rate')
    if (res.ok) {
      const data = await res.json()
      setCurrent(data.current ?? null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  const applyRate = useCallback((row: RateRow) => setCurrent(row), [])

  return (
    <ExchangeRateContext.Provider value={{ rate: current?.rate ?? null, current, loading, refresh, applyRate }}>
      {children}
    </ExchangeRateContext.Provider>
  )
}

export function useExchangeRate() {
  const ctx = useContext(ExchangeRateContext)
  if (!ctx) throw new Error('useExchangeRate يجب أن يُستخدم داخل ExchangeRateProvider')
  return ctx
}
