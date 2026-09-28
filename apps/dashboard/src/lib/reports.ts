export type ReportRangeKey = 'today' | 'week' | 'month' | 'quarter' | 'year';

export const REPORT_RANGE_KEYS: ReportRangeKey[] = ['today', 'week', 'month', 'quarter', 'year'];

function isoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function reportRangeBounds(range: ReportRangeKey, now = new Date()) {
  const end = new Date(now);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (range === 'week') {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  } else if (range === 'month') {
    start.setDate(1);
  } else if (range === 'quarter') {
    start.setMonth(start.getMonth() - (start.getMonth() % 3), 1);
  } else if (range === 'year') {
    start.setMonth(0, 1);
  }
  const startIso = isoDate(start);
  const endIso = isoDate(end);
  const days = Math.max(1, Math.round((Date.parse(`${endIso}T00:00:00`) - Date.parse(`${startIso}T00:00:00`)) / 86400000) + 1);
  return { start, end, startIso, endIso, days };
}

export function parseReportRange(value: string | null | undefined): ReportRangeKey {
  return REPORT_RANGE_KEYS.includes(value as ReportRangeKey) ? (value as ReportRangeKey) : 'month';
}

export function stayOverlapsRange(checkInDate: string, checkOutDate: string, startIso: string, endIso: string) {
  return checkInDate <= endIso && checkOutDate > startIso;
}
