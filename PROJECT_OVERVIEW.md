# نظام كاشير — نظرة عامة على المشروع

> تم توليد هذا الملف تلقائياً بتاريخ 2026-07-01 عبر فحص الكود الفعلي، وحُدِّث بتاريخ 2026-07-04 (إدارة اشتراكات المتاجر + توثيق نظام الصيانة/الحجب)، ثم **حُدِّث بالكامل بتاريخ 2026-07-05** ليطابق الواقع الفعلي حسب `PROJECT_AUDIT_REPORT.md` (فحص شامل بتاريخ 2026-07-04). حدّثه عند إجراء تغييرات معمارية كبيرة.

نظام كاشير SaaS متعدد المتاجر (multi-tenant) مبني بـ Next.js 14 (App Router) + TypeScript.

## التقنيات
- Next.js 14.2 (App Router) + TypeScript strict + React 18
- Prisma 5 + SQLite (لا يزال — لم ينتقل لـ Postgres رغم أن `.env.example` يلمّح لذلك مستقبلاً)
- NextAuth v5 beta (Credentials + JWT يدوي) — نسختان منفصلتان بالكامل (متجر / سوبر أدمن)
- Zustand موجود كتبعية لكنه **غير مستخدم فعلياً** (كود ميت بالكامل، انظر قسم الكود القديم — مرشَّح للحذف من `package.json`)
- Tailwind CSS 4 + shadcn/ui (RTL) + Radix UI
- react-hook-form + zod
- dexie (IndexedDB) + next-pwa — **مثبَّتان لكن غير موصولين فعلياً** (`lib/db/offline.ts`/`lib/db/sync.ts` كود ميت كامل غير مستورَد من أي مكان بالتطبيق الحي — انظر قسم "الأوفلاين" أدناه). المؤشر المرئي للاتصال (`ConnectionIndicator`/`ConnectionToast`) حيّ ومنفصل تماماً عن أي طابور مزامنة حقيقي.
- @zxing/library — **مثبَّتة كتبعية لكن غير مستخدمة إطلاقاً** (صفر استيراد بكل الكود). الباركود الفعلي هو كيبورد (rapid keydown) فقط بـ `pos/page.tsx`
- recharts — الرسوم البيانية في صفحة التقارير
- react-to-print + `lib/print/receipt.ts` — طباعة فاتورة حرارية 80mm (موصولة فعلياً بـ `pos/page.tsx`)

## هيكل الأدوار

```
SUPER_ADMIN         ← /super-admin/*
STORE_MANAGER       ← /[slug]/* (إدارة كاملة)
CASHIER             ← /[slug]/pos + /[slug]/shifts + /[slug]/returns فقط
```

### حماية الكاشير — طبقتان في `middleware.ts`

