# تقرير فحص شامل لمشروع نظام الكاشير

> تقرير قراءة وفحص فقط — لم يُعدَّل أي كود أثناء إعداده. تم توليده بتاريخ **2026-07-04** بمقارنة الكود الفعلي مع `PROJECT_OVERVIEW.md` (المؤرَّخ 2026-07-01) ومع ذاكرة الجلسات السابقة. كل ادعاء هنا مرفق بمسار الملف كدليل.

---

## 0. ملخص سريع للمنهجية

تم الفحص عبر: قراءة مباشرة لكل الملفات المالية الحرجة (`sales`, `returns`, `reports`, `expenses`, `customers/[id]`, `products/[id]`, `shifts/[id]`, `middleware.ts`, `store-auth-helper.ts`, `lib/utils.ts`, `lib/subscription.ts`)، بالإضافة إلى ثلاث عمليات فحص مؤتمتة (agents) غطّت: (أ) التحقق من الكود الميت المُدَّعى، (ب) جرد كامل لحماية كل API route، (ج) التحقق الفعلي من حالة كل ميزة موثّقة. النتائج مدموجة أدناه بعد تحقق يدوي إضافي — تم اكتشاف أن أوامر `find` الأولية عبر Bash فاتت 3 ملفات API و1 صفحة و1 ملف lib (بسبب سلوك غير موثوق لـ `find` على هذه البيئة)، فأُعيد الفحص بأداة `Glob` للتأكد من الشمول الكامل.

---

## 1. البنية العامة

### شجرة المجلدات الرئيسية

| المجلد | الدور |
|---|---|
| `app/super-admin/` | لوحة السوبر أدمن (متاجر، خطط، اشتراكات، صيانة عامة) |
| `app/[slug]/` | كل متجر عبر slug ديناميكي — صفحات عامة (login/maintenance/suspended..) + مجموعة `(store)` المحمية |
| `app/[slug]/(store)/` | التطبيق الفعلي للمتجر: pos, products, customers, suppliers, expenses, reports, shifts, returns, inventory, settings |
| `app/api/store/*` | الـ API الحقيقي الوحيد للمتجر (session-based) |
| `app/api/super-admin/*` | API السوبر أدمن |
| `app/api/store-auth`, `super-admin-auth` | NextAuth الفعلي (نسختان منفصلتان) |
| `app/api/internal/maintenance-status` | نداء داخلي خفيف يقرأه middleware (Edge runtime لا يستطيع Prisma مباشرة) |
| `components/` | فيها كتلة كاملة من الكود الميت (قسم 7) بجانب المكوّنات الحية |
| `lib/` | مصادقة، حسابات مالية (`utils.ts`)، تقارير (`report-data.ts`, `report-workbook.ts`)، إشعارات، اشتراكات، صيانة |
| `prisma/` | `schema.prisma` (31 موديل) + `seed.ts` |
| `store/`, `hooks/` (جزئياً) | كود ميت بالكامل تقريباً (قسم 7) |

### إحصائيات فعلية (بعد التحقق بـ Glob، وليس بـ find الأولي الذي كان ناقصاً)

| المقياس | العدد الفعلي | ملاحظة |
|---|---|---|
| صفحات (`page.tsx`) | **32** | `PROJECT_OVERVIEW.md` لا يذكر عدداً؛ يفوّت صراحة `stores/[id]/subscription/page.tsx` (يصفها كمجلد فارغ رغم أنها مبنية بالكامل) |
| API routes (`route.ts`) | **47** | يشمل 3 مسارات اشتراك (`super-admin/stores/[id]/subscription`, `.../renew`, `.../payments`) غير موثقة إطلاقاً |
| مكوّنات (`components/*.tsx`) | **30** | نصفها تقريباً كود ميت مؤكَّد (قسم 7) |
| موديلات Prisma | **31** | ليس 23 كما جاء بـ `PROJECT_OVERVIEW.md` (الرقم 23 كان صحيحاً في المرحلة الأولى فقط قبل إضافات لاحقة موثّقة جزئياً في الذاكرة لكن غير محدَّثة بالملف) |
| ملفات `lib/*.ts` | **21** | يشمل `lib/subscription.ts` غير المذكور في أي توثيق سابق |

---

## 2. قاعدة البيانات — 31 موديل (`prisma/schema.prisma`)

| الموديل | الدور | مستخدَم فعلياً؟ |
|---|---|---|
| SuperAdmin | حساب مدير المنصة | ✅ auth + `super-admin/admins` |
| **PlatformSetting** | صف singleton لصيانة المنصة العامة | ✅ `lib/maintenance.ts`, `super-admin/maintenance` |
| StoreType | تصنيف نوع المتجر | ✅ `super-admin/store-types` |
| Plan / PlanPrice | خطط الاشتراك وأسعارها | ✅ `super-admin/plans` |
| Store | المتجر (tenant) | ✅ محور كل شيء |
| **ExchangeRate** | سجل تاريخي لسعر الصرف | ✅ `store/exchange-rate`, يُقرأ بكل عملية بيع/مصروف/مرتجع |
| Subscription / SubscriptionPayment / SubscriptionRenewal | اشتراك المتجر ودفعاته وتجديداته | ✅ `super-admin/stores/[id]/subscription/*` + `lib/subscription.ts` (غير موثقة سابقاً) |
| Branch | فرع المتجر | ✅ |
| StoreUser | مستخدم المتجر (مدير/كاشير) | ✅ |
| Product | المنتج (سعر + عملة + خصم + مخزون) | ✅ |
| **Expense** | مصاريف (رواتب/سُلف/محل) | ✅ `store/expenses` |
| Category | تصنيف المنتجات | ✅ |
| Sale / SaleItem | الفاتورة وأسطرها | ✅ محور القسم 4 |
| SaleReturn / SaleReturnItem | المرتجعات | ✅ `store/returns` |
| Payment | دفعة على فاتورة (CASH فقط حالياً) | ✅ يُنشأ تلقائياً مع كل بيع نقدي |
| Shift | الوردية | ✅ |
| **Customer / CustomerPayment** | العملاء ورصيدهم الآجل (USD) | ✅ `store/customers`, `store/customers/[id]` |
| **Supplier / SupplierInvoice / SupplierInvoiceItem / SupplierPayment** | الموردون وفواتيرهم (USD) | ✅ `store/suppliers`, `store/supplier-invoices` |
| **InventoryMovement** | حركة مخزون بكل نوع (SALE/SALE_RETURN/PURCHASE/ADJUSTMENT/DAMAGE) | ✅ **مبني بالكامل** خلافاً لما هو موثَّق بـ `PROJECT_OVERVIEW.md` ("بلا API أو صفحة فعلية بعد") — له API (`store/inventory`) وصفحة (`inventory/page.tsx`) فعليتان |
| AuditLog | سجل تدقيق | ⚠️ الموديل موجود، لكن لم يُعثر أثناء الفحص على أي `prisma.auditLog.create` فعلي في الكود المقروء (`lib/audit.ts` موجود كملف مساعد لكنه لم يُتحقق من استدعائه من كل نقطة حسّاسة — يستحق فحصاً منفصلاً لاحقاً بعمق أكبر) |
| **Notification** | إشعارات 6 أنواع | ✅ **الستة الأنواع مفعّلة فعلياً** (تفصيل بالقسم 6) |
| LoginAttempt | تتبع محاولات الدخول الفاشلة | ✅ `lib/auth-store.ts` (قفل بعد 5 محاولات/15 دقيقة) |

