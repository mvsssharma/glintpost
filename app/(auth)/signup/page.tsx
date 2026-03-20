"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signupAction, type AuthState } from "@/app/actions/auth";
import { PasswordInput } from "../PasswordInput";
import styles from "../auth.module.css";

export default function SignupPage() {
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    signupAction,
    {},
  );

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Create your account</h2>
      <form action={formAction} className={styles.form}>
        {state.error && <div className={styles.error}>{state.error}</div>}
        <div className={styles.fieldGroup}>
          <label htmlFor="name" className={styles.label}>
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
            className="input-field"
            placeholder="Your name"
          />
        </div>
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
            autoComplete="new-password"
            placeholder="At least 8 characters"
            minLength={8}
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className={`btn-primary ${styles.submitBtn}`}
        >
          {isPending ? "Creating account..." : "Create account"}
        </button>
      </form>
      <div className={styles.footer}>
        Already have an account? <Link href="/login">Sign in</Link>
      </div>
    </div>
  );
}
