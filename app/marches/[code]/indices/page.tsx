import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import ComingSoonMarketPanel from "@/components/marche/ComingSoonMarketPanel";
import { comingSoonExchanges, parseComingSoonMarketSlug } from "@/lib/markets/nav-structure";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return comingSoonExchanges().map((exchange) => ({
    code: exchange.code.toLowerCase(),
  }));
}

export function generateMetadata({ params }: { params: { code: string } }) {
  const exchange = parseComingSoonMarketSlug(params.code);
  if (!exchange) {
    return { title: "Indices — OuestBourse" };
  }
  return {
    title: `Indices ${exchange.shortLabel} — bientôt — OuestBourse`,
    description: `Indices de ${exchange.shortLabel} : couverture en cours. Consultez les indices BRVM en attendant.`,
  };
}

export default function ComingSoonMarketIndicesPage({ params }: { params: { code: string } }) {
  const exchange = parseComingSoonMarketSlug(params.code);
  if (!exchange) notFound();

  return (
    <AppHeader>
      <ComingSoonMarketPanel exchange={exchange} topic="indices" />
      <SiteFooter />
    </AppHeader>
  );
}
