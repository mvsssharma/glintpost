/**
 * The app's own origin. These iframe pages are always served *from* the app
 * origin, so `window.location.origin` is the source of truth at runtime — this
 * works on any domain without a build-time env var (important for a single
 * prebuilt Docker image deployed to arbitrary hosts). Falls back to a runtime
 * env var only during SSR, where `window` is undefined.
 */
function getAppOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

/**
 * Builds the set of origins trusted for postMessage communication.
 * Includes the Glintpost app origin, localhost for development,
 * and the org's configured allowedDomain if set.
 */
export function getAllowedOrigins(allowedDomain: string | null): Set<string> {
  const origins = new Set<string>([getAppOrigin()]);

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
 * Returns the targetOrigin to use for window.parent.postMessage, or null if
 * no trusted origin can be determined. Never widens to "*" — a message sent
 * to an unverified origin could be read by any page that happens to embed
 * this iframe.
 */
export function getParentOrigin(allowedOrigins: Set<string>): string | null {
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

  // Neither check confirmed the parent's origin. Fall back to the org's
  // configured custom domain, if any — the one other origin we can trust
  // to be the legitimate embed target. Otherwise give up rather than guess.
  const appOrigin = getAppOrigin();
  for (const origin of allowedOrigins) {
    if (origin !== appOrigin && !origin.startsWith("http://localhost")) {
      return origin;
    }
  }

  return null;
}

/**
 * Posts a message to the parent frame if a trusted target origin is known.
 * Silently no-ops otherwise instead of falling back to "*".
 */
export function postToParent(data: unknown, allowedOrigins: Set<string>): void {
  const origin = getParentOrigin(allowedOrigins);
  if (!origin) return;
  window.parent.postMessage(data, origin);
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
