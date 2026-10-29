// Fiche d'analyse NGX : 8 sections dans un ordre fixe. Composant serveur, sans état.
// Toutes les valeurs viennent du modèle (lib/ngx/sheet-model.ts) ; rien n'est rédigé ici.

import { getI18n } from "@/lib/i18n/get-i18n";
import { localizedTypeDef } from "@/lib/i18n/portfolio-type-copy";
import { getPortfolioTypeDef } from "@/lib/portfolio-types/catalog";
import { type CriterionKey, type PolicyCriterion } from "@/lib/ngx/policy";
import type { NgxSheetModel, SectorMetricKey } from "@/lib/ngx/sheet-model";
import { outlookSummary, outlookText, type NgxOutlookItem } from "@/lib/ngx/outlook";
import { VALUATION_BAND_PERCENT, type FairValueEstimate } from "@/lib/ngx/valuation";
import FinancialBars from "./FinancialBars";
import { NGX_MARKET_PILLARS, NGX_SCORE_WEIGHTS } from "@/lib/ngx/score";
import NgxScoreBlock, { PillarCard } from "./NgxScoreBlock";
import styles from "./NgxSheet.module.css";

type Fmt = ReturnType<typeof getI18n>["format"];
type T = ReturnType<typeof getI18n>["t"];

const SECTION_IDS = [
  "presentation",
  "performance",
  "outlook",
  "price",
  "valuation",
  "sector",
  "dividends",
  "chartAnalysis",
  "conclusion",
] as const;
type SectionId = (typeof SECTION_IDS)[number];

const CEILING_KEYS: ReadonlySet<CriterionKey> = new Set<CriterionKey>(["payout", "drawdown", "volatility"]);
const INTEGER_KEYS: ReadonlySet<CriterionKey> = new Set<CriterionKey>(["dividendRegularity"]);
const NO_VALUE_KEYS: ReadonlySet<CriterionKey> = new Set<CriterionKey>(["valuation", "trend"]);

function Section({
  id,
  title,
  lead,
  children,
}: {
  id: SectionId;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  const index = SECTION_IDS.indexOf(id) + 1;
  return (
    <section id={`ngx-${id}`} className={styles.section} aria-labelledby={`ngx-${id}-title`}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionNum}>{String(index).padStart(2, "0")}</span>
        <h2 id={`ngx-${id}-title`}>{title}</h2>
      </div>
      {lead ? <p className={styles.lead}>{lead}</p> : null}
      {children}
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
      {note ? <span className={styles.statNote}>{note}</span> : null}
    </div>
  );
}

export default function NgxSheetView({ model }: { model: NgxSheetModel }) {
  const { t, format, locale, labels } = getI18n();
  const na = t("ngx.sheet.na");
  const full = model.tier === "FULL";

  const bn = (v: number | null) =>
    v == null ? na : `${format.decimal(v, Math.abs(v) >= 100 ? 0 : 1)} ${t("ngx.sheet.unitBn")}`;
  const ngn = (v: number | null) => (v == null ? na : format.money(v, "NGN"));
  const pct = (v: number | null, digits = 1, sign = false) => (v == null ? na : format.percent(v, digits, sign));
  const mult = (v: number | null) => (v == null ? na : `${format.decimal(v, 1)}×`);
  const day = (iso: string | null) =>
    iso
      ? format.date(`${iso}T00:00:00.000Z`, {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        })
      : na;

  const visible: SectionId[] = full ? [...SECTION_IDS] : ["presentation", "chartAnalysis", "conclusion"];

  return (
    <div>
      <nav className={styles.toc} aria-label={t("ngx.sheet.nav")}>
        {visible.map((id) => (
          <a key={id} href={`#ngx-${id}`}>
            {SECTION_IDS.indexOf(id) + 1}. {t(`ngx.sheet.sections.${id}`)}
          </a>
        ))}
      </nav>

      <Section id="presentation" title={t("ngx.sheet.sections.presentation")}>
        <Presentation model={model} t={t} format={format} na={na} ngn={ngn} bn={bn} day={day} />
      </Section>

      {full ? (
        <>
          <Section id="performance" title={t("ngx.sheet.sections.performance")} lead={t("ngx.sheet.performance.lead")}>
            <Performance model={model} t={t} format={format} na={na} bn={bn} pct={pct} />
          </Section>
          <Section id="outlook" title={t("ngx.sheet.sections.outlook")} lead={t("ngx.sheet.outlook.lead")}>
            <Outlook model={model} t={t} locale={locale} pct={pct} day={day} />
          </Section>
          <Section id="price" title={t("ngx.sheet.sections.price")} lead={t("ngx.sheet.price.lead")}>
            <PriceMultiples model={model} t={t} ngn={ngn} bn={bn} pct={pct} mult={mult} />
          </Section>
          <Section id="valuation" title={t("ngx.sheet.sections.valuation")} lead={t("ngx.sheet.valuation.lead")}>
            <Valuation model={model} t={t} format={format} ngn={ngn} pct={pct} />
          </Section>
          <Section id="sector" title={t("ngx.sheet.sections.sector")}>
            <SectorAverage model={model} t={t} format={format} na={na} pct={pct} mult={mult} />
          </Section>
          <Section id="dividends" title={t("ngx.sheet.sections.dividends")} lead={t("ngx.sheet.dividends.lead")}>
            <Dividends model={model} t={t} format={format} na={na} ngn={ngn} pct={pct} day={day} />
          </Section>
        </>
      ) : (
        <div className={styles.comingSoon} role="status">
          <h2>{t("ngx.sheet.comingSoon.title")}</h2>
          <p>{t("ngx.sheet.comingSoon.body", { name: model.name })}</p>
          <p>{t("ngx.sheet.comingSoon.tradingOnly")}</p>
        </div>
      )}

      <Section id="chartAnalysis" title={t("ngx.sheet.sections.chartAnalysis")} lead={t("ngx.sheet.chartAnalysis.lead")}>
        <ChartAnalysis model={model} t={t} format={format} labels={labels} na={na} pct={pct} />
      </Section>

      <Section id="conclusion" title={t("ngx.sheet.sections.conclusion")} lead={t("ngx.sheet.conclusion.lead")}>
        <Conclusion model={model} t={t} format={format} locale={locale} />
      </Section>
    </div>
  );
}

