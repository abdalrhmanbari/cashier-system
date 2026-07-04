'use client';

import { Bell, Moon, Sun } from 'lucide-react';
import { useState, useEffect } from 'react';
import { ConnectionStatus } from './OfflineIndicator';
import { useShiftStore } from '@/store/shiftStore';
import { formatCurrency } from '@/lib/utils';

export function Header({ title }: { title: string }) {
  const [isDark, setIsDark] = useState(false);
  const { currentShift } = useShiftStore();

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark');
    setIsDark(dark);
  }, []);

  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
    setIsDark(!isDark);
  };

  return (
    <header className="h-16 border-b border-border bg-background/95 backdrop-blur flex items-center justify-between px-6 sticky top-0 z-30">
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>

      <div className="flex items-center gap-3">
        <ConnectionStatus />

        {currentShift && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-green-700 dark:text-green-400 font-medium">
              وردية مفتوحة
            </span>
          </div>
        )}

        <button
          onClick={toggleTheme}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted transition"
          title="تبديل المظهر"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted transition relative"
          title="الإشعارات"
        >
          <Bell className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
