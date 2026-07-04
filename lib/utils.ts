import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** تنسيق المبلغ المالي */
export function formatCurrency(amount: number): string {
  const currency = process.env.NEXT_PUBLIC_CURRENCY ?? 'ر.س';
  return `${parseFloat(amount.toFixed(2))} ${currency}`;
}

/** تنسيق مبلغ دولاري مخزَّن كسنتات (Int) — 250 → "$2.50" */
export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** تنسيق مبلغ بالليرة السورية — عدد صحيح دائماً، بدون كسور */
export function formatSyp(amount: number): string {
  return `${Math.round(amount).toLocaleString('en-US')} ل.س`;
}

/** تحويل سعر بالسنتات (دولار) إلى ليرة سورية صحيحة حسب سعر الصرف الحالي */
export function usdCentsToSyp(cents: number, rate: number): number {
  return Math.round((cents / 100) * rate);
}

/** تقريب مبلغ بالليرة حسب قاعدة التقريب المختارة ("100"/"500"/"1000") */
export function roundSyp(amount: number, rule: string): number {
  const step = parseInt(rule, 10) || 500;
  return Math.round(amount / step) * step;
}

/** تنسيق التاريخ بالعربية */
export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** تنسيق التاريخ والوقت */
export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** توليد رقم الفاتورة */
export function generateInvoiceNumber(prefix: string, count: number): string {
  const year = new Date().getFullYear();
  const num = String(count + 1).padStart(4, '0');
  return `${prefix}-${year}-${num}`;
}

/**
 * يوزّع مبلغاً صحيحاً (خصم إجمالي الفاتورة) على أسطر عدة نسبياً حسب وزن كل سطر (قيمته قبل التوزيع)،
 * ثم يصحّح باقي القسمة الصحيحة بإضافته للأسطر الأكبر وزناً حتى يساوي مجموع الحصص المبلغ المطلوب توزيعه بالضبط.
 */
export function distributeProportionally(weights: number[], amountToDistribute: number): number[] {
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  if (totalWeight <= 0 || amountToDistribute <= 0) return weights.map(() => 0);

  const shares = weights.map(w => Math.floor((w / totalWeight) * amountToDistribute));
  let remainder = amountToDistribute - shares.reduce((s, x) => s + x, 0);

  const order = weights.map((_, i) => i).sort((a, b) => weights[b] - weights[a]);
  for (let idx = 0; remainder > 0; idx = (idx + 1) % order.length) {
    shares[order[idx]] += 1;
    remainder -= 1;
  }
  return shares;
}

/** حساب سعر المنتج بعد الخصم */
export function calculateDiscountedPrice(
  price: number,
  discountType: 'PERCENTAGE' | 'FIXED',
  discountValue: number
): number {
  if (discountType === 'PERCENTAGE') {
    return Math.round(price * (1 - discountValue / 100));
  }
  return Math.max(0, price - discountValue);
}

/** حساب ضريبة القيمة المضافة */
export function calculateTax(amount: number, taxRate: number = 15): number {
  return Math.round(amount * (taxRate / 100));
}

/** تلخيص حالة الوردية */
export function getShiftDifference(expected: number, actual: number) {
  const diff = actual - expected;
  if (diff > 0) return { type: 'surplus', amount: diff, label: 'فائض' };
  if (diff < 0) return { type: 'deficit', amount: Math.abs(diff), label: 'عجز' };
  return { type: 'match', amount: 0, label: 'مطابق' };
}
