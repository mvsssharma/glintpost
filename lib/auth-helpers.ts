import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "./db";

/**
 * Require an authenticated user. Redirects to /login if not authenticated.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session;
}

/**
 * Require an authenticated user with an organization.
 * Redirects to /login if not authenticated, /onboarding if no org.
 */
export async function requireOrg() {
  const session = await requireAuth();
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
}
