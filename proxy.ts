import { auth } from "@/auth";
import { NextResponse } from "next/server";

const publicPaths = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/api/auth",
  "/api/config",
  "/api/changelog",
  "/api/roadmap",
  "/changelog",
  "/board",
];

function isPublicPath(pathname: string) {
  return publicPaths.some((p) => pathname.startsWith(p));
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (isPublicPath(pathname)) return NextResponse.next();

  // Not authenticated → redirect to login
  if (!req.auth?.user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated but email not verified → redirect to verify-email
  if (!req.auth.emailVerified && pathname !== "/verify-email") {
    return NextResponse.redirect(new URL("/verify-email", req.url));
  }

  // Authenticated but no org → redirect to onboarding (unless already there)
  if (!req.auth.orgId && pathname !== "/onboarding") {
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }

  // Has org but on onboarding → let them through (they might not be complete)
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Match all paths except static files and API internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css)$).*)",
  ],
};
