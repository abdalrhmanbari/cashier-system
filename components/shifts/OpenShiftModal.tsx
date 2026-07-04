'use client';

import { useState } from 'react';
import { X, DollarSign, Loader2 } from 'lucide-react';
import { useShiftStore } from '@/store/shiftStore';
import { ShiftWithUser } from '@/types';
import { Button } from '@/components/ui/button';

interface OpenShiftModalProps {
  onClose: () => void;
  onSuccess: (shift: ShiftWithUser) => void;
}

export function OpenShiftModal({ onClose, onSuccess }: OpenShiftModalProps) {
  const [amount, setAmount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { setShift } = useShiftStore();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openingCash: Math.round(amount) }),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.message ?? 'حدث خطأ');
        return;
      }

      setShift(json.data as ShiftWithUser);
      onSuccess(json.data);
    } catch {
      setError('حدث خطأ في الاتصال');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-bold text-lg">فتح وردية جديدة</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2">
              <DollarSign className="inline w-4 h-4 mb-0.5 me-1" />
              مبلغ النقد الافتتاحي (ر.س)
            </label>
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="0"
              className="w-full px-4 py-3 text-xl font-bold text-center rounded-xl border-2 border-primary bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <p className="text-xs text-muted-foreground bg-muted rounded-lg p-3">
            سيتم احتساب النقد المتوقع تلقائياً بناءً على مبيعاتك النقدية خلال الوردية.
            المبلغ المتوقع لن يظهر للكاشير إلا عند إغلاق الوردية.
          </p>

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
              className="flex-1 h-12 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-green-400 font-bold"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> جاري الفتح...</>
              ) : (
                'فتح الوردية'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
