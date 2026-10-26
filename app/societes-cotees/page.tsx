// Page "Sociétés cotées" — présentation par catégorie (secteur) + contexte.
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import AnalysisRecap from "@/components/analysis/AnalysisRecap";
import { C } from "@/lib/theme/colors";
import { getCompaniesFullDataset } from "@/lib/api/companies-full-dataset";
import { calcMetrics, type CalcMetricsResult } from "@/lib/calc/calc-metrics";
import { fundamentalRecapLines, truncateSummary } from "@/lib/calc/analysis-recap";
import { getI18n } from "@/lib/i18n/get-i18n";
import type { LabelsApi } from "@/lib/i18n/labels";
import type { FormatApi } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import type { TFunc } from "@/lib/i18n/create-i18n";
import styles from "@/components/societes/SocietesCotees.module.css";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  const { t } = getI18n();
  return {
    title: t("directory.companies.metaTitle"),
    description: t("directory.companies.metaDescription"),
  };
}

function sectorBlurb(sector: string, t: TFunc, labels: LabelsApi): string {
  switch (sector) {
    case "Banques":
      return t("directory.companies.sectorsBlurb.banques");
    case "Conso. Base":
      return t("directory.companies.sectorsBlurb.consoBase");
    case "Conso. Discrétionnaire":
      return t("directory.companies.sectorsBlurb.consoDiscretionnaire");
    case "Divertissement":
      return t("directory.companies.sectorsBlurb.divertissement");
    case "Énergie":
      return t("directory.companies.sectorsBlurb.energie");
    case "Industrie":
      return t("directory.companies.sectorsBlurb.industrie");
    case "Services Publics":
      return t("directory.companies.sectorsBlurb.servicesPublics");
    case "Télécoms":
      return t("directory.companies.sectorsBlurb.telecoms");
    case "Autres":
      return t("directory.companies.sectorsBlurb.autres");
    default:
      return t("directory.companies.sectorsBlurb.fallback", { sector: labels.sector(sector) });
  }
}

function lastPrice(prices: Record<number, number>, years: number[]): number | null {
  for (let i = years.length - 1; i >= 0; i--) {
    const p = prices[years[i]!];
    if (p != null && p > 0) return p;
  }
  return null;
}

function recapLines(
  m: CalcMetricsResult,
  per: number,
  locale: Locale,
  t: TFunc,
  labels: LabelsApi,
  format: FormatApi
): string[] {
  if (locale !== "en") return fundamentalRecapLines(m, per);
  const perTxt = per > 0 ? format.decimal(per, 1) : "N/D";
  const lines: string[] = [
    t("directory.companies.recapDividend", { yield: m.dividendYieldPercent, per: perTxt }),
    t("directory.companies.recapRisk", {
      tier: labels.riskTier(m.riskAnalysis.riskTier),
      score: m.riskAnalysis.riskScore,
      vol:
        m.volatilityPercent !== "N/D"
          ? t("directory.companies.recapVol", { vol: m.volatilityPercent })
          : "",
    }),
    t("directory.companies.recapHorizons", {
      court: m.horizonScores.court,
      moyen: m.horizonScores.moyen,
      long: m.horizonScores.long,
      fundamental: m.fundamentalScore,
    }),
  ];
  const top = m.signalReasons.filter((r) => r.kind !== "neutre").slice(0, 2);
  for (const reason of top) {
    lines.push(`${reason.kind === "positif" ? "▲" : "▼"} ${labels.reason(reason)}`);
  }
  return lines.slice(0, 5);
}

