/** Only known operational failures may be shown to customers. */
export function apiError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (/no longer available|capacity|not available/i.test(message)) return 'That room is no longer available. Choose another room or different dates.';
  if (/hold has expired/i.test(message)) return 'Your room hold has expired. Please choose your room again.';
  if (/check-out must be after/i.test(message)) return 'Check-out must be after check-in.';
  if (/available, clean room/i.test(message)) return 'Choose an available, clean room of the booked room type.';
  if (/Only confirmed reservations/i.test(message)) return 'Only confirmed reservations can be checked in.';
  if (/Only checked-in stays/i.test(message)) return 'Only checked-in stays can be checked out.';
  if (/valid payment amount/i.test(message)) return 'Enter a payment amount greater than zero.';
  return 'We could not complete this request. Check your information and try again.';
}
