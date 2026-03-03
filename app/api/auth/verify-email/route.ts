import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const VERIFICATION_IDENTIFIER_PREFIX = "email-verify:";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  if (!token || !email) {
    return NextResponse.redirect(
      new URL("/verify-email?error=invalid", req.url)
    );
  }

  const identifier = `${VERIFICATION_IDENTIFIER_PREFIX}${email}`;

  try {
    const storedToken = await prisma.verificationToken.findUnique({
      where: { identifier_token: { identifier, token } },
    });

    if (!storedToken) {
      return NextResponse.redirect(
        new URL("/verify-email?error=invalid", req.url)
      );
    }

    if (storedToken.expires < new Date()) {
      await prisma.verificationToken.delete({
        where: { identifier_token: { identifier, token } },
      });
      return NextResponse.redirect(
        new URL("/verify-email?error=expired", req.url)
      );
    }

    // Mark user as verified
    await prisma.user.update({
      where: { email },
      data: { emailVerified: new Date() },
    });

    // Delete the used token
    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier, token } },
    });

    return NextResponse.redirect(
      new URL("/login?verified=true", req.url)
    );
  } catch {
    return NextResponse.redirect(
      new URL("/verify-email?error=server", req.url)
    );
  }
}
