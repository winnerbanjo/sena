import { test, expect } from '@playwright/test';
import { api, createInvoice, login, OWNER_A } from './helpers';

test('G: two sessions cannot book the last room or overdraw an invoice', async ({ page, browser }, testInfo) => {
  await login(page, OWNER_A);
  const roomsResponse = await api(page.request, 'GET', '/api/rooms');
  const rooms = await roomsResponse.json();
  const lastRoomType = rooms.roomTypes.find((roomType: { name: string }) => roomType.name === 'Last Available Room');
  expect(lastRoomType).toBeTruthy();

  const secondContext = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
  const secondPage = await secondContext.newPage();
  await login(secondPage, OWNER_A);

  const stamp = Date.now();
  const start = new Date(Date.UTC(2035, 0, 1) + (stamp % 1000) * 86_400_000);
  const dates = {
    checkInDate: start.toISOString().slice(0, 10),
    checkOutDate: new Date(start.getTime() + 86_400_000).toISOString().slice(0, 10),
  };
  const [first, second] = await Promise.all([
    api(page.request, 'POST', '/api/reservations', {
      roomTypeId: lastRoomType.id,
      ...dates,
      numGuests: 1,
      guest: { fullName: 'Last Room Racer A', email: 'last-room-a@example.invalid' },
    }),
    api(secondPage.request, 'POST', '/api/reservations', {
      roomTypeId: lastRoomType.id,
      ...dates,
      numGuests: 1,
      guest: { fullName: 'Last Room Racer B', email: 'last-room-b@example.invalid' },
    }),
  ]);

  const statuses = [first.status(), second.status()];
  expect(statuses.filter((status) => status === 200)).toHaveLength(1);
  expect(statuses.filter((status) => status >= 400 && status < 500)).toHaveLength(1);
  expect(statuses.some((status) => status >= 500)).toBe(false);

  for (let iteration = 1; iteration <= 5; iteration += 1) {
    const created = await createInvoice(page.request, {
      recipientName: `Invoice Race ${iteration}`,
      amountMinorUnits: 100_000,
      description: `Invoice race ${iteration}`,
    });
    expect(created.status()).toBe(200);
    const invoiceId = (await created.json()).invoice.id;

    const [edit, payment] = await Promise.all([
      api(page.request, 'PATCH', `/api/invoices/${invoiceId}`, {
        items: [
          {
            id: 'verification-line',
            description: `Invoice race ${iteration}`,
            category: 'room',
            quantity: 1,
            unitPriceMinorUnits: 40_000,
          },
        ],
      }),
      api(
        secondPage.request,
        'POST',
        `/api/invoices/${invoiceId}/payments`,
        { amountMinorUnits: 50_000, method: 'cash', providerReference: `RACE-${invoiceId}` },
        { 'Idempotency-Key': `race-${invoiceId}-${iteration}` },
      ),
    ]);

    expect(edit.status()).toBeLessThan(500);
    expect(payment.status()).toBeLessThan(500);
    expect([edit.status(), payment.status()].filter((status) => status === 200)).toHaveLength(1);

    const detail = await api(page.request, 'GET', `/api/invoices/${invoiceId}`);
    expect(detail.status()).toBe(200);
    const invoice = (await detail.json()).invoice;
    expect(invoice.paidAmountMinorUnits).toBeLessThanOrEqual(invoice.totalAmountMinorUnits);
    expect(invoice.paidAmountMinorUnits).toBeGreaterThanOrEqual(0);
  }

  await secondContext.close();
});
