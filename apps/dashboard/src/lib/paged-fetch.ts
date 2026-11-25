/**
 * Client-side helper for endpoints that return `{ items, nextCursor }`.
 *
 * Operational screens (front desk, rooms, POS, command palette) need more than
 * the first page but must not pull a property's whole history, so they walk a
 * bounded number of cursor pages instead.
 */
export async function fetchPagedItems<T>(
  path: string,
  options: { maxPages?: number; signal?: AbortSignal } = {},
): Promise<T[]> {
  const { maxPages = 5, signal } = options;
  const items: T[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < maxPages; page += 1) {
    const url = new URL(path, window.location.origin);
    if (cursor) url.searchParams.set('cursor', cursor);
    const response = await fetch(url.toString(), { signal });
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    const data = await response.json();
    items.push(...(data.items || []));
    cursor = data.nextCursor || null;
    if (!cursor) break;
  }

  return items;
}
