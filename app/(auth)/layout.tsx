import Image from "next/image";
import styles from "./auth.module.css";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.authLayout}>
      <div className={styles.authContainer}>
        <div className={styles.brand}>
          <Image
            src="/Glintpost.svg"
            alt="GlintPost"
            width={48}
            height={48}
            className={styles.brandLogo}
          />
          <h1>GlintPost</h1>
          <p>Product communication, simplified.</p>
        </div>
        {children}
      </div>
    </div>
  );
}
