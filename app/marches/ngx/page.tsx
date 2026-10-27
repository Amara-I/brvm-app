import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import NgxShareTable from "@/components/ngx/NgxShareTable";
import { ngxBoardLabel, ngxSectorLabel } from "@/components/ngx/ngx-labels";
import styles from "@/components/ngx/NgxMarket.module.css";
import ChangeValue from "@/components/ui/ChangeValue";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { translateDataSourceLabel } from "@/components/marche/market-copy";
import { getI18n } from "@/lib/i18n/get-i18n";
import { loadNgxOverview } from "@/lib/markets/ngx-browse";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  const { t } = getI18n();
  return { title: t("ngx.market.metaTitle"), description: t("ngx.market.metaDescription") };
}

export default async function NgxMarketPage() {
  const { t, format } = getI18n();
  const overview = await loadNgxOverview().catch(() => null);
  const shares = overview?.shares ?? [];
  const session = overview?.sessionDate
    ? t("ngx.market.session", {
        date: format.date(`${overview.sessionDate}T00:00:00.000Z`, {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        }),
      })
    : t("ngx.market.sessionMissing");
  const top = overview?.gainers[0];

  return (
    <AppHeader>
      <div className="ob-page">
        <PageHeader kicker={t("ngx.market.kicker")} title={t("ngx.market.title")} lead={t("ngx.market.lead")} />
        <div className={styles.kpis}>
          <div className={styles.kpi}>
            <span>{t("ngx.market.kpiListed")}</span>
            <strong>{shares.length > 0 ? format.integer(shares.length) : "N/D"}</strong>
          </div>
          <div className={styles.kpi}>
            <span>{t("ngx.market.kpiAsi")}</span>
            <strong>{overview?.asi ? format.decimal(overview.asi.value, 2) : "N/D"}</strong>
            {overview?.asi ? <ChangeValue value={overview.asi.changePercent} /> : null}
          </div>
          <div className={styles.kpi}>
            <span>{t("ngx.market.kpiMovers")}</span>
            <strong>{top ? top.ticker : "N/D"}</strong>
            {top ? <ChangeValue value={top.changePercent} /> : null}
          </div>
          <div className={styles.kpi}>
            <span>{t("ngx.market.kpiSession")}</span>
            <strong style={{ fontSize: "1rem" }}>{session}</strong>
          </div>
        </div>

        {shares.length === 0 ? (
          <EmptyState title={t("ngx.market.emptyTitle")} body={t("ngx.market.emptyBody")} />
        ) : (
          <>
            <div className={styles.movers}>
              <section>
                <h2 className={styles.sectionTitle}>{t("ngx.market.gainers")}</h2>
                {overview && overview.gainers.length > 0 ? (
                  <ul className={styles.moverList}>
                    {overview.gainers.map((row) => (
                      <li key={row.ticker}>
                        <Link href={`/marches/ngx/actions/${row.ticker}`}>
                          <span>
                            {row.ticker}
                            <span className={styles.sub}>{row.name}</span>
                          </span>
                          <ChangeValue value={row.changePercent} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.note}>{t("ngx.market.noMovers")}</p>
                )}
              </section>
              <section>
                <h2 className={styles.sectionTitle}>{t("ngx.market.losers")}</h2>
                {overview && overview.losers.length > 0 ? (
                  <ul className={styles.moverList}>
                    {overview.losers.map((row) => (
                      <li key={row.ticker}>
                        <Link href={`/marches/ngx/actions/${row.ticker}`}>
                          <span>
                            {row.ticker}
                            <span className={styles.sub}>{row.name}</span>
                          </span>
                          <ChangeValue value={row.changePercent} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.note}>{t("ngx.market.noMovers")}</p>
                )}
              </section>
            </div>
            <NgxShareTable
              rows={shares.map((row) => ({
                ticker: row.ticker,
                name: row.name,
                sectorSlug: row.sectorSlug,
                sectorLabel: ngxSectorLabel(row.sectorSlug, row.sectorName, t),
                boardLabel: ngxBoardLabel(row.board, t),
                closeLabel: row.close == null ? "N/D" : format.money(row.close, "NGN"),
                fcfaLabel: row.indicativeFcfa == null ? "N/D" : format.money(row.indicativeFcfa, "XOF"),
                changePercent: row.changePercent,
              }))}
              sectors={(overview?.sectors ?? []).map((sector) => ({
                slug: sector.slug,
                label: ngxSectorLabel(sector.slug, sector.name, t),
                count: sector.count,
              }))}
              labels={{
                all: t("ngx.market.allSectors"),
                searchPlaceholder: t("ngx.market.searchPlaceholder"),
                searchAria: t("ngx.market.searchAria"),
                sectorsTitle: t("ngx.market.sectorsTitle"),
                colTicker: t("ngx.market.colTicker"),
                colName: t("ngx.market.colName"),
                colSector: t("ngx.market.colSector"),
                colBoard: t("ngx.market.colBoard"),
                colPrice: t("ngx.market.colPrice"),
                colChange: t("ngx.market.colChange"),
                colFcfa: t("ngx.market.colFcfa"),
                empty: t("market.board.empty"),
              }}
            />
            <p className={styles.attribution}>
              {t("ngx.market.attribution")}{" "}
              {shares[0] ? t("ngx.market.sourceLine", { source: translateDataSourceLabel(shares[0].sourceLabel, t) }) : ""}
            </p>
          </>
        )}
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
