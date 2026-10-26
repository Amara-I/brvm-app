"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { C } from "@/lib/theme/colors";
import type { EnrichedHoldingMetrics } from "@/lib/api/portfolio-data";
import type { ChartClosePoint } from "@/lib/charts/indicators";
import ColumnFilterRow from "@/components/ui/ColumnFilterRow";
import {
  applyColumnSort,
  type ColumnFilterDef,
  type ColumnSortState,
} from "@/lib/ui/column-filters";
import EducationTermLink, {
  PORTFOLIO_TABLE_TERM_SLUGS,
} from "@/components/education/EducationTermLink";
import { notifyPortfolioChanged, notifyPortfolioTradesChanged } from "@/lib/api/portfolio-trades-client";
import HorizonSelect from "@/components/marche/HorizonSelect";
import {
  filterSeriesByHorizon,
  horizonChangePercent,
  type MarketHorizon,
} from "@/lib/markets/market-horizon";
import { usePersistedState } from "@/lib/ui/use-persisted-state";
import { useI18n } from "@/components/i18n/I18nProvider";
import { formatIso, showPortfolioApiError } from "@/components/portfolio/portfolio-i18n";
import type { BuyHorizonCode } from "@/lib/calc/portfolio-advice";
import {
  DEFAULT_DISCRETE_MASKS,
  DISCRETE_AMOUNT_LABEL,
  isMasked,
  type DiscreteMaskConfig,
} from "@/lib/portfolio/discrete-mode";
import styles from "./PortfolioHoldingsTable.module.css";

