"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ChartDrawing } from "@/lib/charts/chart-drawings-storage";
import type { ChartIndicatorsState } from "@/components/charts/TradingChart";
import type { ChartRange } from "@/lib/charts/indicators";
import type { CandleInterval } from "@/lib/charts/ohlc-aggregate";
import { useI18n } from "@/components/i18n/I18nProvider";
import { formatSavedAt, localizeApiMessage } from "./chart-locale";
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
  const { t, format } = useI18n();
  const [internalOpen, setInternalOpen] = useState(false);
  const panelOpen = open ?? internalOpen;
  const setPanelOpen = onOpenChange ?? setInternalOpen;
  const [analyses, setAnalyses] = useState<SavedAnalysisSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const defaultNameRef = useRef("");
  const tickerRef = useRef(ticker);

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
        setError(localizeApiMessage(json.error ?? "Impossible de charger les analyses.", t));
        setAnalyses([]);
        return;
      }
      setAnalyses((json.data?.analyses ?? []) as SavedAnalysisSummary[]);
    } catch {
      setError(t("charts.errors.loadAnalyses"));
      setAnalyses([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, ticker, t]);

  useEffect(() => {
    if (panelOpen && isAuthenticated) void loadList();
  }, [panelOpen, isAuthenticated, loadList]);

  useEffect(() => {
    const nextDefault = t("charts.analysis.defaultName", { ticker });
    const tickerChanged = tickerRef.current !== ticker;
    tickerRef.current = ticker;
    const previousDefault = defaultNameRef.current;
    defaultNameRef.current = nextDefault;
    setName((current) =>
      tickerChanged || current === "" || current === previousDefault ? nextDefault : current
    );
    if (tickerChanged) {
      setMessage(null);
      setError(null);
    }
  }, [ticker, t]);

  async function saveAnalysis() {
    if (!isAuthenticated) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("charts.errors.analysisNameRequired"));
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
        const detail = typeof json?.details?.reason === "string" ? ` (${json.details.reason})` : "";
        setError(localizeApiMessage(json?.error ?? "Enregistrement impossible.", t) + detail);
        return;
      }
      setMessage(t("charts.analysis.saved"));
      await loadList();
      onSaved?.();
    } catch {
      setError(t("charts.errors.saveFailed"));
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
        setError(localizeApiMessage(json.error ?? "Suppression impossible.", t));
        return;
      }
      setAnalyses((prev) => prev.filter((a) => a.id !== id));
      setMessage(t("charts.analysis.deleted"));
      onSaved?.();
    } catch {
      setError(t("charts.errors.deleteFailed"));
    }
  }

  if (!isAuthenticated) {
    const callback = loginCallbackPath ?? `/graphes?ticker=${encodeURIComponent(ticker)}`;
    return (
      <Link
        href={`/connexion?callbackUrl=${encodeURIComponent(callback)}`}
        className={styles.ghostBtnEnabled}
        title={t("charts.analysis.signIn")}
      >
        {t("charts.analysis.button")}
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
        title={t("charts.analysis.openTitle")}
        onClick={() => setPanelOpen(!panelOpen)}
      >
        {t("charts.analysis.button")}
        {listCount > 0 ? <span className={styles.analysisBadge}>{listCount}</span> : null}
      </button>
      {panelOpen && (
        <div className={styles.analysisPanel} role="dialog" aria-label={t("charts.analysis.dialog")}>
          <p className={styles.analysisLead}>
            {t("charts.analysis.leadBefore")}
            <strong>{t("charts.analysis.load")}</strong>
            {t("charts.analysis.leadAfter")}
          </p>
          <div className={styles.analysisListHead}>
            <span>{t("charts.analysis.savedFor", { ticker })}</span>
            <button type="button" className={styles.analysisLinkBtn} onClick={() => void loadList()}>
              {t("charts.analysis.refresh")}
            </button>
          </div>
          {loading ? (
            <p className={styles.analysisHint}>{t("common.loading")}</p>
          ) : analyses.length === 0 ? (
            <p className={styles.analysisHint}>{t("charts.analysis.none")}</p>
          ) : (
            <ul className={styles.analysisList}>
              {analyses.map((a) => (
                <li key={a.id} className={styles.analysisItem}>
                  <div>
                    <strong>{a.name}</strong>
                    <span>{formatSavedAt(a.updatedAt, format, false)}</span>
                  </div>
                  <div className={styles.analysisItemActions}>
                    <button
                      type="button"
                      className={styles.analysisLoadBtn}
                      onClick={() => {
                        onApply(a);
                        setPanelOpen(false);
                        setMessage(t("charts.analysis.loaded", { name: a.name }));
                      }}
                    >
                      {t("charts.analysis.load")}
                    </button>
                    <button
                      type="button"
                      className={styles.analysisDangerBtn}
                      onClick={() => void removeAnalysis(a.id)}
                    >
                      {t("charts.analysis.delete")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className={styles.analysisDivider} aria-hidden />
          <p className={styles.analysisSectionTitle}>{t("charts.analysis.saveTitle")}</p>
          <p className={styles.analysisHint}>{t("charts.analysis.saveHint")}</p>
          <label className={styles.analysisLabel}>
            {t("charts.analysis.name")}
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
            {saving ? t("charts.analysis.saving") : t("charts.analysis.saveNow")}
          </button>
          {message && <p className={styles.analysisOk}>{message}</p>}
          {error && <p className={styles.analysisErr}>{error}</p>}
        </div>
      )}
    </div>
  );
}
