"use client";

// Vue d'ensemble NGX : même en-tête et mêmes mécaniques d'actualisation que la BRVM
// (components/marche/MarketBoardClient.tsx) — bouton « Actualiser les cours »,
// relecture au plus toutes les 10 minutes (onglet visible, y compris au retour), données relues en base
// sans re-scraper. L'ingestion officielle est déclenchée par le bouton et par
// le cron quotidien /api/cron/ingest.

import { useCallback, useRef, useState } from "react";
import MarketChrome from "@/components/marche/MarketChrome";
import styles from "@/components/marche/MarketBoard.module.css";
import ngxStyles from "@/components/ngx/NgxMarket.module.css";
import NgxMarketBoard from "@/components/ngx/NgxMarketBoard";
import type { NgxBoardRow } from "@/lib/markets/ngx-board-row";
import EmptyState from "@/components/ui/EmptyState";
import { useI18n } from "@/components/i18n/I18nProvider";
import { translateDataSourceLabel } from "@/components/marche/market-copy";
import { getExchange } from "@/lib/markets/african-exchanges";
import {
  formatNgxAvgYield,
  type NgxMarketKpis,
  type NgxOverviewBoardPayload,
} from "@/lib/markets/ngx-overview-board";
import type { MarketIndexSnapshot } from "@/lib/api/market-summary-snapshot";
import { preserveScrollDuring } from "@/lib/ui/scroll-restoration";
import { useThrottledPoll } from "@/lib/ui/use-throttled-poll";
import { useLiveQuotes } from "@/lib/ui/use-live-quotes";
import type { LatestQuote } from "@/lib/quotes/types";

const NUMERIC_DATE: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
};

function formatSessionDate(
  sessionDate: string | null,
  format: { date: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string }
): string {
  if (!sessionDate) return "N/D";
  return format.date(`${sessionDate}T00:00:00.000Z`, NUMERIC_DATE);
}

export interface NgxOverviewClientProps {
  initial: NgxOverviewBoardPayload;
}

export default function NgxOverviewClient({ initial }: NgxOverviewClientProps) {
  const { t, format } = useI18n();
  const exchange = getExchange("NGX");
  const [rows, setRows] = useState<NgxBoardRow[]>(initial.rows);
  const [kpis, setKpis] = useState<NgxMarketKpis>(initial.kpis);
  const [indices, setIndices] = useState<MarketIndexSnapshot[]>(initial.indices);
  const [sourceLabel, setSourceLabel] = useState(initial.sourceLabel);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(() => formatSessionDate(initial.sessionDate, format));

  const applyPayload = useCallback(
    (payload: NgxOverviewBoardPayload) => {
      setRows(payload.rows);
      setKpis(payload.kpis);
      setIndices(payload.indices);
      setSourceLabel(payload.sourceLabel);
      setLastUpdate(formatSessionDate(payload.sessionDate, format));
    },
    [format]
  );

  const reloadFromDb = useCallback(async () => {
    await preserveScrollDuring(async () => {
      try {
        const res = await fetch("/api/market/ngx-board", { cache: "no-store" });
        const json = await res.json();
        if (json.ok && json.data) {
          applyPayload(json.data as NgxOverviewBoardPayload);
        }
      } catch {
        // best-effort : le prochain cycle ou Actualiser suffira
      }
    });
  }, [applyPayload]);

  // Relecture douce : au plus toutes les 10 min, onglet visible uniquement
  // (le cron quotidien et « Actualiser les cours » apportent les nouveaux cours).
  const markFresh = useThrottledPoll(reloadFromDb);

  // Derniers cours live NGX (09:30–14:30 heure de Lagos : 60 s), mêmes lignes que
  // les notifications : seuls le cours, la variation et la date de séance changent.
  const sessionRef = useRef<string | null>(initial.sessionDate);
  const onLiveQuotes = useCallback(
    (changed: LatestQuote[]) => {
      const byTicker = new Map(changed.map((q) => [q.ticker, q]));
      setRows((prev) => {
        let dirty = false;
        const next = prev.map((row) => {
          const q = byTicker.get(row.ticker);
          if (!q || !(q.close > 0)) return row;
          if (row.close === q.close && row.changePercent === q.changePercent) return row;
          dirty = true;
          const fcfa = row.fcfa != null && row.close ? (row.fcfa / row.close) * q.close : row.fcfa;
          return { ...row, close: q.close, changePercent: q.changePercent, fcfa };
        });
        return dirty ? next : prev;
      });
      const newest = changed.reduce((max, q) => (q.date > max ? q.date : max), "");
      if (newest && (!sessionRef.current || newest > sessionRef.current)) {
        sessionRef.current = newest;
        setLastUpdate(formatSessionDate(newest, format));
      }
    },
    [format]
  );
  useLiveQuotes({ market: "NGX", onChange: onLiveQuotes });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await preserveScrollDuring(async () => {
        const res = await fetch("/api/market/refresh-ngx-quotes", { method: "POST", cache: "no-store" });
        const json = await res.json();
        if (json.ok && json.data) {
          applyPayload(json.data as NgxOverviewBoardPayload);
          markFresh();
        }
      });
    } finally {
      setRefreshing(false);
    }
  }, [applyPayload, markFresh]);

  return (
    <div className={styles.page} data-testid="ngx-overview">
      <MarketChrome
        lastUpdate={lastUpdate}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        companiesCount={kpis.listed}
        totalMktCap={kpis.totalCapBn ?? 0}
        buySignals={kpis.buySignals}
        avgYield={formatNgxAvgYield(kpis.avgYieldPercent)}
        indexPills={indices}
        currency={exchange.currency}
        capCurrency="₦"
        currencyLabel={t("market.exchange.ngxCurrency")}
        exchangeCode={exchange.code}
        exchangeName={exchange.name}
        region={exchange.region}
        indexHref={(code) => `/marches/ngx/indices/${code}`}
        indicesFallbackHref="/marches/ngx/indices"
      />

      {rows.length === 0 ? (
        <EmptyState title={t("ngx.market.emptyTitle")} body={t("ngx.market.emptyBody")} />
      ) : (
        <NgxMarketBoard rows={rows} />
      )}

      <p className={ngxStyles.attribution}>
        {t("ngx.market.attribution")}{" "}
        {sourceLabel ? t("ngx.market.sourceLine", { source: translateDataSourceLabel(sourceLabel, t) }) : ""}
      </p>
    </div>
  );
}
