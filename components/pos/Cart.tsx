'use client';

import { Trash2, Plus, Minus, ShoppingCart } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function Cart({ onCheckout }: { onCheckout: () => void }) {
  const { items, subtotal, discountAmount, taxAmount, total, removeItem, updateQuantity, globalDiscount, setGlobalDiscount } =
    useCartStore();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">السلة</h2>
          {items.length > 0 && (
            <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {items.length}
            </span>
          )}
        </div>
        {items.length > 0 && (
          <Button
            variant="link"
            className="h-auto p-0 text-xs"
            onClick={() => useCartStore.getState().clearCart()}
          >
            مسح الكل
          </Button>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
            <ShoppingCart className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm">السلة فارغة</p>
            <p className="text-xs mt-1 opacity-60">أضف منتجات للبدء</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.productId}
              className="bg-muted/40 rounded-xl p-3 border border-border/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(item.unitPrice)} × {item.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon-xs"
                    onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                  <Button
                    variant="outline"
                    size="icon-xs"
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    disabled={item.quantity >= item.stock}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost-destructive"
                    size="icon-xs"
                    onClick={() => removeItem(item.productId)}
                    className="ms-1 text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground">
                  {item.discount > 0 && `خصم ${item.discount}${item.discountType === 'PERCENTAGE' ? '%' : ' ر.س'}`}
                </span>
                <span className="font-semibold text-sm">{formatCurrency(item.total)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary */}
      {items.length > 0 && (
        <div className="border-t border-border p-4 space-y-3">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>المجموع الفرعي</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm flex-1">خصم عام %</span>
              <input
                type="number"
                min={0}
                max={100}
                value={globalDiscount}
                onChange={(e) => setGlobalDiscount(Number(e.target.value))}
                className="w-16 text-center py-0.5 px-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {discountAmount > 0 && (
                <span className="text-destructive text-sm">-{formatCurrency(discountAmount)}</span>
              )}
            </div>

            {taxAmount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>الضريبة (15%)</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
            )}

            <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
              <span>الإجمالي</span>
              <span className="text-primary">{formatCurrency(total)}</span>
            </div>
          </div>

          <Button
            onClick={onCheckout}
            className="w-full h-12 rounded-xl font-bold shadow-md shadow-primary/20"
          >
            إتمام البيع (F12)
          </Button>
        </div>
      )}
    </div>
  );
}
