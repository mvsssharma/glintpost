import Image from "next/image";
import styles from "../loading.module.css";

export default function AuthLoading() {
  return (
    <div className={styles.loader}>
      <Image
        src="/Glintpost.svg"
        alt="GlintPost"
        width={64}
        height={64}
        className={styles.logo}
        loading="eager"
      />
      <span className={styles.text}>Loading...</span>
    </div>
  );
}
