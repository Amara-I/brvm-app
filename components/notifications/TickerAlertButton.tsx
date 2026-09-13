"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BRVM_DAILY_COLLAR_PCT } from "@/lib/notifications/types";
import styles from "./TickerAlertButton.module.css";

type Kind = "PRICE" | "DAILY" | "HORIZON" | "SIGNAL";

export default function TickerAlertButton({
  isAuthenticated,
  ticker,
  lastClose,
  loginCallbackPath,
  className,
  defaultTarget,
  defaultDirection,
  label,
}: {
  isAuthenticated: boolean;
  ticker: string;
  lastClose: number | null;
  loginCallbackPath?: string;
  className?: string;
  /** Seuil prérempli (ex. stop de la calculette). */
  defaultTarget?: number | null;
  defaultDirection?: "ABOVE" | "BELOW";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("PRICE");
  const [direction, setDirection] = useState<"ABOVE" | "BELOW">(defaultDirection ?? "ABOVE");
  const [target, setTarget] = useState("");
  const [percent, setPercent] = useState("3");
  const [horizon, setHorizon] = useState<"1S" | "1M">("1S");
  const [signal, setSignal] = useState<"ACHAT FORT" | "ACHAT">("ACHAT FORT");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (defaultTarget != null && Number.isFinite(defaultTarget) && defaultTarget > 0) {
      setTarget(String(Math.round(defaultTarget)));
      return;
    }
    if (lastClose != null && Number.isFinite(lastClose)) setTarget(String(Math.round(lastClose)));
  }, [ticker, lastClose, defaultTarget]);

  useEffect(() => {
    if (defaultDirection) setDirection(defaultDirection);
  }, [defaultDirection]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!isAuthenticated) {
    const callback = loginCallbackPath ?? `/actions/${ticker}`;
    return (
      <Link
        href={`/connexion?callbackUrl=${encodeURIComponent(callback)}`}
        className={className ?? styles.btn}
      >
        {label ?? "Alerte"}
      </Link>
    );
  }

  async function create() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (kind === "PRICE") {
        const value = Number(String(target).replace(",", "."));
        if (!Number.isFinite(value) || value <= 0) {
          setError("Indiquez un seuil de cours positif.");
          return;
        }
        const res = await fetch("/api/alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker, direction, targetPrice: value }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          setError(json?.error ?? "Création impossible.");
          return;
        }
        setMessage(json.data?.alert?.status === "TRIGGERED" ? "Seuil déjà atteint — notification créée." : "Alerte de cours créée.");
        return;
      }

      const body =
        kind === "DAILY"
          ? { kind: "DAILY_MOVE", ticker, percent: Number(percent) }
          : kind === "HORIZON"
            ? { kind: "HORIZON_MOVE", ticker, percent: Number(percent), horizon }
            : { kind: "SIGNAL_ENTRY", ticker, signal };

      const res = await fetch("/api/alert-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? "Création impossible.");
        return;
      }
      setMessage("Règle d'alerte créée.");
    } catch {
      setError("Création impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <button type="button" className={className ?? styles.btn} onClick={() => setOpen(true)}>
        {label ?? "Alerte"}
      </button>
      {open ? (
        <div className={styles.overlay} role="presentation" onClick={() => setOpen(false)}>
          <div
            className={styles.sheet}
            role="dialog"
            aria-label={`Créer une alerte ${ticker}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={styles.title}>Alerte {ticker}</h2>
            <p className={styles.hint}>
              {lastClose != null ? `Cours actuel ${Math.round(lastClose).toLocaleString("fr-FR")} FCFA. ` : ""}
              Collier BRVM typique ±{BRVM_DAILY_COLLAR_PCT} % / séance. Évalué après actualisation des cours.
            </p>
            <label className={styles.label}>
              Type
              <select className={styles.input} value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                <option value="PRICE">Cours franchit un seuil (FCFA)</option>
                <option value="DAILY">Variation du jour ≥ Y %</option>
                <option value="HORIZON">Variation 1S / 1M ≥ Y %</option>
                <option value="SIGNAL">Entre en ACHAT / ACHAT FORT</option>
              </select>
            </label>
            {kind === "PRICE" ? (
              <>
                <label className={styles.label}>
                  Direction
                  <select className={styles.input} value={direction} onChange={(e) => setDirection(e.target.value as "ABOVE" | "BELOW")}>
                    <option value="ABOVE">Cours ≥ seuil</option>
                    <option value="BELOW">Cours ≤ seuil</option>
                  </select>
                </label>
                <label className={styles.label}>
                  Seuil (FCFA)
                  <input className={styles.input} type="number" min={1} value={target} onChange={(e) => setTarget(e.target.value)} />
                </label>
              </>
            ) : null}
            {kind === "DAILY" || kind === "HORIZON" ? (
              <label className={styles.label}>
                Seuil (%)
                <input className={styles.input} type="number" min={0.5} max={10} step="0.1" value={percent} onChange={(e) => setPercent(e.target.value)} />
              </label>
            ) : null}
            {kind === "HORIZON" ? (
              <label className={styles.label}>
                Horizon
                <select className={styles.input} value={horizon} onChange={(e) => setHorizon(e.target.value as "1S" | "1M")}>
                  <option value="1S">1 semaine</option>
                  <option value="1M">1 mois</option>
                </select>
              </label>
            ) : null}
            {kind === "SIGNAL" ? (
              <label className={styles.label}>
                Signal
                <select className={styles.input} value={signal} onChange={(e) => setSignal(e.target.value as "ACHAT FORT" | "ACHAT")}>
                  <option value="ACHAT FORT">ACHAT FORT</option>
                  <option value="ACHAT">ACHAT ou ACHAT FORT</option>
                </select>
              </label>
            ) : null}
            {message ? <p className={styles.ok}>{message}</p> : null}
            {error ? <p className={styles.err}>{error}</p> : null}
            <div className={styles.actions}>
              <button type="button" className={styles.primary} disabled={saving} onClick={() => void create()}>
                {saving ? "Création…" : "Créer"}
              </button>
              <button type="button" className={styles.ghost} onClick={() => setOpen(false)}>
                Fermer
              </button>
              <Link href="/notifications" className={styles.ghost} style={{ textDecoration: "none" }}>
                Centre
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
