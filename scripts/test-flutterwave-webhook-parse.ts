import assert from 'node:assert/strict';
import { isFlutterwaveSettlementEvent, parseSafeWebhookBody } from '../apps/dashboard/src/lib/flutterwave-webhook-parse';

assert.equal(isFlutterwaveSettlementEvent('charge.completed'), true);
assert.equal(isFlutterwaveSettlementEvent('BANK_TRANSFER_TRANSACTION'), true);
assert.equal(isFlutterwaveSettlementEvent('CARD_TRANSACTION'), true);
assert.equal(isFlutterwaveSettlementEvent('transfer.completed'), false);

const nested = parseSafeWebhookBody(JSON.stringify({
  event: 'charge.completed',
  data: { id: 10518947, tx_ref: 'SENA_nested', amount: 400, currency: 'NGN' },
}));
assert.equal(nested.eventType, 'charge.completed');
assert.equal(nested.txRef, 'SENA_nested');
assert.equal(nested.transactionId, '10518947');

// Production 00:11 delivery shape.
const bankTransfer = parseSafeWebhookBody(JSON.stringify({
  id: 10518968,
  txRef: 'SENA_675b1ada17ffd0ea8da94c0cb33d05ca072e',
  flwRef: 'FLW-BANK',
  amount: 400,
  charged_amount: 400,
  appfee: 0,
  currency: 'NGN',
  charge_type: 'normal',
  createdAt: '2026-09-28T23:11:43.000Z',
  customer: { email: 'guest@example.com' },
  entity: { account_id: 1 },
  IP: '1.2.3.4',
  'event.type': 'BANK_TRANSFER_TRANSACTION',
  merchantbearsfee: false,
  merchantfee: 0,
  orderRef: 'SENA_675b1ada17ffd0ea8da94c0cb33d05ca072e',
  paymentPage: 'page',
  status: 'successful',
}));
assert.equal(bankTransfer.eventType, 'BANK_TRANSFER_TRANSACTION');
assert.equal(isFlutterwaveSettlementEvent(bankTransfer.eventType), true);
assert.equal(bankTransfer.txRef, 'SENA_675b1ada17ffd0ea8da94c0cb33d05ca072e');
assert.equal(bankTransfer.transactionId, '10518968');

const ignored = parseSafeWebhookBody(JSON.stringify({ event: 'transfer.completed', data: { id: 1 } }));
assert.equal(isFlutterwaveSettlementEvent(ignored.eventType), false);

console.log('PASS Flutterwave webhook parser accepts charge.completed and BANK_TRANSFER_TRANSACTION flat payloads');
