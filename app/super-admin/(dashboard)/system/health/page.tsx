import fs from 'fs'
import path from 'path'
import { HeartPulse, Database, HardDrive, Clock, Server, CheckCircle2, XCircle } from 'lucide-react'
import { getHealthSnapshot } from '@/lib/system-metrics'

function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const parts = []
  if (days)    parts.push(`${days} يوم`)
  if (hours)   parts.push(`${hours} ساعة`)
  if (minutes || parts.length === 0) parts.push(`${minutes} دقيقة`)
  return parts.join(' ')
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return 'غير معروف'
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatAge(ms: number | null): string {
  if (ms === null) return 'لا توجد نسخة احتياطية'
  const hours = ms / (60 * 60 * 1000)
  if (hours < 1) return `منذ ${Math.round(ms / 60000)} دقيقة`
  if (hours < 24) return `منذ ${hours.toFixed(1)} ساعة`
  return `منذ ${(hours / 24).toFixed(1)} يوم`
}

function nextVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'))
    return (pkg.dependencies?.next ?? 'unknown').replace(/^\^|~/, '')
  } catch {
    return 'unknown'
  }
}

export default async function SystemHealthPage() {
  const health = await getHealthSnapshot()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center"
          style={{ background: health.status === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)' }}
        >
          <HeartPulse className="w-5 h-5" style={{ color: health.status === 'ok' ? 'var(--green)' : 'var(--red)' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold">صحة النظام</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-m)' }}>
            آخر فحص: {new Date(health.timestamp).toLocaleString('ar-EG')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card
          icon={health.database.ok ? CheckCircle2 : XCircle}
          color={health.database.ok ? 'var(--green)' : 'var(--red)'}
          bg={health.database.ok ? 'var(--green-bg)' : 'var(--red-bg)'}
          label="قاعدة البيانات"
          value={health.database.ok ? 'متصلة' : 'غير متصلة'}
          sub={`زمن الاستجابة: ${health.database.latencyMs}ms`}
        />
        <Card
          icon={HardDrive}
          color="var(--indigo)"
          bg="var(--indigo-g)"
          label="مساحة القرص المتبقية"
          value={health.diskFreePercent !== null ? `${health.diskFreePercent}%` : 'غير معروف'}
        />
        <Card
          icon={Database}
          color="var(--teal)"
          bg="var(--teal-bg)"
          label="حجم قاعدة البيانات"
          value={formatBytes(health.dbFileSizeBytes)}
        />
        <Card
          icon={Clock}
          color="var(--amber)"
          bg="var(--amber-bg)"
          label="آخر نسخة احتياطية"
          value={formatAge(health.lastBackupAgeMs)}
        />
        <Card
          icon={Server}
          color="var(--purple)"
          bg="var(--purple-bg)"
          label="مدة تشغيل الخادم"
          value={formatDuration(health.uptimeSeconds)}
        />
      </div>

      <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--white)', border: '1px solid var(--border-color)' }}>
        <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>بيئة التشغيل</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <Info label="إصدار التطبيق" value={health.appVersion} />
          <Info label="إصدار Node.js" value={health.nodeVersion} />
          <Info label="إصدار Next.js" value={nextVersion()} />
          <Info label="بيئة التشغيل" value={process.env.NODE_ENV ?? 'unknown'} />
          <Info label="نظام التشغيل" value={process.platform} />
          <Info label="المنطقة الزمنية" value={timeZone} />
        </div>
      </div>
    </div>
  )
}

function Card({ icon: Icon, color, bg, label, value, sub }: { icon: React.ElementType; color: string; bg: string; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--white)', border: '1px solid var(--border-color)' }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: bg }}>
          <Icon size={15} style={{ color }} />
        </div>
        <span className="text-sm" style={{ color: 'var(--text-2)' }}>{label}</span>
      </div>
      <p className="text-xl font-bold" style={{ color: 'var(--text)' }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-m)' }}>{sub}</p>}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs" style={{ color: 'var(--text-m)' }}>{label}</p>
      <p className="font-medium" style={{ color: 'var(--text)' }}>{value}</p>
    </div>
  )
}
