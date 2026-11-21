import { test, expect } from '@playwright/test';
import { api, collectPageProblems, login, OWNER_A } from './helpers';

async function collectPages(
  request: Parameters<typeof api>[0],
  path: string,
  limit = 25,
): Promise<{ ids: string[]; pages: number }> {
  const ids: string[] = [];
  let cursor: string | null = null;
  let pages = 0;
  do {
    const separator = path.includes('?') ? '&' : '?';
    const query = `${path}${separator}limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const response = await api(request, 'GET', query);
    expect(response.status()).toBe(200);
    const body = await response.json();
    ids.push(...body.items.map((item: { id: string }) => item.id));
    cursor = body.nextCursor;
    pages += 1;
    expect(pages).toBeLessThan(100);
  } while (cursor);
  return { ids, pages };
}

test('E: cursor lists are complete and unique across pages', async ({ page }) => {
  await login(page, OWNER_A);

  for (const path of ['/api/reservations', '/api/invoices', '/api/guests', '/api/payments']) {
    const { ids, pages } = await collectPages(page.request, path);
    expect(ids.length, `${path} should return more than one page`).toBeGreaterThan(25);
    expect(new Set(ids).size, `${path} should not repeat rows`).toBe(ids.length);
    expect(pages).toBeGreaterThan(1);
  }

  await page.goto('/reservations');
  const tableRows = page.locator('table tbody tr');
  await expect(tableRows.first()).toBeVisible();
  await expect(tableRows).toHaveCount(25);
  const firstPage = await tableRows.locator('td:nth-child(6) span:first-child').allTextContents();
  await page.getByRole('button', { name: 'Load more stays' }).click();
  await expect(tableRows).toHaveCount(50);
  const firstTwoPages = await tableRows.locator('td:nth-child(6) span:first-child').allTextContents();
  expect(new Set(firstPage).size).toBe(firstPage.length);
  expect(new Set(firstTwoPages).size).toBe(firstTwoPages.length);

  await page.goto('/invoices');
  const invoiceRows = page.locator('table tbody tr');
  await expect(invoiceRows.first()).toBeVisible();
  const invoiceCount = await invoiceRows.count();
  await page.getByRole('button', { name: 'Load more invoices' }).click();
  await expect(invoiceRows).toHaveCount(invoiceCount + 25);

  await page.goto('/guests');
  const guestRows = page.locator('table tbody tr');
  await expect(guestRows.first()).toBeVisible();
  const guestCount = await guestRows.count();
  await page.getByRole('button', { name: 'Load more guests' }).click();
  await expect(guestRows).toHaveCount(guestCount + 25);

  await page.goto('/payments');
  await expect(page.getByRole('button', { name: 'Load more payments' })).toBeVisible();
});

test('F: front desk exposes the operational truncation notice', async ({ page }) => {
  await login(page, OWNER_A);
  await page.goto('/front-desk');
  await expect(page.getByRole('status')).toContainText('Showing the first 1000 of 1001 stays.');
  await expect(page.getByRole('status')).toContainText('narrow the view');

  await page.goto('/rooms');
  await expect(page.getByText(/Harbour Deluxe|Last Available Room/).first()).toBeVisible();
});

test('J: primary screens load without server errors or console exceptions', async ({ page }) => {
  await login(page, OWNER_A);
  const problems = collectPageProblems(page);
  const pages = ['/', '/reservations', '/guests', '/invoices', '/payments', '/front-desk', '/rooms', '/analytics', '/settings'];

  for (const path of pages) {
    const response = await page.goto(path);
    expect(response?.status(), `${path} should not return a server error`).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
  }

  expect(problems.failedRequests.filter((entry) => entry.startsWith('5'))).toEqual([]);
  expect(problems.consoleErrors.filter((entry) => !/favicon/i.test(entry))).toEqual([]);
});
