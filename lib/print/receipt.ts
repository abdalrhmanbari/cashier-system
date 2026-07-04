import { formatSyp, formatUsd, formatDateTime } from '@/lib/utils';

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ReceiptData {
  invoiceNumber: string;
  date: Date;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  tax: number;
  /** اسم الضريبة كما يظهر على الفاتورة — افتراضياً "الضريبة" */
  taxName?: string;
  total: number;
  amountPaid: number;
  change: number;
  cashierName: string;
  customerName?: string;
  /** المعادل الدولاري للإجمالي — يُعرض كسطر ثانوي فقط عند pricingCurrency === 'USD' */
  totalUsdCents?: number;
  /** سعر الصرف وقت البيع — يُعرض دائماً كسطر صغير للمرجعية */
  exchangeRate?: number;
  pricingCurrency?: 'USD' | 'SYP';
}

/** توليد HTML للفاتورة الحرارية 80mm — كل المبالغ بالليرة السورية (الأساس)، مع سطر معادل دولاري اختياري */
export function generateReceiptHTML(data: ReceiptData): string {
  const storeName = process.env.NEXT_PUBLIC_STORE_NAME ?? 'المحل التجاري';
  const storeAddress = process.env.NEXT_PUBLIC_STORE_ADDRESS ?? '';
  const storePhone = process.env.NEXT_PUBLIC_STORE_PHONE ?? '';

  const itemsHTML = data.items
    .map(
      (item) => `
      <tr>
        <td style="text-align:right">${item.name}</td>
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:left">${formatSyp(item.unitPrice)}</td>
        <td style="text-align:left">${formatSyp(item.total)}</td>
      </tr>
    `
    )
    .join('');

  const usdLine = data.pricingCurrency === 'USD' && data.totalUsdCents !== undefined
    ? `<tr><td>المعادل بالدولار:</td><td style="text-align:left">${formatUsd(data.totalUsdCents)}</td></tr>`
    : '';

  const rateLine = data.exchangeRate
    ? `<div class="footer" style="margin-top:4px">سعر الصرف: $1 = ${data.exchangeRate.toLocaleString('en-US')} ل.س</div>`
    : '';

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Cairo', 'Tahoma', sans-serif;
          font-size: 12px;
          width: 80mm;
          padding: 4mm;
          direction: rtl;
        }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .large { font-size: 16px; }
        .divider { border-top: 1px dashed #000; margin: 4px 0; }
        table { width: 100%; border-collapse: collapse; }
        th { border-bottom: 1px solid #000; padding: 2px; font-size: 11px; }
        td { padding: 2px; font-size: 11px; }
        .total-row { border-top: 1px dashed #000; font-weight: bold; }
        .footer { margin-top: 8px; text-align: center; font-size: 10px; }
        @media print {
          @page { margin: 0; size: 80mm auto; }
        }
      </style>
    </head>
    <body>
      <div class="center bold large">${storeName}</div>
      ${storeAddress ? `<div class="center">${storeAddress}</div>` : ''}
      ${storePhone ? `<div class="center">هاتف: ${storePhone}</div>` : ''}

      <div class="divider"></div>

      <div>رقم الفاتورة: <strong>${data.invoiceNumber}</strong></div>
      <div>التاريخ: ${formatDateTime(data.date)}</div>
      <div>الكاشير: ${data.cashierName}</div>
      ${data.customerName ? `<div>العميل: ${data.customerName}</div>` : ''}

      <div class="divider"></div>

      <table>
        <thead>
          <tr>
            <th style="text-align:right">الصنف</th>
            <th style="text-align:center">الكمية</th>
            <th style="text-align:left">السعر</th>
            <th style="text-align:left">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>

      <div class="divider"></div>

      <table>
        <tr><td>المجموع:</td><td style="text-align:left">${formatSyp(data.subtotal)}</td></tr>
        ${data.discount > 0 ? `<tr><td>الخصم:</td><td style="text-align:left">- ${formatSyp(data.discount)}</td></tr>` : ''}
        ${data.tax > 0 ? `<tr><td>${data.taxName ?? 'الضريبة'}:</td><td style="text-align:left">${formatSyp(data.tax)}</td></tr>` : ''}
        <tr class="total-row"><td>الإجمالي:</td><td style="text-align:left">${formatSyp(data.total)}</td></tr>
        ${usdLine}
        <tr><td>المدفوع:</td><td style="text-align:left">${formatSyp(data.amountPaid)}</td></tr>
        ${data.change > 0 ? `<tr><td>الباقي:</td><td style="text-align:left">${formatSyp(data.change)}</td></tr>` : ''}
      </table>

      <div class="footer">
        <div class="divider"></div>
        <p>شكراً لزيارتكم</p>
        <p>نتمنى لكم تجربة تسوق ممتازة</p>
      </div>
      ${rateLine}
    </body>
    </html>
  `;
}

/** فتح نافذة طباعة */
export function printReceipt(data: ReceiptData): void {
  const html = generateReceiptHTML(data);
  const printWindow = window.open('', '_blank', 'width=320,height=600');
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 500);
}
