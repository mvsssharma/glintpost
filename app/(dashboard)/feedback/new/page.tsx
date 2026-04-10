import Link from "next/link";
import { FeedbackFormBuilder } from "../FeedbackFormBuilder";
import styles from "../page.module.css";

export default function NewFeedbackFormPage() {
  return (
    <div className={styles.containerNarrow}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <div>
            <h2>New feedback form</h2>
            <p>Configure up to 3 questions. Choose from select boxes, NPS scale, or free text.</p>
          </div>
          <Link href="/feedback" className="btn-secondary">
            Back to forms
          </Link>
        </div>
      </header>

      <FeedbackFormBuilder existingForm={null} />
    </div>
  );
}
