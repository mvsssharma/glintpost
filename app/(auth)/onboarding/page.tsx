"use client";

import { useState, useActionState } from "react";
import {
  createOrganization,
  type OnboardingState,
} from "@/app/actions/org";
import {
  COLOR_PRESETS,
  DEFAULT_PRIMARY_COLOR,
} from "@/lib/constants";
import styles from "./onboarding.module.css";

const TOTAL_STEPS = 2;

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [orgName, setOrgName] = useState("");
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY_COLOR);
  // Defaults to English; language selection is hidden until the translation
  // feature ships (roadmap).
  const selectedLocales = ["en"];
  const [state, formAction, isPending] = useActionState<
    OnboardingState,
    FormData
  >(createOrganization, {});

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
            This is how your product will be identified in GlintPost.
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
        <form action={formAction}>
          <input type="hidden" name="name" value={orgName} />
          <input type="hidden" name="primaryColor" value={primaryColor} />
          <input
            type="hidden"
            name="locales"
            value={selectedLocales.join(",")}
          />

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
