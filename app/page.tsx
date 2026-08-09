// Page racine — étape 10 (navigation complète) : devient la LANDING PAGE
// publique (exception scoped, cf. .cursor/rules/brvm-non-negotiable.mdc).
// L'ancien contenu de ce fichier (dashboard `BrvmDashboardClient`) est
// déplacé TEL QUEL vers `app/marche/page.tsx` — aucune modification du
// composant dashboard lui-même (contrainte non-négociable).
import { getCompaniesFullDataset } from "@/lib/api/companies-full-dataset";
import { computeMarketSummaryStats, topScoredCompanies } from "@/lib/calc/market-summary-stats";
import LandingPage from "@/components/landing/LandingPage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "BRVM App — Toute l'intelligence de marché de la BRVM",
  description:
    "Données tracées et sourcées, analyses avancées et suivi de portefeuille pour les sociétés cotées à la BRVM (Bourse Régionale des Valeurs Mobilières).",
};

export default async function LandingRoute() {
  const dataset = await getCompaniesFullDataset();
  const stats = computeMarketSummaryStats(dataset);
  const topCompanies = topScoredCompanies(dataset, 4);

  return <LandingPage stats={stats} topCompanies={topCompanies} />;
}
