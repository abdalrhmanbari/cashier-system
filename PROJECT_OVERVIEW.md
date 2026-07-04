# نظام كاشير — نظرة عامة على المشروع

> تم توليد هذا الملف تلقائياً بتاريخ 2026-07-01 عبر فحص الكود الفعلي، وحُدِّث بتاريخ 2026-07-04 (إدارة اشتراكات المتاجر + توثيق نظام الصيانة/الحجب الذي كان ناقصاً). حدّثه عند إجراء تغييرات معمارية كبيرة.

نظام كاشير SaaS متعدد المتاجر (multi-tenant) مبني بـ Next.js 14 (App Router) + TypeScript.

## التقنيات
- Next.js 14.2 (App Router) + TypeScript strict + React 18
- Prisma 5 + SQLite (لا يزال — لم ينتقل لـ Postgres رغم أن `.env.example` يلمّح لذلك مستقبلاً)
- NextAuth v5 beta (Credentials + JWT يدوي) — نسختان منفصلتان بالكامل (متجر / سوبر أدمن)
- Zustand موجود كتبعية لكنه **غير مستخدم فعلياً** (انظر قسم الكود القديم)
- Tailwind CSS 4 + shadcn/ui (RTL) + Radix UI
- react-hook-form + zod
- dexie (IndexedDB) + next-pwa — دعم أوفلاين/PWA
- @zxing/library — قراءة الباركود بالكاميرا
- recharts — الرسوم البيانية في صفحة التقارير
- react-to-print + `lib/print/receipt.ts` — طباعة فاتورة حرارية 80mm

## هيكل الأدوار

```
SUPER_ADMIN         ← /super-admin/*
STORE_MANAGER       ← /[slug]/* (إدارة كاملة)
CASHIER             ← /[slug]/pos + /[slug]/shifts فقط
```

قيود الكاشير في `middleware.ts`:
```js
CASHIER_BLOCKED = ['/products', '/inventory', '/suppliers', '/customers', '/reports', '/settings']
```
ملاحظة: `/expenses` غير مذكورة صراحة في هذه القائمة (غائبة من قائمة تنقّل الكاشير، لكن الوصول المباشر بالرابط قد لا يُمنع على مستوى الـ middleware).

## بيانات الدخول التجريبية
| الدور | البريد | كلمة المرور | رابط الدخول |
|-------|--------|-------------|--------------|
| SuperAdmin | admin@platform.com | Admin@2024 | /super-admin/login |
| مدير المتجر | manager@alamal.com | Manager@2024 | /alamal/login |
| كاشير 1 | cashier1@alamal.com | Cashier@2024 | /alamal/login |
| كاشير 2 | cashier2@alamal.com | Cashier@2024 | /alamal/login |

## أوامر التشغيل

### أول مرة (إعداد قاعدة البيانات)
```bash
npm run db:push     # إنشاء الجداول في SQLite
npm run db:seed     # زرع البيانات التجريبية
npm run dev         # http://localhost:3000
```

### أوامر npm الكاملة
```
dev, build, start, lint
db:generate   → prisma generate
db:push       → prisma db push
db:seed       → ts-node prisma/seed.ts
db:studio     → prisma studio
db:reset      → prisma migrate reset --force
```

## قاعدة البيانات (prisma/schema.prisma)

SQLite بدون enums حقيقية (كل الحقول String مع تعليق يوضح القيم الممكنة). 23 موديل.

**الأساسية:** SuperAdmin, PlatformSetting, StoreType, Plan, PlanPrice, Store, Subscription, SubscriptionPayment, SubscriptionRenewal, Branch, StoreUser, Product, Category, Sale, SaleItem, SaleReturn, SaleReturnItem, Payment, Shift, AuditLog, LoginAttempt.

`PlatformSetting` — صف وحيد (`id: "singleton"`) لصيانة المنصة كاملة (كل المتاجر معاً)، منفصل عن `Store.maintenanceMode` (صيانة متجر واحد). انظر قسم "الصيانة والحجب" أدناه.

**أُضيفت لاحقاً (بحلول 2026-07-01):**
- `Customer` + `CustomerPayment` — العملاء ورصيدهم الآجل
- `Supplier` + `SupplierInvoice` + `SupplierInvoiceItem` + `SupplierPayment` — الموردون وفواتيرهم
- `Expense` — مصاريف (رواتب/سُلف/مصاريف محل)
- `InventoryMovement` — موجود في الـ schema لكن **بلا API أو صفحة فعلية بعد**

## خريطة الصفحات (app/)

