"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  requestPasswordReset,
  type PasswordResetState,
} from "@/app/actions/password-reset";
import styles from "../auth.module.css";

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState<
    PasswordResetState,
    FormData
  >(requestPasswordReset, {});

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Reset your password</h2>
      {state.success ? (
        <div>
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
            Back to sign in
          </Link>
        </div>
      ) : (
        <form action={formAction} className={styles.form}>
          {state.error && <div className={styles.error}>{state.error}</div>}
          <p
            style={{
              color: "hsl(var(--text-muted))",
              fontSize: "0.875rem",
              marginBottom: "0.5rem",
            }}
          >
            Enter your email and we&apos;ll send you a link to reset your
            password.
          </p>
          <div className={styles.fieldGroup}>
            <label htmlFor="email" className={styles.label}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="input-field"
              placeholder="you@example.com"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className={`btn-primary ${styles.submitBtn}`}
          >
            {isPending ? "Sending..." : "Send reset link"}
          </button>
        </form>
      )}
      <div className={styles.footer}>
        Remember your password? <Link href="/login">Sign in</Link>
      </div>
    </div>
  );
}
