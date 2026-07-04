import { prisma } from '@/lib/prisma'

// خيارات مهلة السماح المتاحة عند تفعيل الصيانة العامة (بالدقائق) — 0 = فوري
export const GRACE_MINUTES_OPTIONS = [0, 10, 30] as const

const SINGLETON_ID = 'singleton'

export async function getPlatformSettings() {
  const existing = await prisma.platformSetting.findUnique({ where: { id: SINGLETON_ID } })
  if (existing) return existing
  return prisma.platformSetting.create({ data: { id: SINGLETON_ID } })
}

// لحظة توقف الجلسات النشطة عن العمل: وقت التفعيل + مهلة السماح
export function maintenanceCutoverAt(activatedAt: Date, graceMinutes: number) {
  return new Date(activatedAt.getTime() + graceMinutes * 60_000)
}
