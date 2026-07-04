import { createBackup } from '../lib/backup'

try {
  const backupPath = createBackup()
  console.log(`✅ تم إنشاء نسخة احتياطية: ${backupPath}`)
} catch (err) {
  console.error('❌ فشل إنشاء النسخة الاحتياطية:', err instanceof Error ? err.message : err)
  process.exit(1)
}
