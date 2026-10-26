import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import ComingSoonMarketPanel from "@/components/marche/ComingSoonMarketPanel";
import { getI18n } from "@/lib/i18n/get-i18n";
import { comingSoonExchanges, parseComingSoonMarketSlug } from "@/lib/markets/nav-structure";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return comingSoonExchanges().map((exchange) => ({
    code: exchange.code.toLowerCase(),
  }));
}

export function generateMetadata({ params }: { params: { code: string } }) {
  const { t } = getI18n();
  const exchange = parseComingSoonMarketSlug(params.code);
  if (!exchange) {
    return { title: t("market.comingSoon.indicesFallbackTitle") };
  }
  return {
    title: t("market.comingSoon.indicesMetaTitle", { market: exchange.shortLabel }),
    description: t("market.comingSoon.indicesMetaDescription", { market: exchange.shortLabel }),
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
