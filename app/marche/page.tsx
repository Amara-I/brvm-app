// Page "Marché" — étape 10 (navigation complète).
// Contenu IDENTIQUE à l'ancien `app/page.tsx` (étape 8) : le dashboard
// `BrvmDashboardClient` n'est PAS modifié (contrainte non-négociable), il est
// simplement servi depuis `/marche` désormais, enveloppé par le nouveau
// `AppHeader` (nav sombre/or additive, cf. AGENTS.md § Étape 10).
import { getCompaniesFullDataset } from "@/lib/api/companies-full-dataset";
import BrvmDashboardClient from "@/components/BrvmDashboardClient";
import AppHeader from "@/components/AppHeader";

// Toujours resservir les données les plus fraîches disponibles en base (les
// KPIs et classements dépendent directement de l'état courant de l'ingestion).
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Marché — ouestBourse",
  description: "Analyse financière des sociétés cotées à la BRVM : cours, dividendes, projections et signaux.",
};

export default async function MarchePage() {
  const dataset = await getCompaniesFullDataset();
  return (
    <>
      <AppHeader />
      <BrvmDashboardClient initialData={dataset} />
    </>
  );
}
