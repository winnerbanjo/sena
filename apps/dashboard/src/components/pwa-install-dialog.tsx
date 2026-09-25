'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { usePwa } from './pwa-provider';
import { PwaInstallCard } from './pwa-install-card';

export function PwaInstallDialog() {
  const { isInstallGuideOpen, closeInstallGuide } = usePwa();

  if (!isInstallGuideOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden border border-[#E8E2DA] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="absolute top-4 right-4 z-10">
          <button
            type="button"
            onClick={closeInstallGuide}
            className="p-1.5 rounded-md text-[#7A7267] hover:text-[#191816] hover:bg-[#F5EFE9] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-2 sm:p-4 max-h-[90vh] overflow-y-auto">
          <PwaInstallCard className="border-0 shadow-none p-4 sm:p-6" />
        </div>
      </div>
    </div>
  );
}
