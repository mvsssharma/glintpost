"use client";

import { useState, useActionState } from "react";
import {
  createOrganization,
  type OnboardingState,
} from "@/app/actions/org";
import {
  COLOR_PRESETS,
  DEFAULT_PRIMARY_COLOR,
  SUPPORTED_LOCALES,
} from "@/lib/constants";
import styles from "./onboarding.module.css";

const TOTAL_STEPS = 3;

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [orgName, setOrgName] = useState("");
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY_COLOR);
  const [selectedLocales, setSelectedLocales] = useState<string[]>(["en"]);
  const [state, formAction, isPending] = useActionState<
    OnboardingState,
    FormData
  >(createOrganization, {});

  function toggleLocale(code: string) {
    setSelectedLocales((prev) =>
      prev.includes(code)
        ? code === "en"
          ? prev // English is always selected
          : prev.filter((l) => l !== code)
        : [...prev, code],
    );
  }

  function handleNext() {
    if (step === 0 && orgName.trim().length < 2) return;
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  return (
    <div className={styles.card}>
      {/* Step indicator */}
      <div className={styles.stepIndicator}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={`${styles.stepDot} ${i <= step ? styles.stepDotActive : ""}`}
          />
        ))}
      </div>

      {state.error && <div className={styles.error}>{state.error}</div>}

      {/* Step 0: Org name */}
      {step === 0 && (
        <>
          <h2 className={styles.stepTitle}>Name your organization</h2>
          <p className={styles.stepDescription}>
            This is how your product will be identified in Glintpost.
          </p>
          <div className={styles.fieldGroup}>
            <label htmlFor="orgName" className={styles.label}>
              Organization name
            </label>
            <input
              id="orgName"
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="input-field"
              placeholder="Acme Inc"
              autoFocus
            />
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              onClick={handleNext}
              disabled={orgName.trim().length < 2}
              className="btn-primary"
            >
              Continue
            </button>
          </div>
        </>
      )}

      {/* Step 1: Color */}
      {step === 1 && (
        <>
          <h2 className={styles.stepTitle}>Choose your brand color</h2>
          <p className={styles.stepDescription}>
            This color will be used in your changelog widget.
          </p>
          <div className={styles.colorGrid}>
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className={`${styles.colorSwatch} ${primaryColor === preset.value ? styles.colorSwatchActive : ""}`}
                style={{ background: preset.value }}
                onClick={() => setPrimaryColor(preset.value)}
                title={preset.name}
              />
            ))}
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              onClick={handleBack}
              className="btn-secondary"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="btn-primary"
            >
              Continue
            </button>
          </div>
        </>
      )}

      {/* Step 2: Locales */}
      {step === 2 && (
        <form action={formAction}>
          <input type="hidden" name="name" value={orgName} />
          <input type="hidden" name="primaryColor" value={primaryColor} />
          <input
            type="hidden"
            name="locales"
            value={selectedLocales.join(",")}
          />

          <h2 className={styles.stepTitle}>Select supported languages</h2>
          <p className={styles.stepDescription}>
            Choose languages for your changelog content. You can change this
            later.
          </p>
          <div className={styles.localeGrid}>
            {SUPPORTED_LOCALES.map((locale) => (
              <button
                key={locale.code}
                type="button"
                className={`${styles.localeChip} ${selectedLocales.includes(locale.code) ? styles.localeChipActive : ""}`}
                onClick={() => toggleLocale(locale.code)}
              >
                <span
                  className={`${styles.checkbox} ${selectedLocales.includes(locale.code) ? styles.checkboxActive : ""}`}
                >
                  {selectedLocales.includes(locale.code) && (
                    <span className={styles.checkmark}>&#10003;</span>
                  )}
                </span>
                {locale.label}
              </button>
            ))}
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              onClick={handleBack}
              className="btn-secondary"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="btn-primary"
            >
              {isPending ? "Creating..." : "Create organization"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
