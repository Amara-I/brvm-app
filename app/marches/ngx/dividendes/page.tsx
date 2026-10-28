import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { ngxSectorLabel } from "@/components/ngx/ngx-labels";
import NgxDividendsTable from "@/components/ngx/NgxDividendsTable";
import local from "@/components/ngx/NgxDividends.module.css";
import styles from "@/components/ngx/NgxMarket.module.css";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { getI18n } from "@/lib/i18n/get-i18n";
import { loadNgxDividends, topYieldByCompany } from "@/lib/markets/ngx-dividends";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  const { t } = getI18n();
  return { title: t("ngx.dividends.metaTitle"), description: t("ngx.dividends.metaDescription") };
}

export default async function NgxDividendsPage() {
  const { t, format } = getI18n();
  const data = await loadNgxDividends();
  const sectorLabels = Object.fromEntries(data.sectors.map((s) => [s.slug, ngxSectorLabel(s.slug, s.name, t)]));
  const top = topYieldByCompany(data.rows);

  return (
    <AppHeader>
      <div className="ob-page">
        <Link href="/marches/ngx" className={local.back}>
          ← {t("ngx.dividends.back")}
        </Link>
        <PageHeader
          kicker={t("ngx.dividends.kicker")}
          title={t("ngx.dividends.title")}
          lead={t("ngx.dividends.lead")}
        />
        {data.rows.length > 0 ? (
          <>
            <div className={styles.kpis}>
              <div className={styles.kpi}>
                <span>{t("ngx.dividends.kpiPayers")}</span>
                <strong>{format.integer(data.companies)}</strong>
              </div>
              <div className={styles.kpi}>
                <span>{t("ngx.dividends.kpiRows")}</span>
                <strong>{format.integer(data.rows.length)}</strong>
              </div>
              <div className={styles.kpi}>
                <span>{t("ngx.dividends.kpiTopYield")}</span>
                <strong>
                  {top && top.yieldPercent != null
                    ? `${top.ticker} · ${format.percent(top.yieldPercent, 1)}`
                    : t("ngx.dividends.kpiTopYieldNone")}
                </strong>
              </div>
              <div className={styles.kpi}>
                <span>{t("ngx.dividends.fiscalYear")}</span>
                <strong>{data.years[0] ?? "N/D"}</strong>
              </div>
            </div>
            <NgxDividendsTable data={data} sectorLabels={sectorLabels} />
            <p className={local.note}>
              {t("ngx.dividends.note", { date: data.priceDate ?? "N/D" })}
            </p>
            <p className={local.disclaimer}>{t("ngx.dividends.disclaimer")}</p>
          </>
        ) : (
          <EmptyState title={t("ngx.dividends.emptyTitle")} body={t("ngx.dividends.emptyBody")} />
        )}
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
