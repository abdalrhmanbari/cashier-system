'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Camera, Keyboard } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [manual, setManual] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (manual.trim()) {
      onScan(manual.trim());
      setManual('');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-bold flex items-center gap-2">
            <Camera className="w-5 h-5" />
            ماسح الباركود
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            وجّه الباركود ليتم المسح تلقائياً، أو أدخله يدوياً
          </p>

          {/* Manual entry */}
          <form onSubmit={handleSubmit}>
            <label className="block text-sm font-medium mb-2">
              <Keyboard className="inline w-4 h-4 mb-0.5 me-1" />
              إدخال يدوي
            </label>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="6281006671030"
                className="flex-1 px-3 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm font-mono"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm transition hover:bg-primary/90"
              >
                بحث
              </button>
            </div>
          </form>

          <p className="text-xs text-muted-foreground text-center">
            يدعم: EAN-13، EAN-8، Code128، QR Code
          </p>
        </div>
      </div>
    </div>
  );
}
