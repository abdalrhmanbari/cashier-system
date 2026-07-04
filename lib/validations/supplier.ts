import { z } from 'zod';

export const supplierSchema = z.object({
  name: z.string().min(2, 'اسم المورد مطلوب'),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export const supplierInvoiceSchema = z.object({
  supplierId: z.string(),
  invoiceNumber: z.string().optional(),
  date: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().int().min(1),
      unitCost: z.number().min(0),
      total: z.number().min(0),
    })
  ).min(1),
  total: z.number().min(0),
  amountPaid: z.number().min(0).default(0),
  notes: z.string().optional(),
});

export const customerSchema = z.object({
  name: z.string().min(2, 'اسم العميل مطلوب'),
  phone: z.string().optional(),
  address: z.string().optional(),
  creditLimit: z.number().min(0).default(0),
});

export type SupplierInput = z.infer<typeof supplierSchema>;
export type SupplierInvoiceInput = z.infer<typeof supplierInvoiceSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
