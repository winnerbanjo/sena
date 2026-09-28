import assert from 'node:assert/strict';
import { parseSafeWebhookBody } from '../apps/dashboard/src/lib/flutterwave-webhook-parse';

const nested = parseSafeWebhookBody(JSON.stringify({
  event: 'charge.completed',
  data: { id: 10518947, tx_ref: 'SENA_eea1d01971deefa87b694a9878cbc449bbdc', amount: 400, currency: 'NGN' },
}));
assert.equal(nested.eventType, 'charge.completed');
assert.equal(nested.txRef, 'SENA_eea1d01971deefa87b694a9878cbc449bbdc');
assert.equal(nested.transactionId, '10518947');

const typed = parseSafeWebhookBody(JSON.stringify({
  type: 'charge.completed',
  data: { id: 1, txRef: 'SENA_typed' },
}));
assert.equal(typed.eventType, 'charge.completed');
assert.equal(typed.txRef, 'SENA_typed');

// Production 23:48 delivery shape: flat hosted/test webhook with event.type key.
const flat = parseSafeWebhookBody(JSON.stringify({
  id: 10518947,
  txRef: 'SENA_eea1d01971deefa87b694a9878cbc449bbdc',
  flwRef: 'FLW-MOCK',
  amount: 400,
  charged_amount: 400,
  appfee: 0,
  currency: 'NGN',
  charge_type: 'normal',
  createdAt: '2026-09-28T22:48:42.000Z',
  customer: { email: 'guest@example.com' },
  entity: { account_id: 1 },
  IP: '1.2.3.4',
  'event.type': 'charge.completed',
  status: 'successful',
}));
assert.equal(flat.eventType, 'charge.completed');
assert.equal(flat.txRef, 'SENA_eea1d01971deefa87b694a9878cbc449bbdc');
assert.equal(flat.transactionId, '10518947');
assert.match(flat.topKeys, /event\.type/);

const snakeFlat = parseSafeWebhookBody(JSON.stringify({
  id: 99,
  tx_ref: 'SENA_snake',
  'event.type': 'charge.completed',
  amount: 10,
  currency: 'NGN',
}));
assert.equal(snakeFlat.eventType, 'charge.completed');
assert.equal(snakeFlat.txRef, 'SENA_snake');

const ignored = parseSafeWebhookBody(JSON.stringify({ event: 'transfer.completed', data: { id: 1 } }));
assert.equal(ignored.eventType, 'transfer.completed');
assert.equal(ignored.txRef, null);

assert.equal(parseSafeWebhookBody('not-json').parseable, false);

console.log('PASS Flutterwave webhook parser accepts nested and flat charge.completed payloads');
