"use client";

import { useState, useActionState, useTransition } from "react";
import {
  updateOrgSettings,
  type SettingsState,
} from "@/app/actions/org";
import {
  changePassword,
  type ChangePasswordState,
} from "@/app/actions/auth";
import {
  COLOR_PRESETS,
  DEFAULT_PRIMARY_COLOR,
  SUPPORTED_LOCALES,
  AI_PROVIDERS,
  AI_MODELS,
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
  const [widgetTheme, setWidgetTheme] = useState<"light" | "dark">(
    (settings?.widgetTheme as "light" | "dark") ?? "light"
  );
  const [selectedLocales, setSelectedLocales] = useState<string[]>(
    settings?.supportedLocales?.length
      ? settings.supportedLocales
      : ["en"]
  );
  const [allowedDomain, setAllowedDomain] = useState(
    settings?.allowedDomain ?? ""
  );
  const ALL_WIDGETS = [
    { key: "changelog", label: "Changelog" },
    { key: "roadmap", label: "Roadmap" },
    { key: "feedback", label: "Feedback" },
    { key: "announcements", label: "Announcements" },
  ] as const;
  const [enabledWidgets, setEnabledWidgets] = useState<string[]>(
    settings?.enabledWidgets?.length
      ? settings.enabledWidgets
      : ALL_WIDGETS.map((w) => w.key)
  );
  const [aiProvider, setAiProvider] = useState(settings?.aiProvider ?? "");
  const [aiModel, setAiModel] = useState(settings?.aiModel ?? "");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiWritingContext, setAiWritingContext] = useState(
    settings?.aiWritingContext ?? ""
  );

  // Build-time constant, identical on server and client — no hydration effect needed.
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const [settingsState, settingsAction, settingsPending] = useActionState<
    SettingsState,
    FormData
  >(updateOrgSettings, {});

  // Same server action, own submit handler — so this form's feedback renders here,
  // not on the org form.
  const [aiState, setAiState] = useState<SettingsState>({});
  const [aiPending, startAiTransition] = useTransition();
  const saveAiSettings = (formData: FormData) => {
    startAiTransition(async () => {
      setAiState(await updateOrgSettings({}, formData));
    });
  };

  const [passwordState, passwordAction, passwordPending] = useActionState<
    ChangePasswordState,
    FormData
  >(changePassword, {});

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
          <input type="hidden" name="widgetTheme" value={widgetTheme} />
          <input type="hidden" name="allowedDomain" value={allowedDomain} />
          <input
            type="hidden"
            name="enabledWidgets"
            value={enabledWidgets.join(",")}
          />
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
            <div className={styles.colorPickerRow}>
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
              <div className={styles.colorInputRow}>
                <div
                  className={styles.colorPreview}
                  style={{ background: primaryColor }}
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className={styles.colorInput}
                  placeholder="#10b981 or rgb(...) or hsl(...)"
                  spellCheck={false}
                />
              </div>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.label}>Widget theme</span>
            <div className={styles.themeToggle}>
              <button
                type="button"
                className={`${styles.themeOption} ${widgetTheme === "light" ? styles.themeOptionActive : ""}`}
                onClick={() => setWidgetTheme("light")}
              >
                ☀️ Light
              </button>
              <button
                type="button"
                className={`${styles.themeOption} ${widgetTheme === "dark" ? styles.themeOptionActive : ""}`}
                onClick={() => setWidgetTheme("dark")}
              >
                🌙 Dark
              </button>
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

          <div className={styles.fieldGroup}>
            <label htmlFor="allowedDomain" className={styles.label}>
              Allowed domain (for headless API)
            </label>
            <input
              id="allowedDomain"
              type="text"
              value={allowedDomain}
              onChange={(e) => setAllowedDomain(e.target.value)}
              className={styles.inputField}
              placeholder="https://example.com"
            />
            <span className={styles.hint}>
              The origin where your API calls come from. Subdomains (e.g. app.example.com) must be added separately.
            </span>
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.label}>Enabled widgets</span>
            <span className={styles.hint}>
              Select which widgets the unified embed snippet activates. Use a single script tag to load all enabled widgets automatically.
            </span>
            <div className={styles.localeGrid}>
              {ALL_WIDGETS.map((w) => (
                <button
                  key={w.key}
                  type="button"
                  className={`${styles.localeChip} ${enabledWidgets.includes(w.key) ? styles.localeChipActive : ""}`}
                  onClick={() =>
                    setEnabledWidgets((prev) =>
                      prev.includes(w.key)
                        ? prev.filter((k) => k !== w.key)
                        : [...prev, w.key]
                    )
                  }
                >
                  <span
                    className={`${styles.checkbox} ${enabledWidgets.includes(w.key) ? styles.checkboxActive : ""}`}
                  >
                    {enabledWidgets.includes(w.key) && (
                      <span className={styles.checkmark}>&#10003;</span>
                    )}
                  </span>
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.label}>Unified embed snippet</span>
            <span className={styles.hint}>
              Add this single script tag to your site. It automatically loads all enabled widgets above.
            </span>
            <code className={styles.embedSnippet}>
              {`<script src="${origin}/widget.js" data-api-key="${org.apiKey}" defer></script>`}
            </code>
          </div>

          <div className={styles.actions}>
            <button
              type="submit"
              disabled={settingsPending}
              className="btn-primary"
            >
              {settingsPending ? "Saving..." : "Save organization settings"}
            </button>
            <a
              href={`/preview?apiKey=${org.apiKey}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.previewLink}
            >
              Preview widget
            </a>
          </div>
        </form>
      </section>

      {/* AI configuration */}
      <section className={styles.card}>
        <h3>AI configuration</h3>
        <p>
          Configure an LLM provider to enable semantic duplicate detection for
          roadmap suggestions. Without this, basic keyword matching is used.
        </p>
        <form action={saveAiSettings}>
          <input type="hidden" name="name" value={orgName} />
          <input type="hidden" name="primaryColor" value={primaryColor} />
          <input type="hidden" name="widgetTheme" value={widgetTheme} />
          <input type="hidden" name="allowedDomain" value={allowedDomain} />
          <input type="hidden" name="locales" value={selectedLocales.join(",")} />
          <input type="hidden" name="enabledWidgets" value={enabledWidgets.join(",")} />
          <input type="hidden" name="aiProvider" value={aiProvider} />
          <input type="hidden" name="aiModel" value={aiModel} />
          <input type="hidden" name="aiApiKey" value={aiApiKey} />
          <input type="hidden" name="aiWritingContext" value={aiWritingContext} />

          {aiState.error && <div className={styles.error}>{aiState.error}</div>}
          {aiState.success && <div className={styles.success}>{aiState.success}</div>}

          <div className={styles.fieldGroup}>
            <label htmlFor="aiProvider" className={styles.label}>
              Provider
            </label>
            <select
              id="aiProvider"
              value={aiProvider}
              onChange={(e) => {
                setAiProvider(e.target.value);
                const provider = AI_PROVIDERS.find((p) => p.id === e.target.value);
                setAiModel(provider?.defaultModel ?? "");
              }}
              className={styles.inputField}
            >
              <option value="">None (use keyword matching)</option>
              {AI_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {aiProvider && (
            <>
              <div className={styles.fieldGroup}>
                <label htmlFor="aiModel" className={styles.label}>
                  Model
                </label>
                <select
                  id="aiModel"
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className={styles.inputField}
                >
                  {(AI_MODELS[aiProvider] ?? []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="aiApiKey" className={styles.label}>
                  API key
                </label>
                <input
                  id="aiApiKey"
                  type="password"
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  className={styles.inputField}
                  placeholder={settings?.aiApiKey ? "••••••••  (saved)" : "Enter API key"}
                />
              </div>
            </>
          )}

          <div className={styles.fieldGroup}>
            <label htmlFor="aiWritingContext" className={styles.label}>
              AI writing context <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional)</span>
            </label>
            <textarea
              id="aiWritingContext"
              value={aiWritingContext}
              onChange={(e) => setAiWritingContext(e.target.value)}
              className={styles.inputField}
              rows={3}
              maxLength={2000}
              placeholder="Describe your audience, tone, and anything the AI should avoid — used when rewriting or drafting changelog posts."
            />
          </div>

          <div className={styles.actions}>
            <button
              type="submit"
              disabled={aiPending}
              className="btn-primary"
            >
              {aiPending ? "Saving..." : "Save AI settings"}
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
