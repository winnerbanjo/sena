import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  PAYMENT_RECEIPT_MAX_BYTES,
  inspectPaymentReceipt,
  paymentReceiptStorageKey,
  receiptContentDisposition,
  resolveReceiptAccess,
  settleWithOptionalReceipt,
  storePaymentReceipt,
  type ReceiptFileInput,
} from '../apps/dashboard/src/lib/payment-receipt-file';

const propertyA = '11111111-1111-4111-8111-111111111111';
const propertyB = '22222222-2222-4222-8222-222222222222';
const paymentId = '33333333-3333-4333-8333-333333333333';
const receiptId = '44444444-4444-4444-8444-444444444444';
const userId = '55555555-5555-4555-8555-555555555555';

function file(name: string, type: string, bytes: Uint8Array, size = bytes.byteLength): ReceiptFileInput {
  return { name, type, size, bytes };
}

const jpeg = file('slip.jpg', 'image/jpeg', Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00]));
const png = file('slip.png', 'image/png', Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
const pdf = file('slip.pdf', 'application/pdf', Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]));
const webp = file('slip.webp', 'image/webp', Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]));

assert.equal(inspectPaymentReceipt(jpeg).ok, true);
assert.equal(inspectPaymentReceipt(png).ok, true);
assert.equal(inspectPaymentReceipt(pdf).ok, true);
assert.equal(inspectPaymentReceipt(webp).ok, true);
assert.equal(inspectPaymentReceipt(file('slip.exe', 'image/jpeg', jpeg.bytes)).ok, false);
assert.equal(inspectPaymentReceipt(file('notes.jpg', 'image/jpeg', Uint8Array.from([0x68, 0x65, 0x6c, 0x6c, 0x6f]))).ok, false);
assert.equal(inspectPaymentReceipt(file('big.jpg', 'image/jpeg', jpeg.bytes, PAYMENT_RECEIPT_MAX_BYTES + 1)).code, 'receipt_size');
console.log('PASS valid JPG, PNG, WebP, and PDF; invalid type and oversize rejected');

