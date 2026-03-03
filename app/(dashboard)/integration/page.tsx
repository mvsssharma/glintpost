import { requireOrg } from "@/lib/auth-helpers";
import styles from "./page.module.css";

export default async function IntegrationPage() {
  const { org } = await requireOrg();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2>Widget Integration</h2>
        <p>
          Embed the Glintpost widget into your app to share releases with your
          users.
        </p>
      </header>

      <div className={styles.card}>
        <h3>Your API Key</h3>
        <p>
          Use this key to authenticate the widget. Keep it safe — it identifies
          your organization.
        </p>
        <div className={styles.codeBlock}>
          <pre>
            <code>{org.apiKey}</code>
          </pre>
        </div>
      </div>

      <div className={styles.card}>
        <h3>1. Copy the Script</h3>
        <p>
          Place this script block just before the closing{" "}
          <code>&lt;/body&gt;</code> tag of your HTML.
        </p>
        <div className={styles.codeBlock}>
          <pre>
            <code>{`<!-- Glintpost Widget -->
<script
  src="${appUrl}/widget.js"
  data-api-key="${org.apiKey}"
  defer
></script>`}</code>
          </pre>
        </div>
      </div>

      <div className={styles.card}>
        <h3>2. Advanced Targeting (Optional)</h3>
        <p>
          To filter which posts users see or pass user-specific datalayer
          variables, define a global <code>window.GlintpostConfig</code> object
          before the script loads.
        </p>
        <div className={styles.codeBlock}>
          <pre>
            <code>{`<script>
  window.GlintpostConfig = {
    visitorId: "user_123",
    datalayer: {
      plan: "pro",
      role: "admin"
    }
  };
</script>`}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