export default async function SocietesCoteesPage() {
  const { t, format, labels, locale } = getI18n();
  const dataset = await getCompaniesFullDataset();
  const { companies, years } = dataset;
  const yearSpan =
    years.length >= 2 ? `${years[0]} → ${years[years.length - 1]}` : years[0] != null ? String(years[0]) : t("common.nd");

  const countries = new Set(companies.map((c) => c.country));

  const bySector = new Map<string, typeof companies>();
  for (const co of companies) {
    const list = bySector.get(co.sector) ?? [];
    list.push(co);
    bySector.set(co.sector, list);
  }

  const sectors = [...bySector.entries()]
    .map(([sector, list]) => ({
      sector,
      companies: [...list].sort((a, b) => a.name.localeCompare(b.name, "fr")),
    }))
    .sort((a, b) => a.sector.localeCompare(b.sector, "fr"));

  const sectorSlug = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");

  return (
    <AppHeader>
      <main className={styles.page}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>{t("directory.companies.eyebrow")}</p>
          <h1 className={styles.title}>{t("directory.companies.title")}</h1>
          <p className={styles.lead}>
            {t("directory.companies.leadBefore")}
            <strong style={{ color: C.text }}>BRVM</strong>
            {t("directory.companies.leadMid")}
            <strong style={{ color: C.text }}>{t("directory.companies.leadSector")}</strong>
            {t("directory.companies.leadAfter")}
          </p>
          <div className={styles.metaStrip}>
            <span className={styles.metaChip}>{t("directory.companies.issuers", { count: companies.length })}</span>
            <span className={styles.metaChip}>{t("directory.companies.sectors", { count: sectors.length })}</span>
            <span className={styles.metaChip}>{t("directory.companies.countries", { count: countries.size })}</span>
            <span className={styles.metaChip}>{t("directory.companies.history", { span: yearSpan })}</span>
          </div>
        </header>

        <nav className={styles.toc} aria-label={t("directory.companies.tocAria")}>
          <div className={styles.tocLabel}>{t("directory.companies.tocLabel")}</div>
          {sectors.map(({ sector, companies: list }) => (
            <a key={sector} href={`#secteur-${sectorSlug(sector)}`} className={styles.tocLink}>
              {labels.sector(sector)} ({list.length})
            </a>
          ))}
        </nav>

        {sectors.map(({ sector, companies: list }) => {
          const mktSum = list.reduce((a, c) => a + (c.mktcap > 0 ? c.mktcap : 0), 0);
          const withCap = list.filter((c) => c.mktcap > 0).length;
          return (
            <section
              key={sector}
              id={`secteur-${sectorSlug(sector)}`}
              className={styles.section}
              aria-labelledby={`h-${sectorSlug(sector)}`}
            >
              <div className={styles.sectionHead}>
                <h2 id={`h-${sectorSlug(sector)}`} className={styles.sectionTitle}>
                  {labels.sector(sector)} <span className={styles.sectionCount}>({list.length})</span>
                </h2>
                <div className={styles.sectionStats}>
                  {mktSum > 0
                    ? t("directory.companies.capReported", {
                        amount: format.mdsFcfa(mktSum),
                        withCap,
                        total: list.length,
                      })
                    : t("directory.companies.capReportedNd")}
                </div>
              </div>
              <p className={styles.sectionBlurb}>{sectorBlurb(sector, t, labels)}</p>

              <div className={styles.grid}>
                {list.map((co) => {
                  const price = lastPrice(co.prices, years);
                  const m = calcMetrics({
                    years,
                    prices: co.prices,
                    dividends: co.dividends,
                    per: co.per,
                    mktcap: co.mktcap,
                    sector: co.sector,
                  });
                  const summary =
                    locale === "en"
                      ? truncateSummary(
                          labels.signalSummary({
                            label: m.signal.label,
                            score: m.score,
                            confidence: m.confidence,
                            signalSummary: m.signalSummary,
                            signalReasons: m.signalReasons,
                          })
                        )
                      : truncateSummary(m.signalSummary);
                  return (
                    <article key={co.ticker} id={co.ticker} className={styles.card}>
                      <Link href={`/actions/${co.ticker}`} className={styles.cardMain}>
                        <div className={styles.cardTop}>
                          <span className={styles.logo} aria-hidden="true">
                            {co.ticker.slice(0, 2)}
                          </span>
                          <div className={styles.cardIdentity}>
                            <span className={styles.ticker}>{co.ticker}</span>
                            <span className={styles.name}>{co.name}</span>
                            <span className={styles.country}>
                              {co.countryFlag} {labels.country(co.country)}
                            </span>
                          </div>
                        </div>
                        <div className={styles.cardMetrics}>
                          <div className={styles.metric}>
                            <span className={styles.metricLabel}>{t("directory.companies.price")}</span>
                            <span className={styles.metricValue}>
                              {price != null ? format.fcfa(price) : t("common.nd")}
                            </span>
                          </div>
                          <div className={styles.metric}>
                            <span className={styles.metricLabel}>{t("directory.companies.mktCap")}</span>
                            <span className={styles.metricValue}>
                              {co.mktcap > 0
                                ? t("directory.companies.mktCapShort", { amount: format.integer(co.mktcap) })
                                : t("common.nd")}
                            </span>
                          </div>
                          <div className={styles.metric}>
                            <span className={styles.metricLabel}>{t("directory.companies.dividendYield")}</span>
                            <span className={styles.metricValue} style={{ color: C.teal }}>
                              {m.dividendYieldPercent}%
                            </span>
                          </div>
                          <div className={styles.metric}>
                            <span className={styles.metricLabel}>{t("directory.companies.score")}</span>
                            <span className={styles.metricValue}>{m.score}/100</span>
                          </div>
                        </div>
                        <div className={styles.cardFooter}>
                          <span
                            className={styles.pill}
                            style={{
                              color: m.signal.color,
                              background: `color-mix(in srgb, ${m.signal.color} 18%, transparent)`,
                            }}
                          >
                            {labels.signal(m.signal.label)}
                          </span>
                          <span className={styles.more}>{t("directory.companies.sheet")}</span>
                        </div>
                      </Link>
                      <AnalysisRecap
                        kind="fundamental"
                        signalLabel={labels.signal(m.signal.label)}
                        signalColor={m.signal.color}
                        score={m.fundamentalScore}
                        confidence={labels.confidence(m.confidence)}
                        summary={summary}
                        lines={recapLines(m, co.per, locale, t, labels, format)}
                        href={`/actions/${co.ticker}`}
                        hrefLabel={t("directory.companies.fullSheet")}
                      />
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}

        <p className={styles.note}>
          {t("directory.companies.note")}{" "}
          <Link href="/mentions-legales" style={{ color: C.textDim }}>
            {t("directory.companies.legalLink")}
          </Link>
        </p>
      </main>
      <SiteFooter />
    </AppHeader>
  );
}
