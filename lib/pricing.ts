import type { Plan, PlanPrice } from '@prisma/client'

type PlanWithPrices = Plan & { prices: PlanPrice[] }

export type BillingCycle = 'MONTHLY' | 'YEARLY'

export function calculatePrice(
  plan: PlanWithPrices,
  billingCycle: BillingCycle,
  branchCount: number,
): { priceUsd: number; discountPct: number; originalPrice: number } {
  const row = plan.prices
    .filter(p => p.billingCycle === billingCycle)
    .filter(p => p.minBranches <= branchCount)
    .filter(p => p.maxBranches === null || p.maxBranches >= branchCount)
    .sort((a, b) => b.minBranches - a.minBranches)[0]

  if (!row) throw new Error('لا يوجد سعر لهذا الخيار')

  const base     = row.priceUsd * branchCount
  const discount = Math.round(base * row.discountPct / 100)

  return {
    priceUsd:      base - discount,
    discountPct:   row.discountPct,
    originalPrice: base,
  }
}

/** تحويل السنتات إلى دولارات للعرض */
export function centsToUsd(cents: number): string {
  return String(parseFloat((cents / 100).toFixed(2)))
}
