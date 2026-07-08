import { requireOrg } from "@/lib/auth-helpers";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { org } = await requireOrg();

  // Never serialize the encrypted AI API key to the client — redact to a sentinel in
  // both props; the form only needs to know whether a key is saved.
  const settings = org.settings
    ? { ...org.settings, aiApiKey: org.settings.aiApiKey ? "__saved__" : null }
    : null;
  const safeOrg = { ...org, settings };

  return <SettingsForm org={safeOrg} settings={settings} />;
}
