// Page racine — étape 10 (navigation complète) : devient la LANDING PAGE
// publique (exception scoped, cf. .cursor/rules/brvm-non-negotiable.mdc).
// L'ancien contenu de ce fichier (dashboard `BrvmDashboardClient`) est
// déplacé TEL QUEL vers `app/marche/page.tsx` — aucune modification du
// composant dashboard lui-même (contrainte non-négociable).
import { getCompaniesFullDataset } from "@/lib/api/companies-full-dataset";
import { computeMarketSummaryStats, topScoredCompanies } from "@/lib/calc/market-summary-stats";
import { EDUCATION_TERMS } from "@/lib/education/catalog";
import LandingPage from "@/components/landing/LandingPage";
import AppHeader from "@/components/AppHeader";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "OuestBourse — Marché, graphes et signaux BRVM",
  description:
    "Plateforme d'analyse de la BRVM : marché, screener, graphes techniques, fiches sociétés, portefeuille et lexique — données sourcées BRVM / Sikafinance / Richbourse.",
};

export default async function LandingRoute() {
  const dataset = await getCompaniesFullDataset();
  const stats = computeMarketSummaryStats(dataset);
  const topCompanies = topScoredCompanies(dataset, 4);
  const sectorsCount = new Set(dataset.companies.map((c) => c.sector).filter(Boolean)).size;

  return (
    <AppHeader>
      <LandingPage
        stats={stats}
        topCompanies={topCompanies}
        sectorsCount={sectorsCount}
        educationTermsCount={EDUCATION_TERMS.length}
      />
    </AppHeader>
  );
}