function fmtDay(iso: string | null | undefined, format: ReturnType<typeof useI18n>["format"]): string {
  return formatIso(format, iso);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function buyIso(h: EnrichedHoldingMetrics): string {
  return (h.buyDate ?? h.createdAt).slice(0, 10);
}

function horizonCode(code: string): BuyHorizonCode {
  if (code === "COURT" || code === "LONG") return code;
  return "MOYEN";
}

function formatSignedPct(pct: number | null): string {
  if (pct == null || Number.isNaN(pct)) return "N/D";
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

const STATIC_COL_DEFS_AFTER_VAR: ColumnFilterDef<EnrichedHoldingMetrics>[] = [
  { key: "qty", label: "Qté", sortKind: "number", getValue: (h) => String(h.quantity) },
  { key: "pru", label: "PRU", sortKind: "number", getValue: (h) => String(Math.round(h.avgBuyPrice)) },
  {
    key: "cost",
    label: "Coût",
    sortKind: "number",
    getValue: (h) => String(Math.round(h.costBasis)),
  },
  {
    key: "unitPrice",
    label: "Cours",
    sortKind: "number",
    getValue: (h) => (typeof h.currentPrice === "number" ? String(Math.round(h.currentPrice)) : "N/D"),
  },
  {
    key: "value",
    label: "Total",
    sortKind: "number",
    getValue: (h) => (typeof h.marketValue === "number" ? String(Math.round(h.marketValue)) : "N/D"),
  },
  {
    key: "bought",
    label: "Acheté le",
    sortKind: "text",
    getValue: (h) => buyIso(h),
  },
  {
    key: "horizon",
    label: "Horizon",
    sortKind: "text",
    getValue: (h) => h.buyHorizon,
  },
  {
    key: "pnl",
    label: "+/−",
    sortKind: "number",
    getValue: (h) =>
      typeof h.gainLossPercent === "number"
        ? `${h.gainLossPercent >= 0 ? "+" : ""}${h.gainLossPercent}%`
        : "N/D",
  },
  {
    key: "score",
    label: "Score",
    sortKind: "number",
    getValue: (h) => (typeof h.analysisScore === "number" ? String(h.analysisScore) : "N/D"),
  },
  {
    key: "advice",
    label: "Signal",
    sortKind: "text",
    getValue: (h) => h.advice.label,
  },
];

type Props = {
  portfolioId: string;
  holdings: EnrichedHoldingMetrics[];
  latestQuoteLabel?: string;
  /** Valeur totale du portefeuille, pour la colonne Poids. */
  portfolioValue?: number;
  /** Mode discret actif. */
  discrete?: boolean;
  /** Quels champs masquer (défaut = config historique, PRU/Marché visibles). */
  masks?: DiscreteMaskConfig;
};

export default function PortfolioHoldingsTable({
  portfolioId,
  holdings,
  latestQuoteLabel,
  portfolioValue = 0,
  discrete = false,
  masks = DEFAULT_DISCRETE_MASKS,
}: Props) {
  const { t, format, labels } = useI18n();
  const fmtAmt = (n: number) => format.integer(n);
  const fmtFcfa = (n: number) => format.fcfa(n);
  const amtOrMask = (n: number, masked: boolean) => (masked ? DISCRETE_AMOUNT_LABEL : format.integer(n));
  const [colSort, setColSort] = useState<ColumnSortState | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [qty, setQty] = useState("");
  const [pru, setPru] = useState("");
  const [horizon, setHorizon] = useState<"COURT" | "MOYEN" | "LONG">("MOYEN");
  const [targetPrice, setTargetPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buyDateBusyId, setBuyDateBusyId] = useState<string | null>(null);
  const [selling, setSelling] = useState<EnrichedHoldingMetrics | null>(null);
  const [sellQty, setSellQty] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [sellDate, setSellDate] = useState(todayIso());
  const [reinforcing, setReinforcing] = useState<EnrichedHoldingMetrics | null>(null);
  const [reinforceQty, setReinforceQty] = useState("");
  const [reinforcePrice, setReinforcePrice] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const [varHorizon, setVarHorizon] = usePersistedState<MarketHorizon>(
    "portfolio-holdings:var-horizon",
    "1J"
  );
  const [sparkSeriesByTicker, setSparkSeriesByTicker] = useState<Record<string, ChartClosePoint[]>>(
    {}
  );
  const [dayChangesByTicker, setDayChangesByTicker] = useState<Record<string, number | null>>({});

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/market/spark-series", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || !json?.ok) return;
        setSparkSeriesByTicker((json.data?.sparkSeries as Record<string, ChartClosePoint[]>) ?? {});
        setDayChangesByTicker((json.data?.dayChanges as Record<string, number | null>) ?? {});
      })
      .catch(() => {
        /* best-effort */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const variationByTicker = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const h of holdings) {
      if (map.has(h.ticker)) continue;
      if (varHorizon === "1J") {
        map.set(h.ticker, dayChangesByTicker[h.ticker] ?? null);
        continue;
      }
      const dated = sparkSeriesByTicker[h.ticker];
      if (!dated?.length) {
        map.set(h.ticker, null);
        continue;
      }
      const series = filterSeriesByHorizon(dated, varHorizon);
      map.set(h.ticker, horizonChangePercent(series));
    }
    return map;
  }, [holdings, varHorizon, sparkSeriesByTicker, dayChangesByTicker]);

  const colDefs = useMemo<ColumnFilterDef<EnrichedHoldingMetrics>[]>(() => {
    const defs: ColumnFilterDef<EnrichedHoldingMetrics>[] = [
      {
        key: "ticker",
        label: t("portfolio.holdings.col.company"),
        sortKind: "text",
        getValue: (h) => `${h.ticker} ${h.name ?? ""}`.trim(),
      },
      {
        key: "variation",
        label: t("portfolio.holdings.col.variation"),
        sortKind: "number",
        getValue: (h) => {
          const v = variationByTicker.get(h.ticker);
          return v == null ? "N/D" : String(v);
        },
      },
      ...STATIC_COL_DEFS_AFTER_VAR,
    ];
    const pnlAt = defs.findIndex((column) => column.key === "pnl");
    defs.splice(pnlAt + 1, 0, {
      key: "weight",
      label: t("portfolio.holdings.col.weight"),
      sortKind: "number",
      getValue: (h) => {
        if (typeof h.marketValue !== "number" || portfolioValue <= 0) return "N/D";
        return String((h.marketValue / portfolioValue) * 100);
      },
    });
    const labelsByKey: Record<string, string> = {
      qty: t("portfolio.holdings.col.qty"),
      pru: t("portfolio.holdings.col.pru"),
      cost: t("portfolio.holdings.col.cost"),
      unitPrice: t("portfolio.holdings.col.price"),
      value: t("portfolio.holdings.col.total"),
      bought: t("portfolio.holdings.col.bought"),
      horizon: t("portfolio.holdings.col.horizon"),
      pnl: t("portfolio.holdings.col.pnl"),
      score: t("portfolio.holdings.col.score"),
      advice: t("portfolio.holdings.col.signal"),
    };
    return defs.map((column) =>
      labelsByKey[column.key] ? { ...column, label: labelsByKey[column.key]! } : column
    );
  }, [variationByTicker, portfolioValue, t]);

  const rows = useMemo(
    () => applyColumnSort(holdings, colDefs, colSort),
    [holdings, colDefs, colSort]
  );

  const latestQuoteDate = useMemo(() => {
    const days = holdings
      .map((h) => (h.currentPriceDate !== "N/D" ? h.currentPriceDate : null))
      .filter((d): d is string => Boolean(d))
      .sort();
    return days.length > 0 ? days[days.length - 1]! : null;
  }, [holdings]);

  useEffect(() => {
    if (!menuId) return;
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuId(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuId(null);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuId]);

  const changeBuyDate = useCallback(
    async (h: EnrichedHoldingMetrics, nextBuyDate: string) => {
      if (!h.id) return;
      const max = todayIso();
      if (nextBuyDate > max) {
        setError(t("portfolio.holdings.futureDate"));
        return;
      }
      if (nextBuyDate === buyIso(h)) return;

      setBuyDateBusyId(h.id);
      setError(null);
      try {
        const res = await fetch(`/api/portfolio/${portfolioId}/holdings/${h.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ buyDate: nextBuyDate }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          setError(showPortfolioApiError(t, json?.error, t("portfolio.holdings.dateFailed")));
          return;
        }
        notifyPortfolioTradesChanged(portfolioId);
        notifyPortfolioChanged(portfolioId);
      } finally {
        setBuyDateBusyId(null);
      }
    },
    [portfolioId]
  );

  function startEdit(h: EnrichedHoldingMetrics) {
    if (!h.id) return;
    setMenuId(null);
    setEditingId(h.id);
    setQty(String(h.quantity));
    setPru(String(h.avgBuyPrice));
    setHorizon(h.buyHorizon);
    setTargetPrice(h.targetPrice != null ? String(h.targetPrice) : "");
    setStopPrice(h.stopPrice != null ? String(h.stopPrice) : "");
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setError(null);
  }

  async function saveEdit(holdingId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/portfolio/${portfolioId}/holdings/${holdingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: Number(qty),
          avgBuyPrice: Number(pru),
          buyHorizon: horizon,
          targetPrice: targetPrice.trim() ? Number(targetPrice) : null,
          stopPrice: stopPrice.trim() ? Number(stopPrice) : null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(showPortfolioApiError(t, json?.error, t("portfolio.holdings.saveFailed")));
        return;
      }
      setEditingId(null);
      notifyPortfolioChanged(portfolioId);
    } finally {
      setBusy(false);
    }
  }

  function startSell(h: EnrichedHoldingMetrics) {
    if (!h.id) return;
    setMenuId(null);
    setReinforcing(null);
    setSelling(h);
    setSellQty(String(h.quantity));
    setSellPrice(
      typeof h.currentPrice === "number" && h.currentPrice > 0 ? String(h.currentPrice) : ""
    );
    setSellDate(todayIso());
    setError(null);
  }

  function cancelSell() {
    setSelling(null);
    setError(null);
  }

  function startReinforce(h: EnrichedHoldingMetrics) {
    if (!h.id) return;
    setMenuId(null);
    setSelling(null);
    setReinforcing(h);
    setReinforceQty("1");
    setReinforcePrice(
      typeof h.currentPrice === "number" && h.currentPrice > 0
        ? String(h.currentPrice)
        : String(h.avgBuyPrice)
    );
    setError(null);
  }

  function cancelReinforce() {
    setReinforcing(null);
    setError(null);
  }

  async function confirmReinforce() {
    if (!reinforcing?.id) return;
    const quantity = Number(reinforceQty);
    const avgBuyPrice = Number(reinforcePrice);
    if (!(quantity > 0)) {
      setError(t("portfolio.holdings.reinforceQty"));
      return;
    }
    if (!(avgBuyPrice > 0)) {
      setError(t("portfolio.holdings.reinforcePrice"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/portfolio/${portfolioId}/holdings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: reinforcing.ticker,
          quantity,
          avgBuyPrice,
          buyDate: todayIso(),
          buyHorizon: reinforcing.buyHorizon,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(showPortfolioApiError(t, json?.error, t("portfolio.holdings.reinforceFailed")));
        return;
      }
      setReinforcing(null);
      notifyPortfolioTradesChanged(portfolioId);
    } finally {
      setBusy(false);
    }
  }

  async function confirmSell() {
    if (!selling?.id) return;
    const quantitySold = Number(sellQty);
    const price = Number(sellPrice);
    if (!(quantitySold > 0) || quantitySold > selling.quantity + 1e-9) {
      setError(t("portfolio.holdings.sellQtyInvalid"));
      return;
    }
    if (!(price > 0)) {
      setError(t("portfolio.holdings.sellPriceInvalid"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/portfolio/${portfolioId}/holdings/${selling.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantitySold,
          sellPrice: price,
          sellDate,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(showPortfolioApiError(t, json?.error, t("portfolio.holdings.sellFailed")));
        return;
      }
      const tradePnl =
        typeof json?.data?.trade?.realizedPnl === "number" ? json.data.trade.realizedPnl : null;
      setSelling(null);
      notifyPortfolioTradesChanged(portfolioId);
      if (tradePnl != null) {
        const sign = tradePnl >= 0 ? "+" : "";
        setError(null);
        // Message court sous le tableau (vert/rouge via texte) — l'historique se met à jour aussitôt.
        window.setTimeout(() => {
          const el = document.getElementById(`portfolio-trades-${portfolioId}`);
          el?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 80);
        console.info(
          `[portefeuille] Vente ${selling.ticker} enregistrée · P&L ${sign}${format.fcfa(tradePnl)}`
        );
      }
      notifyPortfolioChanged(portfolioId);
    } finally {
      setBusy(false);
    }
  }

  const quoteLabelRight =
    latestQuoteLabel && latestQuoteLabel !== "N/D"
      ? latestQuoteLabel
      : latestQuoteDate
        ? t("portfolio.holdings.quoteNow", { date: fmtDay(latestQuoteDate, format) })
        : t("portfolio.holdings.quoteNd");

  return (
    <div className={styles.wrap} data-align-left>
      {error ? (
        <p style={{ color: C.red, fontSize: "0.78rem", margin: "0 0 10px" }} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.hintRow}>
        <p className={styles.hintLeft}>
          {t("portfolio.holdings.amounts")} <strong className={styles.unitNote}>FCFA</strong>
          {discrete ? t("portfolio.holdings.discrete") : ""}
          {" · "}
          <EducationTermLink slug="pru">{t("portfolio.holdings.definitions")}</EducationTermLink>
        </p>
        <p className={styles.hintRight} title={t("portfolio.holdings.quoteTitle")}>
          {quoteLabelRight}
        </p>
      </div>

      <div className={styles.scroll}>
      <table className={styles.table}>
        <thead>
          <ColumnFilterRow
            columns={[
              ...colDefs.map((c) => {
                const eduSlug = PORTFOLIO_TABLE_TERM_SLUGS[c.key];
                if (c.key === "variation") {
                  return {
                    key: c.key,
                    label: c.label,
                    header: (
                      <span className={styles.varHead}>
                        <span>{t("portfolio.holdings.col.variationWord")}</span>
                        <HorizonSelect value={varHorizon} onChange={setVarHorizon} />
                      </span>
                    ),
                  };
                }
                if (c.key === "value") {
                  return {
                    key: c.key,
                    label: c.label,
                    header: (
                      <span className={styles.colStackHead} title={t("portfolio.holdings.totalTitle")}>
                        {eduSlug ? (
                          <EducationTermLink slug={eduSlug}>{t("portfolio.holdings.col.total")}</EducationTermLink>
                        ) : (
                          <span>{t("portfolio.holdings.col.total")}</span>
                        )}
                        <span className={styles.colStackSub}>{t("portfolio.holdings.col.market")}</span>
                      </span>
                    ),
                  };
                }
                if (c.key === "unitPrice") {
                  return {
                    key: c.key,
                    label: c.label,
                    header: (
                      <span className={styles.colStackHead} title={t("portfolio.holdings.unitTitle")}>
                        {eduSlug ? (
                          <EducationTermLink slug={eduSlug}>{t("portfolio.holdings.col.price")}</EducationTermLink>
                        ) : (
                          <span>{t("portfolio.holdings.col.price")}</span>
                        )}
                        <span className={styles.colStackSub}>{t("portfolio.holdings.col.unit")}</span>
                      </span>
                    ),
                  };
                }
                return {
                  key: c.key,
                  label: c.label,
                  skip: c.skip,
                  header: eduSlug ? (
                    <EducationTermLink slug={eduSlug}>{c.label}</EducationTermLink>
                  ) : undefined,
                };
              }),
              { key: "actions", label: "", skip: true },
            ]}
            sort={colSort}
            onSortChange={setColSort}
          />
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={14} className={styles.cellMuted}>
                {t("portfolio.holdings.empty")}
              </td>
            </tr>
          ) : (
            rows.map((h) => {
              const isEdit = Boolean(h.id && editingId === h.id);
              const menuOpen = Boolean(h.id && menuId === h.id);
              const pnlColor =
                typeof h.gainLoss === "number" && h.gainLoss >= 0 ? C.green : C.red;
              const maxDate = todayIso();
              const buyDateLoading = Boolean(h.id && buyDateBusyId === h.id);
              const buyDateValue = buyIso(h);
              const scoreColor =
                typeof h.analysisScore === "number"
                  ? h.analysisScore >= 70
                    ? C.green
                    : h.analysisScore >= 45
                      ? C.gold
                      : C.red
                  : C.textDim;
              const varPct = variationByTicker.get(h.ticker) ?? null;
              const varColor = varPct == null ? C.textDim : varPct >= 0 ? C.green : C.red;

              return (
                <tr key={h.id ?? h.ticker} className={styles.row}>
                  <td className={styles.cellSticky} data-label={t("portfolio.holdings.col.security")}>
                    <Link href={`/actions/${h.ticker}`} className={styles.tickerLink}>
                      <span className={styles.tickerCode}>{h.ticker}</span>
                      {h.name ? <span className={styles.tickerName}>{h.name}</span> : null}
                    </Link>
                    {isEdit ? (
                      <div className={styles.pnlCell} style={{ marginTop: 6 }}>
                        <input
                          type="number"
                          min={1}
                          className={styles.input}
                          placeholder={t("portfolio.holdings.targetPh")}
                          aria-label={t("portfolio.holdings.targetAria", { ticker: h.ticker })}
                          value={targetPrice}
                          onChange={(e) => setTargetPrice(e.target.value)}
                          disabled={busy}
                        />
                        <input
                          type="number"
                          min={1}
                          className={styles.input}
                          placeholder={t("portfolio.holdings.stopPh")}
                          aria-label={t("portfolio.holdings.stopAria", { ticker: h.ticker })}
                          value={stopPrice}
                          onChange={(e) => setStopPrice(e.target.value)}
                          disabled={busy}
                        />
                      </div>
                    ) : h.targetPrice != null || h.stopPrice != null ? (
                      <span className={styles.tickerName}>
                        {h.targetPrice != null ? t("portfolio.holdings.obj", { amount: fmtAmt(h.targetPrice) }) : ""}
                        {h.targetPrice != null && h.stopPrice != null ? " · " : ""}
                        {h.stopPrice != null ? t("portfolio.holdings.stop", { amount: fmtAmt(h.stopPrice) }) : ""}
                      </span>
                    ) : null}
                  </td>
                  <td
                    data-label={t("portfolio.holdings.col.variation")}
                    className={styles.varChg}
                    style={{ color: varColor }}
                    title={
                      varHorizon === "1J"
                        ? t("portfolio.holdings.varDay")
                        : t("portfolio.holdings.varPeriod")
                    }
                  >
                    {formatSignedPct(varPct)}
                  </td>
                  <td className={styles.cellNum} data-label={t("portfolio.holdings.col.qty")}>
                    {isEdit ? (
                      <input
                        type="number"
                        min={0.0001}
                        step="any"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        disabled={busy}
                        aria-label={t("portfolio.holdings.qtyAria", { ticker: h.ticker })}
                        className={styles.input}
                      />
                    ) : (
                      <span className={styles.qty}>
                        {isMasked(discrete, masks, "quantity")
                          ? DISCRETE_AMOUNT_LABEL
                          : format.decimal(h.quantity, Number.isInteger(h.quantity) ? 0 : 2)}
                      </span>
                    )}
                  </td>
                  <td className={styles.cellNum} data-label={t("portfolio.holdings.col.pru")}>
                    {isEdit ? (
                      <input
                        type="number"
                        min={0.01}
                        step="any"
                        value={pru}
                        onChange={(e) => setPru(e.target.value)}
                        disabled={busy}
                        aria-label={t("portfolio.holdings.pruAria", { ticker: h.ticker })}
                        className={styles.input}
                      />
                    ) : (
                      amtOrMask(h.avgBuyPrice, isMasked(discrete, masks, "pru"))
                    )}
                  </td>
                  <td className={`${styles.cellNum} ${styles.cellSecondary}`}>
                    {amtOrMask(h.costBasis, isMasked(discrete, masks, "cost"))}
                  </td>
                  <td className={styles.cellNum} data-label={t("portfolio.holdings.col.price")} title={t("portfolio.holdings.unitTitle")}>
                    {typeof h.currentPrice === "number"
                      ? amtOrMask(h.currentPrice, isMasked(discrete, masks, "unitPrice"))
                      : "N/D"}
                  </td>
                  <td className={styles.cellNum} data-label={t("portfolio.holdings.col.value")} title={t("portfolio.holdings.valueTitle")}>
                    {typeof h.marketValue === "number"
                      ? amtOrMask(h.marketValue, isMasked(discrete, masks, "positionTotal"))
                      : "N/D"}
                  </td>
                  <td className={`${styles.cellMuted} ${styles.cellSecondary}`}>
                    {h.id ? (
                      <input
                        type="date"
                        className={styles.dateInput}
                        max={maxDate}
                        value={buyDateValue}
                        disabled={busy || buyDateLoading}
                        aria-label={t("portfolio.holdings.boughtAria", { ticker: h.ticker })}
                        title={t("portfolio.holdings.boughtTitle")}
                        onChange={(e) => void changeBuyDate(h, e.target.value)}
                      />
                    ) : (
                      fmtDay(buyDateValue, format)
                    )}
                  </td>
                  <td className={`${styles.cell} ${styles.cellSecondary}`}>
                    {isEdit ? (
                      <select
                        value={horizon}
                        onChange={(e) => setHorizon(e.target.value as "COURT" | "MOYEN" | "LONG")}
                        disabled={busy}
                        className={styles.input}
                        aria-label={t("portfolio.holdings.horizonAriaRow", { ticker: h.ticker })}
                      >
                        <option value="COURT">{labels.horizon("COURT", "short")}</option>
                        <option value="MOYEN">{labels.horizon("MOYEN", "short")}</option>
                        <option value="LONG">{labels.horizon("LONG", "short")}</option>
                      </select>
                    ) : (
                      <span className={styles.horizonPill}>{labels.horizon(horizonCode(h.buyHorizon), "short")}</span>
                    )}
                  </td>
                  <td className={styles.cellNum} data-label={t("portfolio.holdings.col.pnl")} style={{ color: pnlColor }}>
                    {typeof h.gainLossPercent === "number" || typeof h.gainLoss === "number" ? (
                      <div className={styles.pnlCell}>
                        {!isMasked(discrete, masks, "gainPercent") &&
                        typeof h.gainLossPercent === "number" ? (
                          <span className={styles.pnlPct}>
                            {h.gainLossPercent >= 0 ? "+" : ""}
                            {h.gainLossPercent}%
                          </span>
                        ) : null}
                        {typeof h.gainLoss === "number" &&
                        !isMasked(discrete, masks, "gainAmount") ? (
                          <span className={styles.pnlAbs}>
                            {h.gainLoss >= 0 ? "+" : ""}
                            {fmtAmt(h.gainLoss)}
                          </span>
                        ) : null}
                        {isMasked(discrete, masks, "gainPercent") &&
                        isMasked(discrete, masks, "gainAmount") ? (
                          <span className={styles.pnlPct}>{DISCRETE_AMOUNT_LABEL}</span>
                        ) : null}
                      </div>
                    ) : (
                      "N/D"
                    )}
                  </td>
                  <td className={styles.cellNum} data-label={t("portfolio.holdings.col.weight")}>
                    {typeof h.marketValue === "number" && portfolioValue > 0
                      ? `${((h.marketValue / portfolioValue) * 100).toFixed(1)} %`
                      : "N/D"}
                  </td>
                  <td className={`${styles.cellNum} ${styles.cellSecondary}`}>
                    <span className={styles.scoreValue} style={{ color: scoreColor }}>
                      {typeof h.analysisScore === "number" ? h.analysisScore : "N/D"}
                    </span>
                  </td>
                  <td className={`${styles.cell} ${styles.cellSecondary}`}>
                    <span
                      className={styles.advicePill}
                      title={[h.advice.summary, ...h.advice.reasons].filter(Boolean).join(" · ")}
                      style={{ background: h.advice.color }}
                    >
                      {labels.advice(h.advice.action, h.advice.label)}
                    </span>
                  </td>
                  <td className={styles.cellActions} data-label={t("portfolio.holdings.col.actions")}>
                    {!h.id ? null : isEdit ? (
                      <div className={styles.editBtns}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void saveEdit(h.id!)}
                          className={styles.btnPrimary}
                        >
                          OK
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={cancelEdit}
                          className={styles.btnGhost}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className={styles.menuRoot} ref={menuOpen ? menuRef : undefined}>
                        <button
                          type="button"
                          disabled={busy}
                          aria-label={t("portfolio.holdings.options", { ticker: h.ticker })}
                          aria-haspopup="menu"
                          aria-expanded={menuOpen}
                          title={t("portfolio.holdings.rowActions")}
                          onClick={() => setMenuId(menuOpen ? null : h.id!)}
                          className={styles.btnIcon}
                        >
                          ⋯
                        </button>
                        {menuOpen ? (
                          <ul role="menu" className={styles.menu}>
                            <li role="none">
                              <button
                                type="button"
                                role="menuitem"
                                disabled={busy}
                                onClick={() => startReinforce(h)}
                                className={`${styles.menuItem} ${styles.menuItemBuy}`}
                              >
                                {t("portfolio.holdings.buy")}
                              </button>
                            </li>
                            <li role="none">
                              <button
                                type="button"
                                role="menuitem"
                                disabled={busy}
                                onClick={() => startSell(h)}
                                className={`${styles.menuItem} ${styles.menuItemDanger}`}
                              >
                                {t("portfolio.holdings.sell")}
                              </button>
                            </li>
                            <li role="none">
                              <button
                                type="button"
                                role="menuitem"
                                disabled={busy}
                                onClick={() => startEdit(h)}
                                className={styles.menuItem}
                              >
                                {t("common.edit")}
                              </button>
                            </li>
                          </ul>
                        ) : null}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      </div>

      {selling ? (
        <div className={styles.sellOverlay} role="dialog" aria-modal="true" aria-labelledby="sell-title">
          <div className={styles.sellDialog}>
            <h3 id="sell-title" className={styles.sellTitle}>
              {t("portfolio.holdings.sellTitle", { ticker: selling.ticker })}
            </h3>
            <p className={styles.sellHint}>
              {t("portfolio.holdings.sellHint", {
                pru: fmtFcfa(selling.avgBuyPrice),
                qty: format.decimal(selling.quantity, Number.isInteger(selling.quantity) ? 0 : 2),
              })}
            </p>
            <div className={styles.sellPresets}>
              <button
                type="button"
                className={styles.chip}
                disabled={busy}
                onClick={() => setSellQty(String(Math.max(1, Math.floor(selling.quantity / 2))))}
              >
                {t("portfolio.holdings.half")}
              </button>
              <button
                type="button"
                className={styles.chip}
                disabled={busy}
                onClick={() => setSellQty(String(selling.quantity))}
              >
                {t("portfolio.holdings.sellAll")}
              </button>
            </div>
            <label className={styles.sellLabel}>
              {t("portfolio.holdings.qtyToSell")}
              <input
                type="number"
                min={0.0001}
                max={selling.quantity}
                step="any"
                value={sellQty}
                onChange={(e) => setSellQty(e.target.value)}
                className={styles.sellInput}
              />
            </label>
            <label className={styles.sellLabel}>
              {t("portfolio.holdings.sellPrice")}
              <input
                type="number"
                min={0.01}
                step="any"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                className={styles.sellInput}
              />
            </label>
            <label className={styles.sellLabel}>
              {t("portfolio.holdings.sellDate")}
              <input
                type="date"
                value={sellDate}
                max={todayIso()}
                onChange={(e) => setSellDate(e.target.value)}
                className={styles.sellInput}
              />
            </label>
            {(() => {
              const q = Number(sellQty);
              const p = Number(sellPrice);
              if (!(q > 0) || !(p > 0)) return null;
              const pnl = (p - selling.avgBuyPrice) * q;
              const full = q >= selling.quantity - 1e-9;
              return (
                <p className={styles.sellPnl} style={{ color: pnl >= 0 ? C.green : C.red }}>
                  {full ? t("portfolio.holdings.fullClose") : t("portfolio.holdings.partialClose")} · {t("portfolio.holdings.estPnl")}{" "}
                  {pnl >= 0 ? "+" : ""}
                  {fmtFcfa(pnl)}
                </p>
              );
            })()}
            {error ? (
              <p className={styles.modalError} role="alert">
                {error}
              </p>
            ) : null}
            <div className={styles.sellActions}>
              <button type="button" className={styles.btnGhost} disabled={busy} onClick={cancelSell}>
                {t("common.cancel")}
              </button>
              <button type="button" className={styles.btnSell} disabled={busy} onClick={() => void confirmSell()}>
                {t("portfolio.holdings.confirmSell")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {reinforcing ? (
        <div className={styles.sellOverlay} role="dialog" aria-modal="true" aria-labelledby="reinforce-title">
          <div className={styles.sellDialog}>
            <h3 id="reinforce-title" className={styles.sellTitle}>
              {t("portfolio.holdings.reinforceTitle", { ticker: reinforcing.ticker })}
            </h3>
            <p className={styles.sellHint}>
              {t("portfolio.holdings.reinforceHint", {
                qty: format.decimal(reinforcing.quantity, Number.isInteger(reinforcing.quantity) ? 0 : 2),
                pru: fmtFcfa(reinforcing.avgBuyPrice),
              })}
            </p>
            <label className={styles.sellLabel}>
              {t("portfolio.holdings.qtyToBuy")}
              <input
                type="number"
                min={0.0001}
                step="any"
                value={reinforceQty}
                onChange={(e) => setReinforceQty(e.target.value)}
                className={styles.sellInput}
              />
            </label>
            <label className={styles.sellLabel}>
              {t("portfolio.holdings.buyPrice")}
              <input
                type="number"
                min={0.01}
                step="any"
                value={reinforcePrice}
                onChange={(e) => setReinforcePrice(e.target.value)}
                className={styles.sellInput}
              />
            </label>
            {error ? (
              <p className={styles.modalError} role="alert">
                {error}
              </p>
            ) : null}
            <div className={styles.sellActions}>
              <button type="button" className={styles.btnGhost} disabled={busy} onClick={cancelReinforce}>
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className={styles.btnReinforceConfirm}
                disabled={busy}
                onClick={() => void confirmReinforce()}
              >
                {t("portfolio.holdings.confirmReinforce")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
