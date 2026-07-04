import Dexie, { type Table } from 'dexie';

export interface OfflineSale {
  id?: number;
  tempId: string;
  data: Record<string, unknown>;
  synced: boolean;
  createdAt: Date;
}

export interface OfflineSaleItem {
  id?: number;
  tempSaleId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

export interface PendingSync {
  id?: number;
  entity: string;
  action: 'create' | 'update' | 'delete';
  payload: Record<string, unknown>;
  retries: number;
  createdAt: Date;
}

export class CashierDB extends Dexie {
  sales!: Table<OfflineSale>;
  saleItems!: Table<OfflineSaleItem>;
  pendingSync!: Table<PendingSync>;

  constructor() {
    super('CashierSystemDB');
    this.version(1).stores({
      sales: '++id, tempId, synced, createdAt',
      saleItems: '++id, tempSaleId, productId',
      pendingSync: '++id, entity, action, createdAt',
    });
  }
}

export const db = new CashierDB();

export async function saveSaleOffline(saleData: Record<string, unknown>): Promise<string> {
  const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await db.sales.add({
    tempId,
    data: saleData,
    synced: false,
    createdAt: new Date(),
  });
  return tempId;
}

export async function getUnsyncedSales(): Promise<OfflineSale[]> {
  return db.sales.where('synced').equals(0).toArray();
}

export async function markSaleSynced(tempId: string): Promise<void> {
  await db.sales.where('tempId').equals(tempId).modify({ synced: true });
}

export async function queueSync(
  entity: string,
  action: 'create' | 'update' | 'delete',
  payload: Record<string, unknown>
): Promise<void> {
  await db.pendingSync.add({
    entity,
    action,
    payload,
    retries: 0,
    createdAt: new Date(),
  });
}

export async function getPendingSyncs(): Promise<PendingSync[]> {
  return db.pendingSync.toArray();
}

export async function removePendingSync(id: number): Promise<void> {
  await db.pendingSync.delete(id);
}
