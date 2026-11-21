import type { MinorUnits } from '@sena/types';

/**
 * Money is stored strictly in minor integer units (kobo).
 * Section 91 of PRD
 */

/**
 * Largest value a PostgreSQL `integer` money column can hold:
 * 2,147,483,647 kobo = ₦21,474,836.47.
 *
 * Newer gym/restaurant columns are `bigint`, but the hotel ledger columns this
 * module protects are `integer`, so every stored amount must fit this bound.
 */
export const MAX_MONEY_MINOR_UNITS = 2_147_483_647;

/**
 * A money input or intermediate result fell outside the range the ledger can
 * store exactly. Routes map this to HTTP 400: the caller sent a correctable
 * amount, so it is not a server fault.
 */
export class MoneyRangeError extends Error {
  readonly code = 'MONEY_RANGE';
  readonly field: string;
  readonly limitMinorUnits: number;

  constructor(field: string, reason: string, limitMinorUnits: number = MAX_MONEY_MINOR_UNITS) {
    super(`${field} ${reason} The maximum is ${formatNaira(limitMinorUnits, { showKobo: true })}.`);
    this.name = 'MoneyRangeError';
    this.field = field;
    this.limitMinorUnits = limitMinorUnits;
  }
}

export function formatNaira(minorUnits: MinorUnits, options?: { showKobo?: boolean }): string {
  const majorUnits = minorUnits / 100;
  if (!options?.showKobo && Number.isInteger(majorUnits)) {
    return `₦${majorUnits.toLocaleString('en-NG')}`;
  }
  return `₦${majorUnits.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function toMinorUnits(naira: number): MinorUnits {
  return Math.round(naira * 100);
}

export function fromMinorUnits(minorUnits: MinorUnits): number {
  return minorUnits / 100;
}

export interface MoneyConstraint {
  /** Allow a negative amount. Derived differences (e.g. discount) opt in. */
  allowNegative?: boolean;
  /** Reject zero. Payment amounts opt in to this. */
  allowZero?: boolean;
  /** Override the storage bound, e.g. for a narrower column. */
  maxMinorUnits?: number;
}

function wholeNumber(value: unknown, field: string): number {
  if (typeof value === 'string' && value.trim() === '') {
    throw new MoneyRangeError(field, 'must be a whole amount in kobo.');
  }
  const amount = typeof value === 'number' ? value : Number(value);
  if (
    value === null ||
    value === undefined ||
    typeof value === 'boolean' ||
    !Number.isFinite(amount)
  ) {
    throw new MoneyRangeError(field, 'must be a whole amount in kobo.');
  }
  if (!Number.isInteger(amount)) {
    throw new MoneyRangeError(field, 'must be a whole amount in kobo, not a fraction.');
  }
  return amount;
}

/**
 * Validate a money value before it is stored or used in arithmetic.
 * Rejects fractions, non-finite values, values above the storage bound, and
 * (unless allowed) negatives and zero.
 */
export function assertMoney(value: unknown, field: string, constraint: MoneyConstraint = {}): number {
  const amount = wholeNumber(value, field);
  if (!Number.isSafeInteger(amount)) {
    throw new MoneyRangeError(field, 'is too large to calculate safely.');
  }
  const limit = constraint.maxMinorUnits ?? MAX_MONEY_MINOR_UNITS;
  if (amount > limit) {
    throw new MoneyRangeError(field, 'is above the allowed maximum.', limit);
  }
  if (!constraint.allowNegative) {
    if (amount < 0) throw new MoneyRangeError(field, 'cannot be negative.');
  } else if (amount < -limit) {
    throw new MoneyRangeError(field, 'is below the allowed minimum.', limit);
  }
  if (constraint.allowZero === false && amount === 0) {
    throw new MoneyRangeError(field, 'must be greater than zero.');
  }
  return amount;
}

function assertWhole(value: number, field: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyRangeError(field, 'is too large to calculate safely.');
  }
  return value;
}

/** Add two money values, rejecting a result the ledger cannot store. */
export function checkedAdd(left: number, right: number, field: string): number {
  assertWhole(left, field);
  assertWhole(right, field);
  const sum = left + right;
  if (!Number.isSafeInteger(sum)) {
    throw new MoneyRangeError(field, 'is too large to calculate safely.');
  }
  return assertMoney(sum, field);
}

/** Subtract two money values. Pass `allowNegative` for derived differences. */
export function checkedSub(
  left: number,
  right: number,
  field: string,
  options: { allowNegative?: boolean } = {},
): number {
  assertWhole(left, field);
  assertWhole(right, field);
  const difference = left - right;
  if (!Number.isSafeInteger(difference)) {
    throw new MoneyRangeError(field, 'is too large to calculate safely.');
  }
  return assertMoney(difference, field, { allowNegative: options.allowNegative });
}

/** Multiply money by a whole count, rejecting products beyond exact arithmetic. */
export function checkedMul(left: number, right: number, field: string): number {
  assertWhole(left, field);
  assertWhole(right, field);
  const product = left * right;
  if (!Number.isSafeInteger(product)) {
    throw new MoneyRangeError(field, 'is too large to calculate safely.');
  }
  return assertMoney(product, field);
}

/** Sum money values with the same bound checks as {@link checkedAdd}. */
export function checkedSum(values: readonly number[], field: string): number {
  let total = 0;
  for (const value of values) total = checkedAdd(total, value, field);
  return total;
}
