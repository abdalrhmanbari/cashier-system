import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // 1. SUPER_ADMIN
  await prisma.superAdmin.create({
    data: {
      name: 'مدير النظام',
      email: 'admin@platform.com',
      password: await bcrypt.hash('Admin@2024', 12),
    },
  })

  // 2. أنواع المتاجر
  const storeTypes = await Promise.all([
    prisma.storeType.create({ data: { name: 'سوبر ماركت',   icon: 'ShoppingCart', description: 'مواد غذائية وبقالة' } }),
    prisma.storeType.create({ data: { name: 'ملابس وأزياء', icon: 'Shirt',        description: 'ملابس وإكسسوارات'   } }),
    prisma.storeType.create({ data: { name: 'صيدلية',       icon: 'Pill',         description: 'أدوية ومستلزمات'    } }),
    prisma.storeType.create({ data: { name: 'مطعم وكافيه',  icon: 'Utensils',     description: 'طعام ومشروبات'      } }),
    prisma.storeType.create({ data: { name: 'إلكترونيات',   icon: 'Smartphone',   description: 'أجهزة ومعدات'       } }),
    prisma.storeType.create({ data: { name: 'محل عام',      icon: 'Store',        description: 'نشاط تجاري عام'     } }),
  ])

  // 3. خطط الاشتراك
  await prisma.plan.create({
    data: {
      name: 'أساسي',
      description: 'مناسب للمحلات الصغيرة',
      prices: {
        create: [
          { billingCycle: 'MONTHLY', minBranches: 1, maxBranches: 1, priceUsd: 1900, discountPct: 0  },
          { billingCycle: 'YEARLY',  minBranches: 1, maxBranches: 1, priceUsd: 1900, discountPct: 17 },
        ],
      },
    },
  })

  const advancedPlan = await prisma.plan.create({
    data: {
      name: 'متقدم',
      description: 'للمحلات متوسطة الحجم ومتعددة الفروع',
      prices: {
        create: [
          { billingCycle: 'MONTHLY', minBranches: 1, maxBranches: 1,    priceUsd: 2900, discountPct: 0  },
          { billingCycle: 'MONTHLY', minBranches: 2, maxBranches: 5,    priceUsd: 2900, discountPct: 10 },
          { billingCycle: 'MONTHLY', minBranches: 6, maxBranches: null, priceUsd: 2900, discountPct: 20 },
          { billingCycle: 'YEARLY',  minBranches: 1, maxBranches: 1,    priceUsd: 2900, discountPct: 17 },
          { billingCycle: 'YEARLY',  minBranches: 2, maxBranches: 5,    priceUsd: 2900, discountPct: 25 },
          { billingCycle: 'YEARLY',  minBranches: 6, maxBranches: null, priceUsd: 2900, discountPct: 33 },
        ],
      },
    },
  })

  await prisma.plan.create({
    data: {
      name: 'احترافي',
      description: 'للسلاسل الكبيرة — فروع غير محدودة',
      prices: {
        create: [
          { billingCycle: 'MONTHLY', minBranches: 1, maxBranches: null, priceUsd: 4900, discountPct: 0  },
          { billingCycle: 'YEARLY',  minBranches: 1, maxBranches: null, priceUsd: 4900, discountPct: 17 },
        ],
      },
    },
  })

  // 4. متجر تجريبي — سوبر ماركت
  const supermarketType = storeTypes.find(t => t.name === 'سوبر ماركت')!

  const store = await prisma.store.create({
    data: {
      name: 'سوبر ماركت الأمل',
      slug: 'alamal',
      phone: '+966500000000',
      storeTypeId: supermarketType.id,
    },
  })

  const endDate = new Date()
  endDate.setFullYear(endDate.getFullYear() + 1)

  await prisma.subscription.create({
    data: {
      storeId:      store.id,
      planId:       advancedPlan.id,
      billingCycle: 'YEARLY',
      branchCount:  2,
      priceUsd:     43500,
      endDate,
      status:       'ACTIVE',
    },
  })

  const branch1 = await prisma.branch.create({
    data: { name: 'الفرع الرئيسي', address: 'الرياض — حي النزهة', storeId: store.id },
  })
  const branch2 = await prisma.branch.create({
    data: { name: 'فرع الشمال', address: 'الرياض — حي الملقا', storeId: store.id },
  })

  const [manager, cashier1] = await Promise.all([
    prisma.storeUser.create({
      data: {
        name:     'أحمد المحمد',
        email:    'manager@alamal.com',
        password: await bcrypt.hash('Manager@2024', 12),
        role:     'STORE_MANAGER',
        storeId:  store.id,
        branchId: null,
      },
    }),
    prisma.storeUser.create({
      data: {
        name:     'خالد العلي',
        email:    'cashier1@alamal.com',
        password: await bcrypt.hash('Cashier@2024', 12),
        role:     'CASHIER',
        storeId:  store.id,
        branchId: branch1.id,
      },
    }),
    prisma.storeUser.create({
      data: {
        name:     'سعد الحربي',
        email:    'cashier2@alamal.com',
        password: await bcrypt.hash('Cashier@2024', 12),
        role:     'CASHIER',
        storeId:  store.id,
        branchId: branch2.id,
      },
    }),
  ])

  // سعر الصرف التجريبي — $1 = 14500 ل.س
  await prisma.exchangeRate.create({
    data: { rate: 14500, storeId: store.id, createdById: manager.id },
  })

  // تصنيف ومنتجات تجريبية — الأسعار بالدولار (priceCurrency = "USD") مخزّنة كسنتات
  const category = await prisma.category.create({
    data: { name: 'مواد غذائية', color: '#10b981', storeId: store.id },
  })

  await prisma.product.createMany({
    data: [
      { name: 'أرز بسمتي 5 كيلو', barcode: '6281023590065', price: 250, priceCurrency: 'USD', costPrice: 180, stock: 50, storeId: store.id, categoryId: category.id },
      // lowStockThreshold مضبوط قريباً من المخزون الحالي لتسهيل اختبار إشعار LOW_STOCK ببضع عمليات بيع
      { name: 'زيت نخيل 1.5 لتر',  barcode: '6281003060069', price: 120, priceCurrency: 'USD', costPrice: 85,  stock: 30, lowStockThreshold: 28, storeId: store.id, categoryId: category.id },
      { name: 'سكر أبيض 2 كيلو',   barcode: '6281006330015', price: 80,  priceCurrency: 'USD', costPrice: 55,  stock: 40, storeId: store.id, categoryId: category.id },
    ],
  })

  // عميل تجريبي بسقف دين — لاختبار إشعار CUSTOMER_DEBT_LIMIT عبر بيع آجل
  await prisma.customer.create({
    data: {
      name: 'محل الوفاء للتجزئة', phone: '+966511111111',
      creditLimit: 10000, debtLimitUsdCents: 5000, storeId: store.id,
    },
  })

  // النقد الافتتاحي بالليرة السورية
  await prisma.shift.create({
    data: {
      storeId:     store.id,
      branchId:    branch1.id,
      userId:      cashier1.id,
      openingCash: 500000,
      status:      'OPEN',
    },
  })

  console.log(`
✅ Seed مكتمل!

══════════════════════════════════════
مدير النظام (Super Admin):
  URL:      /super-admin/login
  Email:    admin@platform.com
  Password: Admin@2024
══════════════════════════════════════
المتجر التجريبي → /alamal/login

  مدير:     manager@alamal.com  / Manager@2024
  كاشير 1:  cashier1@alamal.com / Cashier@2024  (الفرع الرئيسي)
  كاشير 2:  cashier2@alamal.com / Cashier@2024  (فرع الشمال)
══════════════════════════════════════
`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
