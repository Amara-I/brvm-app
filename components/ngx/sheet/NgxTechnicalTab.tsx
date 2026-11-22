"use client";

// Onglet Analyse Graphique de la fiche NGX : le même workbench et le même panneau
// d'analyse technique que la BRVM, avec les niveaux et les prix en naira (₦).

import { useCallback, useMemo, useState } from "react";
import LazyChartWorkbench from "@/components/charts/LazyChartWorkbench";
import type { ChartUniverseItem } from "@/components/charts/ChartWorkbench";
import TechnicalAnalysisPanel from "@/components/actions/TechnicalAnalysisPanel";
import LockedTeaser from "@/components/entitlements/LockedTeaser";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { ChartClosePoint } from "@/lib/charts/indicators";
import { analyzePriceHistory } from "@/lib/technical-analysis/analyze";
import { chartLevelLines } from "@/lib/technical-analysis/chart-lines";
import type { TechnicalAnalysis } from "@/lib/technical-analysis/types";
import styles from "@/components/actions/CompanySheet.module.css";

export default function NgxTechnicalTab({
  symbol,
  universe,
  isAuthenticated,
  gatedVisitor = false,
  initialAnalysis,
  qualityScore,
}: {
  symbol: string;
  universe: ChartUniverseItem[];
  isAuthenticated: boolean;
  gatedVisitor?: boolean;
  initialAnalysis: TechnicalAnalysis;
  /** Note NGX /100 (inchangée). null = N/D. */
  qualityScore: number | null;
}) {
  const { t, locale } = useI18n();
  const [analysis, setAnalysis] = useState<TechnicalAnalysis>(initialAnalysis);
  const levelLines = useMemo(() => chartLevelLines(analysis, locale === "en" ? "en" : "fr"), [analysis, locale]);
  const onActiveSeries = useCallback(
    (ticker: string, points: ChartClosePoint[]) => {
      const last = points[points.length - 1];
      const same =
        ticker === symbol &&
        last != null &&
        initialAnalysis.structure.asOf === last.time.slice(0, 10) &&
        initialAnalysis.structure.lastClose === last.value;
      if (same) {
        setAnalysis(initialAnalysis);
        return;
      }
      if (points.length === 0) return;
      setAnalysis(analyzePriceHistory(points, { currency: "NGN" }));
    },
    [symbol, initialAnalysis],
  );
  return (
    <div className={styles.chartWorkbenchWrap}>
      <LazyChartWorkbench
        market="NGX"
        universe={universe}
        initialTicker={symbol}
        embedded
        isAuthenticated={isAuthenticated}
        gatedVisitor={gatedVisitor}
        levelLines={gatedVisitor ? undefined : levelLines}
        onActiveSeries={onActiveSeries}
      />
      {gatedVisitor ? (
        <LockedTeaser body={t("entitlements.scenarios")} />
      ) : (
        <TechnicalAnalysisPanel analysis={analysis} qualityScore={qualityScore} />
      )}
    </div>
  );
}
