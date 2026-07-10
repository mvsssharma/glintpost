import { requireOrg } from "@/lib/auth-helpers";
import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  if (process.env.ENABLE_BILLING === "false") {
    notFound();
  }

  await requireOrg();

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2>Billing</h2>
        <p>Manage your subscription and payment methods.</p>
      </header>
      <div className={styles.card}>
        <p>Billing is not set up yet. You can configure Razorpay (or another provider) later.</p>
        <Link href="/settings" className={`btn-secondary ${styles.backLink}`}>
          Back to Settings
        </Link>
      </div>
    </div>
  );
}
