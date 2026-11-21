import { test, expect } from '@playwright/test';
import { api, login, OWNER_A } from './helpers';

test('B: guest profile edit persists and validation is enforced', async ({ page }) => {
  await login(page, OWNER_A);
  await page.goto('/guests');
  await page.getByPlaceholder('Search by name, phone, email...').fill('Verification Guest 01');
  await page.getByText('Verification Guest 01', { exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Verification Guest 01' })).toBeVisible();

  await page.getByRole('button', { name: 'Edit Profile' }).click();
  await page.locator('#guest-phone').fill('+2348111111111');
  await page.locator('#guest-notes').fill('Browser verification note');
  await page.getByRole('button', { name: 'Save Profile' }).click();

  await page.reload();
  await page.getByPlaceholder('Search by name, phone, email...').fill('Verification Guest 01');
  await page.getByText('Verification Guest 01', { exact: true }).first().click();
  await expect(page.getByRole('dialog').getByText('+2348111111111')).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Browser verification note')).toBeVisible();

  const list = await api(page.request, 'GET', '/api/guests?search=Verification%20Guest%2001&limit=5');
  const guest = (await list.json()).items[0];

  const blank = await api(page.request, 'PATCH', `/api/guests/${guest.id}`, { fullName: '   ' });
  expect(blank.status()).toBe(400);
  expect((await blank.json()).error).toMatch(/name is required/i);

  const invalidEmail = await api(page.request, 'PATCH', `/api/guests/${guest.id}`, { email: 'not-an-email' });
  expect(invalidEmail.status()).toBe(400);
  expect((await invalidEmail.json()).error).toMatch(/invalid email/i);

  const unchanged = await api(page.request, 'PATCH', `/api/guests/${guest.id}`, {
    fullName: guest.fullName,
    email: guest.email,
    phone: guest.phone,
    notes: guest.notes,
  });
  expect(unchanged.status()).toBe(200);
  expect((await unchanged.json()).message).toBe('No changes made.');
});
