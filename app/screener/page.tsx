import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
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
      <div className="ob-page">
        <PageHeader
          kicker="BRVM · UEMOA"
          title="Screener"
          lead={
            <>
              Filtrez les {companies.length} sociétés cotées par rentabilité, dividendes, croissance, valorisation ou
              solidité — puis affinez par secteur et pays. Cliquez un ticker pour ouvrir sa fiche détaillée.
            </>
          }
        />
        {companies.length > 0 ? (
          <ScreenerTable companies={companies} />
        ) : (
          <EmptyState
            title="Aucune société disponible"
            body="Les données de marché n’ont pas encore été chargées. Les champs vides s’affichent N/D — aucun cours n’est inventé."
          />
        )}
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