### `app/super-admin/(dashboard)/*`
- `page.tsx` — لوحة رئيسية (إحصائيات)
- `stores/page.tsx`, `stores/new/page.tsx`, `stores/[id]/edit/page.tsx` — إدارة المتاجر
- `stores/[id]/subscription/page.tsx` — **(جديد 2026-07-04)** إدارة اشتراك متجر واحد: بطاقة تفاصيل (الحالة/`endDate`/دورة الفوترة/عدد الفروع/السعر)، تجديد (dialog)، تسجيل دفعة، سجلا الدفعات والتجديدات. رابط الوصول من زر "إدارة الاشتراك" بقائمة المتاجر وبصفحة تعديل المتجر.
- `subscriptions/page.tsx` — إدارة الاشتراكات (قائمة كل المتاجر، فلترة بالحالة، تغيير الحالة يدوياً). عند كل تحميل، الـ API يصحّح تلقائياً أي اشتراك `ACTIVE` تجاوز `endDate` إلى `EXPIRED` (مزامنة بلا cron — انظر أدناه)
- `plans/page.tsx` — الخطط والأسعار
- `store-types/page.tsx` — أنواع المتاجر
- `users/page.tsx` — تبويبات: مستخدمو المتاجر + مدراء النظام
- `maintenance/page.tsx` — صيانة المنصة العامة (كل المتاجر معاً)، منفصلة عن صيانة متجر واحد

### `app/[slug]/(store)/*`
- `pos/page.tsx` — نقطة البيع (سلة، باركود، دفع كاش/آجل)
- `products/page.tsx` — CRUD المنتجات والفئات
- `customers/page.tsx`, `customers/[id]/page.tsx` — العملاء
- `suppliers/page.tsx`, `suppliers/[id]/page.tsx`, `suppliers/[id]/edit/page.tsx`, `suppliers/new/page.tsx` — الموردون
- `expenses/page.tsx` — المصاريف
- `reports/page.tsx` — التقارير (رسوم بيانية بـ recharts)
- `shifts/page.tsx` — الورديات
- `settings/page.tsx` — الفروع + المستخدمون
- ⚠️ `inventory/` مجلد فارغ (لا صفحة ولا API بعد)

### `app/[slug]/*` (صفحات حالة عامة — خارج مجموعة `(store)`، بلا تسجيل دخول مطلوب)
- `login/page.tsx` — تسجيل دخول المتجر
- `expired/page.tsx` — تُعرض عند انتهاء الاشتراك (`status === 'EXPIRED'` أو `ACTIVE` مع `endDate` بالماضي)
- `suspended/page.tsx` — تُعرض عند `Store.isActive === false`، أو عدم وجود اشتراك أصلاً، أو `Subscription.status` = `SUSPENDED`/`CANCELLED`
- `maintenance/page.tsx` — صيانة (صيانة المنصة العامة أو صيانة هذا المتجر تحديداً — الرسالة تُفرَّق بينهما)
- `store-not-found/page.tsx` — الـ slug بالرابط لا يطابق أي متجر
- `forbidden/page.tsx` — الكاشير حاول الوصول لمسار غير مسموح له

## API

### النظام الفعلي الوحيد: `app/api/store/*` (session-based عبر `requireStore()`/`requireManager()`)
branches, categories(+[id]), customers(+[id]), expenses(+[id]), products(+[id]), reports, sales, shifts(+[id]), supplier-invoices(+[id]/pay), suppliers(+[id], +[id]/pay), users

> ⚠️ `app/api/[slug]/*` (products, sales, shifts) هي **مجلدات فارغة بالكامل** — بقايا محاولة أولى مهجورة. لا تستخدمها ولا تفترض وجود منطق بها.

### `app/api/super-admin/*`
admins, store-types, stores(+[id], +[id]/branches(+[branchId]), +[id]/subscription(+/renew, +/payments)), subscriptions, plans(+[id], +[id]/prices(+[priceId])), users, maintenance — `analytics/` مجلد فارغ.

**اشتراك متجر واحد (جديد 2026-07-04):**
- `GET /api/super-admin/stores/[id]/subscription` — تفاصيل الاشتراك (يشمل `plan`, `payments[]`, `renewals[]`). يستدعي مزامنة الحالة تلقائياً (`lib/subscription.ts:syncExpiredStatus`).
- `POST /api/super-admin/stores/[id]/subscription/renew` — تجديد بخطوة واحدة داخل transaction: يمدد `endDate` (من `endDate` الحالي إن كان بالمستقبل، أو من الآن إن منتهياً)، يسجّل `SubscriptionRenewal`، يعيد `status` إلى `ACTIVE` دائماً. المدة حسب `billingCycle` (`MONTHLY`=30 يوم، `YEARLY`=365) أو `customDays` مخصصة. `priceUsd` قابل للتجاوز اختيارياً.
- `GET`/`POST /api/super-admin/stores/[id]/subscription/payments` — سجل/تسجيل `SubscriptionPayment` (المبلغ `amountUsd` بالسنتات).
- `GET /api/super-admin/subscriptions` — عند كل استدعاء يصحّح أولاً أي اشتراك `ACTIVE` تجاوز `endDate` إلى `EXPIRED` (`updateMany` مباشر، بلا cron).

### `app/api/internal/maintenance-status/route.ts`
نداء داخلي خفيف يقرأه الـ `middleware.ts` (Edge runtime، لا يصل SQLite مباشرة) ليعرف حالة الصيانة العامة وحالة صيانة المتجر معاً؛ النتيجة تُخزَّن بذاكرة محلية قصيرة الأمد (12 ثانية) لتفادي استعلام قاعدة بيانات مع كل طلب.

