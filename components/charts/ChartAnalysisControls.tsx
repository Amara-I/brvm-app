"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { ChartDrawing } from "@/lib/charts/chart-drawings-storage";
import type { ChartIndicatorsState } from "@/components/charts/TradingChart";
import type { ChartRange } from "@/lib/charts/indicators";
import type { CandleInterval } from "@/lib/charts/ohlc-aggregate";
import styles from "./ChartWorkbench.module.css";

export interface SavedAnalysisSummary {
  id: string;
  ticker: string;
  name: string;
  drawings: ChartDrawing[];
  indicators: ChartIndicatorsState;
  range: string;
  interval: CandleInterval;
  compareTickers: string[];
  updatedAt: string;
}

export default function ChartAnalysisControls({
  isAuthenticated,
  ticker,
  drawings,
  indicators,
  range,
  interval,
  compare,
  onApply,
  onSaved,
  loginCallbackPath,
  open,
  onOpenChange,
  savedCount,
}: {
  isAuthenticated: boolean;
  ticker: string;
  drawings: ChartDrawing[];
  indicators: ChartIndicatorsState;
  range: ChartRange;
  interval: CandleInterval;
  compare: string[];
  onApply: (analysis: SavedAnalysisSummary) => void;
  /** Après enregistrement ou suppression — rafraîchir le compteur parent. */
  onSaved?: () => void;
  /** URL de retour après connexion (ex. /graphes ou /actions/CIEC). */
  loginCallbackPath?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  savedCount?: number;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const panelOpen = open ?? internalOpen;
  const setPanelOpen = onOpenChange ?? setInternalOpen;
  const [analyses, setAnalyses] = useState<SavedAnalysisSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const listCount = savedCount ?? analyses.length;

  const loadList = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/charts/analyses?ticker=${encodeURIComponent(ticker)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Impossible de charger les analyses.");
        setAnalyses([]);
        return;
      }
      setAnalyses((json.data?.analyses ?? []) as SavedAnalysisSummary[]);
    } catch {
      setError("Impossible de charger les analyses.");
      setAnalyses([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, ticker]);

  useEffect(() => {
    if (panelOpen && isAuthenticated) void loadList();
  }, [panelOpen, isAuthenticated, loadList]);

  useEffect(() => {
    setName(`Analyse ${ticker}`);
    setMessage(null);
    setError(null);
  }, [ticker]);

  async function saveAnalysis() {
    if (!isAuthenticated) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Indiquez un nom pour l'analyse.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/charts/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          name: trimmed,
          drawings,
          indicators,
          range,
          interval,
          compareTickers: compare,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const detail =
          typeof json?.details?.reason === "string"
            ? ` (${json.details.reason})`
            : "";
        setError((json?.error ?? "Enregistrement impossible.") + detail);
        return;
      }
      setMessage("Analyse enregistrée.");
      await loadList();
      onSaved?.();
    } catch {
      setError("Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function removeAnalysis(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/charts/analyses/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Suppression impossible.");
        return;
      }
      setAnalyses((prev) => prev.filter((a) => a.id !== id));
      setMessage("Analyse supprimée.");
      onSaved?.();
    } catch {
      setError("Suppression impossible.");
    }
  }

  if (!isAuthenticated) {
    const callback =
      loginCallbackPath ?? `/graphes?ticker=${encodeURIComponent(ticker)}`;
    return (
      <Link
        href={`/connexion?callbackUrl=${encodeURIComponent(callback)}`}
        className={styles.ghostBtnEnabled}
        title="Connectez-vous pour enregistrer et rouvrir vos analyses graphiques"
      >
        Mes analyses
      </Link>
    );
  }

  return (
    <div className={styles.analysisMenuWrap}>
      <button
        type="button"
        className={panelOpen ? styles.toolPillActive : styles.ghostBtnEnabled}
        aria-expanded={panelOpen}
        aria-haspopup="dialog"
        title="Ouvrir, charger ou enregistrer une analyse graphique"
        onClick={() => setPanelOpen(!panelOpen)}
      >
        Mes analyses
        {listCount > 0 ? <span className={styles.analysisBadge}>{listCount}</span> : null}
      </button>
      {panelOpen && (
        <div className={styles.analysisPanel} role="dialog" aria-label="Analyses graphiques sauvegardées">
          <p className={styles.analysisLead}>
            Rouvrez une analyse enregistrée avec le bouton <strong>Charger</strong> — tracés,
            indicateurs, plage et comparaisons sont restaurés.
          </p>
          <div className={styles.analysisListHead}>
            <span>Analyses enregistrées ({ticker})</span>
            <button type="button" className={styles.analysisLinkBtn} onClick={() => void loadList()}>
              Actualiser
            </button>
          </div>
          {loading ? (
            <p className={styles.analysisHint}>Chargement…</p>
          ) : analyses.length === 0 ? (
            <p className={styles.analysisHint}>
              Aucune analyse enregistrée pour ce titre. Configurez le graphique puis enregistrez-la
              ci-dessous.
            </p>
          ) : (
            <ul className={styles.analysisList}>
              {analyses.map((a) => (
                <li key={a.id} className={styles.analysisItem}>
                  <div>
                    <strong>{a.name}</strong>
                    <span>
                      {new Date(a.updatedAt).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className={styles.analysisItemActions}>
                    <button
                      type="button"
                      className={styles.analysisLoadBtn}
                      onClick={() => {
                        onApply(a);
                        setPanelOpen(false);
                        setMessage(`Analyse « ${a.name} » chargée.`);
                      }}
                    >
                      Charger
                    </button>
                    <button
                      type="button"
                      className={styles.analysisDangerBtn}
                      onClick={() => void removeAnalysis(a.id)}
                    >
                      Supprimer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className={styles.analysisDivider} aria-hidden />
          <p className={styles.analysisSectionTitle}>Enregistrer l&apos;analyse actuelle</p>
          <p className={styles.analysisHint}>
            Sauvegarde cloud liée à votre compte — tracés, indicateurs, plage et intervalle.
          </p>
          <label className={styles.analysisLabel}>
            Nom
            <input
              className={styles.analysisInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
            />
          </label>
          <button
            type="button"
            className={styles.analysisSaveBtn}
            disabled={saving}
            onClick={() => void saveAnalysis()}
          >
            {saving ? "Enregistrement…" : "Enregistrer maintenant"}
          </button>
          {message && <p className={styles.analysisOk}>{message}</p>}
          {error && <p className={styles.analysisErr}>{error}</p>}
        </div>
      )}
    </div>
  );
}
