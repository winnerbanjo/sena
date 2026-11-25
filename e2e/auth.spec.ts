import { test, expect } from '@playwright/test';
import { login, OWNER_A } from './helpers';

test('owner can sign in and reach the workspace', async ({ page }) => {
  await login(page, OWNER_A);
  await expect(page.getByRole('heading', { name: /overview|front desk|dashboard/i }).first()).toBeVisible();
});
