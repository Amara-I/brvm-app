// Page "Screener" — étape 10 (navigation complète).
// Filtres rapides façon Ouestbourse (brief initial du projet, jamais livré
// avant cette étape) : Rentabilité / Dividendes / Croissance / Valorisation.
import AppHeader from "@/components/AppHeader";
import { C } from "@/lib/theme/colors";
import { getCompaniesFullDataset } from "@/lib/api/companies-full-dataset";
import { allCompaniesWithMetrics } from "@/lib/calc/market-summary-stats";
import ScreenerTable from "@/components/screener/ScreenerTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Screener — BRVM App",
  description: "Filtrez les sociétés cotées à la BRVM par rentabilité, dividendes, croissance ou valorisation.",
};

export default async function ScreenerPage() {
  const dataset = await getCompaniesFullDataset();
  const companies = allCompaniesWithMetrics(dataset);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Trebuchet MS', Georgia, serif" }}>
      <AppHeader />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px" }}>
        <h1 style={{ color: C.text, fontSize: "1.4rem", marginBottom: 4 }}>🔍 Screener</h1>
        <p style={{ color: C.textDim, fontSize: "0.85rem", marginBottom: 24 }}>
          Filtrez rapidement les {companies.length} sociétés cotées par angle d&apos;analyse. Les métriques utilisent le même moteur
          de calcul que l&apos;onglet « Vue d&apos;ensemble » et l&apos;export Excel.
        </p>
        {companies.length > 0 ? (
          <ScreenerTable companies={companies} />
        ) : (
          <p style={{ color: C.textDim }}>Aucune société disponible pour l&apos;instant.</p>
        )}
      </div>
    </div>
  );
}
