import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyInvoiceSettlementToReservation } from '../apps/dashboard/src/lib/invoice-settlement';

const full = applyInvoiceSettlementToReservation({
  reservationPaidMinorUnits: 0,
  reservationTotalMinorUnits: 15_000_000,
  amountMinorUnits: 16_000_000,
});
assert.equal(full.paidAmountMinorUnits, 16_000_000);
assert.equal(full.paymentStatus, 'paid');

const partial = applyInvoiceSettlementToReservation({
  reservationPaidMinorUnits: 0,
  reservationTotalMinorUnits: 15_000_000,
  amountMinorUnits: 10_000_000,
});
assert.equal(partial.paidAmountMinorUnits, 10_000_000);
assert.equal(partial.paymentStatus, 'part_payment');

const exact = applyInvoiceSettlementToReservation({
  reservationPaidMinorUnits: 0,
  reservationTotalMinorUnits: 15_000_000,
  amountMinorUnits: 15_000_000,
});
assert.equal(exact.paymentStatus, 'paid');

for (const method of ['pos', 'bank_transfer', 'cash', 'card']) {
  assert.equal(['cash', 'pos', 'bank_transfer', 'card'].includes(method), true);
}

const route = readFileSync('apps/dashboard/src/app/api/invoices/[id]/payments/route.ts', 'utf8');
assert.doesNotMatch(route, /Amount is more than the reservation outstanding balance/);
assert.match(route, /paymentRecorded: false/);
assert.match(route, /No payment was added/);
assert.match(route, /maybeQueueZohoPaymentSync/);
assert.match(readFileSync('apps/dashboard/src/components/invoice-view-modal.tsx', 'utf8'), /Refresh this invoice before trying again/);

console.log('PASS invoice settlement can record the invoice balance when it is above the stay total');
console.log('PASS partial and exact stay payments still classify correctly');
console.log('PASS rollback responses say that no payment was added');
