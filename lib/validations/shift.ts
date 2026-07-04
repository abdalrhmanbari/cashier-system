import { z } from 'zod';

export const openShiftSchema = z.object({
  openingCash: z.number().min(0, 'مبلغ النقد الافتتاحي يجب أن يكون موجباً'),
  userId: z.string(),
});

export const closeShiftSchema = z.object({
  shiftId: z.string(),
  actualCash: z.number().min(0, 'المبلغ الفعلي يجب أن يكون موجباً'),
  notes: z.string().optional(),
});

export type OpenShiftInput = z.infer<typeof openShiftSchema>;
export type CloseShiftInput = z.infer<typeof closeShiftSchema>;
