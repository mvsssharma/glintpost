"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  FileText,
  Code,
  Settings,
  CreditCard,
  LogOut,
} from "lucide-react";
import styles from "./dashboard.module.css";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/posts", label: "Posts", icon: FileText },
  { href: "/integration", label: "Integration", icon: Code },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ orgName }: { orgName: string }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarBrand}>
        <div className={styles.brandRow}>
          <Image
            src="/Glintpost.svg"
            alt="GlintPost"
            width={24}
            height={24}
          />
          <h2>GlintPost</h2>
        </div>
        <span>{orgName}</span>
      </div>
      <nav className={styles.nav}>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.navLink} ${isActive(item.href) ? styles.navLinkActive : ""}`}
          >
            <item.icon size={18} className={styles.navIcon} />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className={styles.sidebarFooter}>
        <Link href="/settings/billing" className={styles.navLink}>
          <CreditCard size={18} className={styles.navIcon} />
          Billing
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={styles.logoutBtn}
        >
          <LogOut size={18} className={styles.navIcon} />
          Log out
        </button>
      </div>
    </aside>
  );
}
