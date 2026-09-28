import { formatNaira } from '@sena/config';

export function folioBalance(totalAmountMinorUnits: number, paidAmountMinorUnits: number) {
  return Math.max(0, Number(totalAmountMinorUnits || 0) - Number(paidAmountMinorUnits || 0));
}

export type DeskPaymentKind = 'paid' | 'partially_paid' | 'not_paid' | 'pending_verification';

export function deskPaymentStatus(input: {
  totalAmountMinorUnits: number;
  paidAmountMinorUnits: number;
  pendingTransferProof?: boolean;
}) {
  const total = Number(input.totalAmountMinorUnits || 0);
  const paid = Number(input.paidAmountMinorUnits || 0);
  const due = folioBalance(total, paid);
  const pendingProof = Boolean(input.pendingTransferProof) && due > 0;

  if (due <= 0) {
    return {
      kind: 'paid' as const satisfies DeskPaymentKind,
      label: 'PAID',
      columnLabel: 'Paid',
      amountDueMinorUnits: 0,
      paidMinorUnits: paid,
      receivedLabel: paid > 0 ? formatNaira(paid) : undefined,
    };
  }

  if (pendingProof) {
    return {
      kind: 'pending_verification' as const satisfies DeskPaymentKind,
      label: 'PENDING VERIFICATION',
      columnLabel: 'Pending Verification',
      amountDueMinorUnits: due,
      paidMinorUnits: paid,
      dueLabel: formatNaira(due),
      receivedLabel: paid > 0 ? formatNaira(paid) : undefined,
    };
  }

  if (paid > 0) {
    return {
      kind: 'partially_paid' as const satisfies DeskPaymentKind,
      label: 'PARTIALLY PAID',
      columnLabel: `Partially Paid ${formatNaira(due)} due`,
      amountDueMinorUnits: due,
      paidMinorUnits: paid,
      dueLabel: formatNaira(due),
      receivedLabel: formatNaira(paid),
    };
  }

  return {
    kind: 'not_paid' as const satisfies DeskPaymentKind,
    label: 'NOT PAID',
    columnLabel: `Not Paid ${formatNaira(due)} due`,
    amountDueMinorUnits: due,
    paidMinorUnits: paid,
    dueLabel: formatNaira(due),
  };
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
