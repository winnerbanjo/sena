export function normalizeHexColor(input?: string | null, fallback = '#71382D'): string {
  if (!input) return fallback;
  let hex = input.trim();
  if (!hex.startsWith('#')) hex = '#' + hex;
  if (/^#[0-9A-Fa-f]{3}$/.test(hex)) {
    return (
      '#' +
      hex[1] +
      hex[1] +
      hex[2] +
      hex[2] +
      hex[3] +
      hex[3]
    ).toLowerCase();
  }
  if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return hex.toLowerCase();
  }
  return fallback;
}
