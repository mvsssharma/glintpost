import { requireOrg } from "@/lib/auth-helpers";
import IntegrationTabs from "./IntegrationTabs";
import { ApiKeyDisplay } from "./ApiKeyDisplay";
import styles from "./page.module.css";

export default async function IntegrationPage() {
  const { org } = await requireOrg();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return (
    <div className={styles.container}>
      <div className={styles.narrow}>
        <header className={styles.header}>
          <h2>Integration</h2>
          <p>
            Embed GlintPost widgets into your app. Choose a widget type below to
            get the integration code.
          </p>
        </header>

        <div className={styles.card}>
          <h3>Your API Key</h3>
          <p>
            Use this key to authenticate widgets. Keep it safe — it identifies
            your organization.
          </p>
          <ApiKeyDisplay apiKey={org.apiKey} />
        </div>
      </div>

      <IntegrationTabs apiKey={org.apiKey} appUrl={appUrl} />
    </div>
  );
}
