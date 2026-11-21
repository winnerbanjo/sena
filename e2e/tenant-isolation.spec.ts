import { test, expect } from '@playwright/test';
import { api, login, OWNER_A, OWNER_B } from './helpers';

test('H: property B cannot read or mutate property A records by id', async ({ page, browser }, testInfo) => {
  await login(page, OWNER_A);
  const reservations = await api(page.request, 'GET', '/api/reservations?limit=1');
  const invoices = await api(page.request, 'GET', '/api/invoices?limit=1');
  const guests = await api(page.request, 'GET', '/api/guests?limit=1');
  const reservationId = (await reservations.json()).items[0].id;
  const invoiceId = (await invoices.json()).items[0].id;
  const guestId = (await guests.json()).items[0].id;

  const contextB = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
  const pageB = await contextB.newPage();
  await login(pageB, OWNER_B);

  const invoiceDetail = await api(pageB.request, 'GET', `/api/invoices/${invoiceId}`);
  const folio = await api(pageB.request, 'GET', `/api/reservations/${reservationId}/folio`);
  const reservation = await api(pageB.request, 'GET', `/api/reservations/${reservationId}`);
  const guest = await api(pageB.request, 'GET', `/api/guests/${guestId}`);
  const invoiceEdit = await api(pageB.request, 'PATCH', `/api/invoices/${invoiceId}`, {
    recipientName: 'Cross-tenant overwrite',
  });

  expect.soft(invoiceDetail.status(), 'invoice detail must be tenant-scoped').toBe(404);
  expect.soft(folio.status(), 'reservation folio must be tenant-scoped').toBe(404);
  expect.soft(reservation.status(), 'reservation detail must be tenant-scoped').toBe(404);
  expect.soft(guest.status(), 'guest detail must be tenant-scoped').toBe(404);
  expect.soft(invoiceEdit.status(), 'invoice edits must be tenant-scoped').toBe(404);

  const list = await api(pageB.request, 'GET', `/api/invoices?search=${invoiceId}`);
  expect(list.status()).toBe(200);
  expect((await list.json()).items).toEqual([]);

  await contextB.close();
});
