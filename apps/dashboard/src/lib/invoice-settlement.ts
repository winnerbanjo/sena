/** Invoice settlement is limited by the invoice balance, not the original stay total. */
export function applyInvoiceSettlementToReservation(input: {
  reservationPaidMinorUnits: number;
  reservationTotalMinorUnits: number;
  amountMinorUnits: number;
}) {
  const paidAmountMinorUnits = input.reservationPaidMinorUnits + input.amountMinorUnits;
  return {
    paidAmountMinorUnits,
    paymentStatus: paidAmountMinorUnits >= input.reservationTotalMinorUnits ? 'paid' as const : 'part_payment' as const,
  };
}
