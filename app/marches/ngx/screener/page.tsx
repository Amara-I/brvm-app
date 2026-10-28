import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { ngxSectorLabel } from "@/components/ngx/ngx-labels";
import NgxScreenerTable, { type NgxScreenerTableRow } from "@/components/ngx/NgxScreenerTable";
import local from "@/components/ngx/NgxScreener.module.css";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { getI18n } from "@/lib/i18n/get-i18n";
import { localizedTypeDef } from "@/lib/i18n/portfolio-type-copy";
import { loadNgxScreener } from "@/lib/markets/ngx-screener";
import { getPortfolioTypeDef } from "@/lib/portfolio-types/catalog";
import { PORTFOLIO_TYPE_IDS, type PortfolioTypeId } from "@/lib/portfolio-types/constants";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  const { t } = getI18n();
  return { title: t("ngx.screener.metaTitle"), description: t("ngx.screener.metaDescription") };
}

export default async function NgxScreenerPage() {
  const { t, locale, format } = getI18n();
  const data = await loadNgxScreener().catch(() => null);
  const rows: NgxScreenerTableRow[] = (data?.rows ?? []).map((r) => ({
    ...r,
    sectorLabel: ngxSectorLabel(r.sectorSlug, r.sectorName, t),
  }));
  const policyLabels = Object.fromEntries(
    PORTFOLIO_TYPE_IDS.map((id) => [id, localizedTypeDef(getPortfolioTypeDef(id), locale).label]),
  ) as Record<PortfolioTypeId, string>;
  const cov = data?.coverage;

  return (
    <AppHeader>
      <div className="ob-page">
        <Link href="/marches/ngx" className={local.back}>
          ← {t("ngx.screener.back")}
        </Link>
        <PageHeader
          kicker={t("ngx.screener.kicker")}
          title={t("ngx.screener.title")}
          lead={
            cov
              ? t("ngx.screener.lead", {
                  fund: format.integer(cov.fundamentals),
                  total: format.integer(cov.total),
                })
              : t("ngx.screener.emptyBody")
          }
        />
        {rows.length > 0 && cov ? (
          <>
            <p className={local.coverage}>
              {t("ngx.screener.coverage", {
                full: format.integer(cov.full),
                partial: format.integer(cov.partial),
                chart: format.integer(cov.chartOnly),
                none: format.integer(cov.unscored),
              })}
            </p>
            <NgxScreenerTable rows={rows} policyLabels={policyLabels} />
            <p className={local.note}>{t("ngx.screener.method")}</p>
            <p className={local.disclaimer}>{t("ngx.screener.disclaimer")}</p>
          </>
        ) : (
          <EmptyState title={t("ngx.screener.emptyTitle")} body={t("ngx.screener.emptyBody")} />
        )}
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
