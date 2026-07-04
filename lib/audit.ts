import { prisma } from '@/lib/prisma';

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
  | 'EXPORT_DATA'
  | 'IMPORT_DATA'
  | 'LOGIN'
  | 'LOGOUT';

interface AuditParams {
  userId: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  oldData?: object;
  newData?: object;
  ip?: string;
  userAgent?: string;
}

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        oldData: params.oldData ? JSON.stringify(params.oldData) : null,
        newData: params.newData ? JSON.stringify(params.newData) : null,
        ip: params.ip,
      },
    });
  } catch {
    // audit لا يوقف العملية الأصلية عند الفشل
  }
}
