"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
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
        <span className={styles.label}>{user.name ?? user.email ?? "Compte"}</span>
        <span className={styles.chevron} aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <div id={menuId} role="menu" className={`${styles.menu} ${variant === "landing" ? styles.landingMenu : ""}`}>
          <Link href="/profil" role="menuitem" className={styles.item} onClick={() => setOpen(false)}>
            Mon profil
          </Link>
          <Link href="/notifications" role="menuitem" className={styles.item} onClick={() => setOpen(false)}>
            Notifications
          </Link>
          <Link href="/profil#alertes" role="menuitem" className={styles.item} onClick={() => setOpen(false)}>
            Préférences d’alertes
          </Link>
          {user.isAdmin ? (
            <Link
              href="/admin/analytics"
              role="menuitem"
              className={styles.item}
              onClick={() => setOpen(false)}
            >
              Analytique
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
            Déconnexion
          </button>
        </div>
      ) : null}

      <SignOutButton hideTrigger open={signOutOpen} onOpenChange={setSignOutOpen} />
    </div>
  );
}
