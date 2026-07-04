'use client';

import { useOffline } from '@/hooks/useOffline';
import { WifiOff, Wifi } from 'lucide-react';

export function OfflineIndicator() {
  const { isOffline } = useOffline();

  if (!isOffline) return null;

  return (
    <div className="fixed bottom-4 start-4 z-50 flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-white text-sm font-medium shadow-lg animate-bounce">
      <WifiOff className="w-4 h-4" />
      وضع عدم الاتصال
    </div>
  );
}

export function ConnectionStatus() {
  const { isOffline } = useOffline();

  return (
    <div
      className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${
        isOffline
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
          : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      }`}
    >
      {isOffline ? (
        <><WifiOff className="w-3 h-3" /> غير متصل</>
      ) : (
        <><Wifi className="w-3 h-3" /> متصل</>
      )}
    </div>
  );
}
