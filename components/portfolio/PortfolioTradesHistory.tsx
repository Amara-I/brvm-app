"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PortfolioTradeRow } from "@/lib/api/portfolio-trades";
import {
  PORTFOLIO_CHANGED_EVENT,
  PORTFOLIO_TRADES_CHANGED_EVENT,
  summarizeRealizedPnlClient,
} from "@/lib/api/portfolio-trades-client";
import { C } from "@/lib/theme/colors";
import { useI18n } from "@/components/i18n/I18nProvider";
import { formatIso, showPortfolioApiError } from "@/components/portfolio/portfolio-i18n";
import { preserveScrollDuring } from "@/lib/ui/scroll-restoration";
import { usePersistedState } from "@/lib/ui/use-persisted-state";
import {
  DEFAULT_DISCRETE_MASKS,
  DISCRETE_AMOUNT_LABEL,
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

export default function PortfolioTradesHistory({
  portfolioId,
  initialTrades,
  initialSummary,
  discrete = false,
  masks = DEFAULT_DISCRETE_MASKS,
}: PortfolioTradesHistoryProps & { discrete?: boolean; masks?: DiscreteMaskConfig }) {
  const { t, format } = useI18n();
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
          setLoadError(showPortfolioApiError(t, json?.error, t("portfolio.trades.loadFailed")));
          return;
        }
        const nextTrades = (json.data?.trades ?? []) as PortfolioTradeRow[];
        const nextSummary = json.data?.summary ?? summarizeRealizedPnlClient(nextTrades);
        setTrades(nextTrades);
        setSummary(nextSummary);
      } catch {
        setLoadError(t("portfolio.trades.loadFailed"));
      } finally {
        setBusy(false);
      }
    });
  }, [portfolioId, t]);

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
            {t("portfolio.trades.title")}
          </h3>
          <p className={styles.sub}>
            {t("portfolio.trades.sub")}
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
              {f === "TOUS" ? t("portfolio.trades.all") : f === "VENTE" ? t("portfolio.trades.sells") : t("portfolio.trades.buys")}
            </button>
          ))}
          <button
            type="button"
            className={styles.chip}
            onClick={() => void load()}
            disabled={busy}
            title={t("portfolio.trades.refresh")}
          >
            ↻
          </button>
        </div>
      </div>

      <div className={styles.kpis}>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>{t("portfolio.trades.realized")}</span>
          <span
            className={styles.kpiValue}
            style={{ color: summary.totalRealizedPnl >= 0 ? C.green : C.red }}
          >
            {hideRealized
              ? DISCRETE_AMOUNT_LABEL
              : `${summary.totalRealizedPnl >= 0 ? "+" : ""}${format.fcfa(summary.totalRealizedPnl)}`}
          </span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>{t("portfolio.trades.sales")}</span>
          <span className={styles.kpiValue}>{summary.salesCount}</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>{t("portfolio.trades.losses")}</span>
          <span className={styles.kpiValue} style={{ color: C.red }}>
            {summary.lossCount}
          </span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>{t("portfolio.trades.gains")}</span>
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
          {t("portfolio.trades.empty")}
        </p>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t("portfolio.trades.date")}</th>
                  <th>{t("portfolio.trades.type")}</th>
                  <th>{t("portfolio.trades.security")}</th>
                  <th>{t("portfolio.trades.qty")}</th>
                  <th>{t("portfolio.trades.price")}</th>
                  <th>{t("portfolio.trades.pru")}</th>
                  <th>{t("portfolio.trades.pnl")}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => {
                  const pnl = row.realizedPnl;
                  return (
                    <tr key={row.id}>
                      <td>{formatIso(format, row.tradedAt)}</td>
                      <td>
                        <span className={row.side === "VENTE" ? styles.badgeSell : styles.badgeBuy}>
                          {row.side === "VENTE" ? t("portfolio.trades.sell") : t("portfolio.trades.buy")}
                        </span>
                      </td>
                      <td>
                        <strong>{row.ticker}</strong>
                        <div className={styles.name}>{row.name}</div>
                      </td>
                      <td>
                        {hideTrades
                          ? DISCRETE_AMOUNT_LABEL
                          : format.decimal(row.quantity, Number.isInteger(row.quantity) ? 0 : 2)}
                      </td>
                      <td>{hideTrades ? DISCRETE_AMOUNT_LABEL : format.fcfa(row.price)}</td>
                      <td>{row.costBasis != null ? (hideTrades ? DISCRETE_AMOUNT_LABEL : format.fcfa(row.costBasis)) : "—"}</td>
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
                            : `${pnl >= 0 ? "+" : ""}${format.fcfa(pnl)}`}
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
                ? t("portfolio.trades.hideOlder")
                : t("portfolio.trades.showOlder", { count: hiddenCount, s: hiddenCount > 1 ? "s" : "" })}
            </button>
          ) : null}
        </>
      )}
      <p className={styles.foot}>
        {t("portfolio.trades.foot")}
      </p>
    </section>
  );
}
