// Page Graphes premium — étape 17 (lightweight-charts / TradingView OSS).
import AppHeader from "@/components/AppHeader";
import ChartWorkbench from "@/components/charts/LazyChartWorkbench";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { getCompaniesFullDataset } from "@/lib/api/companies-full-dataset";
import { getCurrentUserId } from "@/lib/auth/get-current-user";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Graphes — OuestBourse",
  description: "Analyse graphique BRVM façon trading : historique, moyennes mobiles, comparaison multi-titres.",
};

export default async function GraphesPage({
  searchParams,
}: {
  searchParams?: { ticker?: string };
}) {
  const dataset = await getCompaniesFullDataset();
  const universe = dataset.companies.map((c) => ({
    ticker: c.ticker,
    name: c.name,
    color: c.color,
    sector: c.sector,
    countryFlag: c.countryFlag,
  }));

  const requested = searchParams?.ticker?.toUpperCase();
  const initialTicker =
    (requested && universe.some((u) => u.ticker === requested) && requested) ||
    (universe.some((u) => u.ticker === "ABJC") ? "ABJC" : null) ||
    (universe.some((u) => u.ticker === "SNTS") ? "SNTS" : universe[0]?.ticker ?? "SNTS");

  const userId = await getCurrentUserId().catch(() => null);

  return (
    <AppHeader>
      <div className="ob-page">
        <PageHeader
          kicker="Analyse technique"
          title="Graphes"
          lead="Analyse graphique des titres BRVM — indicateurs, tracés et comparaison multi-titres."
        />

        {universe.length === 0 ? (
          <EmptyState
            title="Aucune société disponible"
            body="Le graphique s’affichera dès que des titres seront chargés. En l’absence de série, l’interface indique N/D."
          />
        ) : (
          <ChartWorkbench universe={universe} initialTicker={initialTicker} isAuthenticated={Boolean(userId)} />
        )}
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