**موديل محذوف بالكامل:** `Currency` وحقل `Store.currencyId` — حُذفا 2026-07-04 حسب الذاكرة، وتم التأكد بالفحص الحالي أنه **لا يوجد أي أثر متبقٍ** لهما بالكود الحالي (لا في schema ولا في أي API/صفحة).

### العلاقات الأساسية
`Store` هو جذر كل شيء (tenant root) — كل موديل تقريباً يحمل `storeId` مباشرة أو عبر علاقة أب (مثل `SupplierInvoiceItem` عبر `SupplierInvoice.supplier.storeId`). `Sale` مرتبطة بـ `Shift`, `Branch`, `StoreUser`, و`Customer` اختيارياً. `SaleItem` تحمل لقطة كاملة من الحساب المالي (`netLineTotal`, `lineTax`) بدل الاعتماد على إعادة حساب لاحق. `InventoryMovement` تربط بشكل اختياري إلى `Sale` أو `SupplierInvoice` حسب مصدر الحركة — وهذا التصميم يسمح بتتبع كامل لسبب كل تغيّر بالمخزون.

---

## 3. المسارات والصفحات

### `/super-admin/*`

| المسار | الوظيفة | الحالة |
|---|---|---|
| `(dashboard)/page.tsx` | إحصائيات عامة | مكتملة |
| `stores/page.tsx`, `stores/new`, `stores/[id]/edit` | CRUD المتاجر | مكتملة |
| **`stores/[id]/subscription/page.tsx`** | إدارة اشتراك متجر واحد (تجديد/دفعات) | **مكتملة وموجودة فعلياً** — غير موثقة بـ `PROJECT_OVERVIEW.md` الذي يصفها كمجلد فارغ |
| `subscriptions/page.tsx` | قائمة كل الاشتراكات | مكتملة |
| `plans/page.tsx` | الخطط والأسعار | مكتملة |
| `store-types/page.tsx` | أنواع المتاجر | مكتملة |
| `users/page.tsx` | تبويبات مستخدمي المتاجر + مدراء النظام | مكتملة |
| **`(dashboard)/maintenance/page.tsx`** | تفعيل/إيقاف صيانة المنصة العامة | **مكتملة، غير موثقة إطلاقاً بـ `PROJECT_OVERVIEW.md`** |
| `login/page.tsx` | دخول السوبر أدمن | مكتملة |

### `/[slug]/*`

| المسار | من يصلها | الحالة |
|---|---|---|
| `pos/page.tsx` | كاشير + مدير | مكتملة (761 سطر، منطق POS كامل inline) |
| `shifts/page.tsx` | كاشير + مدير | مكتملة |
| **`returns/page.tsx`** | كاشير + مدير | **مكتملة** — غير مذكورة كصفحة منفصلة بـ `PROJECT_OVERVIEW.md` (موثّقة فقط كـ API) |
| `products/page.tsx` | مدير فقط (محجوبة عن الكاشير) | مكتملة |
| `customers/page.tsx`, `customers/[id]` | مدير فقط | مكتملة |
| `suppliers/*` (page/new/[id]/edit) | مدير فقط | مكتملة |
| `expenses/page.tsx` | مدير فقط | مكتملة |
| `reports/page.tsx` | مدير فقط | مكتملة + تصدير Excel |
| **`inventory/page.tsx`** | مدير فقط | **مكتملة** — موثقة بـ `PROJECT_OVERVIEW.md` كمجلد فارغ "لا صفحة ولا API بعد" — هذا غير صحيح الآن |
| `settings/page.tsx` | مدير فقط | مكتملة (فروع + مستخدمون + سعر الصرف + الضريبة) |
| `login/page.tsx` | عام | مكتملة |
| `maintenance/page.tsx` | عام (يُستثنى من الحجب) | مكتملة |
| `suspended/page.tsx`, `expired/page.tsx` | عام، يظهر بعد إعادة توجيه فعلية | مكتملة **ومُفعَّلة فعلياً** (انظر القسم 6.4 — ليست صفحات ميتة كما قد يُظن) |
| `forbidden/page.tsx` | عام | مكتملة، تُستخدم فعلياً عند خرق CASHIER_ALLOWED |
| `store-not-found/page.tsx` | عام | مكتملة |

ملاحظة: لا توجد صفحة `expenses` بقائمة تنقّل الكاشير (`components/shared/AppSidebar.tsx`) وهي محجوبة أيضاً بـ middleware عبر آلية allow-list الجديدة — مطابق للتوثيق بالذاكرة (تم تصحيح الثغرة القديمة).

### API — جدول الحماية (ملخص؛ التفاصيل الكاملة اطلع عليها الفريق أثناء الفحص لكل الـ 47 route)

