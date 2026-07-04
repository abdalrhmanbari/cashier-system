'use client';

import { useState } from 'react';
import { X, Lock, Loader2, CheckCircle2, AlertCircle, MinusCircle } from 'lucide-react';
import { useShiftStore } from '@/store/shiftStore';
import { formatCurrency, getShiftDifference } from '@/lib/utils';
import { ShiftWithUser } from '@/types';
import { Button } from '@/components/ui/button';

interface CloseShiftModalProps {
  shift: ShiftWithUser;
  onClose: () => void;
  onSuccess: () => void;
}

export function CloseShiftModal({ shift, onClose, onSuccess }: CloseShiftModalProps) {
  const [actualCash, setActualCash] = useState(0);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    expectedCash: number;
    actualCash: number;
    difference: number;
    type: string;
  } | null>(null);
  const { setShift } = useShiftStore();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/shifts/${shift.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actualCash: Math.round(actualCash),
          notes,
        }),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.message ?? 'حدث خطأ');
        return;
      }

      const diff = getShiftDifference(
        json.data.expectedCash,
        json.data.actualCash
      );

      setResult({
        expectedCash: json.data.expectedCash,
        actualCash: json.data.actualCash,
        difference: diff.amount,
        type: diff.type,
      });

      setShift(null);
    } catch {
      setError('حدث خطأ في الاتصال');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (result) {
    const isMatch = result.type === 'match';
    const isSurplus = result.type === 'surplus';

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border">
          <div className="p-6 text-center">
            <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center ${
              isMatch ? 'bg-green-100 dark:bg-green-900/20' :
              isSurplus ? 'bg-blue-100 dark:bg-blue-900/20' :
              'bg-red-100 dark:bg-red-900/20'
            }`}>
              {isMatch ? (
                <CheckCircle2 className="w-9 h-9 text-green-600" />
              ) : isSurplus ? (
                <AlertCircle className="w-9 h-9 text-blue-600" />
              ) : (
                <MinusCircle className="w-9 h-9 text-red-600" />
              )}
            </div>

            <h2 className="text-xl font-bold mb-1">
              {isMatch ? 'مطابق تماماً ✅' : isSurplus ? 'فائض 🟢' : 'عجز 🔴'}
            </h2>
            <p className="text-muted-foreground text-sm mb-6">تم إغلاق الوردية بنجاح</p>

            <div className="bg-muted/40 rounded-xl p-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">النقد المتوقع</span>
                <span className="font-medium">{formatCurrency(result.expectedCash)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">النقد الفعلي</span>
                <span className="font-medium">{formatCurrency(result.actualCash)}</span>
              </div>
              <div className={`flex justify-between font-bold border-t border-border pt-2 ${
                isMatch ? 'text-green-600' : isSurplus ? 'text-blue-600' : 'text-red-600'
              }`}>
                <span>{isMatch ? 'الفرق' : isSurplus ? 'فائض' : 'عجز'}</span>
                <span>{isMatch ? '—' : formatCurrency(result.difference)}</span>
              </div>
            </div>

            <Button onClick={onSuccess} className="mt-5 w-full h-12 rounded-xl font-bold">
              إغلاق
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-500" />
            إغلاق الوردية
          </h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-sm text-amber-700 dark:text-amber-400">
            <p>عدّ النقد في الصندوق وأدخل المبلغ الفعلي. سيتم مقارنته بالمبلغ المتوقع بعد الإغلاق.</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">النقد الفعلي في الصندوق (ر.س)</label>
            <input
              type="number"
              min={0}
              value={actualCash}
              onChange={(e) => setActualCash(Number(e.target.value))}
              placeholder="0"
              className="w-full px-4 py-3 text-xl font-bold text-center rounded-xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-900/10 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">ملاحظات (اختياري)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي ملاحظات على الوردية..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm resize-none"
            />
          </div>

          {error && (
            <p className="text-destructive text-sm text-center">{error}</p>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="flex-1 h-12 rounded-xl"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 h-12 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 font-bold"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> جاري الإغلاق...</>
              ) : (
                <><Lock className="w-4 h-4" /> إغلاق الوردية</>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
