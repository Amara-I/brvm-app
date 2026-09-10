// Page "Screener" — étape 10 (navigation complète).
// Filtres rapides façon Ouestbourse (brief initial du projet, jamais livré
// avant cette étape) : Rentabilité / Dividendes / Croissance / Valorisation.
import AppHeader from "@/components/AppHeader";
import { C } from "@/lib/theme/colors";
import { PAGE_LEAD, PAGE_TITLE } from "@/lib/theme/typography";
import { getCompaniesFullDataset } from "@/lib/api/companies-full-dataset";
import { getMarketSparkSeriesByTicker } from "@/lib/api/market-spark-series";
import { allCompaniesWithMetrics } from "@/lib/calc/market-summary-stats";
import ScreenerTable from "@/components/screener/ScreenerTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Screener — OuestBourse",
  description: "Filtrez les sociétés cotées à la BRVM par rentabilité, dividendes, croissance ou valorisation.",
};

export default async function ScreenerPage() {
  const [dataset, sparkSeries] = await Promise.all([
    getCompaniesFullDataset(),
    getMarketSparkSeriesByTicker().catch(() => ({})),
  ]);
  const companies = allCompaniesWithMetrics(dataset, sparkSeries);

  return (
    <AppHeader>
      <div>
        <h1 style={PAGE_TITLE}>Screener</h1>
        <p style={PAGE_LEAD}>
          Filtrez les {companies.length} sociétés cotées par rentabilité, dividendes, croissance, valorisation ou solidité —
          puis affinez par secteur et pays. Cliquez un ticker pour ouvrir sa fiche détaillée.
        </p>
        {companies.length > 0 ? (
          <ScreenerTable companies={companies} />
        ) : (
          <p style={{ color: C.textDim }}>Aucune société disponible pour l&apos;instant.</p>
        )}
      </div>
    </AppHeader>
  );
}
