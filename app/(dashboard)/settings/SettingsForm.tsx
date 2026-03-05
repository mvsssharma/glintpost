"use client";

import { useState, useActionState } from "react";
import {
  updateOrgSettings,
  type SettingsState,
} from "@/app/actions/org";
import {
  changePasswordAction,
  type ChangePasswordState,
} from "@/app/actions/auth";
import {
  COLOR_PRESETS,
  DEFAULT_PRIMARY_COLOR,
  SUPPORTED_LOCALES,
} from "@/lib/constants";
import type { Organization, OrgSettings } from "@/types";
import styles from "./page.module.css";

function toggleLocale(
  current: string[],
  code: string,
): string[] {
  if (code === "en") return current;
  return current.includes(code)
    ? current.filter((l) => l !== code)
    : [...current, code];
}

export function SettingsForm({
  org,
  settings,
}: {
  org: Organization;
  settings: OrgSettings | null;
}) {
  const [orgName, setOrgName] = useState(org.name);
  const [primaryColor, setPrimaryColor] = useState(
    settings?.primaryColor ?? DEFAULT_PRIMARY_COLOR
  );
  const [selectedLocales, setSelectedLocales] = useState<string[]>(
    settings?.supportedLocales?.length
      ? settings.supportedLocales
      : ["en"]
  );

  const [settingsState, settingsAction, settingsPending] = useActionState<
    SettingsState,
    FormData
  >(updateOrgSettings, {});

  const [passwordState, passwordAction, passwordPending] = useActionState<
    ChangePasswordState,
    FormData
  >(changePasswordAction, {});

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2>Settings</h2>
        <p>Manage your organization and account preferences.</p>
      </header>

      {/* Organization / Widget settings (from onboarding) */}
      <section className={styles.card}>
        <h3>Organization &amp; widget</h3>
        <p>
          These settings match what you configured in onboarding. They affect
          your widget appearance and supported languages.
        </p>
        <form action={settingsAction}>
          <input type="hidden" name="name" value={orgName} />
          <input type="hidden" name="primaryColor" value={primaryColor} />
          <input
            type="hidden"
            name="locales"
            value={selectedLocales.join(",")}
          />

          {settingsState.error && (
            <div className={styles.error}>{settingsState.error}</div>
          )}
          {settingsState.success && (
            <div className={styles.success}>{settingsState.success}</div>
          )}

          <div className={styles.fieldGroup}>
            <label htmlFor="orgName" className={styles.label}>
              Organization name
            </label>
            <input
              id="orgName"
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className={styles.inputField}
              placeholder="Acme Inc"
            />
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.label}>Brand color (widget)</span>
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
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.label}>Supported languages</span>
            <div className={styles.localeGrid}>
              {SUPPORTED_LOCALES.map((locale) => (
                <button
                  key={locale.code}
                  type="button"
                  className={`${styles.localeChip} ${selectedLocales.includes(locale.code) ? styles.localeChipActive : ""}`}
                  onClick={() =>
                    setSelectedLocales((prev) =>
                      toggleLocale(prev, locale.code)
                    )
                  }
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
          </div>

          <div className={styles.actions}>
            <button
              type="submit"
              disabled={settingsPending}
              className="btn-primary"
            >
              {settingsPending ? "Saving..." : "Save organization settings"}
            </button>
          </div>
        </form>
      </section>

      {/* Change password */}
      <section className={`${styles.card} ${styles.passwordSection}`}>
        <h3>Change password</h3>
        <p>Update your account password. You’ll need your current password.</p>
        <form action={passwordAction}>
          {passwordState.error && (
            <div className={styles.error}>{passwordState.error}</div>
          )}
          {passwordState.success && (
            <div className={styles.success}>{passwordState.success}</div>
          )}

          <div className={styles.fieldGroup}>
            <label htmlFor="currentPassword" className={styles.label}>
              Current password
            </label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              className={styles.inputField}
              placeholder="••••••••"
            />
          </div>
          <div className={styles.fieldGroup}>
            <label htmlFor="newPassword" className={styles.label}>
              New password
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              autoComplete="new-password"
              minLength={8}
              className={styles.inputField}
              placeholder="At least 8 characters"
            />
          </div>
          <div className={styles.fieldGroup}>
            <label htmlFor="confirmPassword" className={styles.label}>
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              minLength={8}
              className={styles.inputField}
              placeholder="••••••••"
            />
          </div>
          <div className={styles.actions}>
            <button
              type="submit"
              disabled={passwordPending}
              className="btn-primary"
            >
              {passwordPending ? "Updating..." : "Update password"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
