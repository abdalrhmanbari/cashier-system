'use client';

import { RefObject } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer } from 'lucide-react';

interface PrintButtonProps {
  contentRef: RefObject<HTMLElement | null>;
  label?: string;
  className?: string;
}

export function PrintButton({ contentRef, label = 'طباعة', className }: PrintButtonProps) {
  const handlePrint = useReactToPrint({
    contentRef,
    pageStyle: `
      @page { size: 80mm auto; margin: 0; }
      @media print { .no-print { display: none !important; } }
    `,
  });

  return (
    <button
      onClick={handlePrint}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-sm font-medium transition ${className ?? ''}`}
    >
      <Printer className="w-4 h-4" />
      {label}
    </button>
  );
}