// ───────────── Analyse graphique (mêmes fonctions partagées que la fiche BRVM) ─────────────

const SIGNAL_TONE: Record<string, string> = {
  "ACHAT FORT": styles.good,
  ACHAT: styles.good,
  CONSERVER: styles.mid,
  "ALLÉGER": styles.bad,
  VENDRE: styles.bad,
};

function ChartAnalysis({
  model,
  t,
  format,
  labels,
  na,
  pct,
}: {
  model: NgxSheetModel;
  t: T;
  format: Fmt;
  labels: ReturnType<typeof getI18n>["labels"];
  na: string;
  pct: (v: number | null, d?: number, s?: boolean) => string;
}) {
  const { technical, composite } = model.chartAnalysis;
  const stats = model.price.stats;
  const price = (v: number | null | undefined) => (v == null ? na : format.decimal(v, 2));
  const num = (v: number | null | undefined, d = 1) => (v == null ? na : format.decimal(v, d));
  const ok = technical.available;
  const macd = ok ? technical.macd : null;
  const crossText =
    !ok || stats.sma200 == null
      ? na
      : technical.maCross === "golden_cross"
        ? t("ngx.sheet.chartAnalysis.crossGolden")
        : technical.maCross === "death_cross"
          ? t("ngx.sheet.chartAnalysis.crossDeath")
          : technical.maCross === "none"
            ? t("ngx.sheet.chartAnalysis.crossNone")
            : na;
  const pillars = model.score.pillars;
  return (
    <>
      <h3 className={styles.sub}>{t("ngx.sheet.chartAnalysis.signalTitle")}</h3>
      {composite ? (
        <>
          <div className={styles.grid}>
            <Stat label={t("ngx.sheet.chartAnalysis.score")} value={format.integer(composite.score)} />
            <div className={styles.stat}>
              <span className={styles.statLabel}>{t("ngx.sheet.chartAnalysis.signal")}</span>
              <span className={styles.statValue}>
                <span className={`${styles.badge} ${SIGNAL_TONE[composite.signal.label] ?? ""}`}>
                  {labels.signal(composite.signal.label)}
                </span>
              </span>
              <span className={styles.statNote}>
                {t("ngx.sheet.chartAnalysis.confidence")} : {labels.confidence(composite.confidence)}
              </span>
            </div>
            <Stat label={t("ngx.sheet.chartAnalysis.techScore")} value={format.integer(composite.technicalScore)} />
            <Stat label={t("ngx.sheet.chartAnalysis.risk")} value={format.integer(composite.riskScore)} />
            <Stat label={t("ngx.sheet.chartAnalysis.horizonShort")} value={format.integer(composite.horizonScores.court)} />
            <Stat label={t("ngx.sheet.chartAnalysis.horizonMedium")} value={format.integer(composite.horizonScores.moyen)} />
            <Stat label={t("ngx.sheet.chartAnalysis.horizonLong")} value={format.integer(composite.horizonScores.long)} />
          </div>
        </>
      ) : (
        <p className={styles.note}>{t("ngx.sheet.chartAnalysis.compositeNd")}</p>
      )}

      <h3 className={styles.sub}>{t("ngx.sheet.chartAnalysis.indicatorsTitle")}</h3>
      {!ok ? <p className={styles.note}>{t("ngx.sheet.chartAnalysis.techNd", { points: stats.points })}</p> : null}
      <div className={styles.grid}>
        <Stat
          label={t("ngx.sheet.chartAnalysis.rsi")}
          value={ok ? num(technical.rsi14) : na}
          note={t("ngx.sheet.chartAnalysis.rsiNote")}
        />
        <Stat
          label={t("ngx.sheet.chartAnalysis.macdHist")}
          value={macd ? format.signed(macd.histogram, 3) : na}
          note={
            macd
              ? t("ngx.sheet.chartAnalysis.macdNote", {
                  macd: format.signed(macd.macd, 3),
                  signal: format.signed(macd.signal, 3),
                })
              : undefined
          }
        />
        <Stat label={t("ngx.sheet.chartAnalysis.sma10")} value={ok ? price(technical.sma10) : na} note={t("ngx.sheet.chartAnalysis.smaNote")} />
        <Stat label={t("ngx.sheet.chartAnalysis.sma20")} value={ok ? price(technical.sma20) : na} note={t("ngx.sheet.chartAnalysis.smaNote")} />
        <Stat label={t("ngx.sheet.chartAnalysis.sma50")} value={price(stats.sma50)} note={t("ngx.sheet.chartAnalysis.smaNote")} />
        <Stat label={t("ngx.sheet.chartAnalysis.sma200")} value={price(stats.sma200)} note={t("ngx.sheet.chartAnalysis.smaNote")} />
        <Stat label={t("ngx.sheet.chartAnalysis.cross")} value={crossText} />
        <Stat
          label={t("ngx.sheet.chartAnalysis.shortScore")}
          value={ok && technical.shortTermScore != null ? format.integer(technical.shortTermScore) : na}
          note={t("ngx.sheet.chartAnalysis.points", { points: stats.points })}
        />
      </div>
      {ok && technical.notes.length > 0 ? (
        <>
          <h3 className={styles.sub}>{t("ngx.sheet.chartAnalysis.notesTitle")}</h3>
          <ul className={styles.criteria}>
            {technical.notes.map((note) => (
              <li key={note}>{labels.technicalNote(note)}</li>
            ))}
          </ul>
        </>
      ) : null}

      <h3 className={styles.sub}>{t("ngx.sheet.chartAnalysis.momentumTitle")}</h3>
      <div className={styles.grid}>
        <Stat label={t("ngx.sheet.chartAnalysis.return1m")} value={pct(stats.return1mPercent, 1, true)} />
        <Stat label={t("ngx.sheet.chartAnalysis.return3m")} value={pct(stats.return3mPercent, 1, true)} />
        <Stat label={t("ngx.sheet.chartAnalysis.return1y")} value={pct(stats.return1yPercent, 1, true)} />
        <Stat label={t("ngx.sheet.chartAnalysis.high52")} value={price(stats.high52)} />
        <Stat label={t("ngx.sheet.chartAnalysis.low52")} value={price(stats.low52)} />
        <Stat label={t("ngx.sheet.chartAnalysis.drawdown")} value={pct(stats.drawdownFromHighPercent, 1)} />
        <Stat label={t("ngx.sheet.chartAnalysis.volatility")} value={pct(stats.volatilityPercent, 1)} />
      </div>

      <h3 className={styles.sub}>{t("ngx.sheet.chartAnalysis.pillarsTitle")}</h3>
      <div className={styles.pillars}>
        {NGX_MARKET_PILLARS.map((k) => (
          <PillarCard key={k} pillar={pillars[k]} weight={NGX_SCORE_WEIGHTS.OVERALL[k]} t={t} format={format} />
        ))}
      </div>
      <p className={styles.note}>
        <a className={styles.link} href="#ngx-chart">
          {t("ngx.sheet.chartAnalysis.seeChart")}
        </a>
      </p>
    </>
  );
}

