export const PAYMENT_RECEIPT_MAX_BYTES = 10 * 1024 * 1024;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ReceiptExtension = 'jpg' | 'png' | 'webp' | 'pdf';

export type ReceiptFileInput = {
  name: string;
  type: string;
  size: number;
  bytes: Uint8Array;
};

export type ReceiptDecision =
  | { ok: true; extension: ReceiptExtension; contentType: string; filename: string }
  | { ok: false; error: string; code: 'receipt_type' | 'receipt_size' };

const TYPES: Record<ReceiptExtension, { contentType: string; extensions: string[] }> = {
  jpg: { contentType: 'image/jpeg', extensions: ['jpg', 'jpeg'] },
  png: { contentType: 'image/png', extensions: ['png'] },
  webp: { contentType: 'image/webp', extensions: ['webp'] },
  pdf: { contentType: 'application/pdf', extensions: ['pdf'] },
};

function extensionOf(name: string): string {
  const base = name.split(/[/\\]/).pop() || '';
  const match = base.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || '';
}

function matchesMagic(extension: ReceiptExtension, bytes: Uint8Array): boolean {
  if (extension === 'jpg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (extension === 'png') return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (extension === 'pdf') return bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  return bytes.length >= 12
    && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
}

function safeFilename(name: string, extension: ReceiptExtension): string {
  const base = (name.split(/[/\\]/).pop() || `receipt.${extension}`).replace(/[^\w.\- ]+/g, '_').slice(0, 180);
  return base.toLowerCase().endsWith(`.${extension}`) || (extension === 'jpg' && base.toLowerCase().endsWith('.jpeg'))
    ? base
    : `receipt.${extension}`;
}

export function inspectPaymentReceipt(file: ReceiptFileInput): ReceiptDecision {
  if (file.size > PAYMENT_RECEIPT_MAX_BYTES || file.bytes.byteLength > PAYMENT_RECEIPT_MAX_BYTES) {
    return { ok: false, code: 'receipt_size', error: 'Receipt must be 10 MB or smaller.' };
  }
  if (file.size <= 0 || file.bytes.byteLength <= 0) {
    return { ok: false, code: 'receipt_type', error: 'Upload a JPG, PNG, WebP, or PDF receipt.' };
  }
  const rawExtension = extensionOf(file.name);
  const match = (Object.keys(TYPES) as ReceiptExtension[]).find((extension) => TYPES[extension].extensions.includes(rawExtension));
  if (!match) return { ok: false, code: 'receipt_type', error: 'Upload a JPG, PNG, WebP, or PDF receipt.' };
  const allowedMime = match === 'jpg' ? ['image/jpeg', 'image/jpg'] : [TYPES[match].contentType];
  if (!allowedMime.includes(file.type.toLowerCase()) || !matchesMagic(match, file.bytes)) {
    return { ok: false, code: 'receipt_type', error: 'Upload a JPG, PNG, WebP, or PDF receipt.' };
  }
  return { ok: true, extension: match, contentType: TYPES[match].contentType, filename: safeFilename(file.name, match) };
}

export function paymentReceiptStorageKey(propertyId: string, paymentId: string, receiptId: string, extension: ReceiptExtension): string {
  if (![propertyId, paymentId, receiptId].every((value) => UUID.test(value))) throw new Error('Invalid receipt path.');
  return `payment-receipts/${propertyId}/${paymentId}/${receiptId}.${extension}`;
}

export function receiptStorageKeyAllowed(storageKey: string, propertyId: string): boolean {
  return storageKey.startsWith(`payment-receipts/${propertyId}/`) && !storageKey.includes('..');
}

export type ReceiptAccess =
  | { status: 200; storageKey: string }
  | { status: 401 | 403 | 404 };

export function resolveReceiptAccess(input: {
  userId: string | null;
  viewerPropertyId: string | null;
  requestedPaymentId: string;
  receipt: { propertyId: string; paymentId: string; storageKey: string } | null;
}): ReceiptAccess {
  if (!input.userId) return { status: 401 };
  if (!input.viewerPropertyId) return { status: 403 };
  const receipt = input.receipt;
  if (!receipt || receipt.paymentId !== input.requestedPaymentId || receipt.propertyId !== input.viewerPropertyId) return { status: 404 };
  if (!receiptStorageKeyAllowed(receipt.storageKey, input.viewerPropertyId)) return { status: 404 };
  return { status: 200, storageKey: receipt.storageKey };
}

export async function optionalReceiptFromForm(
  form: FormData,
  field = 'receipt',
): Promise<{ receipt: ReceiptFileInput | null; error?: { status: number; error: string; code: 'receipt_type' | 'receipt_size' } }> {
  const uploaded = form.get(field);
  if (!(uploaded instanceof File) || uploaded.size <= 0) return { receipt: null };
  const receipt: ReceiptFileInput = {
    name: uploaded.name,
    type: uploaded.type,
    size: uploaded.size,
    bytes: new Uint8Array(await uploaded.arrayBuffer()),
  };
  const inspected = inspectPaymentReceipt(receipt);
  if (!inspected.ok) return { receipt, error: { status: 422, error: inspected.error, code: inspected.code } };
  return { receipt };
}

/** JSON when no file is attached, so a payment can still be recorded. Multipart only when a receipt is present. */
export function manualPaymentBody(
  fields: Record<string, string | number | undefined>,
  receipt: File | null,
): { headers: Record<string, string>; body: BodyInit } {
  if (!receipt) {
    const json: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && value !== '') json[key] = value;
    }
    return { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(json) };
  }
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== '') form.set(key, String(value));
  }
  form.set('receipt', receipt);
  return { headers: {}, body: form };
}