1. **قائمة سماح للصفحات (`CASHIER_ALLOWED`)** — سطر 11: `['pos', 'shifts', 'returns']`. هذه **قائمة سماح (allowlist)**، وليست قائمة حظر (`CASHIER_BLOCKED`) كما كان موثَّقاً سابقاً — تغيير معماري كامل بمنطق الحماية. أي segment آخر تحت `/[slug]/*` لدور CASHIER يُعاد توجيهه لـ `/forbidden` (سطر 216-217). `/expenses` محجوبة فعلياً الآن ضمن هذا التصميم (لم تعد ثغرة).
2. **قائمة سماح لـ API (`CASHIER_API_RULES` + `cashierApiAllowed()`)** — سطر 20-35، **[أُضيفت 2026-07-04]**. طبقة دفاع ثانية على `/api/store/*` تحديداً لدور CASHIER: allowlist صريحة بالمسار والـ method (مستخرَجة من فحص فعلي لكل نداءات `fetch()` بصفحات pos/shifts/returns والمكوّنات المشتركة) — `products`/`categories`/`customers/lookup`/`settings`/`exchange-rate` (GET فقط), `ping`, `shifts` (GET+POST), `shifts/[id]` (PATCH فقط), `sales` (GET+POST), `returns` (GET+POST). أي مسار/method آخر لدور CASHIER يرد 403 JSON مباشرة من middleware **قبل** الوصول لأي `route.ts`. هذه طبقة إضافية فوق `requireManager()` الموجود داخل كل route (لم يُمس ولم يُخفَّف).

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
db:push       → prisma db push (يستدعي db:backup تلقائياً أولاً)
db:seed       → ts-node prisma/seed.ts (يستدعي db:backup تلقائياً أولاً)
db:studio     → prisma studio
db:reset      → prisma migrate reset --force (يستدعي db:backup تلقائياً أولاً)
db:backup     → scripts/db-backup.ts (نسخ احتياطي فوري لملف SQLite)
db:restore    → scripts/db-restore.ts (استرجاع من نسخة محفوظة)
```

> ⚠️ المنفذ 3000 قد يكون مشغولاً بتطبيق آخر غير هذا المشروع على هذا الجهاز (لوحظ تطبيق آخر باسم مختلف تماماً يستخدمه فعلياً) — إن ظهرت رسالة "Port 3000 is in use"، يعمل `next dev` تلقائياً على المنفذ 3001 بدلاً منه؛ تحقق من رسالة الطرفية لمعرفة المنفذ الفعلي قبل تصفح `localhost`.

## قاعدة البيانات (prisma/schema.prisma)

SQLite بدون enums حقيقية (كل الحقول String مع تعليق يوضح القيم الممكنة). **31 موديل** (وليس 23 كما وثّقت نسخ سابقة من هذا الملف — الرقم 23 كان صحيحاً بمرحلة أقدم من المشروع فقط).

**الأساسية:** SuperAdmin, PlatformSetting, StoreType, Plan, PlanPrice, Store, ExchangeRate, Subscription, SubscriptionPayment, SubscriptionRenewal, Branch, StoreUser, Product, Category, Sale, SaleItem, SaleReturn, SaleReturnItem, Payment, Shift, AuditLog, Notification, LoginAttempt.

`PlatformSetting` — صف وحيد (`id: "singleton"`) لصيانة المنصة كاملة (كل المتاجر معاً)، منفصل عن `Store.maintenanceMode` (صيانة متجر واحد). انظر قسم "الصيانة والحجب" أدناه.

`ExchangeRate` — سجل تاريخي لسعر الصرف، يُقرأ (وليس يُحسب لحظياً) بكل عملية بيع/مصروف/مرتجع عبر القيمة المجمَّدة على كل `Sale`/`Expense`/`SaleReturn` وقت إنشائها.

**أُضيفت لاحقاً (بحلول 2026-07-04):**
- `Customer` + `CustomerPayment` — العملاء ورصيدهم الآجل (USD)
- `Supplier` + `SupplierInvoice` + `SupplierInvoiceItem` + `SupplierPayment` — الموردون وفواتيرهم (USD)
- `Expense` — مصاريف (رواتب/سُلف/مصاريف محل)
- `InventoryMovement` — **مبني بالكامل** (وليس "بلا API أو صفحة فعلية" كما وثّقت نسخ سابقة). أنواع الحركة: SALE/SALE_RETURN/PURCHASE/ADJUSTMENT/DAMAGE. له API كامل (`store/inventory`) وصفحة فعلية (`inventory/page.tsx`)
- `Notification` — نظام إشعارات (10 أنواع، انظر قسم "الإشعارات" أدناه)
- `ErrorLog` — **[أُضيف 2026-07-04]** سجل أخطاء مربوط بكل catch في مسارات sales/returns/shifts/customers/suppliers/expenses/settings/exchange-rate، يغذّي صفحات `super-admin/system/*`

**موديل محذوف بالكامل:** `Currency` وحقل `Store.currencyId` — حُذفا 2026-07-04، لا يوجد أي أثر متبقٍ لهما بالكود الحالي.

## سجل التدقيق (AuditLog)

`lib/audit.ts` → `logAudit()` مربوطة الآن (2026-07-05) بست نقاط حسّاسة، بمبدأ فشل صامت (try/catch لا يُفشل العملية الأصلية أبداً، الفشل يُسجَّل عبر `lib/logger.ts`):

1. تغيير سعر الصرف (`store/exchange-rate` POST)
2. تسديد ديون العملاء (`store/customers/[id]` PATCH — مسار `payment`)
3. تسوية الجرد ADJUSTMENT فقط (`store/inventory` POST) — لا يشمل DAMAGE عمداً
4. إنشاء/تعديل مستخدمي المتجر (`store/users` POST/PATCH) — بلا حذف (لا يوجد DELETE بهذا الـ route أصلاً)
5. إنشاء/تعديل حسابات السوبر أدمن (`super-admin/admins` POST/PATCH)
6. تعديل إعدادات المتجر: الضريبة/التقريب/pricingCurrency (`store/settings` PATCH)

⛔ لا تُسجَّل كلمات مرور أو hashes أبداً بأي سجل — فقط أسماء الحقول المتغيّرة عند تعديل مستخدم/سوبر أدمن.

✅ **[أُضيف 2026-07-05] `AuditLog.superAdminId`**: حقل اختياري (`String?`) بعلاقة اختيارية مع `SuperAdmin`، يُملأ الآن بكل نقاط التسجيل الست الخاصة بالسوبر أدمن (`super-admin/admins` POST/PATCH + الأربع القديمة: `subscription/payments`, `subscription/renew`, `stores/[id]` maintenance toggle, `super-admin/maintenance`) — بدل الاعتماد على الاسم/الإيميل داخل `newData` فقط كما كان سابقاً. الاسم/الإيميل ما زالا يُوثَّقان أيضاً بـ`newData` لأغراض العرض السريع. لا ترحيل للسجلات القديمة (تبقى `superAdminId: null` فيها، مقبول). الأربع نقاط القديمة كانت غير مغلَّفة أصلاً بـtry/catch صامت رغم استثنائها من الفحص الأول — غُلِّفت الآن بنفس نمط try/catch + `logger.error`.

**ملاحظة**: قبل هذا الربط، وُجد أن `lib/audit.ts` نفسه كان ميتاً بالكامل (صفر استدعاء)، بينما 4 نقاط أخرى بـ`super-admin/*` كانت تستدعي `prisma.auditLog.create` مباشرة (بدون المرور بـ`lib/audit.ts`) لتغطية تجديد/دفعات الاشتراك وصيانة المتجر/المنصة — لم تُمس هذه الأربعة.

## خريطة الصفحات (app/)

### `app/super-admin/(dashboard)/*`
- `page.tsx` — لوحة رئيسية (إحصائيات)
- `stores/page.tsx`, `stores/new/page.tsx`, `stores/[id]/edit/page.tsx` — إدارة المتاجر
- `stores/[id]/subscription/page.tsx` — إدارة اشتراك متجر واحد: بطاقة تفاصيل (الحالة/`endDate`/دورة الفوترة/عدد الفروع/السعر)، تجديد (dialog)، تسجيل دفعة، سجلا الدفعات والتجديدات. رابط الوصول من زر "إدارة الاشتراك" بقائمة المتاجر وبصفحة تعديل المتجر
- `subscriptions/page.tsx` — إدارة الاشتراكات (قائمة كل المتاجر، فلترة بالحالة، تغيير الحالة يدوياً). عند كل تحميل، الـ API يصحّح تلقائياً أي اشتراك `ACTIVE` تجاوز `endDate` إلى `EXPIRED` (مزامنة بلا cron — انظر أدناه)
- `plans/page.tsx` — الخطط والأسعار
- `store-types/page.tsx` — أنواع المتاجر
- `users/page.tsx` — تبويبات: مستخدمو المتاجر + مدراء النظام
- `maintenance/page.tsx` — صيانة المنصة العامة (كل المتاجر معاً)، منفصلة عن صيانة متجر واحد
- `system/monitoring/page.tsx`, `system/errors/page.tsx`, `system/health/page.tsx` — **[أُضيفت 2026-07-04]** وحدة المراقبة والتسجيل: صحة النظام، سجل الأخطاء (`ErrorLog`)، ولوحة مراقبة عامة

### `app/[slug]/(store)/*`
- `pos/page.tsx` — نقطة البيع (سلة، باركود كيبورد، دفع كاش/آجل) — كاشير + مدير
- `shifts/page.tsx` — الورديات — كاشير + مدير
- `returns/page.tsx` — المرتجعات — **صفحة منفصلة فعلية** (وليست API فقط كما وثّقت نسخ سابقة) — كاشير + مدير
- `products/page.tsx` — CRUD المنتجات والفئات — مدير فقط (محجوبة عن الكاشير)
- `customers/page.tsx`, `customers/[id]/page.tsx` — العملاء — مدير فقط
- `suppliers/page.tsx`, `suppliers/[id]/page.tsx`, `suppliers/[id]/edit/page.tsx`, `suppliers/new/page.tsx` — الموردون — مدير فقط
- `expenses/page.tsx` — المصاريف — مدير فقط
- `reports/page.tsx` — التقارير (رسوم بيانية بـ recharts + تصدير Excel فعلي عبر `lib/report-workbook.ts`) — مدير فقط
- `inventory/page.tsx` — **مبنية بالكامل** (وليست "مجلد فارغ" كما وثّقت نسخ سابقة) — مدير فقط
- `settings/page.tsx` — الفروع + المستخدمون + سعر الصرف + الضريبة + سقف الخصم لكل دور — مدير فقط

### `app/[slug]/*` (صفحات حالة عامة — خارج مجموعة `(store)`، بلا تسجيل دخول مطلوب)
- `login/page.tsx` — تسجيل دخول المتجر
- `expired/page.tsx` — تُعرض عند انتهاء الاشتراك (`status === 'EXPIRED'` أو `ACTIVE` مع `endDate` بالماضي)
- `suspended/page.tsx` — تُعرض عند `Store.isActive === false`، أو عدم وجود اشتراك أصلاً، أو `Subscription.status` = `SUSPENDED`/`CANCELLED`
- `maintenance/page.tsx` — صيانة (صيانة المنصة العامة أو صيانة هذا المتجر تحديداً — الرسالة تُفرَّق بينهما)
- `store-not-found/page.tsx` — الـ slug بالرابط لا يطابق أي متجر
- `forbidden/page.tsx` — الكاشير حاول الوصول لمسار غير مسموح له (يُستخدم فعلياً عند خرق `CASHIER_ALLOWED`)

## API

### النظام الفعلي الوحيد للمتجر: `app/api/store/*` (session-based عبر `requireStore()`/`requireManager()`)
branches, categories(+[id]), customers(+[id], +lookup), expenses(+[id]), exchange-rate, inventory, notifications(+[id]/read, +read-all), ping, products(+[id]), reports(+export), returns, sales, settings, shifts(+[id]), supplier-invoices(+[id]/pay), suppliers(+[id], +[id]/pay), users. **47 route بإجمالي المشروع.**

> ⚠️ `app/api/[slug]/*` (products/[id], sales, shifts/[id]/close) هي **مجلدات فارغة بالكامل** — بقايا محاولة أولى مهجورة. لا تستخدمها ولا تفترض وجود منطق بها.

### حماية `/api/store/*` — ملخص
| المجموعة | الحماية |
|---|---|
| `sales`, `returns`, `shifts`, `shifts/[id]`, `products`(GET), `categories`(GET), `customers/lookup`, `exchange-rate`(GET), `settings`(GET) | `requireStore` فقط — متعمَّد، الكاشير يحتاجها لعمل POS/الورديات/المرتجعات |
| `customers`, `suppliers`, `expenses`, `reports`(+export), `users`, `branches`(GET), `products`(POST/PATCH/DELETE), `categories`(POST/PATCH/DELETE), `inventory`, `notifications`, `supplier-invoices`(+pay), `settings`(PATCH), `exchange-rate`(POST) | `requireStore` + `requireManager` |

كل الـ `[id]` routes مقيَّدة فعلياً بـ `storeId: t.storeId` — **لا توجد ثغرة IDOR** مكتشفة بأي منها.

### `app/api/super-admin/*`
admins, store-types(+[id]), stores(+[id], +[id]/branches(+[branchId]), +[id]/subscription(+/renew, +/payments)), subscriptions, plans(+[id], +[id]/prices(+[priceId])), users, maintenance — `analytics/` مجلد فارغ. **16 route.**

⚠️ لا يوجد تمييز صلاحيات بين حسابات سوبر أدمن مختلفة (أي حساب يقدر يعدّل أي حساب آخر بما فيه كلمات المرور) — خطورة منخفضة، غياب مبدأ فصل الصلاحيات وليس ثغرة استغلال خارجي.

**اشتراك متجر واحد:**
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

### `app/api/health/route.ts`
**[أُضيف 2026-07-04]** فحص صحة عام (DB، حجم قاعدة البيانات، عمر آخر نسخة احتياطية) يغذّي `super-admin/system/health`.

## نظام العملة الثنائية (USD / SYP) — دليل تفصيلي

- **مبدأ التخزين**: كل مبلغ مالي مخزَّن كـ `Int` — دولار بالسنتات (`xUsdCents`)، ليرة سورية كعدد صحيح كامل (`xSyp`). لا توجد أي حقول مالية `Float` بالـ schema.
- **دوال التنسيق** (`lib/utils.ts`):
  - `formatUsd(cents)` → `$X.XX` (يقسم على 100 ويُظهر خانتين عشريتين).
  - `formatSyp(amount)` → `X,XXX ل.س` (عدد صحيح دائماً، بدون كسور، `toLocaleString('en-US')` للفواصل).
  - `usdCentsToSyp(cents, rate)` → تحويل دولار (سنتات) إلى ليرة صحيحة حسب سعر صرف مُمرَّر (`Math.round((cents/100) * rate)`).
  - `roundSyp(amount, rule)` → تقريب مبلغ الليرة حسب قاعدة اختيارية ("100"/"500"/"1000"، افتراضي 500).
  - `formatCurrency()` — **قديمة/ميتة**، لا تُستخدم بأي مسار حي (انظر قسم Legacy).
- **تسعير المنتج (`Product`)**:
  - `pricingCurrency` (على `Store`) — عملة إدخال أسعار المنتجات الجديدة حالياً ("USD" أو "SYP")، تُغيَّر من `settings/page.tsx`.
  - `Product.priceCurrency` — تُخزَّن *لحظة إنشاء/تعديل المنتج* حسب `pricingCurrency` الساري وقتها (snapshot لكل منتج على حدة، وليست تابعة لإعداد المتجر الحالي دوماً) — منتجات قديمة قد تبقى بعملة مختلفة عن منتجات جديدة إن غُيِّر الإعداد لاحقاً.
  - `hasDiscount`/`discountType`/`discountValue` — خصم تلقائي لكل منتج (نسبة أو مبلغ ثابت)، يُطبَّق أولاً في `calcFinalPriceInProductCurrency` قبل أي تحويل عملة.
- **سعر الصرف (`ExchangeRate`)**: سجل تاريخي (`store/exchange-rate`)، القيمة الحالية تُقرأ فقط لحظة إنشاء عملية جديدة (بيع/مصروف)، ثم تُجمَّد (`exchangeRate` snapshot) على `Sale`/`Expense`/`SaleReturn` نفسها — لا يُعاد حسابها لاحقاً مهما تغيّر سعر الصرف الحالي (انظر "المرتجعات" و"التقارير" أدناه).
- **لقطة الفاتورة (`SaleItem`)**: `unitPrice`/`total` بالليرة السورية بعد التحويل من عملة المنتج الأصلية، مع `priceCurrency` (عملة السعر الأصلي وقت البيع) محفوظة للتوثيق والعرض فقط في الفاتورة — لا تُستخدم لإعادة حساب.
- **الديون (`Customer.currentBalance`)**: بالدولار حصراً (سنتات)، منفصلة تماماً عن مبالغ الفواتير بالليرة — التسديد (`CustomerPayment`) يُخصَم من الرصيد الدولاري مباشرة، بلا أي تحويل عبر سعر صرف.
- **الموردون (`SupplierInvoice`/`SupplierPayment`)**: بالدولار (USD) كذلك، بنفس منطق الديون.
- **المصاريف (`Expense`)**: `amountUsdCents` و`exchangeRate` يُحسبان ويُجمَّدان لحظة التسجيل، لا يُعاد حسابهما لاحقاً.
- **الورديات (`Shift`)**: `expectedCash` يُحسب من مجموع `Payment.amount` الفعلية (بالليرة) ناقص المرتجع النقدي لنفس الوردية — لا علاقة مباشرة بسعر الصرف.
- **التقارير (`lib/report-data.ts`)**: تعتمد حصراً على الحقول المجمَّدة بكل `Sale` (`totalUsdCents`, `taxUsdCents`, `exchangeRate` الخاص بتلك الفاتورة تحديداً) — `usdRatio(sale) = sale.totalUsdCents / sale.totalSyp` نسبة مشتقة من حقول مجمَّدة، لا من سعر صرف حالي. `itemCostUsdCents` يحوّل `costPrice` عبر `sale.exchangeRate` الخاص بتلك الفاتورة، وليس سعراً موحّداً حالياً. **لا يوجد أي استعلام لـ `ExchangeRate` الحالي داخل التقارير** — التقارير التاريخية لا تتأثر أبداً بتغيّر سعر الصرف لاحقاً (سلوك صحيح ومطلوب لأي نظام محاسبي).

## المنطق المالي — نقاط رئيسية

- **ترتيب حساب الفاتورة** (`app/api/store/sales/route.ts`): خصم الصنف التلقائي ← تحويل العملة إلى SYP ← خصم الصنف اليدوي ← توزيع خصم الفاتورة الإجمالي نسبياً (`distributeProportionally`) → `netLineTotal` ← الضريبة تُحسب على الصافي بعد كل الخصومات وتُوزَّع نسبياً → التقريب يُطبَّق فقط على الإجمالي النهائي (`roundSyp`)، والفارق يُسجَّل صراحةً بـ `roundingDiffSyp`.
- **لا floats مخزَّنة**: كل الحقول المالية `Int` بالسنت/الليرة الصحيحة؛ `parseFloat`/`toFixed` تُستخدم فقط للعرض أو لتحويل إدخال نصي فوري إلى integer عبر `Math.round(... * 100)`.
- **المرتجعات تستخدم سعر صرف الفاتورة الأصلية** (`sale.exchangeRate` المجمَّد) — لا استعلام جديد على `ExchangeRate` الحالي.
- **التقارير تقرأ من الحقول المجمَّدة فقط** (`totalUsdCents`, `taxUsdCents`, `exchangeRate` بكل `Sale`) — لا تتأثر بتغيّر سعر الصرف لاحقاً.
- ✅ **[تم الحل 2026-07-04] تحقق سيرفر-سايد من الخصم**: `app/api/store/sales/route.ts` يرفض الآن (400) أي خصم صنف أو فاتورة يجعل الإجمالي سالباً، بالإضافة لطبقة `Math.max(0, ...)` احتياطية على `netAfterDiscount`/`totalBeforeRounding`. قبل هذا الإصلاح كان بالإمكان إنشاء فاتورة بإجمالي سالب فعلياً من الخادم (كانت أخطر نقطة اكتُشفت بالفحص الشامل).
- ✅ **[تم الحل 2026-07-05] سقف الخصم التجاري القابل للضبط لكل دور**: `Store.maxDiscountPercentCashier` / `Store.maxDiscountPercentManager` (`Int?`، نقاط أساس بنفس اصطلاح `taxRate`: 1500 = 15%، `null` = بلا سقف). بعد حساب `subtotalSyp`، يحسب `app/api/store/sales/route.ts` نسبة الخصم الإجمالية الفعلية (خصومات الأصناف اليدوية + خصم الفاتورة معاً) نسبةً إلى `subtotalSyp + totalItemDiscounts` (الإجمالي قبل أي خصم يدوي)، ويقارنها بسقف دور المستخدم الحالي (`t.role`) — تجاوز = رفض 400 برسالة عربية تذكر النسبتين. الحقلان يُعدَّلان من تبويب "سقف الخصم" بصفحة `settings` (مدير فقط)، وتنبيه UX بـ`pos/page.tsx` يعطّل زر تأكيد البيع محلياً عند تجاوز الكاشير سقفه (الفرض الحقيقي بالسيرفر فقط، وليس بالواجهة).
- ✅ **[تم الحل 2026-07-05] تقريب المرتجعات الجزئية المتكررة**: عند استرجاع دفعة تُكمل كامل الكمية المتبقية لسطر (`alreadyReturned + reqItem.quantity === saleItem.quantity`)، يحسب `app/api/store/returns/route.ts` `netRefund`/`taxRefund` كـ"المتبقي المالي بالضبط" (`netLineTotal`/`lineTax` ناقص مجموع ما استُرجع فعلياً بالدفعات السابقة لنفس `SaleItem`) بدل الحساب النسبي — يضمن أن مجموع كل الاسترجاعات الجزئية لنفس السطر = `netLineTotal + lineTax` بالضبط مهما تعددت الدفعات. الدفعات غير الأخيرة ما زالت تستخدم الحساب النسبي القديم بلا تغيير.

## الصيانة والحجب (اشتراك / صيانة عامة / صيانة متجر)

ثلاث طبقات حجب منفصلة تتحقق منها نقطتان مختلفتان بالكود:

1. **انتهاء/تعليق الاشتراك** — يُفحص **حياً عند كل تحميل صفحة** داخل `app/[slug]/(store)/layout.tsx` (Server Component، لا تخزين مؤقت، استعلام Prisma مباشر):
   ```ts
   const expired = sub.status === 'EXPIRED' || (sub.status === 'ACTIVE' && sub.endDate < new Date())
   if (sub.status === 'SUSPENDED' || sub.status === 'CANCELLED') redirect(`/${slug}/suspended`)
   if (expired) redirect(`/${slug}/expired`)
   ```
   لا يوجد cron يقلب الحالة تلقائياً؛ الحجب نفسه لا يعتمد على حقل `status` المخزَّن فقط بل يحسب الانتهاء الفعلي من `endDate` كل مرة. أما تصحيح حقل `status` المخزَّن (لتصير الفلترة بصفحة `/super-admin/subscriptions` صادقة) فيحدث بمزامنة بلا cron: أي اشتراك `ACTIVE` تجاوز `endDate` يُحوَّل إلى `EXPIRED` في قاعدة البيانات عند كل تحميل لقائمة الاشتراكات أو صفحة اشتراك متجر واحد أو أي نداء لـ `requireStore()` (`lib/subscription.ts:syncExpiredStatus`).

   ✅ **[أُضيف 2026-07-05] الفرض الآن مطبَّق أيضاً على مستوى الـ API** — `requireStore()` (`lib/store-auth-helper.ts`) نفسه يتحقق من `Store.isActive` و`Subscription.status`/`endDate` (بإعادة استخدام `syncExpiredStatus` بلا تكرار منطق)، بكاش in-memory قصير (45 ثانية، مفتاح `storeId`) لتفادي استعلام Prisma إضافي بكل طلب. أي متجر موقوف أو اشتراكه منتهٍ/معلَّق يُرفض الآن مباشرة بـ `403 JSON` عند أي استدعاء لـ `/api/store/*` (ما عدا `ping`)، برسالة تميّز بين السببين: "تم إيقاف هذا المتجر من قبل الإدارة" (متجر موقوف) أو "انتهت صلاحية اشتراك المتجر، يرجى التجديد للمتابعة" (اشتراك منتهٍ/معلَّق). بما أن `requireManager()` مبني فوق `requireStore()`، فهو يرث هذا التحقق تلقائياً. طبقة `layout.tsx` (فحص حي بلا كاش، صفحات فقط) بقيت كما هي كطبقة أولى للواجهة، بينما `requireStore()` هي الآن طبقة الفرض الفعلية على كل العمليات.
2. **صيانة متجر واحد** (`Store.maintenanceMode`) — تبديل يدوي من صفحة تعديل المتجر، مستقل تماماً عن الاشتراك، يوجّه إلى `/[slug]/maintenance`.
3. **صيانة المنصة العامة** (`PlatformSetting`, صف `singleton`) — توقف كل المتاجر معاً دفعة واحدة من `/super-admin/maintenance`. يُطبَّق في مكانين: `middleware.ts` (Edge runtime، عبر نداء داخلي مخفَّف ومخزَّن مؤقتاً 12 ثانية بـ `/api/internal/maintenance-status` لتفادي استعلام DB على كل طلب) و`layout.tsx` (Server Component). له مهلة سماح (`maintenanceGraceMinutes`) تسمح للجلسات النشطة بالاستمرار حتى `maintenanceActivatedAt + graceMinutes`، بينما الجلسات الجديدة تُمنع فوراً.

صفحات الحالة الناتجة: `/[slug]/expired`، `/[slug]/suspended`، `/[slug]/maintenance`، `/[slug]/store-not-found`، `/[slug]/forbidden` — كلها مستثناة من فحوصات الحجب في `middleware.ts` لتفادي حلقة تحويل لا نهائية.

**إشعار انتهاء الاشتراك:** `lib/notifications.ts:checkSubscriptionExpiring(storeId, sub)` — يُطلق إشعار `SUBSCRIPTION_EXPIRING` عندما `status === 'ACTIVE'` والوقت المتبقي بين 0 و7 أيام. يُستدعى من `layout.tsx` فقط عند دخول STORE_MANAGER (لا يوجد حالياً تنبيه مماثل للسوبر أدمن نفسه عبر كل المتاجر).

## نظام الإشعارات (Notification) — 10 أنواع فعّالة

| النوع | مكان الإطلاق |
|---|---|
| LOW_STOCK | `store/inventory/route.ts`, `store/returns/route.ts`, `store/sales/route.ts` |
| CUSTOMER_DEBT_LIMIT | `store/sales/route.ts` |
| SHIFT_DIFFERENCE | `store/shifts/[id]/route.ts` |
| STALE_EXCHANGE_RATE | `store/exchange-rate/route.ts` |
| SUPPLIER_INVOICE_DUE | `app/[slug]/(store)/layout.tsx` |
| SUBSCRIPTION_EXPIRING | `app/[slug]/(store)/layout.tsx` |
| BACKUP_STALE | تنبيه منصّة-مستوى **[أُضيف 2026-07-04]** |
| DISK_SPACE_LOW | تنبيه منصّة-مستوى **[أُضيف 2026-07-04]** |
| HIGH_ERROR_RATE | تنبيه منصّة-مستوى **[أُضيف 2026-07-04]** |
| DB_SIZE_WARNING | تنبيه منصّة-مستوى **[أُضيف 2026-07-04]** |

الأربعة الأخيرة صارت ممكنة بعد أن أصبح `Notification.storeId` اختيارياً (لدعم تنبيهات مستوى المنصة بلا متجر محدَّد). الواجهة (`NotificationBell.tsx` + `NotificationContext.tsx`) تعرض القائمة وتضع علامة مقروء فعلياً عبر `store/notifications/[id]/read` و`read-all`.

## النسخ الاحتياطي (Backup) — **[بُني بالكامل 2026-07-04]**

`lib/backup.ts` (منطق مشترك) + `scripts/db-backup.ts`/`db-restore.ts` (CLI) + `instrumentation.ts` (نسخ دوري تلقائي كل 6 ساعات). `db:push`/`db:seed`/`db:reset` تستدعي `db:backup` تلقائياً أولاً. يُحتفظ بآخر 20 نسخة فقط. اختُبر backup وrestore فعلياً بنجاح.

## وحدة المراقبة والتسجيل (Logging & Monitoring) — **[بُنيت بالكامل 2026-07-04]**

- `lib/logger.ts` — تسجيل JSON + ملفات دوارة بالإنتاج.
- موديل `ErrorLog` — مربوط بكل catch في مسارات sales/returns/shifts/customers/suppliers/expenses/settings/exchange-rate.
- `app/api/health/route.ts` — فحص صحة عام (DB، حجم قاعدة البيانات، عمر آخر نسخة احتياطية).
- 4 تنبيهات منصّة-مستوى جديدة (انظر جدول الإشعارات أعلاه).
- 3 صفحات `super-admin/system/{monitoring,errors,health}`.

## الأوفلاين (Offline queue) — ❌ كود ميت بالكامل

`lib/db/offline.ts` و`lib/db/sync.ts` (نظام Dexie) **غير مستورَدين من أي مكان بالتطبيق الفعلي** — لا `pos/page.tsx` ولا أي صفحة تستخدمهما. `sync.ts` يستدعي أصلاً مساراً خاطئاً (`/api/sales` بدل `/api/store/sales`) مما يؤكد أنه لم يُختبَر أو يُشغَّل فعلياً منذ كتابته. الموجود فعلياً هو مؤشر اتصال بصري فقط (`ConnectionIndicator`/`ConnectionToast`/`hooks/useConnectionStatus.ts`/`hooks/useOffline.ts` — هذه الأربعة حيّة وتُستخدم فعلياً)، بلا أي طابور مزامنة حقيقي عند انقطاع الشبكة. **الحالة الحالية (نصف مبني، غير موصول، بمسار API خاطئ داخله) وليست "قيد التنفيذ"** — القرار المقترح: إما حذف `lib/db/offline.ts`/`lib/db/sync.ts` بالكامل، أو ربطهما فعلياً لاحقاً إن كان دعم الأوفلاين مطلوباً.

## كود قديم/ميت (Legacy)

بقايا محاولة معمارية أولى (Zustand + مكوّنات منفصلة) تم التخلي عنها لصالح "كل شيء داخل page.tsx مع useState محلي". **لا تبني عليها ولا تفترض أنها مصدر الحقيقة:**
- `store/` بالكامل (authStore.ts, cartStore.ts, shiftStore.ts)
- `components/pos/*` (Cart, ProductGrid, PaymentModal, BarcodeScanner, Receipt)
- `components/shifts/*` (OpenShiftModal, CloseShiftModal)
- `components/shared/Header.tsx`, `OfflineIndicator.tsx`, `PrintButton.tsx`
- `components/super-admin/NewStoreModal.tsx`
- `hooks/useBarcode.ts`, `hooks/usePrint.ts`, `hooks/useShift.ts`
- تبعية `zustand` بـ `package.json` — بلا أي استخدام حقيقي خارج الكتلة الميتة أعلاه
- **`lib/db/offline.ts` + `lib/db/sync.ts`** (نظام Dexie الأوفلاين بالكامل — انظر قسم "الأوفلاين" أعلاه)
- **`lib/utils.ts` → `formatCurrency()`** — لا تزال مُصدَّرة، لكن كل نقاط استدعائها هي نفسها ملفات ميتة مؤكَّدة أعلاه (`Receipt.tsx`, `Cart.tsx`, `ProductGrid.tsx`, `PaymentModal.tsx`, `CloseShiftModal.tsx`) — أي أن الدالة نفسها ميتة عملياً
- تبعية `@zxing/library` (قراءة باركود بالكاميرا) — مثبَّتة، صفر استيراد فعلي بالكود

## المتبقي / فجوات مفتوحة (بالأولوية)

1. حذف كتلة الكود الميت المؤكَّدة بالكامل (انظر قسم "كود قديم/ميت") لتقليل الالتباس على المطورين الجدد.
2. إما إكمال دعم الباركود بالكاميرا (`@zxing/library`) أو حذفها من `package.json`.
3. تمييز "حساب جذر" فعلي بـ `super-admin/admins` يمنع تعديل حساب لآخر (التدقيق يسجّل التعديل الآن — انظر "سجل التدقيق" أعلاه — لكن لا يمنعه بعد).

**[تم إغلاقها 2026-07-05]**: سقف الخصم القابل للضبط تجارياً (`Store.maxDiscountPercentCashier`/`Manager`)، انجراف تقريب المرتجعات الجزئية، و`AuditLog.superAdminId` — الثلاثة كانت هنا سابقاً وتحتاج تعديل schema؛ نُفِّذت معاً بجلسة schema واحدة (انظر "المنطق المالي" و"سجل التدقيق" أعلاه).

## ملاحظات مهمة
- الأسعار بالسنتات (integer) لتجنب float precision
- `expectedCash` مخفي عن الكاشير حتى إغلاق الوردية
- كل layout يستخدم ClientWrapper → SessionProvider بدل تكرارها بكل صفحة
- POS يدعم Barcode scanning عبر keyboard event listener (rapid input) فقط — لا دعم كاميرا فعلي
- الصفحات الجديدة (customers/suppliers/expenses/reports/inventory) لا تفصل مكوّنات UI — كل شيء inline داخل page.tsx، معتمداً على `DataTable` و`StInput/StSelect` المشتركة فقط
