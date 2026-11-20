import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_MONEY_MINOR_UNITS,
  MoneyRangeError,
  assertMoney,
  checkedAdd,
  checkedMul,
  checkedSub,
} from '../packages/config/src/index';
import { calculateInvoiceAmounts } from '../apps/dashboard/src/lib/invoice-edit';
import { calculateStayAmounts } from '../packages/reservations/src/pricing';
import { PaymentService } from '../packages/payments/src/index';

const line = (unitPriceMinorUnits: unknown, quantity: unknown = 1) => [
  { description: 'Stay', category: 'room', quantity, unitPriceMinorUnits },
];

function invoice(unitPriceMinorUnits: unknown, overrides: Record<string, unknown> = {}) {
  return calculateInvoiceAmounts({
    items: line(unitPriceMinorUnits),
    applyVat: false,
    applyConsumptionTax: false,
    applyServiceCharge: false,
    discountMinorUnits: 0,
    ...overrides,
  } as any);
}

test('money bounds accept the largest storable amount and reject one kobo more', () => {
  assert.equal(assertMoney(MAX_MONEY_MINOR_UNITS, 'Amount'), MAX_MONEY_MINOR_UNITS);
  assert.throws(
    () => assertMoney(MAX_MONEY_MINOR_UNITS + 1, 'Amount'),
    (error: unknown) => error instanceof MoneyRangeError && /maximum/i.test((error as Error).message),
  );
});

test('assertMoney rejects fractions, negatives, empty values, and non-finite amounts', () => {
  for (const value of [1.5, -1, Number.NaN, Number.POSITIVE_INFINITY, '', null, undefined, true]) {
    assert.throws(() => assertMoney(value, 'Amount'), MoneyRangeError);
  }
  assert.throws(() => assertMoney(0, 'Payment amount', { allowZero: false }), MoneyRangeError);
  assert.equal(assertMoney(0, 'Discount'), 0);
});

test('checked arithmetic refuses unsafe products and sums instead of losing precision', () => {
  assert.throws(() => checkedMul(2 ** 40, 2 ** 20, 'Total'), MoneyRangeError);
  assert.throws(() => checkedMul(MAX_MONEY_MINOR_UNITS, 2, 'Total'), MoneyRangeError);
  assert.equal(checkedMul(1_000_000, 2, 'Total'), 2_000_000);
  assert.throws(() => checkedAdd(MAX_MONEY_MINOR_UNITS, 1, 'Total'), MoneyRangeError);
  assert.equal(checkedSub(MAX_MONEY_MINOR_UNITS, MAX_MONEY_MINOR_UNITS, 'Total'), 0);
  assert.equal(checkedSub(1, 2, 'Discount', { allowNegative: true }), -1);
  assert.throws(() => checkedSub(1, 2, 'Discount'), MoneyRangeError);
});

test('invoice line totals at the ledger maximum are accepted', () => {
  const result = invoice(MAX_MONEY_MINOR_UNITS);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.totalAmountMinorUnits, MAX_MONEY_MINOR_UNITS);
});

test('invoice totals above the ledger maximum are rejected, not clamped or rounded', () => {
  assert.throws(() => invoice(MAX_MONEY_MINOR_UNITS + 1), MoneyRangeError);
  assert.throws(() => invoice(2 ** 40), MoneyRangeError);
  // A valid subtotal plus 7.5% VAT can no longer be stored.
  assert.throws(() => invoice(MAX_MONEY_MINOR_UNITS, { applyVat: true }), MoneyRangeError);
});

test('invoice quantity × price products beyond exact integer arithmetic are rejected', () => {
  assert.throws(() => invoice(2 ** 52, 2), MoneyRangeError);
});

test('invoice inputs still reject fractions, negatives, and zero quantities', () => {
  assert.deepEqual(invoice(1000, { discountMinorUnits: 100.5 }), { ok: false, error: 'Enter a valid discount.' });
  assert.deepEqual(invoice(-1), { ok: false, error: 'Enter a whole quantity and a valid price for each item.' });
  assert.deepEqual(invoice(1000, { items: line(1000, 0) }), {
    ok: false,
    error: 'Enter a whole quantity and a valid price for each item.',
  });
});

test('invoice percentage charges keep the established rounding and fit the ledger', () => {
  const result = calculateInvoiceAmounts({
    items: line(2000),
    applyVat: true,
    applyConsumptionTax: true,
    applyServiceCharge: true,
    discountMinorUnits: 0,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.taxVatMinorUnits, 150);
  assert.equal(result.taxConsumptionMinorUnits, 100);
  assert.equal(result.serviceChargeMinorUnits, 200);
  assert.equal(result.totalAmountMinorUnits, 2450);
});

test('reservation pricing stays exact and rejects overflow, negatives, and fractions', () => {
  assert.deepEqual(calculateStayAmounts({ basePriceMinorUnits: 1_000_000, nights: 3 }), {
    standardAmountMinorUnits: 3_000_000,
    totalAmountMinorUnits: 3_000_000,
    discountAmountMinorUnits: 0,
  });
  const negotiated = calculateStayAmounts({
    basePriceMinorUnits: 1_000_000,
    nights: 3,
    customTotalAmountMinorUnits: 2_500_000,
  });
  assert.equal(negotiated.totalAmountMinorUnits, 2_500_000);
  assert.equal(negotiated.discountAmountMinorUnits, 500_000);
  assert.equal(
    calculateStayAmounts({ basePriceMinorUnits: 1000, nights: 1, customTotalAmountMinorUnits: 0 }).totalAmountMinorUnits,
    0,
  );
  assert.throws(() => calculateStayAmounts({ basePriceMinorUnits: MAX_MONEY_MINOR_UNITS, nights: 2 }), MoneyRangeError);
  assert.throws(() => calculateStayAmounts({ basePriceMinorUnits: 2 ** 40, nights: 2 ** 20 }), MoneyRangeError);
  assert.throws(
    () =>
      calculateStayAmounts({
        basePriceMinorUnits: 1000,
        nights: 1,
        customTotalAmountMinorUnits: MAX_MONEY_MINOR_UNITS + 1,
      }),
    MoneyRangeError,
  );
  assert.throws(
    () => calculateStayAmounts({ basePriceMinorUnits: 1000, nights: 1, customTotalAmountMinorUnits: -1 }),
    MoneyRangeError,
  );
  assert.throws(
    () => calculateStayAmounts({ basePriceMinorUnits: 1000, nights: 1, customTotalAmountMinorUnits: 10.5 }),
    MoneyRangeError,
  );
});

test('payment inputs reject out-of-range amounts before touching the database', async () => {
  await assert.rejects(
    PaymentService.recordPayment({
      reservationId: 'none',
      amountMinorUnits: MAX_MONEY_MINOR_UNITS + 1,
      method: 'cash',
      provider: 'manual',
    } as any),
    MoneyRangeError,
  );
  await assert.rejects(
    PaymentService.submitTransferProof({
      propertyId: 'none',
      amountMinorUnits: MAX_MONEY_MINOR_UNITS + 1,
      proofUrl: 'proof.png',
    } as any),
    MoneyRangeError,
  );
  for (const amount of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    await assert.rejects(
      PaymentService.recordPayment({
        reservationId: 'none',
        amountMinorUnits: amount,
        method: 'cash',
        provider: 'manual',
      } as any),
      /valid payment amount/i,
    );
  }
});
