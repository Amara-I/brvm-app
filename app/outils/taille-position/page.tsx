import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import PositionSizeCalculator from "@/components/outils/PositionSizeCalculator";
import PageHeader from "@/components/ui/PageHeader";
import { getCompaniesFullDataset } from "@/lib/api/companies-full-dataset";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { latestPositivePrice } from "@/lib/calc/position-size";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Taille de position — OuestBourse",
  description:
    "Calculez la quantité d’actions BRVM selon votre capital, un taux de perte acceptable et un stop. Outil pédagogique gratuit.",
};

export default async function PositionSizePage({
  searchParams,
}: {
  searchParams?: { ticker?: string; example?: string };
}) {
  const [dataset, userId] = await Promise.all([
    getCompaniesFullDataset(),
    getCurrentUserId().catch(() => null),
  ]);

  const tickers = dataset.companies
    .map((c) => ({
      ticker: c.ticker,
      name: c.name,
      lastPrice: latestPositivePrice(c.prices),
    }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker, "fr"));

  const example = searchParams?.example === "sogb" || searchParams?.example === "1";

  return (
    <AppHeader>
      <div className="ob-page">
        <PageHeader
          kicker="Outil · gratuit"
          title="Taille de position"
          lead="Dimensionnez une position BRVM : capital, taux de perte acceptable, prix d’entrée et stop. La quantité = (capital × taux %) / (entrée − stop). Pas un conseil d’investissement."
        />
        <PositionSizeCalculator
          tickers={tickers}
          isAuthenticated={Boolean(userId)}
          initialTicker={searchParams?.ticker}
          loadExample={example}
        />
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
