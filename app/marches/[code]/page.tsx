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
    return { title: "Marché — OuestBourse" };
  }
  return {
    title: `${exchange.shortLabel} — bientôt — OuestBourse`,
    description: `Couverture en cours pour ${exchange.shortLabel}. Explorez la BRVM en attendant.`,
  };
}

export default function ComingSoonMarketPage({ params }: { params: { code: string } }) {
  const exchange = parseComingSoonMarketSlug(params.code);
  if (!exchange) notFound();

  return (
    <AppHeader>
      <ComingSoonMarketPanel exchange={exchange} />
      <SiteFooter />
    </AppHeader>
  );
}
