/**
 * Shared helpers for keyset (cursor) pagination.
 *
 * Cursors are opaque base64url JSON blobs holding the sort key values of the
 * last row on the previous page. Callers must order by the same keys and use a
 * strict row comparison so equal sort keys cannot duplicate or skip rows.
 */

export const DEFAULT_PAGE_LIMIT = 25;
export const MAX_PAGE_LIMIT = 100;

export type CursorPayload = Record<string, string | number | null>;

export function parsePageLimit(value: string | null | undefined): number {
  if (!value) return DEFAULT_PAGE_LIMIT;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_PAGE_LIMIT;
  return Math.min(parsed, MAX_PAGE_LIMIT);
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

/** Preserve database timestamp text exactly; JavaScript Date drops sub-ms precision. */
export function cursorTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const timestamp = value.trim();
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp)
    ? timestamp
    : null;
}

/** Returns null for absent cursors and for anything that is not a JSON object. */
export function decodeCursor(value: string | null | undefined): CursorPayload | null {
  if (!value) return null;
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as CursorPayload;
  } catch {
    return null;
  }
}

export function cursorUuid(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : null;
}

/** Escapes LIKE/ILIKE metacharacters so user input is matched literally. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export function cursorIsMalformed(raw: string | null, cursor: CursorPayload | null): boolean {
  return Boolean(raw) && !cursor;
}

export function badCursorResponse(): { error: string } {
  return { error: 'Invalid pagination cursor' };
}
