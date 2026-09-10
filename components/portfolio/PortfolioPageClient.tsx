"use client";

import { useCallback, useEffect, useState } from "react";
import { C } from "@/lib/theme/colors";
import { PAGE_TITLE } from "@/lib/theme/typography";
import CreatePortfolioButton from "@/components/portfolio/CreatePortfolioButton";
import AddHoldingForm from "@/components/portfolio/AddHoldingForm";
import PortfolioHoldingsTable from "@/components/portfolio/PortfolioHoldingsTable";
import PortfolioAllocationChart from "@/components/portfolio/PortfolioAllocationChart";
import PortfolioNavChart from "@/components/portfolio/PortfolioNavChart";
import PortfolioTradesHistory from "@/components/portfolio/PortfolioTradesHistory";
import PortfolioDiscreteControls from "@/components/portfolio/PortfolioDiscreteControls";
import PortfolioExcelIO from "@/components/portfolio/PortfolioExcelIO";
import PortfolioManageBar from "@/components/portfolio/PortfolioManageBar";
import { AllocationBars, fmtFcfa, Kpi, panelStyle, allocationLayoutRow, allocationSectorsCol, allocationTickersCol } from "@/components/portfolio/PortfolioPageParts";
import type { UserPortfoliosWithMetrics } from "@/lib/api/portfolio-data";
import type { PortfolioTradeRow } from "@/lib/api/portfolio-trades";
import { PORTFOLIO_CHANGED_EVENT, PORTFOLIO_TRADES_CHANGED_EVENT, summarizeRealizedPnlClient } from "@/lib/api/portfolio-trades-client";
import { preserveScrollDuring } from "@/lib/ui/scroll-restoration";
import { usePersistedState } from "@/lib/ui/use-persisted-state";
import {
  PORTFOLIO_DISCRETE_STORAGE_KEY,
  PORTFOLIO_DISCRETE_MASKS_STORAGE_KEY,
  DEFAULT_DISCRETE_MASKS,
  DISCRETE_AMOUNT_LABEL,
  mergeDiscreteMasks,
  isMasked,
  fmtFcfaOrMasked,
  type DiscreteMaskConfig,
} from "@/lib/portfolio/discrete-mode";

type TradesBundle = {
  trades: PortfolioTradeRow[];
  summary: ReturnType<typeof summarizeRealizedPnlClient>;
};

type Props = {
  initialPortfolios: UserPortfoliosWithMetrics;
  tickers: string[];
  tradesByPortfolio: Record<string, TradesBundle>;
};

const SOFT_REFRESH_MS = 3 * 60_000;

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
  amount: number,
  percent: number | "N/D",
  hideAmount: boolean,
  hidePercent: boolean
): string {
  if (hideAmount && hidePercent) return DISCRETE_AMOUNT_LABEL;
  const pct =
    !hidePercent && percent !== "N/D"
      ? `${percent >= 0 ? "+" : ""}${percent}%`
      : null;
  if (hideAmount) return pct ?? DISCRETE_AMOUNT_LABEL;
  const cash = `${amount >= 0 ? "+" : ""}${fmtFcfa(amount)}`;
  return pct ? `${cash} (${pct})` : cash;
}

