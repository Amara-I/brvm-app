"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { useI18n } from "@/components/i18n/I18nProvider";
import { localizeSharedApiMessage } from "@/lib/i18n/localize-api";
import { NOTIFICATION_TYPES, type NotificationTypeCode } from "@/lib/notifications/types";
import { notificationTypeLabel } from "./type-label";
import styles from "./NotificationCenter.module.css";

type Notif = {
  id: string;
  type: NotificationTypeCode;
  typeLabel: string;
  title: string;
  body: string;
  href: string | null;
  ticker: string | null;
  indexCode: string | null;
  readAt: string | null;
  createdAt: string;
};

function fmtWhen(iso: string, tag: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "N/D";
  return d.toLocaleString(tag, { dateStyle: "short", timeStyle: "short" });
}

export default function NotificationCenter() {
  const { t, format } = useI18n();
  const [filter, setFilter] = useState<"TOUS" | NotificationTypeCode>("TOUS");
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (type: "TOUS" | NotificationTypeCode) => {
    setLoading(true);
    setError(null);
    try {
      const qs = type === "TOUS" ? "" : `?type=${type}`;
      const res = await fetch(`/api/notifications${qs}`, { cache: "no-store" });
      const json = await res.json();
      if (res.status === 401) {
        setError(t("notifications.center.authRequired"));
        setItems([]);
        return;
      }
      if (!res.ok || !json.ok) {
        setError(
          typeof json.error === "string"
            ? localizeSharedApiMessage(json.error, t)
            : t("notifications.center.loadError")
        );
        setItems([]);
        return;
      }
      setItems((json.data?.notifications ?? []) as Notif[]);
      setUnread(Number(json.data?.unreadCount ?? 0));
    } catch {
      setError(t("notifications.center.loadError"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  async function mark(id: string, read: boolean) {
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read, opened: read }),
    }).catch(() => undefined);
    await load(filter);
  }

  async function markAll(read: boolean) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: read ? "read" : "unread" }),
    }).catch(() => undefined);
    await load(filter);
  }

  const filters: Array<{ key: "TOUS" | NotificationTypeCode; label: string }> = [
    { key: "TOUS", label: t("notifications.center.all") },
    ...NOTIFICATION_TYPES.map((key) => ({ key, label: notificationTypeLabel(key, t) })),
  ];

  return (
    <div className={`${styles.root} ob-page`}>
      <PageHeader
        kicker={t("auth.kicker")}
        title={t("notifications.title")}
        lead={t("notifications.center.lead")}
        actions={
          <Link href="/profil#alertes" className={styles.ghost}>
            {t("notifications.center.prefs")}
          </Link>
        }
      />

      <div className={styles.filters} role="group" aria-label={t("notifications.center.filter")}>
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            className={styles.chip}
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className={styles.toolbar}>
        <span className={styles.note}>
          {unread > 1
            ? t("notifications.center.unreadMany", { count: unread })
            : t("notifications.center.unreadOne", { count: unread })}
        </span>
        <button type="button" className={styles.ghost} onClick={() => void markAll(true)}>
          {t("notifications.center.markRead")}
        </button>
        <button type="button" className={styles.ghost} onClick={() => void markAll(false)}>
          {t("notifications.center.markUnread")}
        </button>
      </div>

      {error ? <p className={styles.note}>{error}</p> : null}
      {loading && items.length === 0 ? <p className={styles.note}>{t("common.loading")}</p> : null}

      {!loading && items.length === 0 && !error ? (
        <EmptyState title={t("notifications.center.emptyTitle")} body={t("notifications.center.emptyBody")} />
      ) : null}

      <ul className={styles.list}>
        {items.map((n) => (
          <li key={n.id}>
            <article className={`${styles.card} ${n.readAt ? "" : styles.cardUnread}`}>
              <div className={styles.meta}>
                <span className={styles.type}>{notificationTypeLabel(n.type, t, n.typeLabel)}</span>
                <span className={styles.time}>{fmtWhen(n.createdAt, format.tag)}</span>
              </div>
              <h2 className={styles.title}>{n.title}</h2>
              <p className={styles.body}>{n.body}</p>
              <div className={styles.actions}>
                {n.href ? (
                  <Link
                    href={n.href}
                    className={styles.ghost}
                    onClick={() => void mark(n.id, true)}
                  >
                    {t("notifications.center.open")}
                  </Link>
                ) : null}
                <button type="button" className={styles.ghost} onClick={() => void mark(n.id, !n.readAt)}>
                  {n.readAt ? t("notifications.center.markOneUnread") : t("notifications.center.markOneRead")}
                </button>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
