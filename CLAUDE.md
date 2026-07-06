# نظام كاشير

نظام كاشير SaaS متعدد المتاجر (multi-tenant) مبني بـ Next.js 14 (App Router) + TypeScript + Prisma/SQLite.

## قواعد إلزامية

1. **نسخة احتياطية قبل أي `db:push`/`db:seed`/`db:reset`** — لا تُشغَّل هذه الأوامر بلا تأكد من وجود backup حديث (الأوامر نفسها تستدعي `db:backup` تلقائياً، لا تتجاوزها).
2. **لا بذر بيانات (seed) بلا طلب صريح من المستخدم.**
3. **جلسة عمل واحدة فقط بأي وقت** — لا تشغّل عمليات متوازية على نفس قاعدة البيانات.
4. **عند تعارض الكود مع التوثيق: توقف واسأل** — لا تفترض أيهما صحيح.
5. **لا تلمس كود الـ Legacy** (المذكور في `PROJECT_OVERVIEW.md`) ولا تبني عليه أو تفترض أنه مصدر الحقيقة.
6. **قبل أي عمل**: اقرأ `PROJECT_OVERVIEW.md` (المرجع المعماري الوحيد) ثم `PROJECT_AUDIT_REPORT.md` (حالة الفحص والبنود). **بنهاية كل جلسة**: حدّث `PROJECT_OVERVIEW.md` بأي تغيير معماري، و`PROJECT_AUDIT_REPORT.md` بحالة البنود المنجزة.

## بيانات الدخول التجريبية
| الدور | البريد | كلمة المرور | رابط الدخول |
|-------|--------|-------------|--------------|
| SuperAdmin | admin@platform.com | Admin@2024 | /super-admin/login |
| مدير المتجر | manager@alamal.com | Manager@2024 | /alamal/login |
| كاشير 1 | cashier1@alamal.com | Cashier@2024 | /alamal/login |
| كاشير 2 | cashier2@alamal.com | Cashier@2024 | /alamal/login |

## أوامر npm
```
dev, build, start, lint
db:generate   → prisma generate
db:push       → prisma db push (يستدعي db:backup تلقائياً أولاً)
db:seed       → ts-node prisma/seed.ts (يستدعي db:backup تلقائياً أولاً)
db:studio     → prisma studio
db:reset      → prisma migrate reset --force (يستدعي db:backup تلقائياً أولاً)
db:backup     → scripts/db-backup.ts (نسخ احتياطي فوري لملف SQLite)
db:restore    → scripts/db-restore.ts (استرجاع من نسخة محفوظة)
```
## ⛔ قواعد إلزامية لأي جلسة AI

0. **قبل أي عمل: اقرأ PROJECT_OVERVIEW.md (المرجع المعماري الوحيد) 
   ثم PROJECT_AUDIT_REPORT.md (حالة الفحص والبنود) بالكامل.**
   بنهاية كل جلسة: حدّث PROJECT_OVERVIEW.md بأي تغيير معماري 
   وPROJECT_AUDIT_REPORT.md بحالة البنود.