'use client';

import { useEffect } from 'react';
import { useShiftStore } from '@/store/shiftStore';
import { ShiftWithUser } from '@/types';

export function useShift() {
  const { currentShift, setShift } = useShiftStore();

  useEffect(() => {
    async function fetchOpenShift() {
      try {
        const res = await fetch('/api/shifts?status=OPEN&limit=1');
        const json = await res.json();
        if (json.success && json.data?.length > 0) {
          setShift(json.data[0] as ShiftWithUser);
        } else {
          setShift(null);
        }
      } catch {
        // ignore — offline
      }
    }
    fetchOpenShift();
  }, [setShift]);

  return { currentShift, setShift };
}
