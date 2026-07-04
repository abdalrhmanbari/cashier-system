import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ShiftWithUser } from '@/types';

interface ShiftStore {
  currentShift: ShiftWithUser | null;
  setShift: (shift: ShiftWithUser | null) => void;
  updateExpectedCash: (amount: number) => void;
}

export const useShiftStore = create<ShiftStore>()(
  persist(
    (set) => ({
      currentShift: null,

      setShift: (shift) => set({ currentShift: shift }),

      updateExpectedCash: (amount) =>
        set((state) => {
          if (!state.currentShift) return state;
          return {
            currentShift: {
              ...state.currentShift,
              expectedCash: state.currentShift.expectedCash + amount,
            },
          };
        }),
    }),
    {
      name: 'cashier-shift',
      partialize: (state) => ({ currentShift: state.currentShift }),
    }
  )
);
