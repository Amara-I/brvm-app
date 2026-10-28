// Landing page — contenu aligné sur les modules réels de la plateforme OuestBourse.
// Chiffres exclusivement issus des données BRVM (jamais inventés).

import Link from "next/link";
import type { MarketSummaryStats } from "@/lib/calc/market-summary-stats";
import type { CalcMetricsResult } from "@/lib/calc/calc-metrics";
import type { CompanyFullDataset } from "@/lib/api/companies-full-dataset";
import { AFRICAN_EXCHANGES } from "@/lib/markets/african-exchanges";
import { seriesFromYearlyPrices } from "@/lib/landing/price-series";
import { BRAND_NAME } from "@/lib/theme/brand";
import { getI18n } from "@/lib/i18n/get-i18n";
import LandingSparkline from "./LandingSparkline";
import MarketHeroCard from "./MarketHeroCard";
import type { HeroPoint } from "@/lib/landing/hero-chart";
import { HIGH_SCORE_THRESHOLD } from "@/lib/calc/market-summary-stats";
import {
  IconArrow,
  IconBook,
  IconBriefcase,
  IconBuilding,
  IconCalendar,
  IconChart,
  IconDividend,
  IconFile,
  IconFunnel,
  IconGrad,
  IconPie,
  IconSpark,
  IconStar,
  IconTarget,
  IconTools,
} from "./LandingIcons";
import styles from "./Landing.module.css";

export interface LandingPageProps {
  stats: MarketSummaryStats;
  topCompanies: Array<{ co: CompanyFullDataset; metrics: CalcMetricsResult }>;
  /** Nombre de secteurs présents en base (données réelles). */
  sectorsCount: number;
  /** Nombre de termes du lexique Éducation. */
  educationTermsCount: number;
  /** Niveaux de clôture BRVM Composite (null si indisponible). */
  heroSeries: HeroPoint[] | null;
  /** Date ISO de la dernière clôture connue (cours en base). */
  closeDate: string | null;
}

const LANDING_EXCHANGE_CODES = ["BRVM", "NGX", "GSE", "NSE"] as const;

function signalTone(label: string): "up" | "down" | "flat" {
  if (label.includes("ACHAT")) return "up";
  if (label.includes("VENDRE") || label.includes("ALLÉGER")) return "down";
  return "flat";
}

function perfClass(perf: string): string {
  if (perf === "N/D") return styles.stockFlat;
  return parseFloat(perf) >= 0 ? styles.stockChangeUp : styles.stockChangeDown;
}

