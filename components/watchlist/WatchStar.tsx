"use client";

// Étoile « suivre cette société ». Mise à jour optimiste : l'étoile bascule
// tout de suite, puis revient en arrière si le serveur refuse. Visiteur non
// connecté : lien vers la connexion avec retour sur la page courante.
import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import styles from "./WatchStar.module.css";

export default function WatchStar({
  ticker,
  initialWatched,
  isAuthenticated,
  loginCallbackPath,
  onChange,
  withLabel = false,
  className,
}: {
  ticker: string;
  initialWatched: boolean;
  isAuthenticated: boolean;
  loginCallbackPath: string;
  /** Appelé après chaque changement (y compris le retour arrière en cas d'échec). */
  onChange?: (ticker: string, watched: boolean) => void;
  /** Affiche le texte à côté de l'étoile (fiche société). */
  withLabel?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const [watched, setWatched] = useState(initialWatched);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const label = watched
    ? t("market.watchlist.remove", { ticker })
    : t("market.watchlist.add", { ticker });
  const text = watched ? t("market.watchlist.following") : t("market.watchlist.follow");
  const cls = [styles.star, withLabel ? styles.withLabel : "", className ?? ""].filter(Boolean).join(" ");

  if (!isAuthenticated) {
    return (
      <Link
        href={`/connexion?callbackUrl=${encodeURIComponent(loginCallbackPath)}`}
        className={cls}
        title={t("market.watchlist.loginHint")}
        aria-label={t("market.watchlist.loginHint")}
        onClick={(e) => e.stopPropagation()}
      >
        <span aria-hidden="true">☆</span>
        {withLabel ? <span>{t("market.watchlist.follow")}</span> : null}
      </Link>
    );
  }

  async function toggle(event: React.MouseEvent) {
    event.stopPropagation();
    if (busy) return;
    const next = !watched;
    setBusy(true);
    setFailed(false);
    setWatched(next);
    onChange?.(ticker, next);
    try {
      const res = next
        ? await fetch("/api/watchlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ticker }),
          })
        : await fetch(`/api/watchlist?ticker=${encodeURIComponent(ticker)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setWatched(!next);
      onChange?.(ticker, !next);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={cls}
      aria-pressed={watched}
      aria-label={label}
      title={failed ? t("market.watchlist.error") : label}
      data-watched={watched}
      data-failed={failed || undefined}
      disabled={busy}
      onClick={toggle}
    >
      <span aria-hidden="true">{watched ? "★" : "☆"}</span>
      {withLabel ? <span>{text}</span> : null}
    </button>
  );
}
