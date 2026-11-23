"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { C } from "@/lib/theme/colors";
import CreatePortfolioButton from "@/components/portfolio/CreatePortfolioButton";
import AddHoldingForm from "@/components/portfolio/AddHoldingForm";
import PortfolioHoldingsTable from "@/components/portfolio/PortfolioHoldingsTable";
import PortfolioAllocationChart from "@/components/portfolio/PortfolioAllocationChart";
import PortfolioNavChart from "@/components/portfolio/PortfolioNavChart";
import PortfolioTradesHistory from "@/components/portfolio/PortfolioTradesHistory";
import PortfolioDiscreteControls from "@/components/portfolio/PortfolioDiscreteControls";
import OtherHoldingsSection from "@/components/portfolio/OtherHoldingsSection";
import PortfolioTransfer, { usePortfolioFileDrag } from "@/components/portfolio/PortfolioTransfer";
import pageStyles from "@/components/portfolio/PortfolioPage.module.css";
import { ExpandSection } from "@/components/ui/ExpandChevron";
import PortfolioManageBar from "@/components/portfolio/PortfolioManageBar";
import { useI18n } from "@/components/i18n/I18nProvider";
import { localizeAssetType, localizeQuoteLabel } from "@/components/portfolio/portfolio-i18n";
import {
  AllocationBars,
  Kpi,
  panelStyle,
  allocationSectorsCol,
  allocationTickersCol,
} from "@/components/portfolio/PortfolioPageParts";
import EmptyState from "@/components/ui/EmptyState";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import type { UserPortfoliosWithMetrics } from "@/lib/api/portfolio-data";
import type { PortfolioTradeRow } from "@/lib/api/portfolio-trades";
import { PORTFOLIO_CHANGED_EVENT, PORTFOLIO_TRADES_CHANGED_EVENT, summarizeRealizedPnlClient } from "@/lib/api/portfolio-trades-client";
import { preserveScrollDuring } from "@/lib/ui/scroll-restoration";
import { useLiveQuotes } from "@/lib/ui/use-live-quotes";
import { useThrottledPoll } from "@/lib/ui/use-throttled-poll";
import { holdingsBehindQuotes } from "@/lib/quotes/holdings-sync";
import type { LatestQuote } from "@/lib/quotes/types";
import { usePersistedState } from "@/lib/ui/use-persisted-state";
import {
  PORTFOLIO_DISCRETE_STORAGE_KEY,
  PORTFOLIO_DISCRETE_MASKS_STORAGE_KEY,
  DEFAULT_DISCRETE_MASKS,
  DISCRETE_AMOUNT_LABEL,
  mergeDiscreteMasks,
  isMasked,
  type DiscreteMaskConfig,
} from "@/lib/portfolio/discrete-mode";

type TradesBundle = {
  trades: PortfolioTradeRow[];
  summary: ReturnType<typeof summarizeRealizedPnlClient>;
};

type Props = {
  initialPortfolios: UserPortfoliosWithMetrics;
  tickers: string[];
  /** Titres NGX proposés à l'ajout (prix en ₦). */
  ngxTickers?: string[];
  tradesByPortfolio: Record<string, TradesBundle>;
};


