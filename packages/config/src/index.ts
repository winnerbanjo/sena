import { MinorUnits, Permission, Role } from '@sena/types';

/**
 * Sena Design System Palette Tokens
 * Section 14 of PRD
 */
export const SENA_COLORS = {
  ivory: '#FFFFFF',
  terracotta: '#B85C3E',
  clay: '#71382D',
  sand: '#E5D4BC',
  ink: '#191816',
  white: '#FFFFFF',
  muted: '#7A7267',
  border: '#E8E2DA',
  success: '#2E6B4F',
  warning: '#C47C2B',
  danger: '#9E382A',
} as const;

/**
 * Role to Default Permissions Mapping
 * Section 69-70 of PRD
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [
    'reservation.read',
    'reservation.create',
    'reservation.edit',
    'reservation.cancel',
    'guest.read',
    'guest.edit',
    'room.read',
    'room.edit',
    'housekeeping.update',
    'payment.read',
    'payment.record',
    'payment.refund',
    'analytics.read',
    'website.edit',
    'website.publish',
    'staff.invite',
    'billing.manage',
  ],
  manager: [
    'reservation.read',
    'reservation.create',
    'reservation.edit',
    'reservation.cancel',
    'guest.read',
    'guest.edit',
    'room.read',
    'room.edit',
    'housekeeping.update',
    'payment.read',
    'payment.record',
    'analytics.read',
    'website.edit',
    'website.publish',
    'staff.invite',
  ],
  front_desk: [
    'reservation.read',
    'reservation.create',
    'reservation.edit',
    'guest.read',
    'guest.edit',
    'room.read',
    'housekeeping.update',
    'payment.read',
    'payment.record',
  ],
  housekeeping: [
    'room.read',
    'housekeeping.update',
  ],
  accountant: [
    'payment.read',
    'payment.record',
    'payment.refund',
    'analytics.read',
    'reservation.read',
  ],
  marketing: [
    'website.edit',
    'website.publish',
    'analytics.read',
  ],
};

/**
 * Money Utility Functions
 * Stored strictly in minor integer units (Kobo)
 * Section 91 of PRD
 */
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

/**
 * Calendar Date Helpers (Property Local Time - Africa/Lagos)
 * Section 92 of PRD
 */
export function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function calculateNights(checkInDate: string, checkOutDate: string): number {
  if (!isValidCalendarDate(checkInDate) || !isValidCalendarDate(checkOutDate) || checkOutDate <= checkInDate) throw new Error('Check-out must be after a valid check-in date.');
  const [y1, m1, d1] = checkInDate.split('-').map(Number);
  const [y2, m2, d2] = checkOutDate.split('-').map(Number);
  const inUtc = Date.UTC(y1, m1 - 1, d1);
  const outUtc = Date.UTC(y2, m2 - 1, d2);
  const diffMs = outUtc - inUtc;
  const nights = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return nights;
}

export function getDatesBetween(startDate: string, endDate: string): string[] {
  if (!isValidCalendarDate(startDate) || !isValidCalendarDate(endDate) || endDate < startDate) throw new Error('Invalid calendar date range.');
  const dates: string[] = [];
  const [y1, m1, d1] = startDate.split('-').map(Number);
  const [y2, m2, d2] = endDate.split('-').map(Number);
  const current = new Date(Date.UTC(y1, m1 - 1, d1));
  const end = new Date(Date.UTC(y2, m2 - 1, d2));

  while (current < end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export function formatStayDates(checkIn: string, checkOut: string): string {
  try {
    const dIn = new Date(`${checkIn}T00:00:00Z`);
    const dOut = new Date(`${checkOut}T00:00:00Z`);
    const inMonth = dIn.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
    const outMonth = dOut.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
    const inDay = dIn.getUTCDate();
    const outDay = dOut.getUTCDate();

    if (inMonth === outMonth) {
      return `${inDay}–${outDay} ${inMonth}`;
    }
    return `${inDay} ${inMonth} → ${outDay} ${outMonth}`;
  } catch {
    return `${checkIn} → ${checkOut}`;
  }
}