### Auth routes
- `app/api/store-auth/[...nextauth]/route.ts` — مصادقة المتجر الفعلية
- `app/api/super-admin-auth/[...nextauth]/route.ts` — مصادقة السوبر أدمن الفعلية
- `app/api/auth/[...nextauth]/route.ts` — متوقف فعلياً (يرجع 404)

## الصيانة والحجب (اشتراك / صيانة عامة / صيانة متجر)

ثلاث طبقات حجب منفصلة تتحقق منها نقطتان مختلفتان بالكود:

1. **انتهاء/تعليق الاشتراك** — يُفحص **حياً عند كل تحميل صفحة** داخل `app/[slug]/(store)/layout.tsx` (Server Component، لا تخزين مؤقت، استعلام Prisma مباشر):
   ```ts
   const expired = sub.status === 'EXPIRED' || (sub.status === 'ACTIVE' && sub.endDate < new Date())
   if (sub.status === 'SUSPENDED' || sub.status === 'CANCELLED') redirect(`/${slug}/suspended`)
   if (expired) redirect(`/${slug}/expired`)
   ```
   لا يوجد cron يقلب الحالة تلقائياً؛ الحجب نفسه لا يعتمد على حقل `status` المخزَّن فقط بل يحسب الانتهاء الفعلي من `endDate` كل مرة. أما تصحيح حقل `status` المخزَّن (لتصير الفلترة بصفحة `/super-admin/subscriptions` صادقة) فيحدث بمزامنة بلا cron: أي اشتراك `ACTIVE` تجاوز `endDate` يُحوَّل إلى `EXPIRED` في قاعدة البيانات عند كل تحميل لقائمة الاشتراكات أو صفحة اشتراك متجر واحد (`lib/subscription.ts`).
2. **صيانة متجر واحد** (`Store.maintenanceMode`) — تبديل يدوي من صفحة تعديل المتجر، مستقل تماماً عن الاشتراك، يوجّه إلى `/[slug]/maintenance`.
3. **صيانة المنصة العامة** (`PlatformSetting`, صف `singleton`) — توقف كل المتاجر معاً دفعة واحدة من `/super-admin/maintenance`. يُطبَّق في مكانين: `middleware.ts` (Edge runtime، عبر نداء داخلي مخفَّف ومخزَّن مؤقتاً 12 ثانية بـ `/api/internal/maintenance-status` لتفادي استعلام DB على كل طلب) و`layout.tsx` (Server Component). له مهلة سماح (`maintenanceGraceMinutes`) تسمح للجلسات النشطة بالاستمرار حتى `maintenanceActivatedAt + graceMinutes`، بينما الجلسات الجديدة تُمنع فوراً.

صفحات الحالة الناتجة: `/[slug]/expired`، `/[slug]/suspended`، `/[slug]/maintenance`، `/[slug]/store-not-found`، `/[slug]/forbidden` — كلها مستثناة من فحوصات الحجب في `middleware.ts` لتفادي حلقة تحويل لا نهائية.

**إشعار انتهاء الاشتراك:** `lib/notifications.ts:checkSubscriptionExpiring(storeId, sub)` — يُطلق إشعار `SUBSCRIPTION_EXPIRING` (منفّذ فعلاً، ليس مجرد تعليق بالسكيما) عندما `status === 'ACTIVE'` والوقت المتبقي بين 0 و7 أيام. يُستدعى من `layout.tsx` **فقط عند دخول STORE_MANAGER** (لا يوجد حالياً تنبيه مماثل للسوبر أدمن نفسه عبر كل المتاجر — خارج نطاق الجلسة الحالية).

## كود قديم/ميت (Legacy)

بقايا محاولة معمارية أولى (Zustand + مكوّنات منفصلة) تم التخلي عنها لصالح "كل شيء داخل page.tsx مع useState محلي". **لا تبني عليها ولا تفترض أنها مصدر الحقيقة:**
- `store/` بالكامل (authStore.ts, cartStore.ts, shiftStore.ts)
- `components/pos/*` (Cart, ProductGrid, PaymentModal, BarcodeScanner, Receipt)
- `components/shifts/*` (OpenShiftModal, CloseShiftModal)
- `components/shared/Header.tsx`, `OfflineIndicator.tsx`, `PrintButton.tsx`
- `components/super-admin/NewStoreModal.tsx`
- `hooks/useBarcode.ts`, `hooks/usePrint.ts`, `hooks/useShift.ts`

## ملاحظات مهمة
- الأسعار بالسنتات (integer) لتجنب float precision
- `expectedCash` مخفي عن الكاشير حتى إغلاق الوردية
- كل layout يستخدم ClientWrapper → SessionProvider بدل تكرارها بكل صفحة
- POS يدعم Barcode scanning عبر keyboard event listener (rapid input)
- الصفحات الجديدة (customers/suppliers/expenses/reports) لا تفصل مكوّنات UI — كل شيء inline داخل page.tsx، معتمداً على `DataTable` و`StInput/StSelect` المشتركة فقط
