'use client';

import * as React from 'react';
import { inspectPaymentReceipt } from '@/lib/payment-receipt-file';

export type PaymentReceiptCopy = {
  label: string;
  upload?: string;
  help: string;
  remove: string;
  selected: string;
  invalid: string;
  tooLarge: string;
};

export function usePaymentReceipt(copy: Pick<PaymentReceiptCopy, 'invalid' | 'tooLarge'>) {
  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState('');
  const previewRef = React.useRef<string | null>(null);

  const replacePreview = React.useCallback((next: string | null) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = next;
    setPreviewUrl(next);
  }, []);

  const clear = React.useCallback(() => {
    replacePreview(null);
    setFile(null);
    setMessage('');
  }, [replacePreview]);

  const choose = React.useCallback(async (next: File | null) => {
    replacePreview(null);
    setFile(null);
    if (!next) {
      setMessage('');
      return;
    }
    const bytes = new Uint8Array(await next.arrayBuffer());
    const inspected = inspectPaymentReceipt({ name: next.name, type: next.type || '', size: next.size, bytes });
    if (!inspected.ok) {
      setMessage(inspected.code === 'receipt_size' ? copy.tooLarge : copy.invalid);
      return;
    }
    const stored = new File([bytes], next.name, { type: next.type });
    setMessage('');
    setFile(stored);
    replacePreview(stored.type.startsWith('image/') ? URL.createObjectURL(stored) : null);
  }, [copy.invalid, copy.tooLarge, replacePreview]);

  React.useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  return { file, previewUrl, message, choose, clear };
}

export function PaymentReceiptField({
  id,
  appearance = 'desk',
  copy,
  file,
  previewUrl,
  message,
  onChoose,
  onClear,
}: {
  id: string;
  appearance?: 'desk' | 'invoice';
  copy: PaymentReceiptCopy;
  file: File | null;
  previewUrl: string | null;
  message: string;
  onChoose: (file: File | null) => void;
  onClear: () => void;
}) {
  const helpId = `${id}-help`;
  const invoice = appearance === 'invoice';
  return (
    <div>
      <label htmlFor={id} className={invoice ? 'block text-[#7A7267] font-medium mb-1' : 'block text-sm'}>
        <span className="block">{copy.label}</span>
        {!invoice && copy.upload ? <span className="mt-0.5 block text-xs text-[#7A7267]">{copy.upload}</span> : null}
      </label>
      <input
        id={id}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
        aria-describedby={helpId}
        onChange={(event) => {
          void onChoose(event.target.files?.[0] || null);
          event.target.value = '';
        }}
        className={invoice
          ? 'w-full max-w-full text-xs text-[#191816] file:me-3 file:rounded file:border-0 file:bg-[#FAF7F2] file:px-3 file:py-2 file:text-xs file:font-medium file:text-[#191816]'
          : 'mt-1 w-full max-w-full min-h-11 text-sm text-[#191816] file:me-3 file:min-h-11 file:rounded file:border-0 file:bg-[#FAF7F2] file:px-3 file:py-2 file:text-xs file:font-medium file:text-[#191816]'}
      />
      <p id={helpId} className="text-[10px] text-[#7A7267] mt-1">{copy.help}</p>
      <div aria-live="polite" className="mt-2">
        {file && (
          <div className="flex items-center gap-2 min-w-0">
            {previewUrl && (
              <img src={previewUrl} alt="" className="h-10 w-10 shrink-0 rounded border border-[#E8E2DA] object-cover" />
            )}
            <span className="min-w-0 flex-1 truncate text-[#191816]">{copy.selected}: {file.name}</span>
            <button type="button" onClick={onClear} className="shrink-0 min-h-11 text-[#71382D] underline">
              {copy.remove}
            </button>
          </div>
        )}
        {message && <p role="alert" className="text-sm text-[#B85C3E]">{message}</p>}
      </div>
    </div>
  );
}
