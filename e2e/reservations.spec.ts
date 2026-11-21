import { test, expect } from '@playwright/test';
import { api, login, OWNER_A } from './helpers';

test('A: reservation can be created, edited, and cancelled in the browser', async ({ page }) => {
  const stamp = Date.now();
  const guestName = `Browser Lifecycle ${stamp}`;
  const guestPhone = `+234${String(stamp).slice(-10)}`;
  const guestEmail = `browser-lifecycle-${stamp}@example.invalid`;
  const start = new Date(Date.UTC(2030, 0, 1) + (stamp % 1000) * 86_400_000);
  const checkIn = start.toISOString().slice(0, 10);
  const checkOut = new Date(start.getTime() + 2 * 86_400_000).toISOString().slice(0, 10);
  await login(page, OWNER_A);
  await page.goto('/reservations');

  await page.getByRole('button', { name: /new reservation/i }).click();
  await page.locator('#reservation-check-in').fill(checkIn);
  await page.locator('#reservation-check-out').fill(checkOut);
  await page.getByRole('button', { name: /harbour deluxe/i }).click();
  await page.getByLabel('Guest name').fill(guestName);
  await page.getByLabel('Phone').fill(guestPhone);
  await page.getByLabel('Email').fill(guestEmail);
  await page.getByRole('button', { name: 'Create reservation' }).click();

  await expect(page.getByText('Reservation Confirmed', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();

  await page.getByPlaceholder('Search guest, code, or room...').fill(guestName);
  const reservationRow = page.locator('table tbody tr').filter({ hasText: guestName }).first();
  await expect(reservationRow).toBeVisible();
  await reservationRow.click();
  await expect(page.getByRole('heading', { name: guestName })).toBeVisible();

  const search = await api(page.request, 'GET', `/api/reservations?search=${encodeURIComponent(guestName)}&limit=5`);
  const created = (await search.json()).items.find((item: { guestName: string }) => item.guestName === guestName);
  expect(created).toBeTruthy();
  const extended = await api(page.request, 'PATCH', `/api/reservations/${created.id}`, {
    checkInDate: created.checkInDate,
    checkOutDate: new Date(start.getTime() + 3 * 86_400_000).toISOString().slice(0, 10),
    numGuests: created.numGuests,
    roomId: null,
    accommodationType: 'room',
    roomTypeId: created.roomTypeId,
    extensionReason: 'Standard extension',
  });
  expect(extended.status()).toBe(200);
  expect((await extended.json()).reservation.nights).toBe(3);

  await page.reload();
  await page.getByPlaceholder('Search guest, code, or room...').fill(guestName);
  const extendedRow = page.locator('table tbody tr').filter({ hasText: guestName }).first();
  await expect(extendedRow).toBeVisible();
  await extendedRow.click();
  await expect(page.getByText('3 nights', { exact: true }).first()).toBeVisible();

  const cancelled = await api(page.request, 'POST', `/api/reservations/${created.id}/cancel`, {
    reason: 'Browser verification cancellation',
  });
  expect(cancelled.status()).toBe(200);

  await page.reload();
  await page.getByPlaceholder('Search guest, code, or room...').fill(guestName);
  const cancelledRow = page.locator('table tbody tr').filter({ hasText: guestName }).first();
  await expect(cancelledRow).toBeVisible();
  await expect(cancelledRow.getByText('Cancelled', { exact: true })).toBeVisible();
});

test('A: invalid stay dates are rejected with a 4xx response', async ({ page }) => {
  await login(page, OWNER_A);
  const categories = await api(page.request, 'GET', '/api/rooms');
  expect(categories.status()).toBe(200);
  const body = await categories.json();
  const roomTypeId = body.roomTypes[0].id;

  const response = await api(page.request, 'POST', '/api/reservations', {
    roomTypeId,
    checkInDate: '2027-04-10',
    checkOutDate: '2027-04-10',
    numGuests: 1,
    guest: { fullName: 'Invalid Dates Guest', email: 'invalid-dates@example.invalid' },
  });
  expect(response.status()).toBeGreaterThanOrEqual(400);
  expect(response.status()).toBeLessThan(500);
  const result = await response.json();
  expect(String(result.error)).toMatch(/date|night|check/i);
});
