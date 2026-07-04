'use client';

import { useRef, useCallback } from 'react';
import { useReactToPrint } from 'react-to-print';

export function usePrint() {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    pageStyle: `
      @page { size: 80mm auto; margin: 0; }
      @media print { body { margin: 0; } }
    `,
  });

  const print = useCallback(() => {
    handlePrint();
  }, [handlePrint]);

  return { printRef, print };
}
