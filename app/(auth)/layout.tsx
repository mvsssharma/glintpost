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
          <h1>Glintpost</h1>
          <p>Product communication, simplified.</p>
        </div>
        {children}
      </div>
    </div>
  );
}