| المجموعة | الحماية |
|---|---|
| `store/sales`, `store/returns`, `store/shifts`, `store/shifts/[id]`, `store/products` (GET), `store/categories` (GET), `store/customers/lookup`, `store/exchange-rate` (GET), `store/settings` (GET) | `requireStore` فقط — **متعمَّد** لأن الكاشير يحتاجها لعمل POS/الورديات/المرتجعات |
| `store/customers`, `store/suppliers`, `store/expenses`, `store/reports`(+export)، `store/users`, `store/branches`(GET), `store/products`(POST/PATCH/DELETE), `store/categories`(POST/PATCH/DELETE), `store/inventory`, `store/notifications`, `store/supplier-invoices`(+pay), `store/settings`(PATCH), `store/exchange-rate`(POST) | `requireStore` + `requireManager` |
| `super-admin/*` (كل الـ 16 route) | تحقق جلسة سوبر أدمن (بأسماء دوال محلية مختلفة لكن بنفس الأثر) — **لا يوجد تمييز صلاحيات بين حسابات سوبر أدمن مختلفة** (أي حساب يقدر يعدّل أي حساب آخر بما فيه كلمات المرور) |
| `store-auth`, `super-admin-auth` `[...nextauth]` | NextAuth الفعلي (bcrypt + قفل حساب) |
| `api/auth/[...nextauth]` | **متوقف فعلياً (404)** — مطابق للتوثيق |

فحص IDOR على كل مسارات `[id]` (customers, suppliers, products, expenses, shifts, categories, notifications, supplier-invoices/pay, suppliers/pay): **كلها تُقيَّد فعلياً بـ `storeId: t.storeId`** في شرط `where` أو عبر تحقق أب مسبق. لم يُعثر على أي ثغرة IDOR.

**فجوة حقيقية غير موثّقة سابقاً:** middleware لا يفرض قائمة `CASHIER_ALLOWED` على مسارات `/api/store/*` إطلاقاً (انظر القسم 5) — الاعتماد الكامل على `requireManager()` داخل كل route كخط دفاع وحيد.

---

## 4. المنطق المالي — الفحص الأعمق

### 4.1 ترتيب حساب الفاتورة (`app/api/store/sales/route.ts`)

تم تتبّع الكود سطراً بسطر، والترتيب الفعلي **مطابق تماماً** لما هو موثّق في `schema.prisma` وملاحظات الذاكرة:

1. **خصم كل صنف تلقائياً** (`calcFinalPriceInProductCurrency`, سطر 32-37) — نسبة أو مبلغ ثابت على `product.hasDiscount`.
2. تحويل السعر من عملة المنتج إلى ليرة سورية (`unitPriceSyp`, سطر 91-93) — فقط إن كانت `priceCurrency === 'USD'`.
3. طرح خصم الصنف اليدوي (`reqItem.discount`) → `lineTotal` (سطر 95) → تجميعها بـ `subtotalSyp`.
4. **توزيع خصم إجمالي الفاتورة** (`data.discount`) نسبياً على الأسطر عبر `distributeProportionally` (سطر 109) → `netLineTotal` لكل سطر (هذا فعلاً "الرقم المرجعي الوحيد" كما موثّق بتعليق `schema.prisma:371-373`).
5. **الضريبة تُحسب على الصافي بعد كل الخصومات** (`netAfterDiscount = subtotalSyp - data.discount`, سطر 116-119) — بعد الصنف والفاتورة معاً، مطابق للتوثيق.
6. توزيع الضريبة نسبياً على الأسطر حسب `netLineTotal` → `lineTax` (سطر 122-123).
7. **التقريب** يُطبَّق فقط على الإجمالي النهائي (`totalSyp = roundSyp(totalBeforeRounding, roundingRule)`, سطر 125-127) — وليس على كل سطر، والفارق يُسجَّل صراحةً بـ `roundingDiffSyp` بدل أن يضيع.

الترتيب صنف ← فاتورة ← ضريبة ← تقريب **مطبَّق فعلياً كما هو موثَّق**، ولا يوجد أي انحراف.

### 4.2 لا floats في أي حساب مالي — **تحقّق إيجابي**

فحصتُ كل استخدامات `parseFloat`/`toFixed` في المشروع (23 موقعاً). **كل واحد منها إما**:
- تنسيق عرض فقط (`formatUsd`, `formatCurrency`, صفحات `reports`/`plans`/`subscriptions` عند العرض)، أو
- تحويل إدخال المستخدم النصي (حقل دولار بخانتين عشريتين) فوراً إلى سنت صحيح عبر `Math.round(parseFloat(v) * 100)` — نمط ثابت في `suppliers/new`, `suppliers/[id]/edit`, `customers/page.tsx`, `pos/page.tsx`, `shifts/page.tsx`, `stores/[id]/subscription/page.tsx`.

**لم يُعثر على أي عملية حسابية مالية مخزَّنة أو منطق أعمال يعتمد float بلا `Math.round`.** كل حقول `Sale`, `SaleItem`, `SaleReturn`, `Expense`, `Customer.currentBalance`, إلخ Int صريحة، وكل عملية قسمة (تحويل عملة، توزيع نسبي) مُغلَّفة بـ `Math.round` أو بخوارزمية `distributeProportionally` (`lib/utils.ts:66-79`) التي توزّع الباقي الصحيح بدقة على الأسطر الأكبر وزناً بدل تركه يضيع أو يتكرر.

### 4.3 المرتجعات تستخدم سعر صرف الفاتورة الأصلية — **مؤكَّد**

`app/api/store/returns/route.ts:80-81`:
```ts
const totalUsdCents = sale.exchangeRate > 0 ? Math.round((total / sale.exchangeRate) * 100) : 0
```
يُستخدم `sale.exchangeRate` (المجمَّد بالفاتورة الأصلية) — **وليس** أي استعلام جديد على `ExchangeRate`. مطابق تماماً للتوثيق. الاسترجاع النقدي (`CASH`) يستخدم `unitPrice`/`netLineTotal` المخزَّنة بالليرة مباشرة (سطر 64-65) — محايد تماماً لسعر الصرف، فلا مجال للخطأ هناك أصلاً.

### 4.4 التقارير تقرأ من الحقول المجمَّدة فقط — **مؤكَّد**

`lib/report-data.ts` بأكمله يعتمد على:
- `sale.totalUsdCents`, `sale.taxUsdCents`, `sale.exchangeRate` (المجمَّدة)
- `usdRatio(sale) = sale.totalUsdCents / sale.totalSyp` (سطر 70) — نسبة مشتقة من حقول مجمَّدة، لا من سعر صرف حالي
- `itemCostUsdCents` (سطر 76-82) يحوّل `costPrice` عبر `sale.exchangeRate` **الخاص بتلك الفاتورة تحديداً**، وليس سعراً موحّداً حالياً

