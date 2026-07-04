import { z } from 'zod';

export const saleItemSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().int().min(1).max(9999),
  unitPrice: z.number().int().min(0).max(100_000_000),
  // discount هنا إما نسبة (0-100) أو مبلغ ثابت بالهللات — لا يُقيَّد بـ 100
  discount: z.number().int().min(0).max(100_000_000).default(0),
  total: z.number().int().min(0),
});

export const saleSchema = z.object({
  type: z.enum(['CASH', 'CREDIT']),
  customerId: z.string().cuid().optional(),
  shiftId: z.string().cuid().optional(),
  items: z
    .array(saleItemSchema)
    .min(1, 'يجب إضافة منتج واحد على الأقل')
    .max(100, 'لا يمكن إضافة أكثر من 100 منتج في فاتورة واحدة'),
  subtotal: z.number().int().min(0),
  // discount هنا مبلغ بالهللات (ليس نسبة) — ناتج computeTotals
  discount: z.number().int().min(0),
  tax: z.number().int().min(0).default(0),
  total: z.number().int().min(0),
  amountPaid: z.number().int().min(0),
  remaining: z.number().int().min(0).default(0),
  notes: z.string().max(500).optional(),
});

export type SaleInput = z.infer<typeof saleSchema>;
export type SaleItemInput = z.infer<typeof saleItemSchema>;
