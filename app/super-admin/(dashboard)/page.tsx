import { prisma } from '@/lib/prisma'

export default async function SuperAdminDashboard() {
  const [storeCount, planCount, activeSubs] = await Promise.all([
    prisma.store.count(),
    prisma.plan.count(),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">لوحة التحكم</h1>
      <div className="grid grid-cols-3 gap-4">
        <Stat label="المتاجر"          value={storeCount} color="var(--cerulean)" />
        <Stat label="الاشتراكات النشطة" value={activeSubs} color="var(--green)"   />
        <Stat label="الخطط"            value={planCount}  color="var(--purple)"  />
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'var(--white)', border: '1px solid var(--border-color)' }}
    >
      <p className="text-sm" style={{ color: 'var(--text-2)' }}>{label}</p>
      <p className="text-3xl font-bold mt-1" style={{ color }}>{value}</p>
    </div>
  )
}
