"use server";

import { auth, signIn } from "@/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { sendVerificationEmail } from "@/app/actions/email-verification";
import { signupSchema, loginSchema, changePasswordSchema, formDataToObject } from "@/lib/validations";
import { logger } from "@/lib/logger";

export interface AuthState {
  error?: string;
}

export async function signup(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = signupSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { name, email, password } = parsed.data;

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { error: "An account with this email already exists" };
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        emailVerified: process.env.REQUIRE_EMAIL_VERIFICATION === "true" ? null : new Date(),
      },
    });
  } catch {
    return { error: "Something went wrong. Please try again." };
  }

  // Send verification email (don't block signup if this fails)
  try {
    await sendVerificationEmail(email);
  } catch (err) {
    logger.error({ err }, "Failed to send verification email during signup");
  }

  // Sign in immediately after signup
  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Account created but failed to sign in. Please log in manually." };
    }
    throw error;
  }

  redirect("/onboarding");
}

export async function login(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { email, password } = parsed.data;

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password" };
    }
    throw error;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { emailVerified: true },
  });
  if (user && !user.emailVerified) {
    if (process.env.REQUIRE_EMAIL_VERIFICATION !== "true") {
      // Auto-verify if verification is not strictly required
      await prisma.user.update({
        where: { email },
        data: { emailVerified: new Date() },
      });
    } else {
      await sendVerificationEmail(email);
      redirect("/verify-email");
    }
  }

  redirect("/");
}

export interface ChangePasswordState {
  error?: string;
  success?: string;
}

/** Change password for the current user (credentials only). */
export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated" };
  }

  const parsed = changePasswordSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true, email: true },
  });

  if (!user?.passwordHash) {
    return { error: "Your account uses a different sign-in method. Password cannot be changed here." };
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return { error: "Current password is incorrect" };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash },
  });

  return { success: "Password updated successfully." };
}
