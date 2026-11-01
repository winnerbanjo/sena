/**
 * Formats API errors for display in the merchant dashboard and front desk.
 * Operational errors and validation messages are returned clearly to staff.
 * Internal technical errors are converted to clean, actionable notices.
 */
export function apiError(error: unknown): string {
  if (!error) return 'An unexpected error occurred. Please try again.';
  const message = error instanceof Error ? error.message : String(error);

  if (message === 'ROOM_ASSIGNMENT_REQUIRED' || /physical room/i.test(message)) return 'Select a physical room before checking in.';
  if (/hold has expired/i.test(message)) return 'Your room hold has expired. Please choose your room again.';
  if (/check-out must be after/i.test(message)) return 'Check-out must be after check-in.';
  if (/available, clean room|not clean and ready/i.test(message)) return 'Choose an available, clean room of the booked room type.';
  if (/staff member is not available/i.test(message)) return 'This staff member is not available in your property.';
  if (/valid housekeeping status/i.test(message)) return 'Choose a valid housekeeping status.';
  if (/Choose a room in this room type/i.test(message)) return 'Choose a room in this room type.';
  if (/Only confirmed reservations can be checked in/i.test(message)) return 'Only confirmed reservations can be checked in.';
  if (/Only checked-in stays/i.test(message)) return 'Only checked-in stays can be checked out.';
  if (/valid payment amount/i.test(message)) return 'Enter a payment amount greater than zero.';
  if (message === 'PAYSTACK_NOT_CONNECTED' || message === 'PAYSTACK_PAYMENTS_DISABLED') return 'Online payments are unavailable. Contact the property.';

  // Technical database / network driver exceptions
  if (/ECONNREFUSED|connect ETIMEDOUT|Connection terminated|PostgresError|syntax error|relation.*does not exist/i.test(message)) {
    return 'Database connection error. Please try again in a moment.';
  }

  // Return descriptive domain and operational messages directly (e.g. fully booked, guest validation, payment policy, etc.)
  if (message && message.length < 300 && !message.includes('\n') && !message.includes('at ')) {
    return message;
  }

  return 'We could not complete this request. Check your information and try again.';
}

