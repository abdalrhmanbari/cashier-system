import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { CartItem, SaleType, DiscountType } from '@/types';
import { calculateDiscountedPrice, calculateTax } from '@/lib/utils';

interface CartStore {
  items: CartItem[];
  type: SaleType;
  customerId?: string;
  globalDiscount: number;
  taxEnabled: boolean;

  // Computed
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;

  // Actions
  addItem: (item: Omit<CartItem, 'quantity' | 'total'> & { quantity?: number }) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateDiscount: (productId: string, discount: number, discountType: DiscountType) => void;
  setGlobalDiscount: (discount: number) => void;
  setType: (type: SaleType) => void;
  setCustomer: (customerId?: string) => void;
  setTaxEnabled: (enabled: boolean) => void;
  clearCart: () => void;
}

function calcItem(item: CartItem): CartItem {
  const discountedPrice = calculateDiscountedPrice(item.unitPrice, item.discountType, item.discount);
  return { ...item, total: discountedPrice * item.quantity };
}

function computeTotals(items: CartItem[], globalDiscount: number, taxEnabled: boolean) {
  const subtotal = items.reduce((sum, i) => sum + i.total, 0);
  const discountAmount = Math.round(subtotal * (globalDiscount / 100));
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = taxEnabled ? calculateTax(afterDiscount) : 0;
  const total = afterDiscount + taxAmount;
  return { subtotal, discountAmount, taxAmount, total };
}

export const useCartStore = create<CartStore>()(
  devtools((set, get) => ({
    items: [],
    type: 'CASH',
    customerId: undefined,
    globalDiscount: 0,
    taxEnabled: false,
    subtotal: 0,
    discountAmount: 0,
    taxAmount: 0,
    total: 0,

    addItem: (newItem) => {
      const existing = get().items.find((i) => i.productId === newItem.productId);
      let items: CartItem[];

      if (existing) {
        const quantity = existing.quantity + (newItem.quantity ?? 1);
        if (quantity > existing.stock) return;
        items = get().items.map((i) =>
          i.productId === newItem.productId ? calcItem({ ...i, quantity }) : i
        );
      } else {
        const item: CartItem = {
          ...newItem,
          quantity: newItem.quantity ?? 1,
          discount: newItem.discount ?? 0,
          discountType: newItem.discountType ?? 'PERCENTAGE',
          total: 0,
        };
        items = [...get().items, calcItem(item)];
      }

      const { subtotal, discountAmount, taxAmount, total } = computeTotals(
        items,
        get().globalDiscount,
        get().taxEnabled
      );
      set({ items, subtotal, discountAmount, taxAmount, total });
    },

    removeItem: (productId) => {
      const items = get().items.filter((i) => i.productId !== productId);
      const { subtotal, discountAmount, taxAmount, total } = computeTotals(
        items,
        get().globalDiscount,
        get().taxEnabled
      );
      set({ items, subtotal, discountAmount, taxAmount, total });
    },

    updateQuantity: (productId, quantity) => {
      if (quantity <= 0) {
        get().removeItem(productId);
        return;
      }
      const items = get().items.map((i) =>
        i.productId === productId ? calcItem({ ...i, quantity }) : i
      );
      const { subtotal, discountAmount, taxAmount, total } = computeTotals(
        items,
        get().globalDiscount,
        get().taxEnabled
      );
      set({ items, subtotal, discountAmount, taxAmount, total });
    },

    updateDiscount: (productId, discount, discountType) => {
      const items = get().items.map((i) =>
        i.productId === productId ? calcItem({ ...i, discount, discountType }) : i
      );
      const { subtotal, discountAmount, taxAmount, total } = computeTotals(
        items,
        get().globalDiscount,
        get().taxEnabled
      );
      set({ items, subtotal, discountAmount, taxAmount, total });
    },

    setGlobalDiscount: (globalDiscount) => {
      const { subtotal, discountAmount, taxAmount, total } = computeTotals(
        get().items,
        globalDiscount,
        get().taxEnabled
      );
      set({ globalDiscount, subtotal, discountAmount, taxAmount, total });
    },

    setType: (type) => set({ type }),
    setCustomer: (customerId) => set({ customerId }),
    setTaxEnabled: (taxEnabled) => {
      const { subtotal, discountAmount, taxAmount, total } = computeTotals(
        get().items,
        get().globalDiscount,
        taxEnabled
      );
      set({ taxEnabled, subtotal, discountAmount, taxAmount, total });
    },

    clearCart: () =>
      set({
        items: [],
        type: 'CASH',
        customerId: undefined,
        globalDiscount: 0,
        subtotal: 0,
        discountAmount: 0,
        taxAmount: 0,
        total: 0,
      }),
  }))
);
