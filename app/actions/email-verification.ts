"use server";

import { prisma } from "@/lib/db";
import { randomBytes } from "crypto";
import { auth } from "@/auth";

const VERIFICATION_IDENTIFIER_PREFIX = "email-verify:";
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface EmailVerificationState {
  error?: string;
  success?: string;
}

/**
 * Send (or resend) a verification email for the given email address.
 * Can be called from signup (with email param) or from the
 * verify-email page (using session email).
 */
export async function sendVerificationEmail(
  email?: string,
): Promise<EmailVerificationState> {
  // If no email provided, get it from the session
  if (!email) {
    const session = await auth();
    email = session?.user?.email;
  }

  if (!email) {
    return { error: "No email address found" };
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { success: "If an account exists, a verification email has been sent." };
    }

    if (user.emailVerified) {
      return { success: "Email is already verified." };
    }

    // Delete existing verification tokens for this email
    const identifier = `${VERIFICATION_IDENTIFIER_PREFIX}${email}`;
    await prisma.verificationToken.deleteMany({
      where: { identifier },
    });

    // Create new token
    const token = randomBytes(32).toString("hex");
    await prisma.verificationToken.create({
      data: {
        identifier,
        token,
        expires: new Date(Date.now() + TOKEN_EXPIRY_MS),
      },
    });

    const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

    if (process.env.RESEND_API_KEY) {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: "GlintPost <noreply@send.glintpost.com>",
        to: email,
        subject: "Verify your email address",
        html: `
          <h2>Welcome to GlintPost!</h2>
          <p>Click the link below to verify your email address:</p>
          <p><a href="${verifyUrl}">Verify my email</a></p>
          <p>This link expires in 24 hours.</p>
          <p>If you didn't create an account, you can safely ignore this email.</p>
        `,
      });
      if (error) {
        console.error("[GlintPost] Resend error:", error);
        return { error: "Failed to send verification email. Please try again." };
      }
    } else {
      console.log(`\n[GlintPost] Email verification link for ${email}:\n${verifyUrl}\n`);
      return {
        success:
          "In development: no email was sent. Check your server console for the verification link.",
      };
    }
  } catch {
    return { error: "Failed to send verification email. Please try again." };
  }

  return { success: "Verification email sent. Check your inbox." };
}

/**
 * Resend verification email - server action for the form on verify-email page.
 */
export async function resendVerificationAction(
  _prevState: EmailVerificationState,
  _formData: FormData,
): Promise<EmailVerificationState> {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: "Not authenticated" };
  }
  return sendVerificationEmail(session.user.email);
}