// ───────────── 1. Présentation ─────────────

function Presentation({
  model,
  t,
  format,
  na,
  ngn,
  bn,
  day,
}: {
  model: NgxSheetModel;
  t: T;
  format: Fmt;
  na: string;
  ngn: (v: number | null) => string;
  bn: (v: number | null) => string;
  day: (iso: string | null) => string;
}) {
  const p = model.presentation;
  const profile = p.profile;
  const rows: Array<[string, React.ReactNode]> = [
    [t("ngx.sheet.presentation.isin"), p.isin ?? na],
    [t("ngx.sheet.presentation.listedSince"), p.listedSince ? day(p.listedSince) : na],
    [
      t("ngx.sheet.presentation.shares"),
      p.shares ? (
        <>
          {format.integer(p.shares.value)}
          {p.shares.asOf ? ` (${t("ngx.sheet.presentation.sharesAsOf", { date: day(p.shares.asOf) })})` : ""}
        </>
      ) : (
        na
      ),
    ],
    [t("ngx.sheet.presentation.marketCap"), bn(p.marketCapBn)],
    [
      t("ngx.sheet.presentation.rank"),
      p.marketCapRank != null
        ? t("ngx.sheet.presentation.rankValue", {
            rank: p.marketCapRank,
            count: p.rankedCount,
          })
        : na,
    ],
  ];
  if (profile?.headOffice) rows.push([t("ngx.sheet.presentation.headOffice"), profile.headOffice]);
  if (profile?.chiefExecutive) rows.push([t("ngx.sheet.presentation.chiefExecutive"), profile.chiefExecutive]);
  if (profile?.employees != null) rows.push([t("ngx.sheet.presentation.employees"), format.integer(profile.employees)]);
  if (profile?.freeFloatPercent != null)
    rows.push([t("ngx.sheet.presentation.freeFloat"), format.percent(profile.freeFloatPercent, 1)]);
  if (profile?.foundedYear != null) rows.push([t("ngx.sheet.presentation.founded"), String(profile.foundedYear)]);
  if (profile?.website) {
    rows.push([
      t("ngx.sheet.presentation.website"),
      <a key="web" className={styles.link} href={profile.website} target="_blank" rel="noopener noreferrer">
        {profile.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
      </a>,
    ]);
  }
  const isFinancial = model.sector.group === "BANKING" || model.sector.group === "INSURANCE";
  return (
    <>
      {p.description ? (
        <p className={styles.prose}>{p.description}</p>
      ) : (
        <div className={styles.empty}>{t("ngx.sheet.presentation.descriptionEmpty")}</div>
      )}
      <div className={styles.card}>
        <dl className={styles.facts}>
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      {isFinancial ? <p className={styles.note}>{t("ngx.sheet.presentation.financialNote")}</p> : null}
    </>
  );
}

// ───────────── 2. Performances ─────────────

function Performance({
  model,
  t,
  format,
  na,
  bn,
  pct,
}: {
  model: NgxSheetModel;
  t: T;
  format: Fmt;
  na: string;
  bn: (v: number | null) => string;
  pct: (v: number | null, d?: number, s?: boolean) => string;
}) {
  const perf = model.performance;
  const years = perf.years;
  const first = years[0]?.year;
  const last = years[years.length - 1]?.year;
  // Dernier exercice publié sans CA : on montre le dernier exercice avec données, étiqueté de son année.
  const staleNote = (year: number | null) =>
    year != null && perf.latestYear != null && year < perf.latestYear
      ? t("ngx.sheet.performance.revenueUnconfirmed", { year: perf.latestYear })
      : undefined;
  const cell = (v: number | null) => <td className={v != null && v < 0 ? styles.negative : undefined}>{bn(v)}</td>;
  const axis = (v: number) => format.number(v, { notation: "compact", maximumFractionDigits: 1 });
  return (
    <>
      {years.length === 0 ? (
        <div className={styles.empty}>{t("ngx.sheet.performance.empty")}</div>
      ) : (
        <>
          <div className={styles.grid}>
            <Stat
              label={t("ngx.sheet.performance.cagrRevenue")}
              value={pct(perf.revenueCagr.cagr, 1, true)}
              note={
                perf.revenueCagr.cagr != null
                  ? t("ngx.sheet.performance.cagrSpan", {
                      from: perf.revenueCagr.fromYear ?? "",
                      to: perf.revenueCagr.toYear ?? "",
                    })
                  : undefined
              }
            />
            <Stat
              label={t("ngx.sheet.performance.cagrNet")}
              value={pct(perf.netIncomeCagr.cagr, 1, true)}
              note={
                perf.netIncomeCagr.cagr != null
                  ? t("ngx.sheet.performance.cagrSpan", {
                      from: perf.netIncomeCagr.fromYear ?? "",
                      to: perf.netIncomeCagr.toYear ?? "",
                    })
                  : undefined
              }
            />
            <Stat
              label={
                perf.latestRevenueGrowthYear != null
                  ? t("ngx.sheet.performance.growthYear", { year: perf.latestRevenueGrowthYear })
                  : t("ngx.sheet.performance.growth")
              }
              value={pct(perf.latestRevenueGrowthPercent, 1, true)}
              note={staleNote(perf.latestRevenueGrowthYear)}
            />
            <Stat
              label={
                perf.latestNetMarginYear != null
                  ? t("ngx.sheet.performance.netMarginYear", { year: perf.latestNetMarginYear })
                  : t("ngx.sheet.performance.netMargin")
              }
              value={pct(perf.latestNetMarginPercent, 1)}
              note={staleNote(perf.latestNetMarginYear)}
            />
          </div>
          <h3 className={styles.sub}>{t("ngx.sheet.performance.chartTitle")}</h3>
          <div className={styles.chartBox}>
            <div className={styles.legend}>
              <span>
                <i style={{ background: "var(--c-gold)" }} />
                {t("ngx.sheet.performance.legendRevenue")}
              </span>
              <span>
                <i style={{ background: "var(--c-silver)" }} />
                {t("ngx.sheet.performance.legendOperating")}
              </span>
              <span>
                <i style={{ background: "var(--c-green)" }} />
                {t("ngx.sheet.performance.legendNet")}
              </span>
            </div>
            <FinancialBars years={years} alt={t("ngx.sheet.performance.chartAlt")} formatValue={axis} />
          </div>
          <h3 className={styles.sub}>{t("ngx.sheet.performance.tableTitle")}</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t("ngx.sheet.performance.year")}</th>
                  <th scope="col">{t("ngx.sheet.performance.revenue")}</th>
                  <th scope="col">{t("ngx.sheet.performance.operatingIncome")}</th>
                  <th scope="col">{t("ngx.sheet.performance.netIncome")}</th>
                  <th scope="col">{t("ngx.sheet.performance.eps")}</th>
                  <th scope="col">{t("ngx.sheet.source")}</th>
                </tr>
              </thead>
              <tbody>
                {[...years].reverse().map((y) => (
                  <tr key={y.year}>
                    <td>{y.year}</td>
                    {cell(y.revenueBn)}
                    {cell(y.operatingIncomeBn)}
                    {cell(y.netIncomeBn)}
                    <td>{y.epsNgn == null ? na : format.decimal(y.epsNgn, 2)}</td>
                    <td>
                      {y.sourceUrl ? (
                        <a
                          className={styles.link}
                          href={y.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${t("ngx.sheet.source")} ${y.year}`}
                        >
                          ↗
                        </a>
                      ) : (
                        na
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.note}>
            {t("ngx.sheet.performance.depth", {
              count: years.length,
              from: first ?? "",
              to: last ?? "",
            })}
          </p>
        </>
      )}
      <h3 className={styles.sub}>{t("ngx.sheet.performance.documents")}</h3>
      {perf.documents.length === 0 ? (
        <div className={styles.empty}>{t("ngx.sheet.performance.documentsEmpty")}</div>
      ) : (
        <ul className={styles.list}>
          {perf.documents.map((d) => (
            <li key={d.url} className={styles.item}>
              <a className={styles.link} href={d.url} target="_blank" rel="noopener noreferrer">
                {d.title ?? d.filename ?? d.url}
              </a>
              <span className={styles.meta}>
                {[d.periodLabel, d.publishedAt, d.sourceName].filter(Boolean).join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// ───────────── 3. Perspectives ─────────────

const OUTLOOK_DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;
const CONFIDENCE_TONE: Record<string, string> = { high: styles.good, medium: styles.mid };

function OutlookSynthesis({
  model,
  t,
  locale,
  day,
}: {
  model: NgxSheetModel;
  t: T;
  locale: "fr" | "en";
  day: (iso: string | null) => string;
}) {
  const synthesis = model.outlook.synthesis;
  const title = <h3 className={styles.sub}>{t("ngx.sheet.outlook.synthesis.title")}</h3>;
  if (!synthesis) {
    return (
      <>
        {title}
        <div className={styles.empty}>{t("ngx.sheet.outlook.synthesis.empty")}</div>
      </>
    );
  }
  const summary = outlookSummary(synthesis, locale);
  const analysts = synthesis.items.filter((i) => i.type === "analyst");
  const others = synthesis.items.filter((i) => i.type !== "analyst");
  const when = (i: NgxOutlookItem) =>
    i.date ? (OUTLOOK_DATE_ISO.test(i.date) ? day(i.date) : i.date) : t("ngx.sheet.outlook.synthesis.noDate");
  const itemLine = (i: NgxOutlookItem, key: string) => (
    <li key={key} className={styles.item}>
      <span className={styles.outlookTags}>
        <span className={styles.badge}>{t(`ngx.sheet.outlook.synthesis.types.${i.type}`)}</span>
        {i.confidence ? (
          <span
            className={`${styles.badge} ${CONFIDENCE_TONE[i.confidence] ?? ""}`}
            title={t("ngx.sheet.outlook.synthesis.confidenceLabel")}
          >
            {t(`ngx.sheet.outlook.synthesis.confidence.${i.confidence}`)}
          </span>
        ) : null}
      </span>
      <span className={styles.outlookText}>{outlookText(i, locale)}</span>
      <span className={styles.meta}>
        {t("ngx.sheet.outlook.synthesis.sourceLine", { source: i.sourceName ?? "—", date: when(i) })}
        {i.url ? (
          <>
            {" · "}
            <a className={styles.link} href={i.url} target="_blank" rel="noopener noreferrer">
              {t("ngx.sheet.outlook.open")} ↗
            </a>
          </>
        ) : null}
      </span>
    </li>
  );
  return (
    <div className={styles.synthesis}>
      <div className={styles.synthesisHead}>
        {title}
        {synthesis.updatedAt ? (
          <span className={styles.meta}>
            {t("ngx.sheet.outlook.synthesis.updatedOn", { date: day(synthesis.updatedAt.slice(0, 10)) })}
          </span>
        ) : null}
      </div>
      <p className={styles.lead}>{t("ngx.sheet.outlook.synthesis.lead")}</p>
      {summary.bullets.length > 0 ? (
        <div className={styles.card}>
          <h4 className={styles.synthesisTitle}>{t("ngx.sheet.outlook.synthesis.keyPointsTitle")}</h4>
          <ul className={styles.synthesisList}>
            {summary.bullets.map((b, idx) => (
              <li key={`b-${idx}`}>{b}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {summary.watch.length > 0 ? (
        <div className={`${styles.card} ${styles.synthesisWatch}`}>
          <h4 className={styles.synthesisTitle}>{t("ngx.sheet.outlook.synthesis.watchTitle")}</h4>
          <ul className={styles.synthesisList}>
            {summary.watch.map((w, idx) => (
              <li key={`w-${idx}`}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <h4 className={styles.synthesisTitle}>{t("ngx.sheet.outlook.synthesis.analystsTitle")}</h4>
      {analysts.length === 0 ? (
        <div className={styles.empty}>{t("ngx.sheet.outlook.synthesis.analystsEmpty")}</div>
      ) : (
        <ul className={styles.list}>{analysts.map((i, idx) => itemLine(i, `a-${idx}`))}</ul>
      )}
      {others.length > 0 ? (
        <details className={styles.synthesisMore}>
          <summary>{t("ngx.sheet.outlook.synthesis.sourcesTitle", { count: others.length })}</summary>
          <ul className={styles.list}>{others.map((i, idx) => itemLine(i, `o-${idx}`))}</ul>
        </details>
      ) : null}
    </div>
  );
}

function Outlook({
  model,
  t,
  locale,
  pct,
  day,
}: {
  model: NgxSheetModel;
  t: T;
  locale: "fr" | "en";
  pct: (v: number | null, d?: number, s?: boolean) => string;
  day: (iso: string | null) => string;
}) {
  const o = model.outlook;
  const eventList = (events: typeof o.upcoming, empty: string) =>
    events.length === 0 ? (
      <div className={styles.empty}>{empty}</div>
    ) : (
      <ul className={styles.list}>
        {events.map((e) => (
          <li key={`${e.eventDate}-${e.title}`} className={styles.item}>
            <strong>{e.title}</strong>
            <span className={styles.meta}>
              {t("ngx.sheet.outlook.publishedOn", {
                source: e.sourceName,
                date: day(e.eventDate),
              })}
            </span>
            {e.url ? (
              <a className={styles.link} href={e.url} target="_blank" rel="noopener noreferrer">
                {t("ngx.sheet.outlook.open")} ↗
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    );
  return (
    <>
      <OutlookSynthesis model={model} t={t} locale={locale} day={day} />
      <h3 className={styles.sub}>{t("ngx.sheet.outlook.guidanceTitle")}</h3>
      {o.guidance.length === 0 ? (
        <div className={styles.empty}>{t("ngx.sheet.outlook.guidanceEmpty")}</div>
      ) : (
        <ul className={styles.list}>
          {o.guidance.map((g) => (
            <li key={`${g.eventDate}-${g.title}`} className={styles.item}>
              <strong>{g.title}</strong>
              {g.comment ? <blockquote>{g.comment}</blockquote> : null}
              <span className={styles.meta}>
                {t("ngx.sheet.outlook.publishedOn", {
                  source: g.sourceName,
                  date: day(g.eventDate),
                })}
              </span>
              {g.url ? (
                <a className={styles.link} href={g.url} target="_blank" rel="noopener noreferrer">
                  {t("ngx.sheet.outlook.open")} ↗
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <h3 className={styles.sub}>{t("ngx.sheet.outlook.upcomingTitle")}</h3>
      {eventList(o.upcoming, t("ngx.sheet.outlook.upcomingEmpty"))}
      <h3 className={styles.sub}>{t("ngx.sheet.outlook.pastTitle")}</h3>
      {eventList(o.past, t("ngx.sheet.outlook.pastEmpty"))}
      <h3 className={styles.sub}>{t("ngx.sheet.outlook.sectorTitle")}</h3>
      {o.sectorRevenueCagr.median != null ? (
        <div className={styles.card}>
          {t("ngx.sheet.outlook.sectorBody", {
            count: o.sectorRevenueCagr.n,
            value: pct(o.sectorRevenueCagr.median, 1, true),
          })}
        </div>
      ) : (
        <div className={styles.empty}>{t("ngx.sheet.outlook.sectorEmpty")}</div>
      )}
    </>
  );
}

// ───────────── 4. Prix et multiples ─────────────

function PriceMultiples({
  model,
  t,
  ngn,
  bn,
  pct,
  mult,
}: {
  model: NgxSheetModel;
  t: T;
  ngn: (v: number | null) => string;
  bn: (v: number | null) => string;
  pct: (v: number | null, d?: number, s?: boolean) => string;
  mult: (v: number | null) => string;
}) {
  const m = model.price.metrics;
  const fy = m.fiscalYear != null ? t("ngx.sheet.price.fiscalYear", { year: m.fiscalYear }) : undefined;
  const hasAny = m.per != null || m.pbr != null || m.yieldPercent != null || m.marketCapBn != null;
  // Multiple non calculé pour une raison précise : « n/s » ou capitaux propres négatifs, jamais un nombre trompeur.
  const ratio = (value: number | null, status: typeof m.pbrStatus, negativeLabel: string) =>
    value != null
      ? mult(value)
      : status === "negative"
        ? negativeLabel
        : status === "not_significant" || status === "stale"
          ? t("ngx.sheet.price.notSignificant")
          : t("ngx.sheet.na");
  const yearNote = (label: string, year: number | null) => (year != null ? `${label} · ${year}` : label);
  const unconfirmed = m.equityUnconfirmed;
  return (
    <>
      <div className={styles.grid}>
        <Stat label={t("ngx.sheet.price.price")} value={ngn(model.header.close)} />
        <Stat
          label={t("ngx.sheet.price.marketCap")}
          value={bn(m.marketCapBn)}
          note={t("ngx.sheet.price.howMarketCap")}
        />
        <Stat
          label={t("ngx.sheet.price.per")}
          value={ratio(m.per, m.perStatus, t("ngx.sheet.price.notSignificant"))}
          note={yearNote(t("ngx.sheet.price.howPer"), m.perYear)}
        />
        <Stat
          label={t("ngx.sheet.price.pbr")}
          value={ratio(m.pbr, m.pbrStatus, t("ngx.sheet.price.negativeEquity"))}
          note={yearNote(t("ngx.sheet.price.howPbr"), m.equityYear)}
        />
        <Stat label={t("ngx.sheet.price.yield")} value={pct(m.yieldPercent, 2)} note={t("ngx.sheet.price.howYield")} />
        <Stat
          label={t("ngx.sheet.price.eps")}
          value={ngn(m.eps)}
          note={m.eps != null ? yearNote(t("ngx.sheet.price.epsPublished"), m.epsYear) : fy}
        />
        <Stat
          label={t("ngx.sheet.price.bvps")}
          value={ngn(m.bvps)}
          note={m.bvps != null ? t("ngx.sheet.price.bvpsNote", { year: m.bvpsYear ?? "" }) : undefined}
        />
        <Stat
          label={t("ngx.sheet.price.roe")}
          value={m.staleAccountsYear != null ? t("ngx.sheet.price.notSignificant") : pct(m.roePercent, 1)}
          note={m.roePercent != null ? t("ngx.sheet.price.roeNote", { year: m.roeYear ?? "" }) : undefined}
        />
      </div>
      {unconfirmed ? (
        <p className={styles.note}>
          <span className={`${styles.badge} ${styles.mid}`}>{t("ngx.sheet.price.unconfirmedBadge")}</span>{" "}
          {m.equityYear != null
            ? t("ngx.sheet.price.unconfirmedUsing", { year: unconfirmed.year, basis: m.equityYear })
            : t("ngx.sheet.price.unconfirmedNone", { year: unconfirmed.year })}
        </p>
      ) : null}
      {m.staleAccountsYear != null ? (
        <p className={styles.note}>{t("ngx.sheet.price.staleAccountsNote", { year: m.staleAccountsYear })}</p>
      ) : null}
      {m.pbrStatus === "not_significant" ? <p className={styles.note}>{t("ngx.sheet.price.notSignificantNote")}</p> : null}
      <p className={styles.note}>{hasAny ? t("ngx.sheet.price.negative") : t("ngx.sheet.price.missing")}</p>
    </>
  );
}

// ───────────── 5. Valorisation ─────────────

function Valuation({
  model,
  t,
  format,
  ngn,
  pct,
}: {
  model: NgxSheetModel;
  t: T;
  format: Fmt;
  ngn: (v: number | null) => string;
  pct: (v: number | null, d?: number, s?: boolean) => string;
}) {
  const { summary, estimates } = model.valuation;
  const price = model.header.close;
  const tone =
    summary.verdict === "BELOW"
      ? styles.good
      : summary.verdict === "ABOVE"
        ? styles.bad
        : summary.verdict === "WITHIN"
          ? styles.mid
          : "";
  if (summary.verdict === "UNKNOWN" || summary.low == null || summary.high == null || price == null) {
    return <div className={styles.empty}>{t("ngx.sheet.valuation.empty")}</div>;
  }
  const lo = Math.min(summary.low, price);
  const hi = Math.max(summary.high, price);
  const span = hi - lo || 1;
  const pos = (v: number) => `${(((v - lo) / span) * 84 + 8).toFixed(2)}%`;
  const label = (e: FairValueEstimate) => t(`ngx.sheet.valuation.methods.${e.method}`);
  return (
    <>
      <div className={styles.verdictRow}>
        <span className={`${styles.badge} ${tone}`}>{t(`ngx.sheet.valuation.verdict.${summary.verdict}`)}</span>
        <span className={styles.verdictBig}>
          {t("ngx.sheet.valuation.gapToMid")} : {pct(summary.gapToMidPercent, 0, true)}
        </span>
      </div>
      <div className={styles.card}>
        <div className={styles.statLabel}>{t("ngx.sheet.valuation.range")}</div>
        <div
          className={styles.rangeBar}
          role="img"
          aria-label={`${ngn(summary.low)} – ${ngn(summary.high)} / ${ngn(price)}`}
        >
          <div
            className={styles.rangeFill}
            style={{
              left: pos(summary.low),
              width: `calc(${pos(summary.high)} - ${pos(summary.low)})`,
            }}
          />
          <div className={styles.rangePin} style={{ left: pos(price) }} />
          <span className={styles.rangePinLabel} style={{ left: pos(price) }}>
            {ngn(price)}
          </span>
        </div>
        <div className={styles.grid}>
          <Stat label={t("ngx.sheet.valuation.range")} value={`${ngn(summary.low)} – ${ngn(summary.high)}`} />
          <Stat label={t("ngx.sheet.valuation.mid")} value={ngn(summary.mid)} />
        </div>
      </div>
      <h3 className={styles.sub}>{t("ngx.sheet.valuation.method")}</h3>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t("ngx.sheet.valuation.method")}</th>
              <th scope="col">{t("ngx.sheet.valuation.value")}</th>
              <th scope="col">{t("ngx.sheet.valuation.gap")}</th>
            </tr>
          </thead>
          <tbody>
            {estimates.map((e) => (
              <tr key={e.method}>
                <td style={{ whiteSpace: "normal" }}>
                  {label(e)}
                  {e.lowConfidence ? (
                    <span className={styles.meta}>{t("ngx.sheet.valuation.lowConfidence")}</span>
                  ) : null}
                </td>
                <td>{ngn(e.value)}</td>
                <td>{format.percent(e.priceGapPercent, 0, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.note}>
        {t("ngx.sheet.valuation.band", { percent: VALUATION_BAND_PERCENT })} {t("ngx.sheet.valuation.indicative")}
      </p>
    </>
  );
}

// ───────────── 6. Moyenne du secteur ─────────────

function SectorAverage({
  model,
  t,
  format,
  na,
  pct,
  mult,
}: {
  model: NgxSheetModel;
  t: T;
  format: Fmt;
  na: string;
  pct: (v: number | null, d?: number, s?: boolean) => string;
  mult: (v: number | null) => string;
}) {
  const { rows, peers, lowConfidence } = model.sectorComparison;
  const usable = rows.some((r) => r.stat.median != null);
  const isRatio = (k: SectorMetricKey) => k === "per" || k === "pbr";
  const show = (k: SectorMetricKey, v: number | null) => (isRatio(k) ? mult(v) : pct(v, 1));
  // Société : « n/s » ou capitaux propres négatifs plutôt qu'un tiret quand le multiple existe mais n'a pas de sens.
  const own = (r: (typeof rows)[number]) =>
    r.company != null
      ? show(r.key, r.company)
      : r.companyStatus === "negative" && r.key === "pbr"
        ? t("ngx.sheet.price.negativeEquity")
        : r.companyStatus === "negative" || r.companyStatus === "not_significant" || r.companyStatus === "stale"
          ? t("ngx.sheet.price.notSignificant")
          : na;
  const gap = (k: SectorMetricKey, company: number | null, median: number | null, rel: number | null) => {
    if (isRatio(k)) return rel == null ? na : format.percent(rel, 0, true);
    if (company == null || median == null) return na;
    return `${format.signed(company - median, 1)} ${t("ngx.sheet.sector.points")}`;
  };
  return (
    <>
      <p className={styles.lead}>{t("ngx.sheet.sector.lead", { sector: model.sector.name })}</p>
      {!usable ? (
        <div className={styles.empty}>{t("ngx.sheet.sector.empty")}</div>
      ) : (
        <>
          <div className={styles.verdictRow}>
            <span className={styles.badge}>{t("ngx.sheet.sector.peers", { count: peers })}</span>
            {lowConfidence ? (
              <span className={`${styles.badge} ${styles.mid}`}>{t("ngx.sheet.sector.lowConfidence")}</span>
            ) : null}
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t("ngx.sheet.sector.metric")}</th>
                  <th scope="col">{model.ticker}</th>
                  <th scope="col">{t("ngx.sheet.sector.median")}</th>
                  <th scope="col">{t("ngx.sheet.sector.gap")}</th>
                  <th scope="col">{t("ngx.sheet.sector.n")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td>{t(`ngx.sheet.sector.metrics.${r.key}`)}</td>
                    <td>{own(r)}</td>
                    <td>
                      {show(r.key, r.stat.median)}
                      {r.stat.median != null && r.stat.lowConfidence ? "*" : ""}
                    </td>
                    <td>{gap(r.key, r.company, r.stat.median, r.gapPercent)}</td>
                    <td>{r.stat.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {model.sector.group === "BANKING" || model.sector.group === "INSURANCE" ? (
        <p className={styles.note}>{t("ngx.sheet.sector.financialNote")}</p>
      ) : null}
    </>
  );
}

// ───────────── 7. Dividendes ─────────────

function Dividends({
  model,
  t,
  format,
  na,
  ngn,
  pct,
  day,
}: {
  model: NgxSheetModel;
  t: T;
  format: Fmt;
  na: string;
  ngn: (v: number | null) => string;
  pct: (v: number | null, d?: number, s?: boolean) => string;
  day: (iso: string | null) => string;
}) {
  const d = model.dividends;
  if (d.lines.length === 0) return <div className={styles.empty}>{t("ngx.sheet.dividends.empty")}</div>;
  const unconfirmed = d.currentDps == null;
  const lateYear =
    !unconfirmed && d.currentDpsYear != null && d.lastFiscalYear != null && d.currentDpsYear < d.lastFiscalYear;
  const currentNote = unconfirmed
    ? t("ngx.sheet.dividends.unconfirmed")
    : lateYear
      ? t("ngx.sheet.dividends.latestKnown", { year: d.currentDpsYear ?? "", fiscal: d.lastFiscalYear ?? "" })
      : undefined;
  const yieldNote = unconfirmed ? t("ngx.sheet.dividends.unconfirmed") : undefined;
  const unknownYears = d.yearsPaid ? d.yearsPaid.window - d.yearsPaid.known : 0;
  const partial = unknownYears > 0;
  return (
    <>
      <div className={styles.grid}>
        <Stat label={t("ngx.sheet.dividends.current")} value={ngn(d.currentDps)} note={currentNote} />
        <Stat label={t("ngx.sheet.dividends.yield")} value={pct(d.currentYieldPercent, 2)} note={yieldNote} />
        <Stat
          label={t("ngx.sheet.dividends.yearsPaid")}
          value={
            d.yearsPaid && d.yearsPaid.known > 0
              ? t(
                  partial ? "ngx.sheet.dividends.yearsPaidPartial" : "ngx.sheet.dividends.yearsPaidValue",
                  { paid: d.yearsPaid.paid, window: d.yearsPaid.window },
                )
              : na
          }
          note={partial ? t("ngx.sheet.dividends.yearsUnknown", { count: unknownYears }) : undefined}
        />
        <Stat label={t("ngx.sheet.dividends.growth")} value={pct(d.growthPercent, 0, true)} note={yieldNote} />
      </div>
      <h3 className={styles.sub}>{t("ngx.sheet.dividends.dps")}</h3>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t("ngx.sheet.dividends.year")}</th>
              <th scope="col">{t("ngx.sheet.dividends.dps")}</th>
              <th scope="col">{t("ngx.sheet.dividends.payout")}</th>
              <th scope="col">{t("ngx.sheet.dividends.exDate")}</th>
              <th scope="col">{t("ngx.sheet.dividends.paymentDate")}</th>
            </tr>
          </thead>
          <tbody>
            {d.missingYears.map((m) => (
              <tr key={`nd-${m.year}`}>
                <td>{m.year}</td>
                <td colSpan={4}>{t("ngx.sheet.dividends.unconfirmed")}</td>
              </tr>
            ))}
            {d.lines.map((l) => (
              <tr key={l.year}>
                <td>{l.year}</td>
                <td>{format.decimal(l.dps, 2)}</td>
                <td>{pct(l.payoutPercent, 0)}</td>
                <td>{day(l.exDate)}</td>
                <td>{day(l.paymentDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.note}>{t("ngx.sheet.dividends.note")}</p>
    </>
  );
}

// ───────────── 8. Conclusion par politique ─────────────

function criterionValue(c: PolicyCriterion, t: T, format: Fmt, v: number | null): string {
  const na = t("ngx.sheet.na");
  if (v == null || NO_VALUE_KEYS.has(c.key)) return na;
  if (c.key === "liquidity") return `${format.number(v, { notation: "compact", maximumFractionDigits: 1 })} ₦`;
  if (INTEGER_KEYS.has(c.key)) return format.integer(v);
  return format.percent(v, c.key === "earningsConsistency" ? 0 : 1);
}

function Conclusion({ model, t, format, locale }: { model: NgxSheetModel; t: T; format: Fmt; locale: "fr" | "en" }) {
  return (
    <>
      <NgxScoreBlock score={model.score} t={t} format={format} locale={locale} />
      <div className={styles.policies}>
        {model.policies.map((p) => {
          const ps = model.score.policies.find((x) => x.type === p.type);
          const def = localizedTypeDef(getPortfolioTypeDef(p.type), locale);
          const tone =
            p.verdict === "FAVORABLE"
              ? styles.good
              : p.verdict === "UNFAVORABLE"
                ? styles.bad
                : p.verdict === "MIXED"
                  ? styles.mid
                  : "";
          return (
            <article key={p.type} className={`${styles.card} ${styles.policy}`}>
              <header>
                <h3>{def.label}</h3>
                <span className={`${styles.badge} ${tone}`}>{t(`ngx.sheet.conclusion.verdict.${p.verdict}`)}</span>
              </header>
              <p className={`${styles.policySummary} ${styles.policyScore}`} data-policy-score={p.type}>
                <strong>
                  {ps?.score != null
                    ? t("ngx.sheet.score.policyScore", { score: format.integer(ps.score) })
                    : t("ngx.sheet.score.policyNd")}
                </strong>
                {ps?.score == null && ps && ps.missing.length > 0
                  ? ` · ${t("ngx.sheet.score.policyMissing", { pillars: ps.missing.map((k) => t(`ngx.sheet.score.pillar.${k}`)).join(", ") })}`
                  : ""}
              </p>
              <p className={styles.policySummary}>
                {t("ngx.sheet.conclusion.criteria", {
                  ok: p.okCount,
                  count: p.evaluated,
                })}
              </p>
              <ul className={styles.criteria}>
                {p.criteria.map((c) => {
                  const dot =
                    c.status === "OK"
                      ? styles.dotOk
                      : c.status === "NEUTRAL"
                        ? styles.dotNeutral
                        : c.status === "KO"
                          ? styles.dotKo
                          : "";
                  const showThreshold = c.threshold != null && !NO_VALUE_KEYS.has(c.key);
                  return (
                    <li key={c.key}>
                      <span className={styles.cLabel}>
                        <span className={`${styles.dot} ${dot}`} aria-hidden="true" />
                        {t(`ngx.sheet.conclusion.criterion.${c.key}`)}
                      </span>
                      <span className={styles.cValue}>
                        {c.key === "valuation" && model.valuation.summary.verdict !== "UNKNOWN"
                          ? t(`ngx.sheet.valuation.verdict.${model.valuation.summary.verdict}`)
                          : criterionValue(c, t, format, c.value)}
                        <span className={styles.srOnly}> — {t(`ngx.sheet.conclusion.status.${c.status}`)}</span>
                      </span>
                      {showThreshold ? (
                        <span className={styles.cThreshold}>
                          {t("ngx.sheet.conclusion.threshold", {
                            value: `${CEILING_KEYS.has(c.key) ? "≤" : "≥"} ${criterionValue(c, t, format, c.threshold)}`,
                          })}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </article>
          );
        })}
      </div>
      <p className={styles.disclaimer}>{t("ngx.sheet.conclusion.disclaimer")}</p>
    </>
  );
}
