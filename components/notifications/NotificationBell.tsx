"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { notificationTypeLabel } from "./type-label";
import styles from "./NotificationBell.module.css";

type Notif = {
  id: string;
  type?: string;
  typeLabel: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export default function NotificationBell({ isAuthenticated }: { isAuthenticated: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Notif[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await fetch("/api/notifications?take=8", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) return;
      setItems((json.data?.notifications ?? []) as Notif[]);
      setUnread(Number(json.data?.unreadCount ?? 0));
    } catch {
      /* silencieux — le badge reste à 0 */
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void load();
    if (!isAuthenticated) return;
    const t = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(t);
  }, [isAuthenticated, load]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  if (!isAuthenticated) {
    return (
      <Link
        href="/connexion?callbackUrl=/notifications"
        className={styles.btn}
        title={t("notifications.bell.loginTitle")}
        aria-label={t("notifications.bell.loginAria")}
      >
        🔔
      </Link>
    );
  }

  async function markOpened(id: string) {
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opened: true }),
    }).catch(() => undefined);
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: "read" }),
    }).catch(() => undefined);
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.btn}
        aria-expanded={open}
        aria-label={
          unread > 0 ? t("notifications.bell.unreadAria", { count: unread }) : t("notifications.title")
        }
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void load();
        }}
      >
        🔔
        {unread > 0 ? <span className={styles.badge}>{unread > 99 ? "99+" : unread}</span> : null}
      </button>
      {open ? (
        <div className={styles.panel} role="dialog" aria-label={t("notifications.bell.recent")}>
          <div className={styles.panelHead}>
            <p className={styles.panelTitle}>{t("notifications.title")}</p>
            {unread > 0 ? (
              <button type="button" className={styles.link} onClick={() => void markAllRead()}>
                {t("notifications.bell.markAllRead")}
              </button>
            ) : null}
          </div>
          {items.length === 0 ? (
            <p className={styles.empty}>{t("notifications.bell.empty")}</p>
          ) : (
            items.map((n) => (
              <Link
                key={n.id}
                href={n.href || "/notifications"}
                className={`${styles.item} ${n.readAt ? "" : styles.itemUnread}`}
                onClick={() => {
                  void markOpened(n.id);
                  setOpen(false);
                }}
              >
                <p className={styles.itemType}>{notificationTypeLabel(n.type ?? "", t, n.typeLabel)}</p>
                <p className={styles.itemTitle}>{n.title}</p>
                <p className={styles.itemBody}>{n.body}</p>
              </Link>
            ))
          )}
          <div className={styles.footer}>
            <Link href="/notifications" className={styles.link} onClick={() => setOpen(false)}>
              {t("notifications.bell.seeAll")}
            </Link>
            <Link href="/profil#alertes" className={styles.link} onClick={() => setOpen(false)}>
              {t("notifications.bell.prefs")}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
