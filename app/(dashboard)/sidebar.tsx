"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  FileText,
  Megaphone,
  Map,
  MessageSquare,
  Code,
  Settings,
  CreditCard,
  LogOut,
  Tags,
  Users,
} from "lucide-react";
import styles from "./dashboard.module.css";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/posts", label: "Changelog", icon: FileText },
  { href: "/announcements", label: "Announcements", icon: Megaphone },
  { href: "/roadmap", label: "Roadmap", icon: Map },
  { href: "/feedback", label: "Feedback", icon: MessageSquare },
  { href: "/attributes", label: "Attributes", icon: Tags },
  { href: "/audiences", label: "Audiences", icon: Users },
  { href: "/integration", label: "Integration", icon: Code },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ orgName, userName, billingEnabled }: { orgName: string; userName: string; billingEnabled: boolean }) {
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
            loading="eager"
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
        {billingEnabled && (
          <Link href="/settings/billing" className={styles.navLink}>
            <CreditCard size={18} className={styles.navIcon} />
            Billing
          </Link>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={styles.logoutBtn}
        >
          <LogOut size={18} className={styles.navIcon} />
          Log out
        </button>
        <div className={styles.userProfile}>
          <div className={styles.avatar}>
            {userName[0]?.toUpperCase() ?? "?"}
          </div>
          <span className={styles.userName}>{userName}</span>
        </div>
      </div>
    </aside>
  );
}
