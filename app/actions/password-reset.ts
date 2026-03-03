"use server";

import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const PASSWORD_RESET_PREFIX = "password-reset:";

export interface PasswordResetState {
  error?: string;
  success?: string;
}

/**
 * Request a password reset. Creates a token and (in production) sends an email.
 * In dev, logs the reset link to the console.
 */
export async function requestPasswordReset(
  _prevState: PasswordResetState,
  formData: FormData,
): Promise<PasswordResetState> {
  const email = formData.get("email") as string;

  if (!email) {
    return { error: "Email is required" };
  }

  // Always return success to avoid email enumeration
  const successMessage =
    "If an account exists with that email, you will receive a reset link.";

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { success: successMessage };
    }

    // Delete any existing password-reset tokens for this email
    const identifier = `${PASSWORD_RESET_PREFIX}${email}`;
    await prisma.verificationToken.deleteMany({
      where: { identifier },
    });

    // Create a new token (expires in 1 hour)
    const token = randomBytes(32).toString("hex");
    await prisma.verificationToken.create({
      data: {
        identifier,
        token,
        expires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

    // In dev, log the link. In production, send via Resend.
    if (process.env.RESEND_API_KEY) {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "Glintpost <noreply@glintpost.com>",
        to: email,
        subject: "Reset your password",
        html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour.</p>`,
      });
    } else {
      console.log(`\n[Glintpost] Password reset link for ${email}:\n${resetUrl}\n`);
    }
  } catch {
    // Swallow errors to avoid leaking info
  }

  return { success: successMessage };
}

/**
 * Reset password using a valid token.
 */
export async function resetPassword(
  _prevState: PasswordResetState,
  formData: FormData,
): Promise<PasswordResetState> {
  const token = formData.get("token") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!token || !email) {
    return { error: "Invalid reset link" };
  }

  if (!password || password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  try {
    // Find and validate token
    const identifier = `${PASSWORD_RESET_PREFIX}${email}`;
    const storedToken = await prisma.verificationToken.findUnique({
      where: { identifier_token: { identifier, token } },
    });

    if (!storedToken) {
      return { error: "Invalid or expired reset link" };
    }

    if (storedToken.expires < new Date()) {
      // Clean up expired token
      await prisma.verificationToken.delete({
        where: { identifier_token: { identifier, token } },
      });
      return { error: "Reset link has expired. Please request a new one." };
    }

    // Update password
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { email },
      data: { passwordHash },
    });

    // Delete the used token
    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier, token } },
    });
  } catch {
    return { error: "Something went wrong. Please try again." };
  }

  return { success: "Password reset successfully. You can now sign in." };
}
