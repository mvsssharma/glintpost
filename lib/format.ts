/**
 * Deterministic date/time formatting.
 *
 * `Date#toLocaleDateString()` with no arguments uses the runtime's locale and
 * timezone, which differ between the server (UTC on Vercel / system locale) and
 * the browser (the visitor's locale/timezone). In client components that causes
 * a React hydration mismatch (e.g. "12/03/2026" vs "3/12/2026"). Pinning both
 * locale and timezone makes the output identical everywhere.
 */
const LOCALE = "en-US";
const TIME_ZONE = "UTC";

export function formatDate(value: Date | string | number): string {
  return new Date(value).toLocaleDateString(LOCALE, { timeZone: TIME_ZONE });
}

export function formatTime(value: Date | string | number): string {
  return new Date(value).toLocaleTimeString(LOCALE, { timeZone: TIME_ZONE });
}
