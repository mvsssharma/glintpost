/**
 * Mask a sensitive string, showing the first 4 and last 4 characters.
 * e.g. "clxm1234abcdef5678" → "clxm••••••••5678"
 */
export function maskSecret(value: string): string {
  if (value.length <= 8) return value;
  return value.slice(0, 4) + "\u2022".repeat(value.length - 8) + value.slice(-4);
}
