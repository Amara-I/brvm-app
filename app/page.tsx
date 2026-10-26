// Page racine — étape 10 (navigation complète) : devient la LANDING PAGE
// publique (exception scoped, cf. .cursor/rules/brvm-non-negotiable.mdc).
// L'ancien contenu de ce fichier (dashboard `BrvmDashboardClient`) est
// déplacé TEL QUEL vers `app/marche/page.tsx` — aucune modification du
// composant dashboard lui-même (contrainte non-négociable).
import type { Viewport } from "next";
import { getCompaniesFullDataset } from "@/lib/api/companies-full-dataset";
import { computeMarketSummaryStats, topScoredCompanies } from "@/lib/calc/market-summary-stats";
import { EDUCATION_TERMS } from "@/lib/education/catalog";
import { averageYearlySeries } from "@/lib/landing/price-series";
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
  const dataset = await getCompaniesFullDataset();
  const stats = computeMarketSummaryStats(dataset);
  const topCompanies = topScoredCompanies(dataset, 4);
  const sectorsCount = new Set(dataset.companies.map((c) => c.sector).filter(Boolean)).size;

  return (
    <LandingChrome>
      <LandingPage
        stats={stats}
        topCompanies={topCompanies}
        sectorsCount={sectorsCount}
        educationTermsCount={EDUCATION_TERMS.length}
        marketSeries={averageYearlySeries(dataset.companies, dataset.years)}
      />
    </LandingChrome>
  );
}
