import Link from "next/link";
import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { translateDataSourceLabel } from "@/components/marche/market-copy";
import NgxChart from "@/components/ngx/NgxChart";
import { ngxBoardLabel, ngxSectorLabel } from "@/components/ngx/ngx-labels";
import styles from "@/components/ngx/NgxMarket.module.css";
import ChangeValue from "@/components/ui/ChangeValue";
import PageHeader from "@/components/ui/PageHeader";
import { getI18n } from "@/lib/i18n/get-i18n";
import { loadNgxCompany } from "@/lib/markets/ngx-browse";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { ticker: string } }) {
  const { t } = getI18n();
  const company = await loadNgxCompany(params.ticker).catch(() => null);
  if (!company) return { title: t("ngx.market.metaTitle") };
  return {
    title: t("ngx.company.metaTitle", { name: company.name, ticker: company.ticker }),
    description: t("ngx.company.metaDescription", { name: company.name, ticker: company.ticker }),
  };
}

export default async function NgxCompanyPage({ params }: { params: { ticker: string } }) {
  const { t, format } = getI18n();
  const company = await loadNgxCompany(params.ticker).catch(() => null);
  if (!company) notFound();
  const session = company.sessionDate
    ? format.date(`${company.sessionDate}T00:00:00.000Z`, {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : "N/D";

  return (
    <AppHeader>
      <div className="ob-page">
        <p>
          <Link className={styles.back} href="/marches/ngx">
            ← {t("ngx.company.back")}
          </Link>
        </p>
        <PageHeader
          kicker={`${company.ticker} · ${ngxSectorLabel(company.sectorSlug, company.sectorName, t)}`}
          title={company.name}
          lead={t("ngx.market.sourceLine", { source: translateDataSourceLabel(company.sourceLabel, t) })}
        />
        <div className={styles.hero}>
          <div>
            <span className={styles.sub}>{t("ngx.company.price")}</span>
            <div className={styles.heroPrice}>{company.close == null ? "N/D" : format.money(company.close, "NGN")}</div>
            <ChangeValue value={company.changePercent} />
          </div>
          <div>
            <span className={styles.sub}>{t("ngx.company.indicative")}</span>
            <div className={styles.heroPrice} style={{ fontSize: "1.4rem" }}>
              {company.indicativeFcfa == null ? "N/D" : format.money(company.indicativeFcfa, "XOF")}
            </div>
            <p className={styles.note}>{company.fx ? t("ngx.market.attribution") : t("ngx.company.indicativeMissing")}</p>
          </div>
        </div>
        <div className={styles.metaGrid}>
          <div className={styles.kpi}>
            <span>{t("ngx.company.previous")}</span>
            <strong style={{ fontSize: "1rem" }}>
              {company.previousClose == null ? "N/D" : format.money(company.previousClose, "NGN")}
            </strong>
          </div>
          <div className={styles.kpi}>
            <span>{t("ngx.company.volume")}</span>
            <strong style={{ fontSize: "1rem" }}>
              {company.volume == null ? "N/D" : format.integer(company.volume)}
            </strong>
          </div>
          <div className={styles.kpi}>
            <span>{t("ngx.company.session")}</span>
            <strong style={{ fontSize: "1rem" }}>{session}</strong>
          </div>
          <div className={styles.kpi}>
            <span>{t("ngx.company.board")}</span>
            <strong style={{ fontSize: "1rem" }}>{ngxBoardLabel(company.board, t)}</strong>
          </div>
        </div>
        <h2 className={styles.sectionTitle}>{t("ngx.company.chartTitle")}</h2>
        {company.series.length > 1 ? (
          <NgxChart storageKey={`NGX:${company.ticker}`} series={company.series} />
        ) : (
          <p className={styles.note}>{t("ngx.company.chartEmpty")}</p>
        )}
        <p className={styles.note}>{t("ngx.company.chartNote")}</p>
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
