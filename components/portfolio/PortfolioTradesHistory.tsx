"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PortfolioTradeRow } from "@/lib/api/portfolio-trades";
import {
  PORTFOLIO_CHANGED_EVENT,
  PORTFOLIO_TRADES_CHANGED_EVENT,
  summarizeRealizedPnlClient,
} from "@/lib/api/portfolio-trades-client";
import { C } from "@/lib/theme/colors";
import { preserveScrollDuring } from "@/lib/ui/scroll-restoration";
import { usePersistedState } from "@/lib/ui/use-persisted-state";
import {
  DEFAULT_DISCRETE_MASKS,
  DISCRETE_AMOUNT_LABEL,
  fmtFcfaOrMasked,
  isMasked,
  type DiscreteMaskConfig,
} from "@/lib/portfolio/discrete-mode";
import styles from "./PortfolioTradesHistory.module.css";

export interface PortfolioTradesHistoryProps {
  portfolioId: string;
  initialTrades: PortfolioTradeRow[];
  initialSummary: {
    totalRealizedPnl: number;
    salesCount: number;
    lossCount: number;
    gainCount: number;
  };
}

function fmtFcfa(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}

function fmtDay(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export default function PortfolioTradesHistory({
  portfolioId,
  initialTrades,
  initialSummary,
  discrete = false,
  masks = DEFAULT_DISCRETE_MASKS,
}: PortfolioTradesHistoryProps & { discrete?: boolean; masks?: DiscreteMaskConfig }) {
  const hideTrades = isMasked(discrete, masks, "tradeAmounts");
  const hideRealized = isMasked(discrete, masks, "realizedPnl");
  const [filter, setFilter] = usePersistedState<"TOUS" | "VENTE" | "ACHAT">(
    `ouestbourse:trades:${portfolioId}:filter`,
    "TOUS"
  );
  const [busy, setBusy] = useState(false);
  const [trades, setTrades] = useState(initialTrades);
  const [summary, setSummary] = useState(initialSummary);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    await preserveScrollDuring(async () => {
      setBusy(true);
      setLoadError(null);
      try {
        const res = await fetch(`/api/portfolio/${portfolioId}/trades`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          setLoadError(json?.error ?? "Impossible de charger l'historique.");
          return;
        }
        const nextTrades = (json.data?.trades ?? []) as PortfolioTradeRow[];
        const nextSummary = json.data?.summary ?? summarizeRealizedPnlClient(nextTrades);
        setTrades(nextTrades);
        setSummary(nextSummary);
      } catch {
        setLoadError("Impossible de charger l'historique.");
      } finally {
        setBusy(false);
      }
    });
  }, [portfolioId]);

  useEffect(() => {
    setTrades(initialTrades);
    setSummary(initialSummary);
  }, [initialTrades, initialSummary]);

  useEffect(() => {
    function onChanged(ev: Event) {
      const detail = (ev as CustomEvent<{ portfolioId?: string }>).detail;
      if (detail?.portfolioId && detail.portfolioId !== portfolioId) return;
      void load();
    }
    window.addEventListener(PORTFOLIO_TRADES_CHANGED_EVENT, onChanged);
    window.addEventListener(PORTFOLIO_CHANGED_EVENT, onChanged);
    return () => {
      window.removeEventListener(PORTFOLIO_TRADES_CHANGED_EVENT, onChanged);
      window.removeEventListener(PORTFOLIO_CHANGED_EVENT, onChanged);
    };
  }, [portfolioId, load]);

  const visible = useMemo(() => {
    if (filter === "TOUS") return trades;
    return trades.filter((t) => t.side === filter);
  }, [trades, filter]);

  const PREVIEW = 5;
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? visible : visible.slice(0, PREVIEW);
  const hiddenCount = Math.max(0, visible.length - PREVIEW);

  // Replier automatiquement si le filtre change et qu'il reste peu de lignes.
  useEffect(() => {
    setExpanded(false);
  }, [filter, portfolioId]);

  return (
    <section
      id={`portfolio-trades-${portfolioId}`}
      className={styles.wrap}
      aria-labelledby="trades-history-title"
    >
      <div className={styles.head}>
        <div>
          <h3 id="trades-history-title" className={styles.title}>
            Historique — ventes, gains &amp; pertes
          </h3>
          <p className={styles.sub}>
            Chaque vente (partielle ou totale) conserve le PRU, le prix de cession et la
            plus/moins-value réalisée. Les achats et renforcements sont aussi listés.
          </p>
        </div>
        <div className={styles.filters}>
          {(["TOUS", "VENTE", "ACHAT"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={filter === f ? styles.chipActive : styles.chip}
              onClick={() => setFilter(f)}
              disabled={busy}
            >
              {f === "TOUS" ? "Tous" : f === "VENTE" ? "Ventes" : "Achats"}
            </button>
          ))}
          <button
            type="button"
            className={styles.chip}
            onClick={() => void load()}
            disabled={busy}
            title="Actualiser"
          >
            ↻
          </button>
        </div>
      </div>

      <div className={styles.kpis}>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>P&amp;L réalisé</span>
          <span
            className={styles.kpiValue}
            style={{ color: summary.totalRealizedPnl >= 0 ? C.green : C.red }}
          >
            {hideRealized
              ? DISCRETE_AMOUNT_LABEL
              : `${summary.totalRealizedPnl >= 0 ? "+" : ""}${fmtFcfa(summary.totalRealizedPnl)}`}
          </span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Ventes</span>
          <span className={styles.kpiValue}>{summary.salesCount}</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Pertes</span>
          <span className={styles.kpiValue} style={{ color: C.red }}>
            {summary.lossCount}
          </span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Gains</span>
          <span className={styles.kpiValue} style={{ color: C.green }}>
            {summary.gainCount}
          </span>
        </div>
      </div>

      {loadError ? (
        <p className={styles.empty} style={{ color: C.red }} role="alert">
          {loadError}
        </p>
      ) : visible.length === 0 ? (
        <p className={styles.empty}>
          Aucune opération dans ce filtre. Utilisez « Vendre » sur une ligne pour alléger ou
          clôturer une position — le gain ou la perte apparaîtra ici. « Renforcer » enregistre
          aussi un achat.
        </p>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Titre</th>
                  <th>Qté</th>
                  <th>Prix</th>
                  <th>PRU</th>
                  <th>P&amp;L réalisé</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((t) => {
                  const pnl = t.realizedPnl;
                  return (
                    <tr key={t.id}>
                      <td>{fmtDay(t.tradedAt)}</td>
                      <td>
                        <span className={t.side === "VENTE" ? styles.badgeSell : styles.badgeBuy}>
                          {t.side === "VENTE" ? "Vente" : "Achat"}
                        </span>
                      </td>
                      <td>
                        <strong>{t.ticker}</strong>
                        <div className={styles.name}>{t.name}</div>
                      </td>
                      <td>
                        {hideTrades ? DISCRETE_AMOUNT_LABEL : t.quantity.toLocaleString("fr-FR")}
                      </td>
                      <td>{fmtFcfaOrMasked(t.price, hideTrades)}</td>
                      <td>{t.costBasis != null ? fmtFcfaOrMasked(t.costBasis, hideTrades) : "—"}</td>
                      <td
                        style={{
                          color: pnl == null ? C.textDim : pnl >= 0 ? C.green : C.red,
                          fontWeight: 700,
                        }}
                      >
                        {pnl == null
                          ? "—"
                          : hideTrades || hideRealized
                            ? DISCRETE_AMOUNT_LABEL
                            : `${pnl >= 0 ? "+" : ""}${fmtFcfa(pnl)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {hiddenCount > 0 ? (
            <button
              type="button"
              className={styles.moreBtn}
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded
                ? "Masquer les transactions plus anciennes"
                : `Voir les ${hiddenCount} transaction${hiddenCount > 1 ? "s" : ""} plus ancienne${hiddenCount > 1 ? "s" : ""}`}
            </button>
          ) : null}
        </>
      )}
      <p className={styles.foot}>
        Les ventes restent visibles même après sortie totale d&apos;une ligne.
      </p>
    </section>
  );
}
