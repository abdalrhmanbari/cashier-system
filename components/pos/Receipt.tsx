'use client';

import { forwardRef } from 'react';
import { formatCurrency, formatDateTime } from '@/lib/utils';

interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface ReceiptProps {
  invoiceNumber: string;
  date: Date;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amountPaid: number;
  change: number;
  cashierName: string;
  customerName?: string;
}

export const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(
  ({ invoiceNumber, date, items, subtotal, discount, tax, total, amountPaid, change, cashierName, customerName }, ref) => {
    const storeName = process.env.NEXT_PUBLIC_STORE_NAME ?? 'المحل التجاري';
    const storePhone = process.env.NEXT_PUBLIC_STORE_PHONE ?? '';

    return (
      <div
        ref={ref}
        dir="rtl"
        style={{ width: '80mm', fontFamily: 'Cairo, Tahoma, sans-serif', fontSize: '12px', padding: '4mm' }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <p style={{ fontSize: '18px', fontWeight: 'bold' }}>{storeName}</p>
          {storePhone && <p>هاتف: {storePhone}</p>}
        </div>

        <div style={{ borderTop: '1px dashed #000', marginBottom: '6px' }} />

        {/* Invoice Info */}
        <div style={{ marginBottom: '6px', fontSize: '11px' }}>
          <p>رقم الفاتورة: <strong>{invoiceNumber}</strong></p>
          <p>التاريخ: {formatDateTime(date)}</p>
          <p>الكاشير: {cashierName}</p>
          {customerName && <p>العميل: {customerName}</p>}
        </div>

        <div style={{ borderTop: '1px dashed #000', marginBottom: '6px' }} />

        {/* Items */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'right', paddingBottom: '4px', borderBottom: '1px solid #000' }}>الصنف</th>
              <th style={{ textAlign: 'center', paddingBottom: '4px', borderBottom: '1px solid #000' }}>ك</th>
              <th style={{ textAlign: 'left', paddingBottom: '4px', borderBottom: '1px solid #000' }}>المجموع</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i}>
                <td style={{ textAlign: 'right', padding: '2px 0' }}>{item.name}</td>
                <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                <td style={{ textAlign: 'left' }}>{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ borderTop: '1px dashed #000', marginTop: '6px', marginBottom: '6px' }} />

        {/* Totals */}
        <table style={{ width: '100%', fontSize: '11px' }}>
          <tbody>
            <tr>
              <td>المجموع</td>
              <td style={{ textAlign: 'left' }}>{formatCurrency(subtotal)}</td>
            </tr>
            {discount > 0 && (
              <tr>
                <td>الخصم</td>
                <td style={{ textAlign: 'left' }}>- {formatCurrency(discount)}</td>
              </tr>
            )}
            {tax > 0 && (
              <tr>
                <td>الضريبة (15%)</td>
                <td style={{ textAlign: 'left' }}>{formatCurrency(tax)}</td>
              </tr>
            )}
            <tr style={{ fontWeight: 'bold', fontSize: '13px', borderTop: '1px solid #000' }}>
              <td style={{ paddingTop: '4px' }}>الإجمالي</td>
              <td style={{ textAlign: 'left', paddingTop: '4px' }}>{formatCurrency(total)}</td>
            </tr>
            <tr>
              <td>المدفوع</td>
              <td style={{ textAlign: 'left' }}>{formatCurrency(amountPaid)}</td>
            </tr>
            {change > 0 && (
              <tr>
                <td>الباقي</td>
                <td style={{ textAlign: 'left' }}>{formatCurrency(change)}</td>
              </tr>
            )}
          </tbody>
        </table>

        <div style={{ borderTop: '1px dashed #000', marginTop: '8px', paddingTop: '6px', textAlign: 'center', fontSize: '10px' }}>
          <p>شكراً لزيارتكم</p>
        </div>
      </div>
    );
  }
);

Receipt.displayName = 'Receipt';
