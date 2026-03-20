const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Builds the set of origins trusted for postMessage communication.
 * Includes the Glintpost app origin, localhost for development,
 * and the org's configured allowedDomain if set.
 */
export function getAllowedOrigins(allowedDomain: string | null): Set<string> {
  const origins = new Set<string>([APP_ORIGIN]);

  // Allow localhost on any port for development
  if (typeof window !== "undefined" && window.location.origin.startsWith("http://localhost")) {
    origins.add(window.location.origin);
  }
  origins.add("http://localhost:3000");

  if (allowedDomain) {
    origins.add(allowedDomain);
  }

  return origins;
}

/**
 * Returns the targetOrigin to use for window.parent.postMessage.
 * If the parent origin is known and in the allowed set, returns it.
 * Falls back to "*" only when the parent origin cannot be determined.
 */
export function getParentOrigin(allowedOrigins: Set<string>): string {
  try {
    // Same-origin parents: we can read parent.location.origin directly
    const parentOrigin = window.parent.location.origin;
    if (allowedOrigins.has(parentOrigin)) return parentOrigin;
  } catch {
    // Cross-origin: parent.location.origin throws.
    // Try document.referrer as a hint.
  }

  try {
    if (document.referrer) {
      const referrerOrigin = new URL(document.referrer).origin;
      if (allowedOrigins.has(referrerOrigin)) return referrerOrigin;
    }
  } catch {
    // Malformed referrer — ignore
  }

  return "*";
}

/**
 * Checks whether an incoming MessageEvent comes from a trusted origin.
 */
export function isAllowedOrigin(
  eventOrigin: string,
  allowedOrigins: Set<string>
): boolean {
  return allowedOrigins.has(eventOrigin);
}
