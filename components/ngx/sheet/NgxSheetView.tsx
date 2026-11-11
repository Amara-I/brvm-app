// Vue d'ensemble de la fiche NGX, dans l'ordre de la fiche BRVM : (informations clés et graphe
// dans la page) → Société → Informations de cotation → Note OuestBourse → Actualités et documents.
// Les 8 étapes d'analyse sont dans l'onglet Analyse fondamentale (composant partagé avec la BRVM).
// Composant serveur, sans état. Toutes les valeurs viennent du modèle (lib/ngx/sheet-model.ts).

import { getI18n } from "@/lib/i18n/get-i18n";
import type { NgxSheetModel } from "@/lib/ngx/sheet-model";
import NgxScoreBlock from "./NgxScoreBlock";
import styles from "./NgxSheet.module.css";

type Fmt = ReturnType<typeof getI18n>["format"];
type T = ReturnType<typeof getI18n>["t"];

type OverviewSectionId = "company" | "usd-accounts" | "trading" | "score" | "news";

function Section({ id, title, children }: { id: OverviewSectionId; title: string; children: React.ReactNode }) {
  return (
    <section id={`ngx-${id}`} className={styles.section} aria-labelledby={`ngx-${id}-title`}>
      <div className={styles.sectionHead}>
        <h2 id={`ngx-${id}-title`}>{title}</h2>
      </div>
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
  const { t, format, locale } = getI18n();
  const na = t("ngx.sheet.na");
  const bn = (v: number | null) =>
    v == null ? na : `${format.decimal(v, Math.abs(v) >= 100 ? 0 : 1)} ${t("ngx.sheet.unitBn")}`;
  const ngn = (v: number | null) => (v == null ? na : format.money(v, "NGN"));
  const pct = (v: number | null, digits = 1, sign = false) => (v == null ? na : format.percent(v, digits, sign));
  const day = (iso: string | null) =>
    iso
      ? format.date(`${iso}T00:00:00.000Z`, {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        })
      : na;

  return (
    <div>
      <Section id="company" title={t("ngx.company.overview.company")}>
        <Presentation model={model} t={t} format={format} na={na} ngn={ngn} bn={bn} day={day} />
      </Section>
      {model.presentation.reportingCurrency ? (
        <Section id="usd-accounts" title={t("ngx.sheet.usdAccounts.title")}>
          <UsdAccounts model={model} t={t} format={format} na={na} day={day} />
        </Section>
      ) : null}
      <Section id="trading" title={t("ngx.company.overview.trading")}>
        <Trading model={model} t={t} format={format} na={na} ngn={ngn} bn={bn} pct={pct} day={day} />
      </Section>
      <Section id="score" title={t("ngx.company.overview.scoreTitle")}>
        <NgxScoreBlock score={model.score} t={t} format={format} locale={locale} />
      </Section>
      <Section id="news" title={t("ngx.company.overview.news")}>
        <News model={model} t={t} day={day} />
      </Section>
    </div>
  );
}

// ───────────── Comptes publiés en US$ (ETI, AIRTELAFRI) ─────────────

function UsdAccounts({
  model,
  t,
  format,
  na,
  day,
}: {
  model: NgxSheetModel;
  t: T;
  format: Fmt;
  na: string;
  day: (iso: string | null) => string;
}) {
  const rc = model.presentation.reportingCurrency;
  if (!rc) return null;
  const unit = t("ngx.sheet.usdAccounts.unit");
  const usd = (v: number | null | undefined) =>
    v == null ? na : `${format.decimal(v, Math.abs(v) >= 100 ? 0 : 2)} ${unit}`;
  const years = [...model.performance.years].reverse();
  return (
    <>
      <p className={styles.note} data-testid="ngx-usd-accounts">
        {rc.ngnPerUsd != null
          ? t("ngx.sheet.usdAccounts.lead", { rate: format.decimal(rc.ngnPerUsd, 2), date: day(rc.asOf) })
          : t("ngx.sheet.usdAccounts.leadNoRate")}
        {rc.sourceUrl ? (
          <>
            {" "}
            <a className={styles.link} href={rc.sourceUrl} target="_blank" rel="noopener noreferrer">
              {t("ngx.sheet.usdAccounts.fxSource")} ↗
            </a>
          </>
        ) : null}
      </p>
      {years.length === 0 ? (
        <div className={styles.empty}>{na}</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t("ngx.sheet.usdAccounts.year")}</th>
                <th scope="col">{t("ngx.sheet.usdAccounts.revenue")}</th>
                <th scope="col">{t("ngx.sheet.usdAccounts.operating")}</th>
                <th scope="col">{t("ngx.sheet.usdAccounts.net")}</th>
                <th scope="col">{t("ngx.sheet.usdAccounts.fcf")}</th>
                <th scope="col">{t("ngx.sheet.usdAccounts.eps")}</th>
              </tr>
            </thead>
            <tbody>
              {years.map((y) => (
                <tr key={y.year}>
                  <td>{y.year}</td>
                  <td>{usd(y.revenueBn)}</td>
                  <td>{usd(y.operatingIncomeBn)}</td>
                  <td>{usd(y.netIncomeBn)}</td>
                  <td>{usd(y.fcfBn)}</td>
                  <td>{y.epsNgn == null ? na : `${format.decimal(y.epsNgn, 4)} US$`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ───────────── Informations de cotation ─────────────

function Trading({
  model,
  t,
  format,
  na,
  ngn,
  bn,
  pct,
  day,
}: {
  model: NgxSheetModel;
  t: T;
  format: Fmt;
  na: string;
  ngn: (v: number | null) => string;
  bn: (v: number | null) => string;
  pct: (v: number | null, d?: number, s?: boolean) => string;
  day: (iso: string | null) => string;
}) {
  const h = model.header;
  const s = model.price.stats;
  const compactNgn = (v: number | null) =>
    v == null ? na : `₦${format.number(v, { notation: "compact", maximumFractionDigits: 1 })}`;
  return (
    <div className={styles.grid}>
      <Stat label={t("ngx.company.previous")} value={ngn(h.previousClose)} />
      <Stat label={t("ngx.company.volume")} value={h.volume == null ? na : format.integer(h.volume)} />
      <Stat label={t("ngx.company.session")} value={day(h.sessionDate)} />
      <Stat label={t("ngx.sheet.presentation.marketCap")} value={bn(model.price.metrics.marketCapBn)} />
      <Stat label={t("company.fundamental.field.low52")} value={ngn(s.low52)} />
      <Stat label={t("company.fundamental.field.high52")} value={ngn(s.high52)} />
      <Stat label={t("company.fundamental.field.return3m")} value={pct(s.return3mPercent, 1, true)} />
      <Stat label={t("company.fundamental.field.return1y")} value={pct(s.return1yPercent, 1, true)} />
      <Stat label={t("company.fundamental.field.avgValue")} value={compactNgn(s.avgDailyValueNgn)} />
      <Stat
        label={t("company.fundamental.field.traded")}
        value={s.tradedSessionsRatio == null ? na : pct(s.tradedSessionsRatio * 100, 0)}
      />
      <Stat label={t("company.fundamental.field.volatility")} value={pct(s.volatilityPercent, 1)} />
      <Stat label={t("company.fundamental.field.drawdown")} value={pct(s.drawdownFromHighPercent, 1)} />
    </div>
  );
}

// ───────────── Actualités, événements et documents ─────────────

function News({ model, t, day }: { model: NgxSheetModel; t: T; day: (iso: string | null) => string }) {
  const o = model.outlook;
  const docs = model.performance.documents;
  type Ev = (typeof o.upcoming)[number];
  const list = (events: Ev[], withComment = false) => (
    <ul className={styles.list}>
      {events.map((e) => (
        <li key={`${e.eventDate}-${e.title}`} className={styles.item}>
          <strong>{e.title}</strong>
          {withComment && e.comment ? <blockquote>{e.comment}</blockquote> : null}
          <span className={styles.meta}>
            {t("ngx.sheet.outlook.publishedOn", { source: e.sourceName, date: day(e.eventDate) })}
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
  const noEvents = o.guidance.length === 0 && o.upcoming.length === 0 && o.past.length === 0;
  return (
    <>
      {noEvents ? <div className={styles.empty}>{t("ngx.company.overview.eventsEmpty")}</div> : null}
      {o.upcoming.length > 0 ? (
        <>
          <h3 className={styles.sub}>{t("ngx.company.overview.upcoming")}</h3>
          {list(o.upcoming)}
        </>
      ) : null}
      {o.past.length > 0 ? (
        <>
          <h3 className={styles.sub}>{t("ngx.company.overview.past")}</h3>
          {list(o.past)}
        </>
      ) : null}
      {o.guidance.length > 0 ? (
        <>
          <h3 className={styles.sub}>{t("ngx.company.overview.guidance")}</h3>
          {list(o.guidance, true)}
        </>
      ) : null}
      <h3 className={styles.sub}>{t("ngx.company.overview.documents")}</h3>
      {docs.length === 0 ? (
        <div className={styles.empty}>{t("ngx.company.overview.documentsEmpty")}</div>
      ) : (
        <ul className={styles.list}>
          {docs.map((d) => (
            <li key={d.url} className={styles.item}>
              <a className={styles.link} href={d.url} target="_blank" rel="noopener noreferrer">
                {d.title ?? d.filename ?? d.url}
              </a>
              <span className={styles.meta}>{[d.periodLabel, d.publishedAt, d.sourceName].filter(Boolean).join(" · ")}</span>
            </li>
          ))}
        </ul>
      )}
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
