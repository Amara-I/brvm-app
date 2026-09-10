"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import styles from "./ChartWorkbench.module.css";

type AlertDirection = "ABOVE" | "BELOW";
type AlertStatus = "ACTIVE" | "TRIGGERED" | "DISABLED";

export interface PriceAlertDto {
  id: string;
  ticker: string;
  direction: AlertDirection;
  targetPrice: number;
  note: string | null;
  status: AlertStatus;
  triggeredAt: string | null;
  triggerPrice: number | null;
  createdAt: string;
}

function fmtPrice(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}

export default function ChartAlertControls({
  isAuthenticated,
  ticker,
  lastClose,
  loginCallbackPath,
}: {
  isAuthenticated: boolean;
  ticker: string;
  lastClose: number | null;
  loginCallbackPath?: string;
}) {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<PriceAlertDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [direction, setDirection] = useState<AlertDirection>("ABOVE");
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/alerts?ticker=${encodeURIComponent(ticker)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Impossible de charger les alertes.");
        setAlerts([]);
        return;
      }
      setAlerts((json.data?.alerts ?? []) as PriceAlertDto[]);
    } catch {
      setError("Impossible de charger les alertes.");
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, ticker]);

  useEffect(() => {
    if (open && isAuthenticated) void loadList();
  }, [open, isAuthenticated, loadList]);

  useEffect(() => {
    setMessage(null);
    setError(null);
    if (lastClose != null && Number.isFinite(lastClose)) {
      setTarget(String(Math.round(lastClose)));
    } else {
      setTarget("");
    }
  }, [ticker, lastClose]);

  async function createAlert() {
    if (!isAuthenticated) return;
    const value = Number(target.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      setError("Indiquez un seuil de cours positif.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          direction,
          targetPrice: value,
          note: note.trim() || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? "Création impossible.");
        return;
      }
      const alert = json.data?.alert as PriceAlertDto | undefined;
      if (alert?.status === "TRIGGERED") {
        setMessage(`Seuil déjà atteint (${fmtPrice(alert.triggerPrice ?? value)}). Alerte déclenchée.`);
      } else {
        setMessage("Alerte créée.");
      }
      setNote("");
      await loadList();
    } catch {
      setError("Création impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function removeAlert(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/alerts/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Suppression impossible.");
        return;
      }
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      setMessage("Alerte supprimée.");
    } catch {
      setError("Suppression impossible.");
    }
  }

  async function reactivate(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/alerts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Réactivation impossible.");
        return;
      }
      setMessage("Alerte réactivée.");
      await loadList();
    } catch {
      setError("Réactivation impossible.");
    }
  }

  if (!isAuthenticated) {
    const callback = loginCallbackPath ?? `/graphes?ticker=${encodeURIComponent(ticker)}`;
    return (
      <Link
        href={`/connexion?callbackUrl=${encodeURIComponent(callback)}`}
        className={styles.ghostBtnEnabled}
        title="Connectez-vous pour créer une alerte"
      >
        Alerte
      </Link>
    );
  }

  const triggeredCount = alerts.filter((a) => a.status === "TRIGGERED").length;

  return (
    <div className={styles.analysisMenuWrap}>
      <button
        type="button"
        className={open ? styles.toolPillActive : styles.ghostBtnEnabled}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Alerte{triggeredCount > 0 ? ` (${triggeredCount})` : ""}
      </button>
      {open && (
        <div className={styles.analysisPanel} role="dialog" aria-label="Alertes de cours">
          <p className={styles.analysisHint}>
            Seuil sur le dernier cours canonique de {ticker}
            {lastClose != null ? ` (actuel ${fmtPrice(lastClose)})` : ""}. Vérifié après chaque
            actualisation BRVM.
          </p>
          <label className={styles.analysisLabel}>
            Direction
            <select
              className={styles.analysisInput}
              value={direction}
              onChange={(e) => setDirection(e.target.value as AlertDirection)}
            >
              <option value="ABOVE">Cours ≥ seuil</option>
              <option value="BELOW">Cours ≤ seuil</option>
            </select>
          </label>
          <label className={styles.analysisLabel}>
            Seuil (FCFA)
            <input
              className={styles.analysisInput}
              type="number"
              min={1}
              step="any"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </label>
          <label className={styles.analysisLabel}>
            Note (optionnel)
            <input
              className={styles.analysisInput}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="Ex. resistance 2024"
            />
          </label>
          <button
            type="button"
            className={styles.analysisSaveBtn}
            disabled={saving}
            onClick={() => void createAlert()}
          >
            {saving ? "Création…" : "Créer l'alerte"}
          </button>
          {message && <p className={styles.analysisOk}>{message}</p>}
          {error && <p className={styles.analysisErr}>{error}</p>}
          <div className={styles.analysisListHead}>
            <span>Mes alertes ({ticker})</span>
            <button type="button" className={styles.analysisLinkBtn} onClick={() => void loadList()}>
              Actualiser
            </button>
          </div>
          {loading ? (
            <p className={styles.analysisHint}>Chargement…</p>
          ) : alerts.length === 0 ? (
            <p className={styles.analysisHint}>Aucune alerte pour ce titre.</p>
          ) : (
            <ul className={styles.analysisList}>
              {alerts.map((a) => (
                <li key={a.id} className={styles.analysisItem}>
                  <div>
                    <strong>
                      {a.direction === "ABOVE" ? "≥" : "≤"} {fmtPrice(a.targetPrice)}
                    </strong>
                    <span>
                      {a.status === "TRIGGERED"
                        ? `Déclenchée${a.triggerPrice != null ? ` @ ${fmtPrice(a.triggerPrice)}` : ""}`
                        : "Active"}
                      {a.note ? ` · ${a.note}` : ""}
                    </span>
                  </div>
                  <div className={styles.analysisItemActions}>
                    {a.status === "TRIGGERED" && (
                      <button type="button" className={styles.analysisLinkBtn} onClick={() => void reactivate(a.id)}>
                        Réactiver
                      </button>
                    )}
                    <button type="button" className={styles.analysisDangerBtn} onClick={() => void removeAlert(a.id)}>
                      Suppr.
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