export default function PortfolioPageClient({ initialPortfolios, tickers, tradesByPortfolio }: Props) {
  const [portfolios, setPortfolios] = useState(initialPortfolios);
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

    const onVisible = () => {
      if (document.visibilityState === "visible") void reloadFromApi();
    };
    document.addEventListener("visibilitychange", onVisible);

    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void reloadFromApi();
    }, SOFT_REFRESH_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(id);
    };
  }, [refreshOnOpen, reloadFromApi]);

  const hidePortfolioTotal = isMasked(discrete, masks, "portfolioTotal");
  const hideGainAmt = isMasked(discrete, masks, "gainAmount");
  const hideGainPct = isMasked(discrete, masks, "gainPercent");
  const hideRealized = isMasked(discrete, masks, "realizedPnl");
  const hideNav = isMasked(discrete, masks, "navChart");
  const hideAlloc = isMasked(discrete, masks, "allocationAmounts");

  return (
    <div data-align-left>
      <style>{`
        .portfolio-flash {
          outline: 2px solid var(--c-gold);
          outline-offset: 3px;
          transition: outline-color 0.3s ease;
        }
      `}</style>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          width: "100%",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <h1 style={{ ...PAGE_TITLE, marginBottom: 0 }}>Mon portefeuille</h1>
        <CreatePortfolioButton onCreated={reloadFromApi} />
        <PortfolioDiscreteControls
          discrete={discrete}
          onDiscreteChange={(v) => setDiscrete(v)}
          masks={masks}
          onMasksChange={setMasks}
        />
      </div>

      {portfolios.length === 0 && (
        <div style={panelStyle}>
          <p style={{ color: C.textDim, fontSize: "var(--fs-page-lead)", margin: 0 }}>
            Vous n&apos;avez pas encore de portefeuille. Cliquez sur « + Nouveau portefeuille » pour commencer à suivre
            vos positions BRVM.
          </p>
        </div>
      )}

      {portfolios.map((p) => {
        const tradeBundle = tradesByPortfolio[p.id];
        const summary = tradeBundle?.summary ?? {
          totalRealizedPnl: 0,
          salesCount: 0,
          lossCount: 0,
          gainCount: 0,
        };

        return (
          <div key={p.id} id={`portfolio-${p.id}`} style={panelStyle}>
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
              <PortfolioManageBar portfolioId={p.id} name={p.name} onChanged={reloadFromApi} />
            </div>

            <PortfolioExcelIO portfolioId={p.id} portfolioName={p.name} />

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              <Kpi
                label="Total du portefeuille"
                value={fmtFcfaOrMasked(p.metrics.totalMarketValue, hidePortfolioTotal)}
                educationSlug="valeur-de-marche"
                hint={
                  hidePortfolioTotal
                    ? "Montant masqué"
                    : p.metrics.marketPricesAsOfLabel !== "N/D"
                      ? p.metrics.marketPricesAsOfLabel
                      : "Cours : N/D"
                }
              />
              <Kpi
                label="Plus/moins-value latente"
                value={formatGainKpi(
                  p.metrics.totalGainLoss,
                  p.metrics.totalGainLossPercent,
                  hideGainAmt,
                  hideGainPct
                )}
                color={
                  p.metrics.totalGainLossPercent !== "N/D" && p.metrics.totalGainLossPercent >= 0
                    ? C.green
                    : p.metrics.totalGainLossPercent !== "N/D"
                      ? C.red
                      : p.metrics.totalGainLoss >= 0
                        ? C.green
                        : C.red
                }
                educationSlug="plus-moins-value-latente"
                hint={
                  hideGainAmt && hideGainPct
                    ? "Montants masqués"
                    : hideGainAmt
                      ? "Montant FCFA masqué — % visible"
                      : hideGainPct
                        ? "% masqué — montant FCFA visible"
                        : p.metrics.marketPricesAsOfLabel !== "N/D"
                          ? `${p.metrics.marketPricesAsOfLabel} vs PRU`
                          : "Cours : N/D vs PRU"
                }
              />
              <Kpi
                label="P&L réalisé (ventes)"
                value={
                  hideRealized
                    ? DISCRETE_AMOUNT_LABEL
                    : `${summary.totalRealizedPnl >= 0 ? "+" : ""}${fmtFcfa(summary.totalRealizedPnl)}`
                }
                color={summary.totalRealizedPnl >= 0 ? C.green : C.red}
                hint={`${summary.salesCount} vente(s) · ${summary.lossCount} perte(s) · ${summary.gainCount} gain(s)`}
              />
              <Kpi
                label="Performance YTD"
                value={p.metrics.ytdChangePercent !== "N/D" ? `${p.metrics.ytdChangePercent}%` : "N/D"}
                color={C.teal}
                educationSlug="performance-ytd"
                hint="vs dernier cours avant le 1er janvier"
              />
              <Kpi label="Lignes ouvertes" value={String(p.holdings.length)} />
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                margin: "10px 0 4px",
                fontSize: "0.78rem",
              }}
            >
              <span style={{ color: C.textDim }}>Conseils analyse :</span>
              <span style={{ color: C.green, fontWeight: 700 }}>{p.adviceRecap.reinforce} à renforcer</span>
              <span style={{ color: C.gold, fontWeight: 700 }}>{p.adviceRecap.hold} à conserver</span>
              <span style={{ color: C.red, fontWeight: 700 }}>{p.adviceRecap.exit} à sortir / alléger</span>
            </div>

            <PortfolioNavChart series={p.navSeries} titleSlug="evolution-portefeuille" discrete={hideNav} />

            <div style={allocationLayoutRow}>
              <div style={allocationSectorsCol}>
                <AllocationBars items={p.metrics.sectorBreakdown} />
              </div>
              <div style={allocationTickersCol}>
                <PortfolioAllocationChart items={p.metrics.tickerBreakdown} discrete={hideAlloc} />
              </div>
            </div>

            {p.holdings.length > 0 ? (
              <PortfolioHoldingsTable
                portfolioId={p.id}
                holdings={p.metrics.holdings}
                latestQuoteLabel={p.metrics.marketPricesAsOfLabel}
                discrete={discrete}
                masks={masks}
              />
            ) : (
              <p style={{ color: C.textDim, fontSize: "0.82rem", marginTop: 16 }}>
                Aucune position pour l&apos;instant — ajoutez-en une ci-dessous.
              </p>
            )}

            <PortfolioTradesHistory
              portfolioId={p.id}
              initialTrades={tradeBundle?.trades ?? []}
              initialSummary={summary}
              discrete={discrete}
              masks={masks}
            />

            <AddHoldingForm portfolioId={p.id} tickers={tickers} />
          </div>
        );
      })}
    </div>
  );
}
