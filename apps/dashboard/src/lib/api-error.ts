/** Only known operational failures may be shown to customers. */
export function apiError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message === 'ROOM_ASSIGNMENT_REQUIRED' || /physical room/i.test(message)) return 'Select a physical room before checking in.';
  if (/no longer available\. Choose another room\.$/i.test(message)) return message;
  if (/no longer available|capacity|not available/i.test(message)) return 'That room is no longer available. Choose another room or different dates.';
  if (/hold has expired/i.test(message)) return 'Your room hold has expired. Please choose your room again.';
  if (/check-out must be after/i.test(message)) return 'Check-out must be after check-in.';
  if (/available, clean room|not clean and ready/i.test(message)) return 'Choose an available, clean room of the booked room type.';
  if (/staff member is not available/i.test(message)) return 'This staff member is not available in your property.';
  if (/valid housekeeping status/i.test(message)) return 'Choose a valid housekeeping status.';
  if (/Choose a room in this room type/i.test(message)) return 'Choose a room in this room type.';
  if (/room assignment changed/i.test(message)) return 'Only confirmed reservations can have their room assignment changed.';
  if (/Only confirmed reservations/i.test(message)) return 'Only confirmed reservations can be checked in.';
  if (/Only checked-in stays/i.test(message)) return 'Only checked-in stays can be checked out.';
  if (/valid payment amount/i.test(message)) return 'Enter a payment amount greater than zero.';
  if (message === 'PAYSTACK_NOT_CONNECTED' || message === 'PAYSTACK_PAYMENTS_DISABLED') return 'Online payments are unavailable. Contact the property.';
  return 'We could not complete this request. Check your information and try again.';
}
