import fs from 'fs'
import path from 'path'

const DB_DIR = path.join(process.cwd(), 'prisma')
const DB_NAME = 'dev.db'
const BACKUPS_DIR = path.join(DB_DIR, 'backups')
const MAX_BACKUPS = 20

function timestamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

function copyIfExists(src: string, dest: string) {
  if (fs.existsSync(src)) fs.copyFileSync(src, dest)
}

function removeIfExists(target: string) {
  if (fs.existsSync(target)) fs.rmSync(target, { force: true })
}

function pruneOldBackups() {
  const files = fs
    .readdirSync(BACKUPS_DIR)
    .filter((f) => /^dev\..*\.db$/.test(f))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(BACKUPS_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)

  for (const f of files.slice(MAX_BACKUPS)) {
    const base = path.join(BACKUPS_DIR, f.name)
    removeIfExists(base)
    removeIfExists(`${base}-wal`)
    removeIfExists(`${base}-shm`)
  }
}

// label يميّز نسخة استثنائية (مثل prerestore) عن النسخ الدورية العادية بنفس الاسم الأساسي dev.<timestamp>.db
export function createBackup(label?: string): string {
  const dbPath = path.join(DB_DIR, DB_NAME)
  if (!fs.existsSync(dbPath)) {
    throw new Error(`قاعدة البيانات غير موجودة: ${dbPath}`)
  }

  fs.mkdirSync(BACKUPS_DIR, { recursive: true })

  const suffix = label ? `_${label}` : ''
  const backupName = `dev.${timestamp()}${suffix}.db`
  const backupPath = path.join(BACKUPS_DIR, backupName)

  fs.copyFileSync(dbPath, backupPath)
  copyIfExists(`${dbPath}-wal`, `${backupPath}-wal`)
  copyIfExists(`${dbPath}-shm`, `${backupPath}-shm`)

  pruneOldBackups()

  return backupPath
}

export function listBackups(): string[] {
  if (!fs.existsSync(BACKUPS_DIR)) return []
  return fs
    .readdirSync(BACKUPS_DIR)
    .filter((f) => /^dev\..*\.db$/.test(f))
    .sort()
    .reverse()
}

// يأخذ نسخة pre-restore تلقائية من الحالة الحالية قبل الاستبدال، ويزيل أي -wal/-shm قديمة لا تطابق النسخة المستعادة حتى لا تتعارض مع الملف الجديد
export function restoreBackup(nameOrTimestamp: string): string {
  if (!fs.existsSync(BACKUPS_DIR)) {
    throw new Error('لا يوجد مجلد نسخ احتياطية بعد')
  }

  let backupName = nameOrTimestamp
  if (!fs.existsSync(path.join(BACKUPS_DIR, backupName))) {
    backupName = `dev.${nameOrTimestamp}.db`
  }

  const backupPath = path.join(BACKUPS_DIR, backupName)
  if (!fs.existsSync(backupPath)) {
    throw new Error(
      `النسخة الاحتياطية غير موجودة: ${nameOrTimestamp}\nالنسخ المتاحة:\n${listBackups()
        .map((b) => `  - ${b}`)
        .join('\n') || '  (لا توجد نسخ)'}`
    )
  }

  createBackup('prerestore')

  const dbPath = path.join(DB_DIR, DB_NAME)
  fs.copyFileSync(backupPath, dbPath)

  if (fs.existsSync(`${backupPath}-wal`)) {
    fs.copyFileSync(`${backupPath}-wal`, `${dbPath}-wal`)
  } else {
    removeIfExists(`${dbPath}-wal`)
  }

  if (fs.existsSync(`${backupPath}-shm`)) {
    fs.copyFileSync(`${backupPath}-shm`, `${dbPath}-shm`)
  } else {
    removeIfExists(`${dbPath}-shm`)
  }

  return backupPath
}
