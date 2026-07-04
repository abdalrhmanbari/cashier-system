'use client';

import { useEffect, useRef, useCallback } from 'react';

interface UseBarcodeOptions {
  onScan: (barcode: string) => void;
  enabled?: boolean;
  minLength?: number;
  timeout?: number;
}

export function useBarcode({
  onScan,
  enabled = true,
  minLength = 4,
  timeout = 100,
}: UseBarcodeOptions) {
  const buffer = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;
      if (e.key === 'Enter') {
        const barcode = buffer.current.trim();
        if (barcode.length >= minLength) {
          onScan(barcode);
        }
        buffer.current = '';
        if (timer.current) clearTimeout(timer.current);
        return;
      }

      if (e.key.length === 1) {
        buffer.current += e.key;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          buffer.current = '';
        }, timeout);
      }
    },
    [enabled, minLength, onScan, timeout]
  );

  useEffect(() => {
    if (!enabled) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}
