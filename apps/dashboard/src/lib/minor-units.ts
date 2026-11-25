import { formatNaira } from '@sena/config';

/**
 * Formats a minor-unit amount that may arrive from the API as a decimal string
 * (PostgreSQL bigint sums). Only converts to Number inside the safe integer
 * range; larger sums are formatted from BigInt so no precision is lost.
 */
export function formatMinorUnits(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return formatNaira(0);
  if (typeof value === 'number') return formatNaira(value);

  let amount: bigint;
  try {
    amount = BigInt(value);
  } catch {
    return formatNaira(0);
  }

  if (amount <= BigInt(Number.MAX_SAFE_INTEGER) && amount >= BigInt(Number.MIN_SAFE_INTEGER)) {
    return formatNaira(Number(amount));
  }

  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const major = absolute / 100n;
  const kobo = absolute % 100n;
  const formatted = `₦${major.toLocaleString('en-NG')}${kobo ? `.${kobo.toString().padStart(2, '0')}` : ''}`;
  return negative ? `-${formatted}` : formatted;
}
