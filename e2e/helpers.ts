import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const PASSWORD = 'Local-QA-Pass-2026!';
export const OWNER_A = 'owner-a@verify.local';
export const OWNER_B = 'owner-b@verify.local';

export async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
  await expect(page).not.toHaveURL(/\/login/);
}

export async function api(
  request: APIRequestContext,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  data?: unknown,
  headers?: Record<string, string>,
) {
  return request.fetch(path, {
    method,
    data: data === undefined ? undefined : data,
    headers,
  });
}

export async function createInvoice(
  request: APIRequestContext,
  input: {
    reservationId?: string;
    recipientName: string;
    amountMinorUnits: number;
    quantity?: number;
    description?: string;
    issueDate?: string;
    dueDate?: string;
  },
) {
  const response = await api(request, 'POST', '/api/invoices', {
    invoiceType: 'guest_folio',
    recipientName: input.recipientName,
    recipientEmail: 'browser-verification@example.invalid',
    reservationId: input.reservationId,
    issueDate: input.issueDate || '2026-11-21',
    dueDate: input.dueDate || '2026-12-21',
    items: [
      {
        id: 'verification-line',
        description: input.description || 'Browser verification stay',
        category: 'room',
        quantity: input.quantity ?? 1,
        unitPriceMinorUnits: input.amountMinorUnits,
      },
    ],
  });
  return response;
}

export function collectPageProblems(page: Page) {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedRequests.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });
  return { consoleErrors, failedRequests };
}
