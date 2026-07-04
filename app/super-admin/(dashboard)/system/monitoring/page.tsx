import { Activity, Store, Users, ShoppingCart, AlertTriangle, Gauge, Database, Clock } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getSlowestOperations } from '@/lib/logger'
import { dbFileSizeBytes, lastBackupAgeMs } from '@/lib/system-metrics'
import { ErrorsChart } from '@/components/super-admin/ErrorsChart'

const HOUR = 60 * 60 * 1000
const DAY  = 24 * HOUR

function startOfToday() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function formatAge(ms: number | null): string {
  if (ms === null) return 'لا توجد نسخة'
  const hours = ms / HOUR
  if (hours < 1) return `منذ ${Math.round(ms / 60000)} د`
  if (hours < 24) return `منذ ${hours.toFixed(1)} س`
  return `منذ ${(hours / 24).toFixed(1)} يوم`
}

async function getErrorsLast7Days() {
  const since = new Date(Date.now() - 7 * DAY)
  const rows = await prisma.errorLog.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } })

  const buckets: { date: string; count: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY)
    buckets.push({ date: d.toISOString().split('T')[0], count: 0 })
  }
  const byDate = new Map(buckets.map(b => [b.date, b]))
  for (const row of rows) {
    const day = row.createdAt.toISOString().split('T')[0]
    const bucket = byDate.get(day)
    if (bucket) bucket.count++
  }
  return buckets
}

export default async function SystemMonitoringPage() {
  const today = startOfToday()
  const oneHourAgo = new Date(Date.now() - HOUR)

  const [activeStores, activeUsers, salesToday, errorsToday, errorsLastHour, chartData] = await Promise.all([
    prisma.store.count({ where: { isActive: true, subscription: { status: { in: ['ACTIVE', 'TRIAL'] } } } }),
    prisma.storeUser.count({ where: { isActive: true } }),
    prisma.sale.count({ where: { createdAt: { gte: today }, status: 'COMPLETED' } }),
    prisma.errorLog.count({ where: { createdAt: { gte: today } } }),
    prisma.errorLog.count({ where: { createdAt: { gte: oneHourAgo } } }),
    getErrorsLast7Days(),
  ])

  const slowest = getSlowestOperations(5)
  const dbSize = dbFileSizeBytes()
  const backupAge = lastBackupAgeMs()
  const uptimeHours = process.uptime() / 3600

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'var(--indigo-g)' }}>
          <Activity className="w-5 h-5" style={{ color: 'var(--indigo)' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold">المراقبة</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-m)' }}>مؤشرات حقيقية مقاسة الآن — لا بيانات تجريبية</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={Store}          label="متاجر نشطة"      value={activeStores}    color="var(--indigo)" bg="var(--indigo-g)" />
        <Stat icon={Users}          label="مستخدمون"        value={activeUsers}     color="var(--teal)"   bg="var(--teal-bg)" />
        <Stat icon={ShoppingCart}   label="مبيعات اليوم"     value={salesToday}      color="var(--green)"  bg="var(--green-bg)" />
        <Stat icon={AlertTriangle}  label="أخطاء اليوم"      value={errorsToday}     color="var(--amber)"  bg="var(--amber-bg)" />
        <Stat icon={AlertTriangle}  label="أخطاء آخر ساعة"   value={errorsLastHour}  color="var(--red)"    bg="var(--red-bg)" />
        <Stat icon={Database}       label="حجم قاعدة البيانات" value={dbSize !== null ? `${(dbSize / (1024*1024)).toFixed(1)} MB` : '—'} color="var(--purple)" bg="var(--purple-bg)" />
        <Stat icon={Clock}          label="آخر نسخة احتياطية" value={formatAge(backupAge)} color="var(--teal)" bg="var(--teal-bg)" />
        <Stat icon={Gauge}          label="مدة التشغيل"       value={uptimeHours < 24 ? `${uptimeHours.toFixed(1)} س` : `${(uptimeHours/24).toFixed(1)} يوم`} color="var(--indigo)" bg="var(--indigo-g)" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card" style={{ padding: '14px 16px' }}>
          <p style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)', marginBottom: '12px' }}>أخطاء آخر 7 أيام</p>
          <ErrorsChart data={chartData} />
        </div>

        <div className="card" style={{ padding: '14px 16px' }}>
          <p style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)', marginBottom: '12px' }}>أبطأ 5 عمليات مسجَّلة</p>
          {slowest.length === 0 ? (
            <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-m)', fontSize: '13px', textAlign: 'center' }}>
              لا توجد عمليات بطيئة مسجَّلة (سجلات الأداء تُكتب بالإنتاج فقط)
            </div>
          ) : (
            <div className="space-y-2">
              {slowest.map((op, i) => (
                <div key={i} className="flex items-center justify-between text-sm" style={{ padding: '8px 0', borderBottom: i < slowest.length - 1 ? '1px solid var(--border-l)' : 'none' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{op.message}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-m)', fontFamily: 'monospace', direction: 'ltr', textAlign: 'right' }}>{op.path}</p>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded text-xs font-medium shrink-0"
                    style={{ background: 'var(--amber-bg)', color: 'var(--amber)' }}
                  >
                    {op.durationMs}ms
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value, color, bg }: { icon: React.ElementType; label: string; value: number | string; color: string; bg: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--white)', border: '1px solid var(--border-color)' }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: bg }}>
          <Icon size={14} style={{ color }} />
        </div>
        <span className="text-xs" style={{ color: 'var(--text-2)' }}>{label}</span>
      </div>
      <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{value}</p>
    </div>
  )
}
