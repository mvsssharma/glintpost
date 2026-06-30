"use client";

import { useActionState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { login, type AuthState } from "@/app/actions/auth";
import { PasswordInput } from "../PasswordInput";
import styles from "../auth.module.css";

function LoginForm() {
  const searchParams = useSearchParams();
  const verified = searchParams.get("verified") === "true";

  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    login,
    {},
  );

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Sign in</h2>
      <form action={formAction} className={styles.form}>
        {verified && (
          <div style={{
            background: "hsl(142 71% 45% / 0.1)",
            color: "hsl(142 71% 45%)",
            padding: "0.75rem 1rem",
            borderRadius: "var(--radius-md)",
            fontSize: "0.875rem",
          }}>
            Email verified successfully! You can now sign in.
          </div>
        )}
        {state.error && <div className={styles.error}>{state.error}</div>}
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
          />
        </div>
        <div className={styles.fieldGroup}>
          <label htmlFor="password" className={styles.label}>
            Password
          </label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            placeholder="Enter your password"
          />
        </div>
        <div style={{ textAlign: "right" }}>
          <Link
            href="/forgot-password"
            style={{ fontSize: "0.813rem", color: "hsl(var(--text-muted))" }}
          >
            Forgot password?
          </Link>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className={`btn-primary ${styles.submitBtn}`}
        >
          {isPending ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <div className={styles.footer}>
        Don&apos;t have an account?{" "}
        <Link href="/signup">Create one</Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
