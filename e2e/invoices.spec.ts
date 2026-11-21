import { test, expect } from '@playwright/test';
import { api, createInvoice, login, OWNER_A } from './helpers';

async function firstReservationId(request: Parameters<typeof api>[0]) {
  const response = await api(request, 'GET', '/api/reservations?limit=1');
  expect(response.status()).toBe(200);
  return (await response.json()).items[0].id as string;
}

test('C: invoice billing details, lines, and payments reconcile through the API and UI', async ({ page }) => {
  await login(page, OWNER_A);
  const reservationId = await firstReservationId(page.request);

  const created = await createInvoice(page.request, {
    reservationId,
    recipientName: 'Browser Invoice Guest',
    amountMinorUnits: 100_000,
  });
  expect(created.status()).toBe(200);
  const invoice = (await created.json()).invoice;
  expect(invoice.totalAmountMinorUnits).toBe(100_000);
  expect(invoice.paidAmountMinorUnits).toBe(0);

  const billing = await api(page.request, 'PATCH', `/api/invoices/${invoice.id}`, {
    recipientName: 'Browser Invoice Guest Updated',
    recipientEmail: 'invoice-updated@example.invalid',
    notes: 'Updated through the local verification suite',
  });
  expect(billing.status()).toBe(200);

  const doubled = await api(page.request, 'PATCH', `/api/invoices/${invoice.id}`, {
    items: [
      {
        id: 'verification-line',
        description: 'Browser verification stay',
        category: 'room',
        quantity: 2,
        unitPriceMinorUnits: 100_000,
      },
    ],
  });
  expect(doubled.status()).toBe(200);
  expect((await doubled.json()).invoice.totalAmountMinorUnits).toBe(200_000);

  const partial = await api(
    page.request,
    'POST',
    `/api/invoices/${invoice.id}/payments`,
    { amountMinorUnits: 50_000, method: 'cash', providerReference: `BROWSER-PARTIAL-${invoice.id}` },
    { 'Idempotency-Key': `browser-partial-${invoice.id}` },
  );
  const partialBody = await partial.json();
  expect(partial.status(), JSON.stringify(partialBody)).toBe(200);
  expect(partialBody.invoice.paidAmountMinorUnits).toBe(50_000);

  const belowPaid = await api(page.request, 'PATCH', `/api/invoices/${invoice.id}`, {
    items: [
      {
        id: 'verification-line',
        description: 'Browser verification stay',
        category: 'room',
        quantity: 1,
        unitPriceMinorUnits: 40_000,
      },
    ],
  });
  expect(belowPaid.status()).toBe(409);
  expect((await belowPaid.json()).error).toMatch(/less than the amount already paid/i);

  const reduced = await api(page.request, 'PATCH', `/api/invoices/${invoice.id}`, {
    items: [
      {
        id: 'verification-line',
        description: 'Browser verification stay',
        category: 'room',
        quantity: 1,
        unitPriceMinorUnits: 100_000,
      },
    ],
  });
  expect(reduced.status()).toBe(200);
  expect((await reduced.json()).invoice.totalAmountMinorUnits).toBe(100_000);

  const settled = await api(
    page.request,
    'POST',
    `/api/invoices/${invoice.id}/payments`,
    { amountMinorUnits: 50_000, method: 'cash', providerReference: `BROWSER-FINAL-${invoice.id}` },
    { 'Idempotency-Key': `browser-final-${invoice.id}` },
  );
  expect(settled.status()).toBe(200);
  const settledBody = await settled.json();
  expect(settledBody.invoice.paidAmountMinorUnits).toBe(100_000);
  expect(settledBody.invoice.status).toBe('paid');

  const overpayment = await api(
    page.request,
    'POST',
    `/api/invoices/${invoice.id}/payments`,
    { amountMinorUnits: 1, method: 'cash', providerReference: `BROWSER-OVER-${invoice.id}` },
    { 'Idempotency-Key': `browser-over-${invoice.id}` },
  );
  expect(overpayment.status()).toBeGreaterThanOrEqual(400);
  expect(overpayment.status()).toBeLessThan(500);

  const detail = await api(page.request, 'GET', `/api/invoices/${invoice.id}`);
  expect(detail.status()).toBe(200);
  const detailBody = await detail.json();
  expect(detailBody.invoice.paidAmountMinorUnits).toBe(100_000);
  expect(detailBody.invoice.totalAmountMinorUnits).toBe(100_000);
  expect(detailBody.document.payments.length).toBeGreaterThanOrEqual(2);

  await page.goto(`/invoices?search=${encodeURIComponent(invoice.invoiceNumber)}`);
  await expect(page.getByText(invoice.invoiceNumber, { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'View Folio' }).first().click();
  await expect(page.getByText(invoice.invoiceNumber, { exact: true }).first()).toBeVisible();
  await expect(page.getByText('PAID', { exact: true }).first()).toBeVisible();
});

test('D: invoice money bounds reject values above the ledger limit', async ({ page }) => {
  await login(page, OWNER_A);
  const reservationId = await firstReservationId(page.request);

  const exactLimit = await createInvoice(page.request, {
    reservationId,
    recipientName: 'Exact Limit Guest',
    amountMinorUnits: 2_147_483_647,
  });
  expect(exactLimit.status()).toBe(200);
  expect((await exactLimit.json()).invoice.totalAmountMinorUnits).toBe(2_147_483_647);

  const aboveLimit = await createInvoice(page.request, {
    reservationId,
    recipientName: 'Above Limit Guest',
    amountMinorUnits: 2_147_483_648,
  });
  expect(aboveLimit.status()).toBeGreaterThanOrEqual(400);
  expect(aboveLimit.status()).toBeLessThan(500);
  const aboveError = String((await aboveLimit.json()).error);
  expect(aboveError).toMatch(/maximum/i);
  expect(aboveError).toMatch(/21,474,836\.47/);

  const overflowProduct = await createInvoice(page.request, {
    reservationId,
    recipientName: 'Overflow Guest',
    amountMinorUnits: 1_073_741_824,
    quantity: 2,
  });
  expect(overflowProduct.status()).toBeGreaterThanOrEqual(400);
  expect(overflowProduct.status()).toBeLessThan(500);
  const productError = String((await overflowProduct.json()).error);
  expect(productError).toMatch(/Line 1 total/i);
  expect(productError).toMatch(/21,474,836\.47/);

  const fractional = await createInvoice(page.request, {
    reservationId,
    recipientName: 'Fractional Guest',
    amountMinorUnits: 100.5,
  });
  expect(fractional.status()).toBeGreaterThanOrEqual(400);
  expect(fractional.status()).toBeLessThan(500);
  const fractionalError = String((await fractional.json()).error);
  expect(fractionalError).toMatch(/price|whole/i);

  const negative = await createInvoice(page.request, {
    reservationId,
    recipientName: 'Negative Guest',
    amountMinorUnits: -1,
  });
  expect(negative.status()).toBeGreaterThanOrEqual(400);
  expect(negative.status()).toBeLessThan(500);
  expect(String((await negative.json()).error)).toMatch(/price|whole/i);
});
