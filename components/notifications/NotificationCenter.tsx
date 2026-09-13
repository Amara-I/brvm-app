"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { NOTIFICATION_TYPES, NOTIFICATION_TYPE_LABELS, type NotificationTypeCode } from "@/lib/notifications/types";
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

const FILTERS: Array<{ key: "TOUS" | NotificationTypeCode; label: string }> = [
  { key: "TOUS", label: "Tous" },
  ...NOTIFICATION_TYPES.map((key) => ({ key, label: NOTIFICATION_TYPE_LABELS[key] })),
];

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "N/D";
  return d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export default function NotificationCenter() {
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
        setError("Connectez-vous pour voir vos notifications.");
        setItems([]);
        return;
      }
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Impossible de charger les notifications.");
        setItems([]);
        return;
      }
      setItems((json.data?.notifications ?? []) as Notif[]);
      setUnread(Number(json.data?.unreadCount ?? 0));
    } catch {
      setError("Impossible de charger les notifications.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

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

  return (
    <div className={`${styles.root} ob-page`}>
      <PageHeader
        kicker="Compte"
        title="Notifications"
        lead="Historique de vos alertes (prix, signaux, portefeuille, indices, système). Un clic ouvre la fiche, le graphe, le portefeuille ou l'indice concerné."
        actions={
          <Link href="/profil#alertes" className={styles.ghost}>
            Préférences
          </Link>
        }
      />

      <div className={styles.filters} role="group" aria-label="Filtrer par type">
        {FILTERS.map((f) => (
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
        <span className={styles.note}>{unread} non lue{unread > 1 ? "s" : ""}</span>
        <button type="button" className={styles.ghost} onClick={() => void markAll(true)}>
          Tout marquer lu
        </button>
        <button type="button" className={styles.ghost} onClick={() => void markAll(false)}>
          Tout marquer non lu
        </button>
      </div>

      {error ? <p className={styles.note}>{error}</p> : null}
      {loading && items.length === 0 ? <p className={styles.note}>Chargement…</p> : null}

      {!loading && items.length === 0 && !error ? (
        <EmptyState
          title="Aucune notification"
          body="Créez une alerte de cours depuis un graphe ou une fiche société — elle apparaîtra ici lorsqu'elle se déclenche."
        />
      ) : null}

      <ul className={styles.list}>
        {items.map((n) => (
          <li key={n.id}>
            <article className={`${styles.card} ${n.readAt ? "" : styles.cardUnread}`}>
              <div className={styles.meta}>
                <span className={styles.type}>{n.typeLabel}</span>
                <span className={styles.time}>{fmtWhen(n.createdAt)}</span>
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
                    Ouvrir
                  </Link>
                ) : null}
                <button type="button" className={styles.ghost} onClick={() => void mark(n.id, !n.readAt)}>
                  {n.readAt ? "Marquer non lu" : "Marquer lu"}
                </button>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
