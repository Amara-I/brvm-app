import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import IndexList from "@/components/indices/IndexList";
import styles from "@/components/ngx/NgxMarket.module.css";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { getMarketIndexList } from "@/lib/api/market-indices";
import { getI18n } from "@/lib/i18n/get-i18n";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  const { t } = getI18n();
  return { title: t("ngx.indices.metaTitle"), description: t("ngx.indices.metaDescription") };
}

export default async function NgxIndicesPage() {
  const { t } = getI18n();
  const items = await getMarketIndexList("NGX").catch(() => []);

  return (
    <AppHeader>
      <div className="ob-page">
        <p>
          <a className={styles.back} href="/marches/ngx">
            ← {t("ngx.indices.back")}
          </a>
        </p>
        <PageHeader kicker={t("ngx.indices.kicker")} title={t("ngx.indices.title")} lead={t("ngx.indices.lead")} />
        {items.length === 0 ? (
          <EmptyState title={t("ngx.indices.emptyTitle")} body={t("ngx.indices.emptyBody")} />
        ) : (
          <IndexList items={items} hrefFor={(code) => `/marches/ngx/indices/${code}`} />
        )}
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
