import { restoreBackup, listBackups } from '../lib/backup'

const arg = process.argv[2]

if (!arg) {
  console.log('الاستخدام: npm run db:restore -- <اسم ملف النسخة أو الطابع الزمني>')
  const backups = listBackups()
  console.log(backups.length ? 'النسخ المتاحة:' : 'لا توجد نسخ احتياطية بعد.')
  backups.forEach((b) => console.log(`  - ${b}`))
  process.exit(1)
}

try {
  const restoredFrom = restoreBackup(arg)
  console.log(`✅ تمت استعادة قاعدة البيانات من: ${restoredFrom}`)
  console.log('ℹ️  تم أخذ نسخة احتياطية تلقائية من الحالة السابقة قبل الاستبدال (dev.*_prerestore.db)')
} catch (err) {
  console.error('❌ فشلت الاستعادة:', err instanceof Error ? err.message : err)
  process.exit(1)
}
