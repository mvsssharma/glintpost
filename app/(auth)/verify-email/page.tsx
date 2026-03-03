"use client";

import { useActionState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  resendVerificationAction,
  type EmailVerificationState,
} from "@/app/actions/email-verification";
import styles from "../auth.module.css";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const [state, formAction, isPending] = useActionState<
    EmailVerificationState,
    FormData
  >(resendVerificationAction, {});

  const errorMessages: Record<string, string> = {
    invalid: "This verification link is invalid. Please request a new one.",
    expired: "This verification link has expired. Please request a new one.",
    server: "Something went wrong. Please try again.",
  };

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Check your email</h2>

      {error && (
        <div className={styles.error}>
          {errorMessages[error] || "An error occurred."}
        </div>
      )}

      {state.error && <div className={styles.error}>{state.error}</div>}

      {state.success ? (
        <p style={{
          color: "hsl(142 71% 45%)",
          fontSize: "0.875rem",
          marginBottom: "1rem",
        }}>
          {state.success}
        </p>
      ) : (
        <p style={{
          color: "hsl(var(--text-muted))",
          fontSize: "0.875rem",
          marginBottom: "1.5rem",
        }}>
          We sent a verification link to your email address.
          Please check your inbox and click the link to verify your account.
        </p>
      )}

      <form action={formAction}>
        <button
          type="submit"
          disabled={isPending}
          className={`btn-primary ${styles.submitBtn}`}
          style={{ width: "100%" }}
        >
          {isPending ? "Sending..." : "Resend verification email"}
        </button>
      </form>

      <div className={styles.footer}>
        Wrong email? <Link href="/signup">Sign up again</Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
