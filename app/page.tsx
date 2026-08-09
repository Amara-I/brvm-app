// Page racine — étape 8 du plan de migration.
// Server Component : récupère le jeu de données initial DIRECTEMENT via
// `getCompaniesFullDataset()` (aucun aller-retour HTTP superflu sur le
// premier rendu) puis le transmet au dashboard client, qui gère ensuite
// lui-même les rafraîchissements via `GET /api/companies/full` et l'export
// via `GET /api/export/excel`.
import { getCompaniesFullDataset } from "@/lib/api/companies-full-dataset";
import BrvmDashboardClient from "@/components/BrvmDashboardClient";

// Toujours resservir les données les plus fraîches disponibles en base (les
// KPIs et classements dépendent directement de l'état courant de l'ingestion).
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const dataset = await getCompaniesFullDataset();
  return <BrvmDashboardClient initialData={dataset} />;
}
