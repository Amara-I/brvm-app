"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import SignOutButton from "./SignOutButton";
import type { HeaderNavUser } from "@/components/nav/HeaderNav";
import styles from "./AccountMenu.module.css";

function initials(user: HeaderNavUser): string {
  const source = (user.name || user.email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export default function AccountMenu({
  user,
  variant = "app",
}: {
  user: HeaderNavUser;
  variant?: "app" | "landing";
}) {
  const { t } = useI18n();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={`${styles.trigger} ${variant === "landing" ? styles.landingTrigger : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.avatar} aria-hidden="true">
          {initials(user)}
        </span>
        <span className={styles.label}>
          {user.name?.trim()
            ? t("auth.menu.hello", { name: user.name.trim() })
            : (user.email ?? t("auth.menu.account"))}
        </span>
        <span className={styles.chevron} aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <div id={menuId} role="menu" className={`${styles.menu} ${variant === "landing" ? styles.landingMenu : ""}`}>
          <Link href="/profil" role="menuitem" className={styles.item} onClick={() => setOpen(false)}>
            {t("auth.menu.profile")}
          </Link>
          <Link href="/notifications" role="menuitem" className={styles.item} onClick={() => setOpen(false)}>
            {t("auth.menu.notifications")}
          </Link>
          <Link href="/profil#alertes" role="menuitem" className={styles.item} onClick={() => setOpen(false)}>
            {t("auth.menu.alertPrefs")}
          </Link>
          {user.isAdmin ? (
            <Link
              href="/admin/analytics"
              role="menuitem"
              className={styles.item}
              onClick={() => setOpen(false)}
            >
              {t("auth.menu.analytics")}
            </Link>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className={`${styles.itemButton} ${styles.danger}`}
            onClick={() => {
              setOpen(false);
              setSignOutOpen(true);
            }}
          >
            {t("auth.menu.signOut")}
          </button>
        </div>
      ) : null}

      <SignOutButton hideTrigger open={signOutOpen} onOpenChange={setSignOutOpen} />
    </div>
  );
}
