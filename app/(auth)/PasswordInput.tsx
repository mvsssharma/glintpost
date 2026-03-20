"use client";

import { useState } from "react";
import styles from "./auth.module.css";

export function PasswordInput({
  id,
  name,
  autoComplete,
  placeholder,
  required = true,
  minLength,
  autoFocus,
}: {
  id: string;
  name: string;
  autoComplete: string;
  placeholder: string;
  required?: boolean;
  minLength?: number;
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={styles.passwordWrapper}>
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        className="input-field"
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
      <button
        type="button"
        className={styles.passwordToggle}
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