export function receiptContentDisposition(filename: string, download: boolean): string {
  const ascii = filename.replace(/[^\w.\- ]+/g, '_') || 'receipt';
  const kind = download ? 'attachment' : 'inline';
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

type PaymentResult = { paymentId?: string; propertyId?: string; error?: string; success?: boolean };

export async function storePaymentReceipt(args: {
  propertyId: string;
  paymentId: string;
  receiptId: string;
  userId: string;
  actorName: string;
  file: ReceiptFileInput;
  alreadyAttached: () => Promise<boolean>;
  upload: (key: string, body: Uint8Array, contentType: string) => Promise<{ simulated?: boolean }>;
  remove: (key: string) => Promise<void>;
  insert: (row: {
    id: string;
    propertyId: string;
    paymentId: string;
    uploadedByUserId: string;
    storageKey: string;
    contentType: string;
    originalFilename: string;
    byteSize: number;
  }) => Promise<void>;
  audit: (row: { actorId: string; actorName: string; paymentId: string; receiptId: string; filename: string }) => Promise<void>;
}): Promise<{ attached: boolean; error?: string }> {
  if (await args.alreadyAttached()) return { attached: true };
  const inspected = inspectPaymentReceipt(args.file);
  if (!inspected.ok) return { attached: false, error: inspected.error };
  const storageKey = paymentReceiptStorageKey(args.propertyId, args.paymentId, args.receiptId, inspected.extension);
  let uploaded = false;
  try {
    const result = await args.upload(storageKey, args.file.bytes, inspected.contentType);
    if (result.simulated) return { attached: false, error: 'Receipt storage is not configured.' };
    uploaded = true;
    await args.insert({
      id: args.receiptId,
      propertyId: args.propertyId,
      paymentId: args.paymentId,
      uploadedByUserId: args.userId,
      storageKey,
      contentType: inspected.contentType,
      originalFilename: inspected.filename,
      byteSize: args.file.bytes.byteLength,
    });
  } catch {
    if (uploaded) await args.remove(storageKey).catch(() => undefined);
    return { attached: false, error: 'Payment was recorded, but the receipt was not attached.' };
  }
  await args.audit({
    actorId: args.userId,
    actorName: args.actorName,
    paymentId: args.paymentId,
    receiptId: args.receiptId,
    filename: inspected.filename,
  }).catch(() => undefined);
  return { attached: true };
}

export async function settleWithOptionalReceipt<T extends PaymentResult>(options: {
  receipt: ReceiptFileInput | null;
  recordPayment: () => Promise<T>;
  attach: (payment: { paymentId: string; propertyId: string }) => Promise<{ attached: boolean; error?: string }>;
}): Promise<{ status: number; body: T & { receiptAttached?: boolean; receiptError?: string; code?: string } }> {
  if (options.receipt) {
    const inspected = inspectPaymentReceipt(options.receipt);
    if (!inspected.ok) return { status: 422, body: { error: inspected.error, code: inspected.code } as T & { code: string } };
  }
  let payment: T;
  try {
    payment = await options.recordPayment();
  } catch (error) {
    throw error;
  }
  if (!payment || typeof payment !== 'object' || payment.error || !payment.paymentId || !payment.propertyId) {
    return { status: payment && typeof payment === 'object' && payment.error ? 422 : 200, body: payment };
  }
  if (!options.receipt) return { status: 200, body: payment };
  const attached = await options.attach({ paymentId: payment.paymentId, propertyId: payment.propertyId });
  if (!attached.attached) {
    return { status: 200, body: { ...payment, receiptAttached: false, receiptError: attached.error || 'Payment was recorded, but the receipt was not attached.', code: 'receipt_upload_failed' } };
  }
  return { status: 200, body: { ...payment, receiptAttached: true } };
}
