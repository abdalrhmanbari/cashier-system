import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export type AuditAction =
  | 'CREATE_SALE'
  | 'CANCEL_SALE'
  | 'CREATE_PRODUCT'
  | 'UPDATE_PRODUCT'
  | 'DELETE_PRODUCT'
  | 'OPEN_SHIFT'
  | 'CLOSE_SHIFT'
  | 'CREATE_USER'
  | 'UPDATE_USER'
  | 'DELETE_USER'
  | 'CHANGE_PRICE'
  | 'CHANGE_EXCHANGE_RATE'
  | 'CUSTOMER_PAYMENT'
  | 'INVENTORY_ADJUSTMENT'
  | 'UPDATE_STORE_SETTINGS'
  | 'CREATE_SUPER_ADMIN'
  | 'UPDATE_SUPER_ADMIN'
  | 'EXPORT_DATA'
  | 'IMPORT_DATA'
  | 'LOGIN'
  | 'LOGOUT';

interface AuditParams {
  // userId: مستخدم المتجر (StoreUser) فقط حسب FK بالـ schema — لا يُمرَّر لعمليات السوبر أدمن
  userId?: string;
  // superAdminId: فاعل من نوع سوبر أدمن — يُمرَّر بدلاً من userId لعمليات super-admin/*
  superAdminId?: string;
  storeId?: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  oldData?: object;
  newData?: object;
  ip?: string;
  userAgent?: string;
}

// best-effort بالكامل: فشل تسجيل الـ audit لا يُفشل العملية الأصلية أبداً — نفس مبدأ logApiError
export async function logAudit(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        superAdminId: params.superAdminId,
        storeId: params.storeId,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        oldData: params.oldData ? JSON.stringify(params.oldData) : null,
        newData: params.newData ? JSON.stringify(params.newData) : null,
        ip: params.ip,
      },
    });
  } catch (e) {
    logger.error('فشل تسجيل AuditLog', { action: params.action, resource: params.resource, storeId: params.storeId, err: (e as Error)?.message });
  }
}
