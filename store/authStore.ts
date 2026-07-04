import { create } from 'zustand';
import { StoreUserRole } from '@/types';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: StoreUserRole;
}

interface AuthStore {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  isAdmin: () => boolean;
  isManager: () => boolean;
  isCashier: () => boolean;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  setUser: (user) => set({ user }),
  isAdmin: () => get().user?.role === 'STORE_MANAGER',
  isManager: () => get().user?.role === 'STORE_MANAGER',
  isCashier: () => get().user?.role === 'CASHIER',
}));