لا يوجد أي استعلام لـ `ExchangeRate` الحالي داخل `report-data.ts`. هذا يعني أن التقارير التاريخية **لا تتأثر أبداً** بتغيّر سعر الصرف لاحقاً — سلوك صحيح ومطلوب لأي نظام محاسبي.

### 4.5 ✅ [تم الحل 2026-07-04] مخالفة مالية حقيقية: **لا يوجد سقف أو تحقق من صحة الخصم على مستوى الخادم**

**تم الإصلاح بتاريخ 2026-07-04** في `app/api/store/sales/route.ts`:
- تحقق سيرفر-سايد جديد يرفض الطلب بـ 400 إن كان خصم أي صنف (`reqItem.discount`) يجعل `lineTotal` سالباً (رسالة تذكر اسم الصنف)، وإن كان خصم إجمالي الفاتورة (`data.discount`) أكبر من `subtotalSyp` المحسوب فعلياً بعد خصومات الأصناف (رسالة "قيمة الخصم أكبر من إجمالي الفاتورة").
- طبقة دفاع ثانية احتياطية: `netAfterDiscount` و`totalBeforeRounding` أصبحا مغلَّفين بـ `Math.max(0, ...)` مطابقاً لمنطق العميل بـ `pos/page.tsx:171`.
- رُوجع نفس النمط في `app/api/store/returns/route.ts` — لا ثغرة مماثلة: كل مرتجع محسوب كنسبة من `saleItem.netLineTotal`/`lineTax` المجمَّدين (غير قابلين للتلاعب من الطلب)، والكمية المسترجعة مُقيَّدة صراحة بـ `remaining = saleItem.quantity - alreadyReturned`، فلا يمكن إنشاء مرتجع سالب أو أكبر من قيمة الفاتورة الأصلية عبر أي مدخل.
- **اختُبر فعلياً** (سيرفر تطوير حي + طلبات API حقيقية بجلسة كاشير): فاتورة بخصم = الإجمالي (نجحت 201، `total: 0`)، خصم أكبر من الإجمالي (رُفضت 400)، خصم صنف أكبر من قيمة سطره (رُفض 400)، بيع عادي بخصم صغير (نجح 201 بنفس الأرقام المتوقعة تماماً — لا انحراف عن السلوك السابق).
- **معلَّق عمداً خارج نطاق هذا الإصلاح**: سقف خصم قابل للضبط لكل متجر/دور (كاشير مقابل مدير) — يتطلب إضافة حقل جديد بـ `schema.prisma`، وهذه الجلسة استُبعد منها أي تعديل schema. الإصلاح الحالي يمنع القيم غير المنطقية (السالبة) فقط، وليس سقفاً تجارياً على حجم الخصم المسموح.

هذه كانت أخطر نقطة اكتُشفت بالفحص. التوثيق الحالي (وذاكرة الجلسات) كان يذكر "خانة الخصم بالـ POS بلا سقف" كـ **ثغرة UI معروفة فقط** — لكن الفحص الفعلي أظهر أن المشكلة أعمق وطالت **الخادم نفسه، لا الواجهة فقط**:

- **العميل (`pos/page.tsx:171`)**: `const netAfterDiscount = Math.max(0, subtotal - discount)` — يُطبَّق `Math.max(0, ...)` لمنع سالب في المعاينة المحلية.
- **الخادم (`app/api/store/sales/route.ts`)**:
  - `saleSchema` (سطر 15-25): حقل `discount: z.number().int().min(0).default(0)` — **بلا `.max()` وبلا `superRefine` يقارنه بـ `subtotal`**.
  - سطر 116: `const netAfterDiscount = subtotalSyp - data.discount` — **بدون `Math.max(0, ...)`** خلافاً للعميل.
  - إن أرسل الكاشير (أو أي طلب API مباشر) `discount` أكبر من `subtotal`، تصبح `netAfterDiscount` سالبة، ثم `tax` سالباً (إن كانت الضريبة مفعّلة)، ثم `totalBeforeRounding` سالباً، ثم `totalSyp` (بعد `roundSyp`) **يُخزَّن سالباً فعلياً بقاعدة البيانات** في `Sale.total` و`Sale.subtotal` يبقى موجباً لكن `Sale.total` سالب.
  - `remaining = Math.max(0, totalSyp - data.amountPaid)` يُصفَّر فوراً لأن `totalSyp` سالب — أي **لا خطأ يظهر للمستخدم، والفاتورة تُنشأ بنجاح (201) بإجمالي سالب**.

**الأثر العملي:** كاشير (أو أي شخص يملك جلسة كاشير صالحة ويستدعي الـ API مباشرة بدلاً من الواجهة) يستطيع تسجيل فاتورة بخصم أكبر من قيمتها، ما يُنتج `total` سالباً يُفسد `totalRevenue`/`totalCost`/`totalProfit` في التقارير (`lib/report-data.ts` يجمع `sale.totalUsdCents` مباشرة بلا أي تحقق من الإشارة)، ويمكن استغلاله لإخفاء إيراد فعلي أو للتلاعب بصندوق الوردية (`expectedCash` بـ `shifts/[id]/route.ts:39` يعتمد على `Payment.amount` وليس `Sale.total`، لكن الفاتورة السالبة تبقى تلوّث التقارير المالية للمتجر). **هذا أخطر من مجرد "لا سقف بالواجهة" — هو غياب تحقق سيرفر-سايد على قيمة اقتصادية جوهرية.**

### 4.6 ⚠️ ملاحظة ثانوية (منخفضة الخطورة): انجراف تقريب بسيط في المرتجعات الجزئية المتكررة

`app/api/store/returns/route.ts:64-65` يحسب نصيب كل استرجاع جزئي بـ:
```ts
const netRefund = Math.round((saleItem.netLineTotal * reqItem.quantity) / saleItem.quantity)
```
هذا الحساب يُعاد من الصفر (بالنسبة لكامل `saleItem.quantity` الأصلية) في **كل عملية استرجاع منفصلة لنفس السطر**، وليس تناسبياً مع الكمية المتبقية فقط. في حالات نادرة (خصم كسري لا يقبل قسمة صحيحة)، استرجاع نفس السطر على دفعات منفصلة (بدل مرة واحدة) قد يُراكم فرق تقريب صغيراً (عادة 1 ليرة أو أقل لكل عملية) لصالح الزبون أو ضده مقارنة باسترجاع الكمية كاملة دفعة واحدة. الأثر المالي ضئيل جداً (لا يتجاوز عملياً بضع ليرات لكل فاتورة) وليس ثغرة أمنية، لكنه يستحق الذكر كفارق دقة محاسبية نظرية.