export default function LandingPage({
  stats,
  topCompanies,
  sectorsCount,
  educationTermsCount,
  heroSeries,
  closeDate,
}: LandingPageProps) {
  const { t, format, labels, locale } = getI18n();
  const yearsSpan =
    stats.firstYear && stats.lastYear ? stats.lastYear - stats.firstYear + 1 : null;
  const horizonLabel =
    stats.firstYear && stats.lastYear
      ? `${stats.firstYear} → ${stats.lastYear}`
      : t("common.nd");

  const landingExchanges = LANDING_EXCHANGE_CODES.map((code) =>
    AFRICAN_EXCHANGES.find((exchange) => exchange.code === code)
  ).filter((exchange): exchange is (typeof AFRICAN_EXCHANGES)[number] => Boolean(exchange));

  const showPerf = (raw: string): string => {
    if (raw === "N/D") return t("common.nd");
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n)) return t("common.nd");
    if (locale === "en") {
      const digits = raw.includes(".") ? raw.split(".")[1]!.length : 0;
      return format.percent(n, digits, true);
    }
    return `${n >= 0 ? "+" : ""}${raw.replace(".", ",")}%`;
  };

  const heroFeatures = [
    {
      t: t("landing.features.screenerTitle"),
      d: t("landing.features.screenerBody"),
      href: "/screener",
      icon: <IconFunnel size={16} />,
    },
    {
      t: t("landing.features.chartsTitle"),
      d: t("landing.features.chartsBody"),
      href: "/graphes",
      icon: <IconChart size={16} />,
    },
    {
      t: t("landing.features.portfolioTitle"),
      d: t("landing.features.portfolioBody"),
      href: "/portefeuille",
      icon: <IconBriefcase size={16} />,
    },
    {
      t: t("landing.features.educationTitle"),
      d: t("landing.features.educationBody"),
      href: "/education",
      icon: <IconGrad size={16} />,
    },
  ];

  const modules = [
    {
      t: t("landing.modules.marketTitle"),
      d: t("landing.modules.marketBody"),
      href: "/marche",
      icon: <IconTarget size={20} />,
    },
    {
      t: t("landing.modules.screenerTitle"),
      d: t("landing.modules.screenerBody"),
      href: "/screener",
      icon: <IconSpark size={20} />,
    },
    {
      t: t("landing.modules.chartsTitle"),
      d: t("landing.modules.chartsBody"),
      href: "/graphes",
      icon: <IconChart size={20} />,
    },
    {
      t: t("landing.modules.sheetsTitle"),
      d: t("landing.modules.sheetsBody"),
      href: "/societes-cotees",
      icon: <IconFile size={20} />,
    },
    {
      t: t("landing.modules.portfolioTitle"),
      d: t("landing.modules.portfolioBody"),
      href: "/portefeuille",
      icon: <IconBriefcase size={20} />,
    },
    {
      t: t("landing.modules.educationTitle"),
      d: t("landing.modules.educationBody", { count: educationTermsCount }),
      href: "/education",
      icon: <IconGrad size={20} />,
    },
    {
      t: t("landing.modules.dividendsTitle"),
      d: t("landing.modules.dividendsBody"),
      href: "/calendrier-dividendes",
      icon: <IconDividend size={20} />,
    },
    {
      t: t("landing.modules.toolsTitle"),
      d: t("landing.modules.toolsBody"),
      href: "/outils",
      icon: <IconTools size={20} />,
    },
  ];

  const yieldTail =
    stats.avgDividendYieldPercent !== null
      ? t("landing.cta.yieldTail", {
          pct: format.percent(stats.avgDividendYieldPercent, 1, false),
        })
      : "";

  const signalCount =
    stats.companiesCount > 0 ? `${stats.buySignalsCount}/${stats.companiesCount}` : t("common.nd");

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={`${styles.rail} ${styles.heroStack}`}>
          <div className={styles.heroCopy}>
            <div className={styles.exchangeRow} aria-label={t("landing.hero.exchangesAria")}>
              {landingExchanges.map((exchange) => {
                const title = exchange.live
                  ? exchange.code === "BRVM"
                    ? t("landing.hero.regionBrvm")
                    : exchange.region
                  : t("landing.hero.soon");
                const chipClass = exchange.live
                  ? `${styles.exchangeChip} ${styles.exchangeLive}`
                  : styles.exchangeChip;
                if (exchange.live && exchange.code !== "BRVM") {
                  return (
                    <Link
                      key={exchange.code}
                      href={`/marches/${exchange.code.toLowerCase()}`}
                      className={chipClass}
                      title={title}
                    >
                      {exchange.shortLabel}
                    </Link>
                  );
                }
                return (
                  <span key={exchange.code} className={chipClass} title={title}>
                    {exchange.shortLabel}
                  </span>
                );
              })}
            </div>

            <h1 className={styles.h1}>
              {t("landing.hero.line1")}
              <br />
              {t("landing.hero.line2")}
              <br />
              <span className={styles.h1Accent}>{t("landing.hero.accent")}</span>
            </h1>

            <p className={styles.paragraph}>{t("landing.hero.lead")}</p>

            <div className={styles.ctaRow}>
              <Link href="/marche" className={styles.ctaPrimary}>
                <IconSpark size={14} /> {t("landing.hero.ctaExplore")} <IconArrow size={14} />
              </Link>
              <Link href="/graphes" className={styles.ctaSecondary}>
                <IconChart size={14} /> {t("landing.hero.ctaCharts")}
              </Link>
            </div>
          </div>

          <MarketHeroCard
            locale={locale}
            capitalisation={format.mdsFcfa(stats.totalMarketCapBnFcfa)}
            series={heroSeries ?? []}
            labels={{
              capLabel: t("landing.card.capLabel"),
              closeOn: closeDate
                ? t("landing.card.closeOn", {
                    date: format.date(`${closeDate}T12:00:00Z`, {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      timeZone: "UTC",
                    }),
                  })
                : "",
              chartTitle: t("landing.card.chartTitle"),
              chartSource: t("landing.card.chartSource"),
              rangeAria: t("landing.card.rangeAria"),
              ranges: {
                "1Y": t("landing.card.range1Y"),
                "3Y": t("landing.card.range3Y"),
                "5Y": t("landing.card.range5Y"),
                MAX: t("landing.card.rangeMax"),
              },
              overPeriod: t("landing.card.overPeriod", { period: "{period}" }),
              periodNames: {
                "1Y": t("landing.card.period1Y"),
                "3Y": t("landing.card.period3Y"),
                "5Y": t("landing.card.period5Y"),
                MAX: t("landing.card.periodMax"),
              },
              start: t("landing.card.start"),
              end: t("landing.card.end"),
              high: t("landing.card.high"),
              low: t("landing.card.low"),
              noChart: t("landing.card.noChart"),
              stats: [
                { value: String(stats.companiesCount), label: t("landing.card.companies") },
                { value: String(sectorsCount), label: t("landing.card.sectors") },
                {
                  value: signalCount,
                  label: t("landing.card.highScore", { min: HIGH_SCORE_THRESHOLD }),
                  title: t("landing.card.highScoreTitle", {
                    count: stats.buySignalsCount,
                    total: stats.companiesCount,
                    min: HIGH_SCORE_THRESHOLD,
                  }),
                },
              ],
            }}
          />
        </div>
      </section>

      <div className={styles.belowHero}>
        <section className={styles.section}>
          <div className={styles.rail}>
            <div className={styles.statsInner}>
              <div className={styles.statItem}>
                <span className={styles.statIcon}>
                  <IconBuilding size={16} />
                </span>
                <div>
                  <div className={styles.statValue}>{stats.companiesCount}</div>
                  <div className={styles.statLabel}>{t("landing.stats.listed")}</div>
                  <div className={styles.statHint}>{t("landing.stats.listedHint")}</div>
                </div>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statIcon}>
                  <IconCalendar size={16} />
                </span>
                <div>
                  <div className={styles.statValue}>{yearsSpan !== null ? `${yearsSpan}` : t("common.nd")}</div>
                  <div className={styles.statLabel}>{t("landing.stats.historyYears")}</div>
                  <div className={styles.statHint}>
                    {horizonLabel !== t("common.nd")
                      ? t("landing.stats.historyIncluded", { span: horizonLabel })
                      : t("common.nd")}
                  </div>
                </div>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statIcon}>
                  <IconPie size={16} />
                </span>
                <div>
                  <div className={styles.statValue}>{sectorsCount}</div>
                  <div className={styles.statLabel}>{t("landing.stats.sectors")}</div>
                  <div className={styles.statHint}>{t("landing.stats.sectorsHint")}</div>
                </div>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statIcon}>
                  <IconBook size={16} />
                </span>
                <div>
                  <div className={styles.statValue}>{educationTermsCount}</div>
                  <div className={styles.statLabel}>{t("landing.stats.lexicon")}</div>
                  <div className={styles.statHint}>{t("landing.stats.lexiconHint")}</div>
                </div>
              </div>
            </div>

            <div className={`${styles.card} ${styles.cardStock} ${styles.scoreWrap}`}>
              <div className={styles.cardStockHead}>
                <div className={styles.cardLabel}>
                  <IconStar size={14} />
                  {t("landing.card.topScores")}
                </div>
                <Link href="/screener" className={styles.cardSeeAll}>
                  {t("common.seeAll")}
                </Link>
              </div>
              {topCompanies.length === 0 ? (
                <div className={styles.stockRow}>
                  <span className={styles.stockTicker}>{t("common.nd")}</span>
                </div>
              ) : (
                topCompanies.map(({ co, metrics }) => {
                  const rawSignal = metrics.signal?.label || "N/D";
                  const tone = signalTone(rawSignal);
                  return (
                    <Link key={co.ticker} href={`/actions/${co.ticker}`} className={styles.stockRow}>
                      <span className={styles.stockIdentity}>
                        <span className={styles.stockTicker}>{co.ticker}</span>
                        <span className={styles.stockName}>{co.name || t("common.nd")}</span>
                      </span>
                      <span className={styles.sparkCell}>
                        <LandingSparkline values={seriesFromYearlyPrices(co.prices)} width={72} height={24} />
                      </span>
                      <span className={styles.stockMeta}>
                        <span
                          className={`${styles.stockSignal} ${
                            tone === "up"
                              ? styles.stockChangeUp
                              : tone === "down"
                                ? styles.stockChangeDown
                                : styles.stockFlat
                          }`}
                        >
                          {labels.signal(rawSignal)}
                        </span>
                        <span className={`${styles.stockPerf} ${perfClass(metrics.perf5Percent)}`}>
                          {showPerf(metrics.perf5Percent)}
                        </span>
                      </span>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.rail}>
            <div className={styles.featureRow}>
              {heroFeatures.map((item) => (
                <Link key={item.href} href={item.href} className={styles.featureItem}>
                  <span className={styles.featureIcon}>{item.icon}</span>
                  <span className={styles.featureText}>
                    <strong>{item.t}</strong>
                    {item.d}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionAlt}`}>
          <div className={styles.rail}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionHeadCopy}>
              <p className={styles.sectionEyebrow}>{t("landing.modules.eyebrow")}</p>
              <h2 className={styles.sectionTitle}>{t("landing.modules.title")}</h2>
            </div>
            <p className={styles.sectionLead}>{t("landing.modules.lead", { brand: BRAND_NAME })}</p>
          </div>
          <div className={styles.grid4}>
            {modules.map((f) => (
              <article key={f.href} className={styles.featureCard}>
                <span className={styles.moduleIcon}>{f.icon}</span>
                <h3>
                  <Link href={f.href} className={styles.featureTitleLink}>
                    {f.t}
                  </Link>
                </h3>
                <p>{f.d}</p>
              </article>
            ))}
          </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.rail}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionHeadCopy}>
              <p className={styles.sectionEyebrow}>{t("landing.why.eyebrow", { brand: BRAND_NAME })}</p>
              <h2 className={styles.sectionTitle}>{t("landing.why.title")}</h2>
            </div>
            <p className={styles.sectionLead}>{t("landing.why.lead")}</p>
          </div>
          <div className={styles.grid2}>
            <div className={styles.trustBlock}>
              <h3>{t("landing.why.avoidTitle")}</h3>
              <p>{t("landing.why.avoidBody")}</p>
            </div>
            <div className={`${styles.trustBlock} ${styles.trustBlockGain}`}>
              <h3>{t("landing.why.useTitle")}</h3>
              <p>
                {t("landing.why.useBody", {
                  companies: stats.companiesCount,
                  sectors: sectorsCount,
                  horizon: horizonLabel,
                })}
              </p>
            </div>
          </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionAlt}`}>
          <div className={styles.rail}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionHeadCopy}>
              <p className={styles.sectionEyebrow}>{t("landing.cycle.eyebrow")}</p>
              <h2 className={styles.sectionTitle}>{t("landing.cycle.title")}</h2>
            </div>
            <p className={styles.sectionLead}>{t("landing.cycle.lead")}</p>
          </div>
          <div className={styles.grid3}>
            {[
              {
                n: "1",
                t: t("landing.cycle.collectTitle"),
                d: t("landing.cycle.collectBody"),
              },
              {
                n: "2",
                t: t("landing.cycle.reconcileTitle"),
                d: t("landing.cycle.reconcileBody"),
              },
              {
                n: "3",
                t: t("landing.cycle.readTitle"),
                d: t("landing.cycle.readBody"),
              },
            ].map((s) => (
              <div key={s.n} className={styles.cycleStep}>
                <span className={styles.cycleNum}>{s.n}</span>
                <div>
                  <h3 className={styles.cycleTitle}>{s.t}</h3>
                  <p className={styles.cycleText}>{s.d}</p>
                </div>
              </div>
            ))}
          </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionAlt}`}>
          <div className={styles.rail}>
          <div className={styles.ctaBand}>
            <div>
              <h2 className={styles.ctaBandTitle}>{t("landing.cta.title")}</h2>
              <p className={styles.ctaBandText}>
                {t("landing.cta.body", {
                  companies: stats.companiesCount,
                  signals: stats.buySignalsCount,
                  yield: yieldTail,
                })}
              </p>
            </div>
            <div className={styles.ctaBandActions}>
              <Link href="/marche" className={styles.btnGold}>
                {t("landing.cta.market")}
              </Link>
              <Link href="/screener" className={styles.btnOutline}>
                {t("landing.cta.screener")}
              </Link>
              <Link href="/graphes" className={styles.btnOutline}>
                {t("landing.cta.charts")}
              </Link>
              <Link href="/inscription" className={styles.btnOutline}>
                {t("landing.cta.register")}
              </Link>
            </div>
          </div>
          </div>
        </section>

        <footer className={styles.landingFooter}>
          <div className={styles.rail}>
          <div className={styles.footerInner}>
            <div>
              <div className={styles.footerBrand}>{BRAND_NAME}</div>
              <p className={styles.footerMuted}>{t("landing.footer.blurb")}</p>
            </div>
            <div>
              <p className={styles.footerColTitle}>{t("landing.footer.analyze")}</p>
              <Link href="/marche" className={styles.footerLink}>
                {t("landing.footer.market")}
              </Link>
              <Link href="/screener" className={styles.footerLink}>
                {t("landing.footer.screener")}
              </Link>
              <Link href="/graphes" className={styles.footerLink}>
                {t("landing.footer.charts")}
              </Link>
              <Link href="/societes-cotees" className={styles.footerLink}>
                {t("landing.footer.companies")}
              </Link>
            </div>
            <div>
              <p className={styles.footerColTitle}>{t("landing.footer.follow")}</p>
              <Link href="/portefeuille" className={styles.footerLink}>
                {t("landing.footer.portfolio")}
              </Link>
              <Link href="/calendrier-dividendes" className={styles.footerLink}>
                {t("landing.footer.dividends")}
              </Link>
              <Link href="/actualites" className={styles.footerLink}>
                {t("landing.footer.news")}
              </Link>
              <Link href="/education" className={styles.footerLink}>
                {t("landing.footer.education")}
              </Link>
            </div>
            <div>
              <p className={styles.footerColTitle}>{t("landing.footer.account")}</p>
              <Link href="/connexion" className={styles.footerLink}>
                {t("landing.footer.login")}
              </Link>
              <Link href="/inscription" className={styles.footerLink}>
                {t("landing.footer.register")}
              </Link>
              <Link href="/outils" className={styles.footerLink}>
                {t("landing.footer.tools")}
              </Link>
              <Link href="/mentions-legales" className={styles.footerLink}>
                {t("landing.footer.legal")}
              </Link>
            </div>
          </div>
          <p className={styles.footerCopy}>
            {t("landing.footer.copy", { year: new Date().getFullYear(), brand: BRAND_NAME })}
          </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
