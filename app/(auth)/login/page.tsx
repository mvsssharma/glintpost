"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type AuthState } from "@/app/actions/auth";
import styles from "../auth.module.css";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    loginAction,
    {},
  );

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Sign in</h2>
      <form action={formAction} className={styles.form}>
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
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="input-field"
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
