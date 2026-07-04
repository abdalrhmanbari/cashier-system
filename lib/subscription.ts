import { prisma } from '@/lib/prisma'

const DAY = 24 * 60 * 60 * 1000

/** مدة التجديد القياسية بالأيام حسب دورة الفوترة */
export const RENEWAL_DURATION_DAYS: Record<'MONTHLY' | 'YEARLY', number> = {
  MONTHLY: 30,
  YEARLY:  365,
}

/**
 * تصحيح الحالة المخزّنة لاشتراك واحد إن انتهت صلاحيته فعلياً — بديل عن cron،
 * يُستدعى عند أي قراءة لتفاصيل الاشتراك حتى لا تبقى الحالة ACTIVE بعد انتهاء endDate.
 */
export async function syncExpiredStatus(storeId: string) {
  await prisma.subscription.updateMany({
    where: { storeId, status: 'ACTIVE', endDate: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  })
}

export async function getSubscriptionDetail(storeId: string) {
  await syncExpiredStatus(storeId)
  return prisma.subscription.findUnique({
    where: { storeId },
    include: {
      plan:     { select: { id: true, name: true } },
      payments: { orderBy: { paidAt: 'desc' } },
      renewals: { orderBy: { renewedAt: 'desc' } },
    },
  })
}

export function renewalDuration(billingCycle?: string, customDays?: number): number {
  if (customDays && customDays > 0) return Math.floor(customDays)
  if (billingCycle === 'MONTHLY' || billingCycle === 'YEARLY') return RENEWAL_DURATION_DAYS[billingCycle]
  throw new Error('يجب تحديد دورة فوترة صالحة أو مدة مخصصة')
}

export { DAY }
