/**
 * Resolves the app's public base URL at **runtime** (server-side).
 *
 * Uses a plain `APP_URL` env var — NOT `NEXT_PUBLIC_APP_URL` — so the value is
 * read when the request is served, not frozen at build time. This is what lets
 * a single prebuilt Docker image be deployed to any domain. `NEXT_PUBLIC_APP_URL`
 * and `AUTH_URL` are kept in the fallback chain for backward compatibility with
 * existing Vercel deployments.
 *
 * Client components must NOT import this — pass the value down as a prop from a
 * server component, or derive it from `window.location.origin`.
 */
export function getAppUrl(): string {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    "http://localhost:3000"
  );
}