function useDiscreteMasks(): [DiscreteMaskConfig, (next: DiscreteMaskConfig) => void] {
  const [masks, setMasksState] = useState<DiscreteMaskConfig>(DEFAULT_DISCRETE_MASKS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PORTFOLIO_DISCRETE_MASKS_STORAGE_KEY);
      if (raw) setMasksState(mergeDiscreteMasks(JSON.parse(raw)));
    } catch {
      /* ignore */
    }
  }, []);

  const setMasks = useCallback((next: DiscreteMaskConfig) => {
    setMasksState(next);
    try {
      localStorage.setItem(PORTFOLIO_DISCRETE_MASKS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  return [masks, setMasks];
}

function formatGainKpi(
  format: ReturnType<typeof useI18n>["format"],
  amount: number,
  percent: number | "N/D",
  hideAmount: boolean,
  hidePercent: boolean
): string {
  if (hideAmount && hidePercent) return DISCRETE_AMOUNT_LABEL;
  const pct = !hidePercent && percent !== "N/D" ? format.percent(percent, 2, true) : null;
  if (hideAmount) return pct ?? DISCRETE_AMOUNT_LABEL;
  const cash = `${amount >= 0 ? "+" : ""}${format.fcfa(amount)}`;
  return pct ? `${cash} (${pct})` : cash;
}

function investedAmount(costBasis: number, others: { costBasis: number | "N/D" }[]): number {
  return others.reduce((sum, row) => sum + (typeof row.costBasis === "number" ? row.costBasis : 0), costBasis);
}

function dayMove(series: { value: number; changePercent: number | null }[]): {
  amount: number | null;
  percent: number | null;
} {
  if (series.length < 2) return { amount: null, percent: null };
  const last = series[series.length - 1]!;
  const previous = series[series.length - 2]!;
  return { amount: last.value - previous.value, percent: last.changePercent };
}

export default function PortfolioPageClient({ initialPortfolios, tickers, ngxTickers = [], tradesByPortfolio }: Props) {
  const { t, format, locale } = useI18n();
  const [portfolios, setPortfolios] = useState(initialPortfolios);
  const [openId, setOpenId] = useState<string | null>(() => {
    const empty = initialPortfolios.find((item) => item.holdings.length + item.otherHoldings.length === 0);
    return empty?.id ?? null;
  });
  const [incoming, setIncoming] = useState<{ portfolioId: string; file: File } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [discrete, setDiscrete] = usePersistedState<boolean>(PORTFOLIO_DISCRETE_STORAGE_KEY, false);
  const [masks, setMasks] = useDiscreteMasks();

  useEffect(() => {
    setPortfolios(initialPortfolios);
  }, [initialPortfolios]);

  const reloadFromApi = useCallback(async () => {
    await preserveScrollDuring(async () => {
      try {
        const res = await fetch("/api/portfolio", { cache: "no-store", credentials: "include" });
        const json = await res.json();
        if (json.ok && Array.isArray(json.data?.portfolios)) {
          setPortfolios(json.data.portfolios as UserPortfoliosWithMetrics);
        }
      } catch {
        // Best-effort : les données initiales du serveur restent affichées.
      }
    });
  }, []);

  /** Après création / mutation : recharger la liste client immédiatement. */
  useEffect(() => {
    const onChanged = () => {
      void reloadFromApi();
    };
    window.addEventListener(PORTFOLIO_CHANGED_EVENT, onChanged);
    window.addEventListener(PORTFOLIO_TRADES_CHANGED_EVENT, onChanged);
    return () => {
      window.removeEventListener(PORTFOLIO_CHANGED_EVENT, onChanged);
      window.removeEventListener(PORTFOLIO_TRADES_CHANGED_EVENT, onChanged);
    };
  }, [reloadFromApi]);

  // Derniers cours live des lignes BRVM : en séance toutes les 60 s (onglet visible),
  // et dès qu'une notification arrive. Les lignes (valeur, P&L) ne sont relues
  // que si un cours a réellement changé.
  const holdingTickers = useMemo(
    () => [...new Set(portfolios.flatMap((p) => p.metrics.holdings.map((h) => h.ticker.toUpperCase())))].sort(),
    [portfolios]
  );
  const portfoliosRef = useRef(portfolios);
  portfoliosRef.current = portfolios;
  const onLiveQuotes = useCallback(
    (changed: LatestQuote[]) => {
      const holdings = portfoliosRef.current.flatMap((p) => p.metrics.holdings);
      if (holdingsBehindQuotes(holdings, changed)) void reloadFromApi();
    },
    [reloadFromApi]
  );
  const { quotes: liveQuotes } = useLiveQuotes({
    market: "BRVM",
    tickers: holdingTickers,
    onChange: onLiveQuotes,
    enabled: holdingTickers.length > 0,
  });
  // Relecture complète douce (au plus toutes les 10 min, onglet visible).
  useThrottledPoll(reloadFromApi);

  const refreshOnOpen = useCallback(async () => {
    // Afficher d'abord les données déjà en mémoire / SSR, puis rafraîchir
    // les cours en arrière-plan (évite 30–100 s de blocage au premier paint).
    await reloadFromApi();
    try {
      const res = await fetch("/api/market/refresh-quotes", { method: "POST", cache: "no-store" });
      if (res.ok) await reloadFromApi();
    } catch {
      // Cooldown ou réseau : la première charge suffit.
    }
  }, [reloadFromApi]);

  useEffect(() => {
    void refreshOnOpen();
  }, [refreshOnOpen]);

  const acceptDroppedFile = useCallback(
    (file: File) => {
      const targetId = openId ?? portfolios[0]?.id;
      if (!targetId) return;
      setOpenId(targetId);
      setIncoming({ portfolioId: targetId, file });
    },
    [openId, portfolios]
  );
  const onDragChange = useCallback((active: boolean) => {
    setDragging(active);
    if (active) {
      setOpenId((current) => current ?? portfolios[0]?.id ?? null);
    }
  }, [portfolios]);
  usePortfolioFileDrag(acceptDroppedFile, onDragChange);

  const hidePortfolioTotal = isMasked(discrete, masks, "portfolioTotal");
  const hideGainAmt = isMasked(discrete, masks, "gainAmount");
  const hideGainPct = isMasked(discrete, masks, "gainPercent");
  const hideRealized = isMasked(discrete, masks, "realizedPnl");
  const hideNav = isMasked(discrete, masks, "navChart");
  const hideAlloc = isMasked(discrete, masks, "allocationAmounts");

  return (
    <div className="ob-page">
      <style>{`
        .portfolio-flash {
          outline: 2px solid var(--c-gold);
          outline-offset: 3px;
          transition: outline-color 0.3s ease;
        }
      `}</style>
      <PageHeader
        kicker={t("portfolio.page.kicker")}
        title={t("portfolio.page.title")}
        actions={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Link href="/portefeuille/analyse" className="ob-btn-secondary">
              {t("portfolio.analysis.open")}
            </Link>
            <CreatePortfolioButton onCreated={reloadFromApi} />
            <PortfolioDiscreteControls
              discrete={discrete}
              onDiscreteChange={(v) => setDiscrete(v)}
              masks={masks}
              onMasksChange={setMasks}
            />
          </div>
        }
      />

      {portfolios.length === 0 && (
        <EmptyState
          title={t("portfolio.empty.title")}
          body={t("portfolio.empty.body")}
        />
      )}

      {portfolios.map((p) => {
        const tradeBundle = tradesByPortfolio[p.id];
        const summary = tradeBundle?.summary ?? {
          totalRealizedPnl: 0,
          salesCount: 0,
          lossCount: 0,
          gainCount: 0,
        };

        const lineCount = p.holdings.length + p.otherHoldings.length;
        const invested = investedAmount(p.metrics.totalCostBasis, p.otherHoldings);
        const session = dayMove(p.navSeries);
        const sessionColor =
          session.percent == null ? C.textDim : session.percent >= 0 ? C.green : C.red;
        const latentColor =
          p.combined.totalGainLossPercent !== "N/D" && p.combined.totalGainLossPercent >= 0
            ? C.green
            : p.combined.totalGainLossPercent !== "N/D"
              ? C.red
              : p.combined.totalGainLoss >= 0
                ? C.green
                : C.red;

        return (
          <div key={p.id} id={`portfolio-${p.id}`} style={panelStyle}>
            <PortfolioTransfer
              portfolioId={p.id}
              portfolioName={p.name}
              holdingCount={lineCount}
              open={openId === p.id}
              onOpenChange={(next) => setOpenId(next ? p.id : openId === p.id ? null : openId)}
              incomingFile={incoming?.portfolioId === p.id ? incoming.file : null}
              onIncomingFileHandled={() => setIncoming((current) => (current?.portfolioId === p.id ? null : current))}
              highlighted={dragging && openId === p.id}
            >
              {(transferButton) => (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    marginBottom: 4,
                  }}
                >
                  <h2 style={{ color: C.gold, fontSize: "var(--fs-section)", margin: 0 }}>{p.name}</h2>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {transferButton}
                    <PortfolioManageBar portfolioId={p.id} name={p.name} onChanged={reloadFromApi} />
                  </div>
                </div>
              )}
            </PortfolioTransfer>

            <div className={pageStyles.kpis}>
              <Kpi
                label={t("portfolio.kpis.total")}
                value={hidePortfolioTotal ? DISCRETE_AMOUNT_LABEL : format.fcfa(p.combined.totalMarketValue)}
                educationSlug="valeur-de-marche"
                hint={
                  hidePortfolioTotal
                    ? t("portfolio.kpis.maskedAmount")
                    : p.metrics.marketPricesAsOfLabel !== "N/D"
                      ? localizeQuoteLabel(p.metrics.marketPricesAsOfLabel, locale, t, format)
                      : t("portfolio.kpis.priceNd")
                }
              />
              <Kpi
                label={t("portfolio.kpis.latent")}
                value={formatGainKpi(
                  format,
                  p.combined.totalGainLoss,
                  p.combined.totalGainLossPercent,
                  hideGainAmt,
                  hideGainPct
                )}
                color={latentColor}
                educationSlug="plus-moins-value-latente"
                hint={hideGainAmt && hideGainPct ? t("portfolio.kpis.maskedAmounts") : t("portfolio.kpis.vsPru")}
              />
              <Kpi
                label={t("portfolio.kpis.day")}
                value={
                  session.amount == null
                    ? "N/D"
                    : formatGainKpi(format, session.amount, session.percent ?? "N/D", hideGainAmt, hideGainPct)
                }
                color={sessionColor}
                hint={
                  p.otherHoldings.length > 0
                    ? t("portfolio.kpis.dayStocks")
                    : session.amount == null
                      ? t("portfolio.kpis.dayNeed")
                      : t("portfolio.kpis.dayPrev")
                }
              />
              <Kpi
                label={t("portfolio.kpis.invested")}
                value={hidePortfolioTotal ? DISCRETE_AMOUNT_LABEL : format.fcfa(invested)}
                hint={t("portfolio.kpis.costHint")}
              />
            </div>

            {p.holdings.length > 0 ? (
              <>
                {p.metrics.holdings.length > 0 && (p.otherHoldings.length > 0 || p.ngx) ? (
                  <h3 style={{ color: C.gold, fontSize: "0.95rem", margin: "4px 0 0" }}>
                    {t("portfolio.actionsHeading")}
                    <span style={{ color: C.textDim, fontWeight: 500, marginLeft: 8 }}>
                      {format.fcfa(p.metrics.totalMarketValue)}
                    </span>
                  </h3>
                ) : null}
                {p.metrics.holdings.length > 0 ? (
                  <PortfolioHoldingsTable
                    portfolioId={p.id}
                    holdings={p.metrics.holdings}
                    liveQuotes={liveQuotes}
                    latestQuoteLabel={p.metrics.marketPricesAsOfLabel}
                    portfolioValue={p.combined.totalMarketValue}
                    discrete={discrete}
                    masks={masks}
                  />
                ) : null}
                {p.ngx ? (
                  <>
                    <h3 style={{ color: C.gold, fontSize: "0.95rem", margin: "4px 0 0" }}>
                      {t("portfolio.ngxHeading")}
                      <span style={{ color: C.textDim, fontWeight: 500, marginLeft: 8 }}>
                        {hidePortfolioTotal
                          ? DISCRETE_AMOUNT_LABEL
                          : format.money(p.ngx.metrics.totalMarketValue, "NGN")}
                      </span>
                    </h3>
                    <p style={{ color: C.textDim, fontSize: "0.75rem", margin: 0 }}>
                      {!hidePortfolioTotal && p.ngx.indicativeFcfa.marketValue != null && p.ngx.indicativeFcfa.rateDate
                        ? t("portfolio.ngxIndicative", {
                            amount: format.fcfa(p.ngx.indicativeFcfa.marketValue),
                            date: p.ngx.indicativeFcfa.rateDate,
                          })
                        : hidePortfolioTotal
                          ? ""
                          : t("portfolio.ngxNoRate")}{" "}
                      {t("portfolio.ngxNote")}
                    </p>
                    <PortfolioHoldingsTable
                      portfolioId={p.id}
                      holdings={p.ngx.metrics.holdings}
                      liveQuotes={liveQuotes}
                      latestQuoteLabel={p.ngx.metrics.marketPricesAsOfLabel}
                      portfolioValue={p.ngx.metrics.totalMarketValue}
                      discrete={discrete}
                      masks={masks}
                      currency="NGN"
                    />
                  </>
                ) : null}
              </>
            ) : p.otherHoldings.length === 0 ? (
              <p className={pageStyles.emptyLine}>
                {t("portfolio.emptyLine")}
                {openId === p.id ? null : (
                  <button type="button" className="ob-btn-ghost" onClick={() => setOpenId(p.id)}>
                    {t("portfolio.importStatement")}
                  </button>
                )}
              </p>
            ) : null}

            <OtherHoldingsSection
              portfolioId={p.id}
              holdings={p.otherHoldings}
              portfolioValue={p.combined.totalMarketValue}
              part="tables"
            />

            <ExpandSection
              title={t("portfolio.fold.alloc")}
              className={pageStyles.secondary}
              buttonClassName={pageStyles.foldBtn}
            >
              <div className={pageStyles.kpis}>
                <Kpi
                  label={t("portfolio.kpis.realized")}
                  value={
                    hideRealized
                      ? DISCRETE_AMOUNT_LABEL
                      : `${summary.totalRealizedPnl >= 0 ? "+" : ""}${format.fcfa(summary.totalRealizedPnl)}`
                  }
                  color={summary.totalRealizedPnl >= 0 ? C.green : C.red}
                  hint={t("portfolio.kpis.salesHint", {
                    sales: summary.salesCount,
                    losses: summary.lossCount,
                    gains: summary.gainCount,
                  })}
                />
                <Kpi
                  label={t("portfolio.kpis.ytd")}
                  value={
                    p.metrics.ytdChangePercent !== "N/D"
                      ? format.percent(p.metrics.ytdChangePercent, 2, true)
                      : "N/D"
                  }
                  color={C.teal}
                  educationSlug="performance-ytd"
                  hint={p.otherHoldings.length > 0 ? t("portfolio.kpis.ytdOthers") : t("portfolio.kpis.ytdBase")}
                />
                <Kpi label={t("portfolio.kpis.lines")} value={format.integer(lineCount)} />
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  margin: "4px 0 8px",
                  fontSize: "0.78rem",
                }}
              >
                <span style={{ color: C.textDim }}>{t("portfolio.advice.prefix")}</span>
                <span style={{ color: C.green, fontWeight: 700 }}>
                  {t("portfolio.advice.increase", { count: p.adviceRecap.reinforce })}
                </span>
                <span style={{ color: C.gold, fontWeight: 700 }}>
                  {t("portfolio.advice.hold", { count: p.adviceRecap.hold })}
                </span>
                <span style={{ color: C.red, fontWeight: 700 }}>
                  {t("portfolio.advice.exit", { count: p.adviceRecap.exit })}
                </span>
              </div>
              {p.otherHoldings.length > 0 ? (
                <p style={{ color: C.textDim, fontSize: "0.78rem", margin: "8px 0 0" }}>
                  {t("portfolio.historyNote")}
                </p>
              ) : null}
              <PortfolioNavChart series={p.navSeries} titleSlug="evolution-portefeuille" discrete={hideNav} />
              {p.otherHoldings.length > 0 ? (
                <AllocationBars
                  heading={t("portfolio.asset.byType")}
                  items={p.combined.assetTypeBreakdown.map((slice) => ({
                    sector: localizeAssetType(slice.type, t),
                    weightPercent: slice.weightPercent,
                  }))}
                />
              ) : null}
              <div className={pageStyles.alloc}>
                <div style={allocationSectorsCol}>
                  <AllocationBars items={p.metrics.sectorBreakdown} />
                </div>
                <div style={allocationTickersCol}>
                  <PortfolioAllocationChart items={p.metrics.tickerBreakdown} discrete={hideAlloc} />
                </div>
              </div>
              <PortfolioTradesHistory
                portfolioId={p.id}
                initialTrades={tradeBundle?.trades ?? []}
                initialSummary={summary}
                discrete={discrete}
                masks={masks}
              />
            </ExpandSection>

            <ExpandSection title={t("portfolio.fold.add")} className={pageStyles.addMore} buttonClassName={pageStyles.foldBtn}>
              <AddHoldingForm portfolioId={p.id} tickers={tickers} ngxTickers={ngxTickers} />
              <OtherHoldingsSection portfolioId={p.id} holdings={p.otherHoldings} part="form" />
            </ExpandSection>
          </div>
        );
      })}
    </div>
  );
}