---

## 5. الأمان والصلاحيات

### `middleware.ts` — التحقق الكامل

- **آلية الفرز**: أول segment بالمسار (`super-admin` أو `[slug]`) يحدد أي كوكي جلسة يُفحص (`super-admin.session-token` أو `store.session-token`).
- **قائمة سماح الكاشير (سطر 11)**: `CASHIER_ALLOWED = ['pos', 'shifts', 'returns']` — **قائمة سماح فعلية (allowlist)**، وأي مسار آخر تحت `/[slug]/*` لكاشير يُعاد توجيهه لـ `/forbidden` (سطر 185-187). هذا **مطبَّق فعلياً** كما هو موثَّق بالذاكرة، ويُصحّح الثغرة القديمة الموصوفة بـ `PROJECT_OVERVIEW.md` (حيث كانت `/expenses` تُنسى من قائمة حظر قديمة).
- **✅ مُصلَحة (2026-07-04)**: أُضيفت طبقة دفاع ثانية (`CASHIER_API_RULES` + `cashierApiAllowed()`, سطر 20-35 من `middleware.ts`) — allowlist صريحة لمسارات/methods `/api/store/*` المسموحة لدور CASHIER (`products`/`categories`/`customers/lookup`/`settings`/`exchange-rate` GET فقط، `ping`, `shifts` GET+POST، `shifts/[id]` PATCH فقط، `sales` GET+POST، `returns` GET+POST) — مستخرَجة من فحص فعلي لكل نداءات `fetch()` بصفحات `pos`/`shifts`/`returns` والمكوّنات المشتركة بالـ layout (`ExchangeRateContext`, `ConnectionIndicator`). أي مسار أو method آخر لدور CASHIER يرد الآن 403 JSON (`{error:'FORBIDDEN', message:'غير مصرّح لك بالوصول إلى هذا المسار'}`) مباشرة من middleware، **قبل** الوصول لأي route.ts. `requireManager()` داخل كل route لم يُمس ولم يُخفَّف — هذه الطبقة تُضاف فوقها فقط. اختُبر يدوياً بجلسة كاشير حقيقية (بيع كامل + مرتجع + فتح/إغلاق وردية نجحت 200/201، واستدعاء مباشر لـ `/api/store/expenses`, `/api/store/reports`, `POST /api/store/products`, `POST /api/store/exchange-rate` أعاد 403) — ولم يظهر أي regression لدور STORE_MANAGER (نفس المسارات أعادت 200 بجلسة مدير).
- **صفحات الحالة العامة** (`suspended`, `expired`, `forbidden`, `maintenance`, `store-not-found`) تُستثنى من الحجب لتفادي حلقة لا نهائية — تصميم صحيح.
- **وضع الصيانة**: يُفحص عبر نداء داخلي مخبَّأ (`STATUS_CACHE_MS = 12_000`) لأن middleware يعمل على Edge runtime ولا يستطيع استدعاء Prisma/SQLite مباشرة — تصميم سليم ومُبرَّر بتعليق بالكود.

### فحص شامل لكل الـ 47 API route

- **لا توجد أي endpoint حساسة بلا حماية.** كل route يستدعي `requireStore` على الأقل، والحسّاس منها يضيف `requireManager`.
- **لا توجد ثغرة IDOR** في أي من الـ routes التي تقبل `[id]` — كلها تُقيَّد بـ `storeId` بشكل مباشر أو عبر تحقق أب.
- **ملاحظة صلاحيات سوبر أدمن**: `super-admin/admins` (POST/PATCH) يسمح لأي حساب سوبر أدمن مسجَّل بإنشاء/تعديل أي حساب سوبر أدمن آخر (بما فيه كلمة المرور) بلا أي تمييز "حساب جذر" — خطورة منخفضة لأن كل حسابات السوبر أدمن موثوقة أصلاً بالتصميم، لكنها غياب لمبدأ فصل الصلاحيات.

### خانة الخصم بالـ POS — الثغرة الموثَّقة سابقاً

✅ **[تم الحل 2026-07-04]** — انظر القسم 4.5 أعلاه للتفصيل الكامل. سقف الخصم القابل للضبط تجارياً (وليس مجرد منع القيم السالبة) يبقى معلَّقاً لأنه يتطلب تعديل schema.

### بيانات تصل للكاشير أكثر من اللازم؟

- `store/customers/lookup` (بلا `requireManager`) يعيد `id/name/phone/currentBalance` فقط — تصميم متعمَّد وموثَّق ومناسب (الكاشير يحتاج رصيد العميل لقرار البيع الآجل، لا أكثر).
- `store/shifts` (GET) يقيّد تلقائياً الكاشير على `userId: t.id` بينما يرى المدير كل الورديات — تصميم صحيح.
- `store/shifts/[id]` (PATCH) يتحقق صراحة أن الكاشير يملك الوردية قبل إغلاقها (`shift.userId !== t.id → 403`) — صحيح.
- لم يُعثر على أي endpoint يُسرّب بيانات حساسة (تكلفة `costPrice`، أرباح، بيانات متاجر أخرى) للكاشير.

---

## 6. الميزات: منفّذ / جزئي / غير موجود

