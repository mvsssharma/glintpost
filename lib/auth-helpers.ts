import { cache } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { prisma } from "./db";
import type { Session } from "next-auth";

// Wrapped in React cache(): layout + page both call these, so dedupe the auth()
// call and org query to once per request.

/**
 * Require an authenticated user. Redirects to /login if not authenticated.
 */
export const requireAuth = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session;
});

/**
 * Require an authenticated user with a verified email.
 * Redirects to /login if not authenticated, /verify-email if not verified.
 */
export const requireVerified = cache(async () => {
  const session = await requireAuth();
  if (!session.emailVerified) {
    redirect("/verify-email");
  }
  return session;
});

/**
 * Require an authenticated user with an organization.
 * Redirects to /login if not authenticated, /verify-email if not verified,
 * /onboarding if no org.
 */
export const requireOrg = cache(async () => {
  const session = await requireVerified();
  if (!session.orgId) {
    redirect("/onboarding");
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.orgId },
    include: { settings: true },
  });

  if (!org) {
    redirect("/onboarding");
  }

  if (!org.onboardingComplete) {
    redirect("/onboarding");
  }

  return { session, org };
});

type ApiAuthResult =
  | { session: Session & { orgId: string }; error?: undefined }
  | { session?: undefined; error: NextResponse };

/**
 * Require an authenticated, verified user with an org for a JSON API route.
 * Unlike requireOrg(), returns a JSON error response instead of redirecting,
 * since API routes are called by client-side fetch/XHR, not page navigation.
 */
export async function requireOrgApi(): Promise<ApiAuthResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!session.emailVerified) {
    return { error: NextResponse.json({ error: "Email not verified" }, { status: 403 }) };
  }
  if (!session.orgId) {
    return { error: NextResponse.json({ error: "No organization" }, { status: 403 }) };
  }
  return { session: session as Session & { orgId: string } };
}
