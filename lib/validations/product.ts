import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().min(2, 'اسم المنتج مطلوب'),
  barcode: z.string().optional(),
  price: z.number().min(0, 'السعر يجب أن يكون موجباً'),
  costPrice: z.number().min(0).optional().default(0),
  categoryId: z.string().optional(),
  unit: z.string().default('قطعة'),
  stock: z.number().int().min(0).default(0),
  minStock: z.number().int().min(0).default(5),
  isActive: z.boolean().default(true),
  hasDiscount: z.boolean().default(false),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).default('PERCENTAGE'),
  discountValue: z.number().min(0).default(0),
});

export type ProductInput = z.infer<typeof productSchema>;
