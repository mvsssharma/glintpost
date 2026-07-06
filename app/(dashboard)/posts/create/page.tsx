import { requireOrg } from "@/lib/auth-helpers";
import CreatePostForm from "./CreatePostForm";

export const dynamic = "force-dynamic";

export default async function CreatePostPage() {
  const { org } = await requireOrg();
  const s = org.settings;
  const aiConfigured = !!(s?.aiProvider && s?.aiApiKey && s?.aiModel);

  return <CreatePostForm aiConfigured={aiConfigured} />;
}