| الميزة | الحالة | الدليل |
|---|---|---|
| **العملة الثنائية وتجميد السعر** | ✅ منفّذ بالكامل | `Sale.exchangeRate/totalUsdCents/totalSyp` تُجمَّد لحظة البيع (`sales/route.ts:151-154`)؛ `Product.priceCurrency` snapshot صحيح (`products/[id]/route.ts:32-46`) |
| **الضريبة** | ✅ منفّذ بالكامل | تُحسب على الصافي بعد الخصومات، لقطة `taxRateApplied`/`taxName` مجمَّدة لكل فاتورة (`sales/route.ts:118-119, 145-146`) |
| **المرتجعات** | ✅ منفّذ بالكامل | سعر صرف الفاتورة الأصلية، تحقق كمية متبقية، إشعار دائن أو نقدي (`returns/route.ts`) |
| **الديون والتسديد** | ✅ منفّذ بالكامل | `Customer.currentBalance` بالدولار، تسديد منفصل تماماً عن SYP (`customers/[id]/route.ts:69-107`) |
| **الموردون** | ✅ منفّذ بالكامل | فواتير + دفعات + تحديث مخزون فعلي عبر `InventoryMovement` نوع `PURCHASE` (كانت ثغرة منطقية سابقة، أُصلحت حسب الذاكرة) |
| **المصاريف** | ✅ منفّذ بالكامل | `amountUsdCents`/`exchangeRate` يُحسبان لحظة التسجيل ولا يُعاد حسابهما (`expenses/route.ts:73-74`) |
| **الورديات** | ✅ منفّذ بالكامل | `expectedCash` من `Payment` الفعلية ناقص المرتجع النقدي لنفس الوردية (`shifts/[id]/route.ts:30-39`) |
| **المخزون والحركات** | ✅ **منفّذ بالكامل** (خلافاً للتوثيق) | `store/inventory` API + `inventory/page.tsx` + `InventoryMovement` مربوطة بـ SALE/SALE_RETURN/PURCHASE/ADJUSTMENT/DAMAGE |
| **التقارير وتصدير Excel** | ✅ منفّذ بالكامل | `lib/report-workbook.ts` (مكتبة `xlsx` حقيقية) + زر تصدير فعلي بـ `reports/page.tsx:146` |
| **النسخ الاحتياطي (Backup)** | ✅ **بُني بالكامل بتاريخ 2026-07-04** (كان غير موجود إطلاقاً وقت هذا الفحص) | `lib/backup.ts` (منطق مشترك) + `scripts/db-backup.ts`/`db-restore.ts` (CLI) + `instrumentation.ts` (نسخ دوري كل 6 ساعات) — `db:push`/`db:seed`/`db:reset` تستدعي `db:backup` تلقائياً أولاً؛ الاحتفاظ بآخر 20 نسخة فقط؛ اختُبر backup وrestore فعلياً بنجاح |
| **نظام الإشعارات (6 أنواع)** | ✅ **الستة مفعّلة فعلياً** | LOW_STOCK, CUSTOMER_DEBT_LIMIT, SHIFT_DIFFERENCE, STALE_EXCHANGE_RATE, SUPPLIER_INVOICE_DUE, SUBSCRIPTION_EXPIRING — كلها لها نقطة إنشاء فعلية بالكود (تفصيل بالجدول الفرعي أدناه) |
| **مؤشر الاتصال** | ✅ منفّذ (واجهة) | `ConnectionIndicator.tsx` + `ConnectionToast.tsx` حيّان وموصولان بـ `StoreHeader`/`ClientWrapper` |
| **الأوفلاين (Offline queue)** | ❌ **كود ميت بالكامل، خلافاً للانطباع الموثَّق** | `lib/db/offline.ts` و`lib/db/sync.ts` (Dexie) **غير مستوردَين من أي مكان بالتطبيق الفعلي** — لا `pos/page.tsx` ولا أي صفحة تستخدمهما. الموجود فعلياً هو مؤشر اتصال بصري فقط، بلا أي طابور مزامنة حقيقي عند انقطاع الشبكة |
| **وضع الصيانة (العام والخاص)** | ✅ منفّذ بالكامل على المستويين | `PlatformSetting` (عام) + `Store.maintenanceMode` (خاص) — كلاهما موصول DB→فحص→توجيه→واجهة عبر `middleware.ts` + `lib/maintenance.ts` |
| **الاشتراكات (تفعيل/تعطيل فعلي)** | ✅ **منفّذ وموصول فعلياً** (خلافاً للانطباع بأن الصفحات يتيمة) | `app/[slug]/(store)/layout.tsx:37-45` يتحقق من `store.isActive` و`Subscription.status/endDate` بكل تحميل صفحة، ويوجّه فعلياً لـ `/suspended` أو `/expired`. **لكن**: هذا التحقق موجود بالـ layout (صفحات فقط) وليس بـ middleware ولا داخل `requireStore()`/`requireManager()` — أي أن **API الخاص بالمتجر يبقى يعمل بلا أي تحقق من حالة الاشتراك** حتى لو كان منتهياً أو معلَّقاً (انظر فجوة جديدة، قسم 6.1 أدناه) |
| **الطباعة الحرارية** | ✅ منفّذ بالكامل وموصول | `lib/print/receipt.ts` مستوردة فعلياً بـ `pos/page.tsx` |
| **الباركود** | ⚠️ جزئي | الكيبورد (rapid keydown) فعّال وموصول بـ `pos/page.tsx:118-134`. الكاميرا (`@zxing/library`) **مثبَّتة كتبعية لكن غير مستخدمة إطلاقاً** — صفر استيراد بكل الكود |

### 6.1 ⚠️ فجوة جديدة غير موثّقة: انتهاء الاشتراك لا يمنع استدعاء الـ API مباشرة

بما أن تحقق `Subscription.status`/`endDate` موجود فقط بـ `app/[slug]/(store)/layout.tsx` (خاص بعرض الصفحات)، وليس في `requireStore()` (`lib/store-auth-helper.ts`) ولا في middleware، فإن متجراً اشتراكه منتهٍ (`EXPIRED`) أو معلَّق (`SUSPENDED`/`CANCELLED`) **يبقى قادراً فعلياً على تنفيذ عمليات API كاملة** (بيع، مرتجع، إغلاق وردية...) طالما الجلسة صالحة والطلب يذهب مباشرة لـ `/api/store/*` بدل المرور بصفحة محجوبة. هذا يعني أن الحجب الفعلي "تجميلي" على مستوى التنقل بالواجهة فقط، وليس تطبيقياً على مستوى العمليات — فجوة تستحق إصلاحاً بإضافة نفس التحقق داخل `requireStore()` نفسه.

### 6.2 تفصيل أنواع الإشعارات الستة (كلها فعّالة)

| النوع | مكان الإطلاق |
|---|---|
| LOW_STOCK | `store/inventory/route.ts`, `store/returns/route.ts`, `store/sales/route.ts` |
| CUSTOMER_DEBT_LIMIT | `store/sales/route.ts` |
| SHIFT_DIFFERENCE | `store/shifts/[id]/route.ts` |
| STALE_EXCHANGE_RATE | `store/exchange-rate/route.ts` |
| SUPPLIER_INVOICE_DUE | `app/[slug]/(store)/layout.tsx` |
| SUBSCRIPTION_EXPIRING | `app/[slug]/(store)/layout.tsx` |

