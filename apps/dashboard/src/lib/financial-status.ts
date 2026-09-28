export function folioBalance(totalAmountMinorUnits: number, paidAmountMinorUnits: number) {
  return Math.max(0, Number(totalAmountMinorUnits || 0) - Number(paidAmountMinorUnits || 0));
}

export function settlementLabel(
  status: string,
  totalAmountMinorUnits: number,
  paidAmountMinorUnits: number
) {
  const balance = folioBalance(totalAmountMinorUnits, paidAmountMinorUnits);
  if (balance <= 0 && paidAmountMinorUnits > 0) return 'Settled';
  if (status === 'checked_out' && balance > 0) return 'Outstanding';
  if (paidAmountMinorUnits > 0 && balance > 0) return 'Partially Paid';
  return 'Balance Due';
}

export function policyErrorResponse(error: unknown) {
  const err = error as { message?: string; code?: string; outstandingBalanceMinorUnits?: number };
  const code = err.code || err.message;
  const outstandingBalanceMinorUnits = Number(err.outstandingBalanceMinorUnits || 0);
  if (code === 'PAYMENT_REQUIRED_BEFORE_CHECK_IN') {
    return {
      status: 400,
      body: {
        error: 'Payment required before check-in',
        code,
        outstandingBalanceMinorUnits,
      },
    };
  }
  if (code === 'OUTSTANDING_BALANCE_AUTHORIZATION_REQUIRED') {
    return {
      status: 400,
      body: {
        error: 'Confirm check-in with outstanding balance',
        code,
        outstandingBalanceMinorUnits,
        requiresAuthorization: true,
      },
    };
  }
  if (code === 'SETTLEMENT_REQUIRED_BEFORE_CHECKOUT') {
    return {
      status: 400,
      body: {
        error: 'Settlement required before checkout',
        code,
        outstandingBalanceMinorUnits,
        requiresForce: false,
      },
    };
  }
  return null;
}
