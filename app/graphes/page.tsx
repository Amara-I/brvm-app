// Page Graphes premium — étape 17 (lightweight-charts / TradingView OSS).
import AppHeader from "@/components/AppHeader";
import ChartWorkbench from "@/components/charts/ChartWorkbench";
import { getCompaniesFullDataset } from "@/lib/api/companies-full-dataset";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { C } from "@/lib/theme/colors";
import { PAGE_LEAD, PAGE_TITLE } from "@/lib/theme/typography";

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
      <div>
        <h1 style={PAGE_TITLE}>Graphes</h1>
        <p style={{ ...PAGE_LEAD, marginBottom: 18 }}>
          Analyse graphique des titres BRVM — indicateurs, tracés et comparaison multi-titres.
        </p>

        {universe.length === 0 ? (
          <p style={{ color: C.textDim }}>Aucune société disponible pour l&apos;instant.</p>
        ) : (
          <div data-align-left>
            <ChartWorkbench
              universe={universe}
              initialTicker={initialTicker}
              isAuthenticated={Boolean(userId)}
            />
          </div>
        )}
      </div>
    </AppHeader>
  );
}