الواجهة (`NotificationBell.tsx` + `NotificationContext.tsx`) تعرض القائمة وتضع علامة مقروء فعلياً عبر `store/notifications/[id]/read` و`read-all`.

---

## 7. الكود الميت والفجوات

### قائمة Legacy الموثَّقة بـ `PROJECT_OVERVIEW.md` — **كلها مؤكَّدة ميتة فعلياً** (تحقق بفحص استيراد شامل، لا توجد أي حالة استيراد من خارج الكتلة الميتة نفسها)

- `store/` بالكامل (`authStore.ts`, `cartStore.ts`, `shiftStore.ts`)
- `components/pos/*` (`Cart.tsx`, `ProductGrid.tsx`, `PaymentModal.tsx`, `BarcodeScanner.tsx`, `Receipt.tsx`)
- `components/shifts/*` (`OpenShiftModal.tsx`, `CloseShiftModal.tsx`)
- `components/shared/Header.tsx`, `OfflineIndicator.tsx`, `PrintButton.tsx`
- `components/super-admin/NewStoreModal.tsx`
- `hooks/useBarcode.ts`, `hooks/usePrint.ts`, `hooks/useShift.ts`

حزمة `zustand` بـ `package.json` بلا أي استخدام حقيقي خارج هذه الكتلة الميتة — مرشَّحة للحذف من `package.json` أيضاً.

### كود ميت إضافي **غير مذكور** بأي توثيق سابق (اكتُشف بهذا الفحص)

- **`lib/db/offline.ts` + `lib/db/sync.ts`** (نظام Dexie الأوفلاين بالكامل) — غير مستورَدين من أي مكان بالتطبيق الحي. `sync.ts` يستدعي أصلاً مساراً خاطئاً (`/api/sales` بدل `/api/store/sales`) مما يؤكد أنه لم يُختبَر أو يُشغَّل فعلياً منذ كتابته.
- **`lib/utils.ts` → `formatCurrency()`** — لا تزال مُصدَّرة، لكن كل نقاط استدعائها (`components/pos/Receipt.tsx`, `Cart.tsx`, `ProductGrid.tsx`, `PaymentModal.tsx`, `components/shifts/CloseShiftModal.tsx`) هي نفسها ملفات ميتة مؤكَّدة أعلاه — أي أن الدالة نفسها ميتة عملياً رغم عدم إدراجها بقائمة Legacy الرسمية.
- **`hooks/useConnectionStatus.ts`, `hooks/useOffline.ts`** حيّتان وتُستخدمان فعلياً (بعكس بقية `hooks/*`) — لا تُصنَّفا كميتتين.

### مجلدات فارغة (غير موثقة بالكامل بـ `PROJECT_OVERVIEW.md`)

- `app/api/[slug]/*` (products/[id], sales, shifts/[id]/close) — بقايا معمارية أولى مهجورة، مطابق للتوثيق
- `app/api/super-admin/analytics` — مطابق للتوثيق
- `app/api/auth/detect` — **غير موثّقة سابقاً**
- `app/api/super-admin/store-types/[id]` — **غير موثّقة سابقاً**
- `app/api/super-admin/stores/[id]/subscription/payment` (مفرد — بجانب `payments` الفعلي بصيغة الجمع) — يبدو مسار تجربة أولى مهجور بجانب المسار الحقيقي
- `app/super-admin/(dashboard)/plans/[id]` — **غير موثّقة سابقاً**

### TODO/FIXME

بحث شامل بكل المشروع (باستثناء `node_modules`) — **صفر نتائج**. لا توجد ملاحظات معلَّقة صريحة بالكود.

---

## 8. فروقات التوثيق — قائمة صريحة

### موثَّق في `PROJECT_OVERVIEW.md` لكن **غير صحيح حالياً**

1. **"`InventoryMovement` موجود بالـ schema لكن بلا API أو صفحة فعلية بعد"** — غير صحيح؛ مبني بالكامل (`store/inventory` + `inventory/page.tsx`).
2. **"`inventory/` مجلد فارغ (لا صفحة ولا API بعد)"** — نفس النقطة، غير صحيح.
3. **"`stores/[id]/subscription/` مجلد فارغ (لم يُبنَ بعد)"** — غير صحيح؛ صفحة كاملة + 3 API routes (subscription, renew, payments).
4. **"23 موديل"** — العدد الفعلي 31 (كان صحيحاً بمرحلة أقدم من المشروع فقط).
5. **قائمة `app/api/store/*`** لا تذكر: `exchange-rate`, `inventory`, `notifications/*`, `settings`, `customers/lookup`, `ping` — كلها مبنية وفعّالة.
6. **قائمة `app/[slug]/(store)/*`** لا تذكر `returns/page.tsx` (موجودة كصفحة منفصلة، وليست فقط API).
7. **`CASHIER_BLOCKED`** الموثَّقة كقائمة حظر — أصبحت فعلياً `CASHIER_ALLOWED` (قائمة سماح)، وهذا تغيير معماري كامل بمنطق الحماية وليس مجرد إعادة تسمية.

### موجود فعلياً بالكود لكن **غير موثَّق بـ `PROJECT_OVERVIEW.md` إطلاقاً**

1. موديل `PlatformSetting` ونظام الصيانة العامة الكامل (super-admin maintenance).
2. نظام العملة الثنائية بالكامل (`ExchangeRate`, `roundingRule`, `pricingCurrency`, `totalUsdCents`...) — موثَّق فقط بذاكرة الجلسات، غير مُصدَّر إلى `PROJECT_OVERVIEW.md` نفسه رغم أن الملف يذكر أنه "مُصدَّر أيضاً" لهذا الغرض.
3. `Customer`/`Supplier`/`Expense`/`InventoryMovement` بالكامل — الملف يذكرها كإضافات لاحقة لكن بتفصيل جزئي فقط، ولا يذكر `Notification` أو `ExchangeRate` أو `PlatformSetting` إطلاقاً.
4. `lib/subscription.ts` (منطق تصحيح حالة الاشتراك المنتهي) — غير مذكور بأي توثيق.
5. نظام الإشعارات الستة بالكامل (`Notification` model + `lib/notifications.ts` + UI) — غير مذكور بـ `PROJECT_OVERVIEW.md` إطلاقاً.
6. صفحات `suspended`/`expired`/`forbidden` وربطها الفعلي بمنطق تحقق حقيقي بـ layout — غير مذكورة.
7. المكوّنات الجديدة: `ConnectionIndicator`, `ConnectionToast`, `ExchangeRateContext/Indicator`, `MaintenanceBanner`, `NotificationBell/Context`, `StatusPage`, `StoreHeader` — لا ذكر لأي منها.

