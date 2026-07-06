import { requireOrg } from "@/lib/auth-helpers";
import CreateAnnouncementForm from "./CreateAnnouncementForm";

export const dynamic = "force-dynamic";

export default async function CreateAnnouncementPage() {
  const { org } = await requireOrg();
  const s = org.settings;
  const aiConfigured = !!(s?.aiProvider && s?.aiApiKey && s?.aiModel);

  return <CreateAnnouncementForm aiConfigured={aiConfigured} />;
}
