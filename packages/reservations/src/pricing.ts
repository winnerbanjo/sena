import { assertMoney, checkedMul, checkedSub } from '@sena/config';

export interface StayPricingInput {
  basePriceMinorUnits: number;
  nights: number;
  customTotalAmountMinorUnits?: number | null;
}

export interface StayPricing {
  standardAmountMinorUnits: number;
  totalAmountMinorUnits: number;
  discountAmountMinorUnits: number;
}

/**
 * Standard rate × nights, with an optional negotiated total.
 *
 * Never clamps out-of-range money: a rate, night count, product, or negotiated
 * total that the ledger cannot store exactly throws MoneyRangeError instead.
 */
export function calculateStayAmounts(input: StayPricingInput): StayPricing {
  const standardAmountMinorUnits = checkedMul(
    input.basePriceMinorUnits,
    input.nights,
    'Accommodation total',
  );
  const totalAmountMinorUnits = input.customTotalAmountMinorUnits != null
    ? assertMoney(input.customTotalAmountMinorUnits, 'Custom total')
    : standardAmountMinorUnits;
  // A negotiated total above the rack rate has no discount; the difference is
  // a derived display value, not a stored amount.
  const discountAmountMinorUnits = Math.max(
    0,
    checkedSub(standardAmountMinorUnits, totalAmountMinorUnits, 'Discount', { allowNegative: true }),
  );
  return { standardAmountMinorUnits, totalAmountMinorUnits, discountAmountMinorUnits };
}
