// Page racine — étape 10 (navigation complète) : devient la LANDING PAGE
// publique (exception scoped, cf. .cursor/rules/brvm-non-negotiable.mdc).
// L'ancien contenu de ce fichier (dashboard `BrvmDashboardClient`) est
// déplacé TEL QUEL vers `app/marche/page.tsx` — aucune modification du
// composant dashboard lui-même (contrainte non-négociable).
import type { Viewport } from "next";
import { getCompaniesFullDataset } from "@/lib/api/companies-full-dataset";
import { computeMarketSummaryStats, topScoredCompanies } from "@/lib/calc/market-summary-stats";
import { EDUCATION_TERMS } from "@/lib/education/catalog";
import { loadHeroIndexSeries } from "@/lib/landing/hero-index-series";
import LandingPage from "@/components/landing/LandingPage";
import LandingChrome from "@/components/landing/LandingChrome";
import { getI18n } from "@/lib/i18n/get-i18n";
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
  const [dataset, heroIndex] = await Promise.all([getCompaniesFullDataset(), loadHeroIndexSeries()]);
  const stats = computeMarketSummaryStats(dataset);
  const topCompanies = topScoredCompanies(dataset, 4);
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
        stats={stats}
        topCompanies={topCompanies}
        sectorsCount={sectorsCount}
        educationTermsCount={EDUCATION_TERMS.length}
        heroSeries={heroIndex?.points ?? null}
        closeDate={closeDate}
      />
    </LandingChrome>
  );
}