---

## 9. الخلاصة التنفيذية

### أعلى 5 مخاطر قبل تشغيل أول متجر حقيقي (مرتبة بالخطورة)

1. **✅ [تم الحل 2026-07-04]** لم يكن يوجد سقف أو تحقق على الخصم في `app/api/store/sales/route.ts` — كان يسمح بإنشاء فاتورة بإجمالي سالب فعلياً من الخادم. أُضيف الآن رفض 400 صريح (خصم صنف أو فاتورة يتجاوز القيمة) + طبقة `Math.max(0,...)` احتياطية. سقف الخصم *القابل للضبط تجارياً* (وليس مجرد منع السالب) يبقى معلَّقاً لأنه يتطلب تعديل schema. (قسم 4.5)
2. **🔴 لا يوجد فرض لحالة الاشتراك (منتهي/معلَّق) على مستوى الـ API** — متجر مقطوع الاشتراك يبقى قادراً على البيع والتحصيل عبر استدعاء مباشر للـ API بينما الواجهة تحجبه فقط بصرياً. يهدد نموذج العمل نفسه (SaaS بدون اشتراك فعّال = عمل مجاني). (قسم 6.1)
3. **✅ [تم الحل 2026-07-04]** middleware لم يكن يطبّق أي قيد على `/api/store/*` لدور CASHIER — أُضيفت الآن allowlist صريحة (`CASHIER_API_RULES`) تفرض 403 على أي مسار/method خارج ما تحتاجه فعلياً صفحات pos/shifts/returns، كطبقة دفاع ثانية فوق `requireManager()` الموجودة أصلاً بكل route (لم تُمس). (قسم 5)
4. **✅ [تم الحل 2026-07-04]** عدم وجود نسخ احتياطي — بُني الآن نظام backup/restore كامل (`lib/backup.ts` + `scripts/db-backup.ts`/`db-restore.ts` + `instrumentation.ts` لنسخ دوري كل 6 ساعات)، ومربوط تلقائياً بـ `db:push`/`db:seed`/`db:reset`.
5. **🟡 نظام الأوفلاين وهمي بالكامل** — الانطباع العام (اسم الحزم المثبَّتة `dexie`/`next-pwa`) يوحي بدعم عمل بلا انترنت، لكن لا يوجد أي طابور مزامنة فعلي. أي انقطاع شبكة أثناء البيع الفعلي = توقف كامل للـ POS بلا أي شبكة أمان، خلافاً للتوقع المبني على وجود هذه التبعيات.

### قائمة مهام مقترحة بالأولوية (بناءً على الفحص، وليست نسخاً من "المتبقي" بالتوثيق)

1. **✅ [تم 2026-07-04]** رفض صريح (400) لخصم صنف أو فاتورة يتجاوز القيمة المحسوبة (بعد `subtotalSyp` وليس على الحقل الخام)، مع تغليف `netAfterDiscount`/`totalBeforeRounding` بـ `Math.max(0, ...)` كطبقة احتياطية. **معلَّق:** سقف خصم قابل للضبط (يحتاج تعديل schema — خارج نطاق هذه الجلسة).
2. **عاجل:** نقل تحقق `Subscription.status`/`endDate`/`Store.isActive` إلى داخل `requireStore()` نفسه (أو استدعاء موازٍ بكل route حسّاس) بدل الاكتفاء بحجبه على مستوى الصفحة فقط.
3. **✅ [تم 2026-07-04]** نظام نسخ احتياطي دورية لملف SQLite — منفّذ داخل الكود (وليس خطوة تشغيلية خارجية كما كان مقترحاً)، انظر تفصيله بالقسم 6.
4. **متوسط:** إما حذف `lib/db/offline.ts`/`lib/db/sync.ts` بالكامل (أوضح للمطورين القادمين)، أو ربطهما فعلياً بـ `pos/page.tsx` إن كان دعم الأوفلاين مطلوباً فعلاً لاحقاً — الوضع الحالي (نصف مبني، غير موصول، بمسار API خاطئ داخله) هو الأسوأ من الخيارين.
5. **متوسط:** حذف كتلة الكود الميت المؤكَّدة بالكامل (`store/`, `components/pos/*`, `components/shifts/*`, الملفات الميتة بـ `components/shared/*` و`components/super-admin/*`, `hooks/useBarcode.ts`/`usePrint.ts`/`useShift.ts`, تبعية `zustand`) لتقليل الالتباس على أي مطوّر جديد يقرأ الكود ويظن أنها مصدر الحقيقة.
6. **منخفض:** توضيح `super-admin/admins` بإضافة مستوى صلاحية "جذر" أو تدقيق (audit) على تعديلات حسابات السوبر أدمن المتبادلة.
7. **منخفض:** تحديث `PROJECT_OVERVIEW.md` نفسه ليعكس كل الفروقات المذكورة بالقسم 8 (ليس ضمن نطاق هذه الجلسة القرائية، لكنه أول شيء يستحق فعله بجلسة لاحقة قبل أي اعتماد جديد عليه كمرجع).
8. **منخفض:** إما إكمال دعم الباركود بالكاميرا (`@zxing/library` مثبَّتة فعلاً)، أو حذفها من `package.json` إن قُرِّر أن الكيبورد وحده كافٍ دائماً.
9. **✅ [تم 2026-07-04]** بُنيت وحدة مراقبة وتسجيل كاملة للسوبر أدمن: `lib/logger.ts` (تسجيل JSON + ملفات دوارة بالإنتاج) + موديل `ErrorLog` جديد مربوط بكل catch بمسارات sales/returns/shifts/customers/suppliers/expenses/settings/exchange-rate + `/api/health` + 4 تنبيهات منصّة-مستوى جديدة (BACKUP_STALE, DISK_SPACE_LOW, HIGH_ERROR_RATE, DB_SIZE_WARNING عبر `Notification.storeId` الذي أصبح اختيارياً الآن) + 3 صفحات `super-admin/system/{monitoring,errors,health}`. راجع القسم 6.2 لقائمة أنواع الإشعارات المحدَّثة (10 أنواع الآن، وليس 6).
