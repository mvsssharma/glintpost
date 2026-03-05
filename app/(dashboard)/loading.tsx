import Image from "next/image";
import styles from "../loading.module.css";

export default function DashboardLoading() {
  return (
    <div className={styles.dashboardLoader}>
      <Image
        src="/Glintpost.svg"
        alt="GlintPost"
        width={48}
        height={48}
        className={styles.logo}
        priority
      />
      <span className={styles.text}>Loading...</span>
    </div>
  );
}
