'use client';

import {
  getUnsyncedSales,
  markSaleSynced,
  getPendingSyncs,
  removePendingSync,
} from './offline';

let syncInProgress = false;

export async function syncOfflineData(): Promise<{ synced: number; errors: number }> {
  if (syncInProgress || !navigator.onLine) return { synced: 0, errors: 0 };

  syncInProgress = true;
  let synced = 0;
  let errors = 0;

  try {
    // Sync pending sales
    const unsyncedSales = await getUnsyncedSales();
    for (const sale of unsyncedSales) {
      try {
        const res = await fetch('/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...sale.data, offlineTempId: sale.tempId }),
        });
        if (res.ok) {
          await markSaleSynced(sale.tempId);
          synced++;
        } else {
          errors++;
        }
      } catch {
        errors++;
      }
    }

    // Sync other pending operations
    const pending = await getPendingSyncs();
    for (const op of pending) {
      try {
        const method = op.action === 'create' ? 'POST' : op.action === 'update' ? 'PUT' : 'DELETE';
        const res = await fetch(`/api/${op.entity}`, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(op.payload),
        });
        if (res.ok && op.id !== undefined) {
          await removePendingSync(op.id);
          synced++;
        } else {
          errors++;
        }
      } catch {
        errors++;
      }
    }
  } finally {
    syncInProgress = false;
  }

  return { synced, errors };
}

export function startBackgroundSync(intervalMs: number = 30000): () => void {
  const interval = setInterval(() => {
    if (navigator.onLine) syncOfflineData();
  }, intervalMs);

  const handleOnline = () => syncOfflineData();
  window.addEventListener('online', handleOnline);

  return () => {
    clearInterval(interval);
    window.removeEventListener('online', handleOnline);
  };
}