async function main() {
const uploads: string[] = [];
const removed: string[] = [];
const rows: Array<{ propertyId: string; paymentId: string; storageKey: string }> = [];
const audits: string[] = [];
const stored = await storePaymentReceipt({
  propertyId: propertyA,
  paymentId,
  receiptId,
  userId,
  actorName: 'Front desk',
  file: jpeg,
  alreadyAttached: async () => false,
  upload: async (key) => {
    uploads.push(key);
    return {};
  },
  remove: async (key) => { removed.push(key); },
  insert: async (row) => { rows.push(row); },
  audit: async (row) => { audits.push(`${row.actorId}:${row.paymentId}:${row.receiptId}`); },
});
assert.equal(stored.attached, true);
assert.equal(rows[0].propertyId, propertyA);
assert.equal(rows[0].paymentId, paymentId);
assert.equal(rows[0].storageKey, paymentReceiptStorageKey(propertyA, paymentId, receiptId, 'jpg'));
assert.equal(audits[0], `${userId}:${paymentId}:${receiptId}`);
assert.equal(uploads.length, 1);
console.log('PASS attachment binds to the payment, property, and uploader');

let uploadCalls = 0;
const failedUpload = await storePaymentReceipt({
  propertyId: propertyA,
  paymentId,
  receiptId,
  userId,
  actorName: 'Front desk',
  file: png,
  alreadyAttached: async () => false,
  upload: async () => { uploadCalls += 1; throw new Error('storage down'); },
  remove: async () => { throw new Error('should not remove'); },
  insert: async () => { throw new Error('should not insert'); },
  audit: async () => { throw new Error('should not audit'); },
});
assert.equal(failedUpload.attached, false);
assert.equal(uploadCalls, 1);
console.log('PASS failed upload does not create receipt metadata');

const orphanKeys: string[] = [];
const failedInsert = await storePaymentReceipt({
  propertyId: propertyA,
  paymentId,
  receiptId,
  userId,
  actorName: 'Front desk',
  file: pdf,
  alreadyAttached: async () => false,
  upload: async () => ({}),
  remove: async (key) => { orphanKeys.push(key); },
  insert: async () => { throw new Error('db down'); },
  audit: async () => undefined,
});
assert.equal(failedInsert.attached, false);
assert.equal(orphanKeys.length, 1);
console.log('PASS failed receipt save removes the uploaded object');

let attachedAfterFailure = false;
await assert.rejects(settleWithOptionalReceipt({
  receipt: jpeg,
  recordPayment: async () => { throw new Error('Invoice unavailable'); },
  attach: async () => { attachedAfterFailure = true; return { attached: true }; },
}));
assert.equal(attachedAfterFailure, false);
const balanceError = await settleWithOptionalReceipt({
  receipt: jpeg,
  recordPayment: async () => ({ error: 'Amount is more than the outstanding balance.' }),
  attach: async () => { attachedAfterFailure = true; return { attached: true }; },
});
assert.equal(balanceError.status, 422);
assert.equal(attachedAfterFailure, false);
console.log('PASS failed payment does not leave an attachment');

const plain = await settleWithOptionalReceipt({
  receipt: null,
  recordPayment: async () => ({ success: true, paymentId, propertyId: propertyA }),
  attach: async () => { throw new Error('receipt should not be stored'); },
});
assert.equal(plain.status, 200);
assert.equal(plain.body.receiptAttached, undefined);
console.log('PASS payment with no attachment still works');

const withFile = await settleWithOptionalReceipt({
  receipt: pdf,
  recordPayment: async () => ({ success: true, paymentId, propertyId: propertyA }),
  attach: async (payment) => {
    assert.equal(payment.paymentId, paymentId);
    assert.equal(payment.propertyId, propertyA);
    return { attached: true };
  },
});
assert.equal(withFile.body.receiptAttached, true);
console.log('PASS payment with attachment works');

const rejected = await settleWithOptionalReceipt({
  receipt: file('virus.pdf', 'application/pdf', Uint8Array.from([1, 2, 3, 4])),
  recordPayment: async () => { throw new Error('payment should not be created'); },
  attach: async () => { throw new Error('upload should not start'); },
});
assert.equal(rejected.status, 422);
assert.equal(rejected.body.code, 'receipt_type');
console.log('PASS invalid receipt is rejected before payment');

assert.equal(resolveReceiptAccess({
  userId: null,
  viewerPropertyId: propertyA,
  requestedPaymentId: paymentId,
  receipt: { propertyId: propertyA, paymentId, storageKey: rows[0].storageKey },
}).status, 401);
assert.equal(resolveReceiptAccess({
  userId: userId,
  viewerPropertyId: null,
  requestedPaymentId: paymentId,
  receipt: { propertyId: propertyA, paymentId, storageKey: rows[0].storageKey },
}).status, 403);
assert.equal(resolveReceiptAccess({
  userId: userId,
  viewerPropertyId: propertyB,
  requestedPaymentId: paymentId,
  receipt: { propertyId: propertyA, paymentId, storageKey: rows[0].storageKey },
}).status, 404);
const allowed = resolveReceiptAccess({
  userId,
  viewerPropertyId: propertyA,
  requestedPaymentId: paymentId,
  receipt: { propertyId: propertyA, paymentId, storageKey: rows[0].storageKey },
});
assert.equal(allowed.status, 200);
assert.match(receiptContentDisposition('slip.jpg', false), /^inline;/);
assert.match(receiptContentDisposition('slip.jpg', true), /^attachment;/);
console.log('PASS authorized staff can view a receipt; unauthorized and cross-property access is denied');

const locales = ['en', 'fr', 'ar', 'sw', 'yo', 'ha', 'ig'];
const invoiceKeys = ['receiptLabel', 'receiptHelp', 'receiptRemove', 'receiptSelected', 'receiptInvalid', 'receiptTooLarge', 'receiptUploadFailed', 'receiptAttached'];
const paymentKeys = ['viewReceipt', 'downloadReceipt'];
for (const locale of locales) {
  const messages = JSON.parse(readFileSync(resolve('apps/dashboard/messages', `${locale}.json`), 'utf8'));
  for (const key of invoiceKeys) assert.equal(typeof messages.invoices[key], 'string', `${locale} invoices.${key}`);
  for (const key of paymentKeys) assert.equal(typeof messages.payments[key], 'string', `${locale} payments.${key}`);
}
const arabic = JSON.parse(readFileSync('apps/dashboard/messages/ar.json', 'utf8'));
assert.match(arabic.invoices.receiptLabel, /إيصال|إرفاق/);
console.log('PASS localization keys exist in en, fr, ar, sw, yo, ha, and ig');

const modal = readFileSync('apps/dashboard/src/components/invoice-view-modal.tsx', 'utf8');
const referenceAt = modal.indexOf('Transaction / POS Reference');
const receiptAt = modal.indexOf('htmlFor="settlement-receipt"');
const notesAt = modal.indexOf('Settlement Notes (Optional)');
const confirmAt = modal.indexOf('Confirm Payment');
assert.ok(referenceAt < receiptAt && receiptAt < notesAt && notesAt < confirmAt);
assert.match(modal, /w-full max-w-md max-h-\[90vh\] overflow-y-auto/);
assert.match(modal, /id="settlement-receipt"/);
assert.match(modal, /aria-describedby="settlement-receipt-help"/);
assert.match(modal, /aria-live="polite"/);
assert.doesNotMatch(modal, /min-w-\[4\d{2}px\]/);
const route = readFileSync('apps/dashboard/src/app/api/invoices/[id]/payments/route.ts', 'utf8');
assert.match(route, /maybeQueueZohoPaymentSync/);
assert.match(route, /maybeQueueZohoBooksPaymentSync/);
assert.match(route, /acl: 'private'/);
assert.match(readFileSync('apps/dashboard/src/app/api/payments/[id]/receipt/route.ts', 'utf8'), /withMerchant\(handleGET, 'payments'\)/);
console.log('PASS mobile settlement form stays within the viewport and existing payment sync remains');

console.log('payment receipt checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
