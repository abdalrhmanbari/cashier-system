import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { ZodError } from 'zod'
import { prisma } from '@/lib/prisma'

const LOGS_DIR = path.join(process.cwd(), 'logs')
const RETENTION_DAYS = 14
const isProd = process.env.NODE_ENV === 'production'

type Level = 'info' | 'warn' | 'error'

type LogMeta = {
  storeSlug?: string | null
  path?: string | null
  requestId?: string
  [key: string]: unknown
}

function dateStamp(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function pruneOldLogFiles() {
  if (!fs.existsSync(LOGS_DIR)) return
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
  for (const f of fs.readdirSync(LOGS_DIR)) {
    if (!/^\d{4}-\d{2}-\d{2}\.log$/.test(f)) continue
    const full = path.join(LOGS_DIR, f)
    if (fs.statSync(full).mtimeMs < cutoff) fs.rmSync(full, { force: true })
  }
}

const CONSOLE_COLOR: Record<Level, string> = { info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m' }
const RESET = '\x1b[0m'

// نقطة الإرسال الوحيدة لكل سجل — لاحقاً يمكن استبدالها بإرسال موازٍ لـ Sentry دون تغيير أي نقطة استدعاء لـ logger.*
function send(level: Level, message: string, meta: LogMeta) {
  const entry = { timestamp: new Date().toISOString(), level, message, ...meta }

  if (isProd) {
    try {
      fs.mkdirSync(LOGS_DIR, { recursive: true })
      fs.appendFileSync(path.join(LOGS_DIR, `${dateStamp()}.log`), JSON.stringify(entry) + '\n')
      pruneOldLogFiles()
    } catch (e) {
      console.error('[logger] فشل الكتابة لملف السجل:', e)
    }
  } else {
    console.log(`${CONSOLE_COLOR[level]}[${level.toUpperCase()}]${RESET} ${entry.timestamp} ${meta.path ?? ''} ${message}`, meta)
  }
}

export const logger = {
  info:  (message: string, meta: LogMeta = {}) => send('info', message, meta),
  warn:  (message: string, meta: LogMeta = {}) => send('warn', message, meta),
  error: (message: string, meta: LogMeta = {}) => send('error', message, meta),
  // عمليات مالية بطيئة (> 2000ms) — level warn دائماً، kind: 'performance' يميّزها بملفات السجل لصفحة المراقبة
  performance: (message: string, meta: LogMeta & { durationMs: number }) =>
    send('warn', message, { ...meta, kind: 'performance' }),
}

/**
 * تُستدعى من كل catch بمسارات API الحساسة. تسجّل بملف/console عبر logger.error، وتحفظ صفاً بجدول ErrorLog
 * للعرض بصفحة سجل الأخطاء. best-effort بالكامل — فشلها (سواء بقراءة التوكن أو الكتابة لقاعدة البيانات)
 * لا يجب أن يُفشل استجابة الـ route الأصلية أبداً. لا تُسجَّل أجساد الطلبات ولا كلمات المرور.
 */
export async function logApiError(req: NextRequest, error: unknown): Promise<void> {
  try {
    const isZod = error instanceof ZodError
    const e = error as (Error & { status?: number }) | null
    const statusCode = isZod ? 422 : (e?.status ?? 500)
    const message = isZod ? (error as ZodError).errors[0]?.message ?? 'خطأ تحقق' : (e?.message || 'خطأ غير معروف')
    const type = isZod ? 'ZodValidation' : (e?.name || 'Error')
    const stackTrace = isZod ? null : (e?.stack ?? null)
    const apiRoute = req.nextUrl.pathname
    const method = req.method
    const userAgent = req.headers.get('user-agent')
    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null
    const requestId = randomUUID()

    let storeId: string | null = null
    let userId: string | null = null
    try {
      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: 'store.session-token' })
      if (token) {
        storeId = (token.storeId as string) ?? null
        userId  = (token.id as string) ?? null
      }
    } catch {
      // تعذّر قراءة التوكن — نكمل بلا storeId/userId
    }

    logger.error(message, { path: apiRoute, method, statusCode, storeId, requestId })

    await prisma.errorLog.create({
      data: { type, message, stackTrace, apiRoute, method, statusCode, storeId, userId, userAgent, ip },
    })
  } catch (e) {
    console.error('[logApiError] فشل تسجيل الخطأ:', e)
  }
}

type SlowOperation = { message: string; path?: string; storeId?: string | null; durationMs: number; timestamp: string }

/**
 * أبطأ العمليات المسجَّلة عبر logger.performance — تُقرأ من ملفات السجل (اليوم + أمس فقط).
 * لا تعمل بالتطوير (لا كتابة ملفات إلا بالإنتاج) — تُعيد مصفوفة فارغة حينها، وهذا صحيح: لا بيانات فعلية لعرضها.
 */
export function getSlowestOperations(limit = 5): SlowOperation[] {
  if (!fs.existsSync(LOGS_DIR)) return []

  const files = [dateStamp(), dateStamp(new Date(Date.now() - 24 * 60 * 60 * 1000))]
    .map(d => path.join(LOGS_DIR, `${d}.log`))
    .filter(f => fs.existsSync(f))

  const ops: SlowOperation[] = []
  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        const entry = JSON.parse(line)
        if (entry.kind === 'performance' && typeof entry.durationMs === 'number') ops.push(entry)
      } catch {
        // سطر تالف — يُتجاهل
      }
    }
  }

  return ops.sort((a, b) => b.durationMs - a.durationMs).slice(0, limit)
}
