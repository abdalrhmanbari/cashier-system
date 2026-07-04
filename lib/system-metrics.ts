import fs from 'fs'
import path from 'path'
import { listBackups } from '@/lib/backup'
import { prisma } from '@/lib/prisma'

const DB_PATH = path.join(process.cwd(), 'prisma', 'dev.db')
const BACKUPS_DIR = path.join(process.cwd(), 'prisma', 'backups')

export function diskFreePercent(): number | null {
  try {
    const stats = fs.statfsSync(process.cwd())
    return Math.round((stats.bavail / stats.blocks) * 1000) / 10
  } catch {
    return null
  }
}

export function dbFileSizeBytes(): number | null {
  try {
    return fs.statSync(DB_PATH).size
  } catch {
    return null
  }
}

// null = لا توجد أي نسخة احتياطية إطلاقاً (أخطر من مجرد نسخة قديمة)
export function lastBackupAgeMs(): number | null {
  try {
    const [latest] = listBackups()
    if (!latest) return null
    return Date.now() - fs.statSync(path.join(BACKUPS_DIR, latest)).mtimeMs
  } catch {
    return null
  }
}

export function appVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'))
    return pkg.version ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

// نقطة القياس الوحيدة — يستخدمها /api/health وصفحة "الصحة" بلوحة السوبر أدمن معاً (بلا نداء HTTP داخلي)
export async function getHealthSnapshot() {
  const dbStartedAt = Date.now()
  let dbOk = false
  try {
    await prisma.$queryRaw`SELECT 1`
    dbOk = true
  } catch {
    dbOk = false
  }

  return {
    status: dbOk ? 'ok' as const : 'error' as const,
    database: { ok: dbOk, latencyMs: Date.now() - dbStartedAt },
    diskFreePercent: diskFreePercent(),
    dbFileSizeBytes: dbFileSizeBytes(),
    lastBackupAgeMs: lastBackupAgeMs(),
    uptimeSeconds: Math.round(process.uptime()),
    appVersion: appVersion(),
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
  }
}
