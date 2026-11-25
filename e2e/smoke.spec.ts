import { test, expect } from '@playwright/test';

test('login page renders locally', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /sign in|welcome|log in/i })).toBeVisible();
});
