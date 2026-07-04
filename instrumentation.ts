const SIX_HOURS_MS = 6 * 60 * 60 * 1000

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const g = globalThis as unknown as { __dbBackupIntervalStarted?: boolean }
  if (g.__dbBackupIntervalStarted) return
  g.__dbBackupIntervalStarted = true

  const { createBackup } = await import('./lib/backup')

  const runBackup = () => {
    try {
      const backupPath = createBackup()
      console.log(`[periodic-backup] تم إنشاء نسخة احتياطية: ${backupPath}`)
    } catch (err) {
      console.error('[periodic-backup] فشل إنشاء النسخة الاحتياطية (لن يؤثر على تشغيل السيرفر):', err)
    }
  }

  runBackup()
  setInterval(runBackup, SIX_HOURS_MS)
}
