'use client';

import { useState } from 'react';
import { X, Check, User, CreditCard, Banknote, Loader2 } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { useShiftStore } from '@/store/shiftStore';
import { formatCurrency } from '@/lib/utils';
import { SaleType } from '@/types';
import { Button } from '@/components/ui/button';

interface PaymentModalProps {
  onClose: () => void;
  onSuccess: (saleId: string) => void;
  customers: { id: string; name: string; phone?: string | null }[];
}

export function PaymentModal({ onClose, onSuccess, customers }: PaymentModalProps) {
  const { items, total, subtotal, discountAmount, taxAmount, type, customerId, setType, setCustomer, clearCart } =
    useCartStore();
  const { currentShift, updateExpectedCash } = useShiftStore();

  const [amountPaid, setAmountPaid] = useState<number>(total);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const change = Math.max(0, amountPaid - total);
  const remaining = type === 'CREDIT' ? total - amountPaid : 0;

  const quickAmounts = [total, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500];
  const uniqueAmounts = Array.from(new Set(quickAmounts)).sort((a, b) => a - b);

  async function handleSubmit() {
    if (type === 'CASH' && amountPaid < total) {
      setError('المبلغ المدفوع أقل من الإجمالي');
      return;
    }
    if (type === 'CREDIT' && !customerId) {
      setError('يجب اختيار العميل للبيع الآجل');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          customerId: customerId ?? undefined,
          shiftId: currentShift?.id,
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            discount: i.discount,
            total: i.total,
          })),
          subtotal,
          discount: discountAmount,
          tax: taxAmount,
          total,
          amountPaid: type === 'CASH' ? amountPaid : Math.min(amountPaid, total),
          remaining: type === 'CREDIT' ? remaining : 0,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        setError(json.message ?? 'حدث خطأ أثناء حفظ الفاتورة');
        return;
      }

      if (type === 'CASH' && currentShift) {
        updateExpectedCash(total);
      }

      clearCart();
      onSuccess(json.data.id);
    } catch {
      setError('حدث خطأ في الاتصال');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-bold text-lg">إتمام البيع</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-5 space-y-5">
          {/* Sale type — kept as raw buttons due to dynamic state styling */}
          <div>
            <label className="block text-sm font-medium mb-2">نوع البيع</label>
            <div className="grid grid-cols-2 gap-2">
              {(['CASH', 'CREDIT'] as SaleType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 transition font-medium text-sm ${
                    type === t
                      ? t === 'CASH'
                        ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                        : 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {t === 'CASH' ? <Banknote className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                  {t === 'CASH' ? 'نقدي' : 'آجل'}
                </button>
              ))}
            </div>
          </div>

          {/* Customer (for credit) */}
          {type === 'CREDIT' && (
            <div>
              <label className="block text-sm font-medium mb-2">
                <User className="inline w-4 h-4 mb-0.5 me-1" />
                العميل *
              </label>
              <select
                value={customerId ?? ''}
                onChange={(e) => setCustomer(e.target.value || undefined)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
              >
                <option value="">اختر العميل...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
                ))}
              </select>
            </div>
          )}

          {/* Totals */}
          <div className="bg-muted/40 rounded-xl p-4 space-y-2 text-sm">
            {discountAmount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>خصم</span>
                <span className="text-destructive">- {formatCurrency(discountAmount)}</span>
              </div>
            )}
            {taxAmount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>ضريبة</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t border-border pt-2">
              <span>الإجمالي المطلوب</span>
              <span className="text-primary text-xl">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Amount paid */}
          <div>
            <label className="block text-sm font-medium mb-2">المبلغ المدفوع</label>
            <input
              type="number"
              min={0}
              value={amountPaid}
              onChange={(e) => setAmountPaid(Math.round(Number(e.target.value)))}
              className="w-full px-4 py-3 text-xl font-bold text-center rounded-xl border-2 border-primary bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {/* Quick amounts — kept as raw buttons due to dynamic active state */}
            <div className="flex gap-2 mt-2">
              {uniqueAmounts.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setAmountPaid(amt)}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition ${
                    amountPaid === amt ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'
                  }`}
                >
                  {formatCurrency(amt)}
                </button>
              ))}
            </div>
          </div>

          {/* Change / remaining */}
          {type === 'CASH' && change > 0 && (
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 flex justify-between items-center">
              <span className="text-green-700 dark:text-green-400 font-medium text-sm">الباقي للعميل</span>
              <span className="text-green-700 dark:text-green-400 font-bold text-lg">{formatCurrency(change)}</span>
            </div>
          )}

          {type === 'CREDIT' && remaining > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 flex justify-between items-center">
              <span className="text-amber-700 dark:text-amber-400 font-medium text-sm">المبلغ المتبقي (دين)</span>
              <span className="text-amber-700 dark:text-amber-400 font-bold text-lg">{formatCurrency(remaining)}</span>
            </div>
          )}

          {error && (
            <p className="text-destructive text-sm text-center bg-destructive/10 rounded-lg p-3">{error}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-5 border-t border-border">
          <Button
            variant="secondary"
            onClick={onClose}
            className="flex-1 h-12 rounded-xl"
          >
            إلغاء (Esc)
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 h-12 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-green-400 font-bold shadow-lg shadow-green-900/20"
          >
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</>
            ) : (
              <><Check className="w-4 h-4" /> تأكيد البيع</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
