"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  resetPassword,
  type PasswordResetState,
} from "@/app/actions/password-reset";
import { PasswordInput } from "../PasswordInput";
import styles from "../auth.module.css";
import { Suspense } from "react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";

  const [state, formAction, isPending] = useActionState<
    PasswordResetState,
    FormData
  >(resetPassword, {});

  if (!token || !email) {
    return (
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Invalid reset link</h2>
        <p
          style={{
            color: "hsl(var(--text-muted))",
            fontSize: "0.875rem",
            marginBottom: "1.5rem",
          }}
        >
          This password reset link is invalid or has expired.
        </p>
        <Link href="/forgot-password" className="btn-primary" style={{ width: "100%", textAlign: "center" }}>
          Request a new link
        </Link>
      </div>
    );
  }

  if (state.success) {
    return (
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Password reset</h2>
        <p
          style={{
            color: "hsl(var(--text-muted))",
            fontSize: "0.875rem",
            marginBottom: "1.5rem",
          }}
        >
          {state.success}
        </p>
        <Link href="/login" className="btn-primary" style={{ width: "100%", textAlign: "center" }}>
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Set new password</h2>
      <form action={formAction} className={styles.form}>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="email" value={email} />
        {state.error && <div className={styles.error}>{state.error}</div>}
        <div className={styles.fieldGroup}>
          <label htmlFor="password" className={styles.label}>
            New password
          </label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            minLength={8}
            autoFocus
          />
        </div>
        <div className={styles.fieldGroup}>
          <label htmlFor="confirmPassword" className={styles.label}>
            Confirm password
          </label>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            minLength={8}
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className={`btn-primary ${styles.submitBtn}`}
        >
          {isPending ? "Resetting..." : "Reset password"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
