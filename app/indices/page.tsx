import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import IndexList from "@/components/indices/IndexList";
import PageHeader from "@/components/ui/PageHeader";
import { getMarketIndexList } from "@/lib/api/market-indices";
import { getI18n } from "@/lib/i18n/get-i18n";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  const { t } = getI18n();
  return {
    title: t("market.indices.metaTitle"),
    description: t("market.indices.metaDescription"),
  };
}

export default async function IndicesPage() {
  const { t } = getI18n();
  const items = await getMarketIndexList();
  const withLevel = items.filter((item) => item.lastValue != null).length;
  const countSentence =
    items.length > 0
      ? t(withLevel > 1 ? "market.indices.leadCountPlural" : "market.indices.leadCount", {
          count: withLevel,
        })
      : t("market.indices.leadNone");

  return (
    <AppHeader>
      <div className="ob-page">
        <PageHeader
          kicker={t("market.indices.kicker")}
          title={t("market.indices.title")}
          lead={
            <>
              {t("market.indices.leadPrefix")} {countSentence} {t("market.indices.leadSuffix")}
            </>
          }
        />
        <IndexList items={items} />
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
