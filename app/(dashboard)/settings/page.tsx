import { requireOrg } from "@/lib/auth-helpers";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { org } = await requireOrg();

  // Don't serialize the (encrypted) AI API key to the client — the form only needs to
  // know whether a key is saved. Redact it to a non-sensitive sentinel in BOTH the
  // `settings` prop and the nested `org.settings` that ships with the `org` prop.
  const settings = org.settings
    ? { ...org.settings, aiApiKey: org.settings.aiApiKey ? "__saved__" : null }
    : null;
  const safeOrg = { ...org, settings };

  return <SettingsForm org={safeOrg} settings={settings} />;
}
