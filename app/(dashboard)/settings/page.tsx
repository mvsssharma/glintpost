import { requireOrg } from "@/lib/auth-helpers";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { org } = await requireOrg();

  return <SettingsForm org={org} settings={org.settings} />;
}
