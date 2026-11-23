// Page racine — étape 10 (navigation complète) : devient la LANDING PAGE
// publique (exception scoped, cf. .cursor/rules/brvm-non-negotiable.mdc).
// L'ancien contenu de ce fichier (dashboard `BrvmDashboardClient`) est
// déplacé TEL QUEL vers `app/marche/page.tsx` — aucune modification du
// composant dashboard lui-même (contrainte non-négociable).
import type { Viewport } from "next";
import { getCompaniesFullDataset } from "@/lib/api/companies-full-dataset";
import { getMarketSparkSeriesByTicker } from "@/lib/api/market-spark-series";
import { computeMarketSummaryStats, topScoredCompanies } from "@/lib/calc/market-summary-stats";
import { EDUCATION_TERMS } from "@/lib/education/catalog";
import { loadHeroIndexSeries } from "@/lib/landing/hero-index-series";
import { getLandingMarkets } from "@/lib/api/landing-markets";
import LandingPage from "@/components/landing/LandingPage";
import LandingChrome from "@/components/landing/LandingChrome";
import { getI18n } from "@/lib/i18n/get-i18n";
import { ANON_MAX_CHART_YEARS, getViewer } from "@/lib/entitlements";
import { BROWSER_CHROME_BG } from "@/lib/theme/browser-chrome";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: BROWSER_CHROME_BG.landing,
  viewportFit: "cover",
};

export function generateMetadata() {
  const { t } = getI18n();
  return {
    title: t("landing.metaTitle"),
    description: t("landing.metaDescription"),
  };
}

export default async function LandingRoute() {
  const [dataset, heroIndex, markets, sparkSeries, viewer] = await Promise.all([
    getCompaniesFullDataset(),
    loadHeroIndexSeries(),
    getLandingMarkets().catch(() => ([{ exchange: "BRVM" as const, count: null, index: null }, { exchange: "NGX" as const, count: null, index: null }])),
    getMarketSparkSeriesByTicker().catch(() => ({})),
    getViewer(),
  ]);
  const stats = computeMarketSummaryStats(dataset);
  const topCompanies = topScoredCompanies(dataset, viewer.gated ? 2 : 4, sparkSeries);
  let heroPoints = heroIndex?.points ?? null;
  if (viewer.gated && heroPoints && heroPoints.length > 0) {
    const last = heroPoints[heroPoints.length - 1]!.time;
    const cutoff = new Date(`${last}T00:00:00.000Z`);
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - ANON_MAX_CHART_YEARS);
    const cutoffIso = cutoff.toISOString().slice(0, 10);
    heroPoints = heroPoints.filter((p) => p.time >= cutoffIso);
  }
  const sectorsCount = new Set(dataset.companies.map((c) => c.sector).filter(Boolean)).size;

  // Date de la dernière clôture = séance la plus récente des cours en base
  // (les cours sont mis à jour une fois par jour, après la clôture).
  const closeDate =
    dataset.companies.reduce<string | null>((max, c) => (c.priceAsOf && (!max || c.priceAsOf > max) ? c.priceAsOf : max), null) ??
    heroIndex?.points[heroIndex.points.length - 1]?.time ??
    null;

  return (
    <LandingChrome>
      <LandingPage
        markets={markets}
        stats={viewer.gated ? { ...stats, buySignalsCount: 0 } : stats}
        topCompanies={topCompanies}
        sectorsCount={sectorsCount}
        educationTermsCount={EDUCATION_TERMS.length}
        heroSeries={heroPoints}
        closeDate={closeDate}
        gatedVisitor={viewer.gated}
      />
    </LandingChrome>
  );
}
