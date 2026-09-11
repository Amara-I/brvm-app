"use client";

// Fiche société premium — alignée captures OuestBourse (étape 20).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { C } from "@/lib/theme/colors";
import { usePersistedState } from "@/lib/ui/use-persisted-state";
import type { CompanySheetPayload } from "@/lib/api/company-sheet-dataset";
import type { ChartClosePoint } from "@/lib/charts/indicators";
import { rangeFilter, type ChartRange } from "@/lib/charts/indicators";
import CompanyProjectionPanel from "@/components/actions/CompanyProjectionPanel";
import CompanyComparisonPanel from "@/components/actions/CompanyComparisonPanel";
import FilterableSheetTable from "@/components/actions/FilterableSheetTable";
import ShareholdingPanel from "@/components/actions/ShareholdingPanel";
import ChartWorkbench from "@/components/charts/ChartWorkbench";
import PortfolioTickerAction from "@/components/portfolio/PortfolioTickerAction";
import ChangeValue from "@/components/ui/ChangeValue";
import styles from "./CompanySheet.module.css";

const DATA_SOURCE_LABELS: Record<string, string> = {
  BRVM_OFFICIEL: "BRVM officiel",
  SIKAFINANCE: "Sikafinance",
  OUESTBOURSE: "OuestBourse.com",
  RICHBOURSE: "Richbourse",
  MANUEL: "Saisie manuelle",
};

type TabKey =
  | "overview"
  | "charts"
  | "projection"
  | "comparison"
  | "financials"
  | "interims"
  | "dividends"
  | "societe"
  | "actualites"
  | "documents";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Vue d'ensemble" },
  { key: "charts", label: "Graphes" },
  { key: "projection", label: "🔮 Projection future" },
  { key: "comparison", label: "⚖️ Comparaison" },
  { key: "financials", label: "Données financières" },
  { key: "interims", label: "Interims" },
  { key: "dividends", label: "Dividendes" },
  { key: "societe", label: "Société" },
  { key: "actualites", label: "Actualités" },
  { key: "documents", label: "Documents" },
];

const RANGES: Array<{ key: ChartRange; label: string }> = [
  { key: "1M", label: "1M" },
  { key: "1A", label: "1A" },
  { key: "5A", label: "5A" },
  { key: "MAX", label: "Max" },
];

function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1).replace(".", ",")}%`;
}

function fmtNum(n: number): string {
  return Math.round(n).toLocaleString("fr-FR");
}

function fmtDivDate(iso: string | null | undefined): string {
  if (!iso) return "N/D";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "N/D";
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Introduction en bourse style BRVM : « 2 oct. 1998 ». */
function formatListingDate(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return "N/D";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return "N/D";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function websiteHref(raw: string | null | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

function websiteLabel(raw: string | null | undefined): string {
  const s = raw?.trim();
  if (!s) return "N/D";
  try {
    const u = new URL(websiteHref(s)!);
    return u.hostname.replace(/^www\./, "") + (u.pathname !== "/" ? u.pathname : "");
  } catch {
    return s.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  }
}

export default function CompanySheetClient({
  payload,
  isAuthenticated = false,
  initialTab,
}: {
  payload: CompanySheetPayload;
  isAuthenticated?: boolean;
  /** Onglet initial (ex. ?tab=charts depuis le sélecteur de ticker du graphe). */
  initialTab?: TabKey;
}) {
  const {
    company,
    peers,
    metrics,
    health,
    performance,
    keyRows,
    sessionDate,
    dayChangePercent,
    dayChangeAbs,
    isin,
    description,
    listedSince,
    profileMeta,
    documents,
    events,
    news,
    dividendSchedule,
    incomeStatement,
  } = payload;
  const [tab, setTab] = usePersistedState<TabKey>(`ouestbourse:sheet:${company.ticker}:tab`, "overview");

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab, setTab]);
  const [range, setRange] = usePersistedState<ChartRange>(`ouestbourse:sheet:${company.ticker}:range`, "1A");
  const [series, setSeries] = useState<ChartClosePoint[]>(payload.series);
  const [denseLoading, setDenseLoading] = useState(false);

  // Densifie via l'API charts (Richbourse) si l'historique DB est trop annuel.
  useEffect(() => {
    let cancelled = false;
    async function densify() {
      if (payload.series.length >= 60) return;
      setDenseLoading(true);
      try {
        const res = await fetch(`/api/charts/${company.ticker}`);
        const json = await res.json();
        if (!cancelled && json.ok && Array.isArray(json.data?.series) && json.data.series.length > series.length) {
          setSeries(json.data.series as ChartClosePoint[]);
        }
      } catch {
        /* conserve la série serveur */
      } finally {
        if (!cancelled) setDenseLoading(false);
      }
    }
    void densify();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.ticker]);

  const chartUniverse = useMemo(
    () =>
      peers.map((c) => ({
        ticker: c.ticker,
        name: c.name,
        color: c.color,
        sector: c.sector,
        countryFlag: c.countryFlag,
      })),
    [peers]
  );

  const sectorPeers = useMemo(() => {
    return peers
      .filter((p) => p.sector === company.sector && p.ticker !== company.ticker)
      .map((p) => {
        const years = Object.keys(p.prices)
          .map(Number)
          .filter((y) => (p.prices[y] ?? 0) > 0)
          .sort((a, b) => a - b);
        const y = years[years.length - 1];
        const lastPrice = y != null ? p.prices[y]! : 0;
        return { ...p, lastPrice };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [peers, company.sector, company.ticker]);

  const chartSeries = useMemo(() => rangeFilter(series, range), [series, range]);
  const last = chartSeries[chartSeries.length - 1] ?? series[series.length - 1];
  const prev = chartSeries.length >= 2 ? chartSeries[chartSeries.length - 2] : null;
  const price = metrics.currentPrice || last?.value || 0;
  const chgPct = dayChangePercent ?? (last && prev && prev.value ? ((last.value - prev.value) / prev.value) * 100 : null);
  const chgAbs = dayChangeAbs ?? (last && prev ? last.value - prev.value : null);
  const up = (chgPct ?? 0) >= 0;

  const ohlc = useMemo(() => {
    if (!last || !prev) {
      return { o: "N/D", h: "N/D", l: "N/D", c: price > 0 ? fmtNum(price) : "N/D", vol: "N/D", var: "N/D" };
    }
    const open = prev.value;
    const close = last.value;
    const high = Math.max(open, close);
    const low = Math.min(open, close);
    const v = open > 0 ? ((close - open) / open) * 100 : 0;
    return {
      o: fmtNum(open),
      h: fmtNum(high),
      l: fmtNum(low),
      c: fmtNum(close),
      vol: last.volume && last.volume > 0 ? last.volume.toLocaleString("fr-FR") : "N/D",
      var: `${v >= 0 ? "+" : ""}${v.toFixed(2).replace(".", ",")}%`,
    };
  }, [last, prev, price]);

  const dividendChart = useMemo(
    () =>
      payload.years
        .filter((y) => (company.dividends[y] ?? 0) > 0)
        .map((y) => {
          const amount = company.dividends[y]!;
          const px = company.prices[y] ?? 0;
          const yieldPct = px > 0 ? Math.round((amount / px) * 10000) / 100 : null;
          return { year: String(y), amount, yieldPct };
        }),
    [payload.years, company]
  );

  const incomeChart = useMemo(
    () =>
      (incomeStatement ?? []).map((p) => ({
        year: String(p.year),
        ca: p.revenue,
        resultatNet: p.netIncome,
        resultatExploitation: p.operatingIncome,
      })),
    [incomeStatement]
  );

  const paidYears = dividendChart.length;
  const lastDiv = dividendChart[dividendChart.length - 1];

  const sessionLabel = sessionDate
    ? new Date(`${sessionDate}T12:00:00Z`).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "N/D";

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link href="/societes-cotees">Sociétés cotées</Link>
        <span aria-hidden="true"> / </span>
        <span>{company.ticker}</span>
      </div>

      {/* Header */}
      <header className={styles.hero}>
        <div className={styles.heroMain}>
          <div className={styles.logoMark} style={{ borderColor: company.color }}>
            {company.ticker.slice(0, 2)}
          </div>
          <div>
            <h1 className={styles.title}>{company.name}</h1>
            <div className={styles.subline}>
              <strong>{company.ticker}</strong>
              {isin && (
                <>
                  <span>·</span>
                  <span>ISIN {isin}</span>
                </>
              )}
              <span>·</span>
              <span>{company.sector}</span>
              <span>·</span>
              <span>
                {company.countryFlag} {company.country}
              </span>
            </div>
          </div>
        </div>
        <div className={styles.heroPrice}>
          <div className={styles.price}>{price > 0 ? `${fmtNum(price)} FCFA` : <span className="ob-nd">N/D</span>}</div>
          <div className={styles.chg}>
            <ChangeValue value={chgPct} pill />
            {chgAbs != null ? (
              <span className="ob-num" style={{ marginLeft: 6, color: "var(--c-textdim)" }}>
                ({chgAbs >= 0 ? "+" : ""}
                {fmtNum(chgAbs)})
              </span>
            ) : null}
          </div>
        </div>
        <div className={styles.heroActions}>
          <button type="button" className={styles.btnGhost} disabled title="Bientôt">
            ★ Suivre
          </button>
          <PortfolioTickerAction
            ticker={company.ticker}
            isAuthenticated={isAuthenticated}
            signal={{
              label: metrics.signal.label,
              color: metrics.signal.color,
              score: metrics.score,
            }}
            addClassName={styles.btnPrimary}
          />
        </div>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Sections de la fiche">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? styles.tabActive : styles.tab}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "charts" && (
        <div className={styles.chartWorkbenchWrap}>
          <ChartWorkbench
            universe={chartUniverse}
            initialTicker={company.ticker}
            embedded
            isAuthenticated={isAuthenticated}
          />
        </div>
      )}

      {tab === "overview" && (
        <div className={styles.layout}>
          <div className={styles.mainCol}>
            {/* Cours + aperçu (vue d'ensemble) — graphes détaillés = onglet Graphes */}
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h2 className={styles.cardTitle}>Cours</h2>
                <div className={styles.rangeRow}>
                  {RANGES.map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      className={range === r.key ? styles.rangeActive : styles.rangeBtn}
                      onClick={() => setRange(r.key)}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className={styles.sessionNote}>
                séance du {sessionLabel}
                {denseLoading ? " · densification…" : ""}
                {" · "}
                <button type="button" className={styles.textLink} onClick={() => setTab("charts")}>
                  Ouvrir les graphes détaillés
                </button>
              </p>
              <div className={styles.ohlc}>
                <span>
                  <em>O</em> {ohlc.o}
                </span>
                <span>
                  <em>H</em> {ohlc.h}
                </span>
                <span>
                  <em>B</em> {ohlc.l}
                </span>
                <span>
                  <em>C</em> {ohlc.c}
                </span>
                <span className={up ? styles.pos : styles.neg}>{ohlc.var}</span>
                <span>
                  <em>Vol</em> {ohlc.vol}
                </span>
              </div>
              <div className={styles.chartBox}>
                {chartSeries.length > 1 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={chartSeries.map((p) => ({ ...p, label: p.time.slice(0, 7) }))}>
                      <defs>
                        <linearGradient id="sheetGreen" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C.green} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={C.green} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={C.borderThin} strokeDasharray="3 3" />
                      <XAxis dataKey="label" stroke={C.textDim} fontSize={11} minTickGap={40} />
                      <YAxis stroke={C.textDim} fontSize={11} domain={["auto", "auto"]} width={64} />
                      <Tooltip
                        contentStyle={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8 }}
                        labelStyle={{ color: C.text }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        name="Cours"
                        stroke={C.green}
                        fill="url(#sheetGreen)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className={styles.empty}>Historique insuffisant (N/D).</p>
                )}
              </div>
            </section>

                {/* Scorecard de décision — AD-2026-08-22-002 (approuvée) */}
                <section className={styles.card} aria-labelledby="scorecard-title">
                  <div className={styles.cardHead}>
                    <h2 id="scorecard-title" className={styles.cardTitle}>
                      Pourquoi ce titre ?
                    </h2>
                    <span className={styles.cardMeta}>critères de décision — métriques réelles ou N/D</span>
                  </div>
                  <div className={styles.scoreGrid}>
                    {(
                      [
                        {
                          k: "Perf. 5 ans",
                          v:
                            metrics.perf5Percent === "N/D"
                              ? "N/D"
                              : `${parseFloat(metrics.perf5Percent) > 0 ? "+" : ""}${metrics.perf5Percent}%`,
                          tone:
                            metrics.perf5Percent === "N/D"
                              ? "neutral"
                              : parseFloat(metrics.perf5Percent) >= 0
                                ? "good"
                                : "bad",
                        },
                        {
                          k: "Rend. div.",
                          v:
                            metrics.dividendYieldPercent === "N/D" ||
                            metrics.dividendYieldPercent === ""
                              ? "N/D"
                              : `${metrics.dividendYieldPercent}%`,
                          tone:
                            metrics.dividendYieldPercent === "N/D" ||
                            metrics.dividendYieldPercent === ""
                              ? "neutral"
                              : "good",
                        },
                        {
                          k: "Risque",
                          v: metrics.riskLevel,
                          tone:
                            metrics.riskLevel === "Faible"
                              ? "good"
                              : metrics.riskLevel === "Moyen"
                                ? "warn"
                                : metrics.riskLevel === "N/D"
                                  ? "neutral"
                                  : "bad",
                        },
                        {
                          k: "Confiance",
                          v: metrics.confidence,
                          tone:
                            metrics.confidence === "Élevée"
                              ? "good"
                              : metrics.confidence === "Moyenne"
                                ? "warn"
                                : "neutral",
                        },
                      ] as const
                    ).map((cell) => (
                      <div key={cell.k} className={styles.scoreCell}>
                        <span className={styles.scoreKey}>{cell.k}</span>
                        <span
                          className={
                            cell.tone === "good"
                              ? styles.scoreGood
                              : cell.tone === "warn"
                                ? styles.scoreWarn
                                : cell.tone === "bad"
                                  ? styles.scoreBad
                                  : styles.scoreNeutral
                          }
                        >
                          {cell.v}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className={styles.card}>
                  <div className={styles.cardHead}>
                    <h2 className={styles.cardTitle}>Performances</h2>
                    <span className={styles.cardMeta}>séance du {sessionLabel} — hors dividendes</span>
                  </div>
                  <div className={styles.perfGrid}>
                    {[
                      { l: "1 mois", v: performance.oneMonth },
                      { l: "3 mois", v: performance.threeMonths },
                      { l: "Depuis janvier", v: performance.ytd },
                      { l: "1 an", v: performance.oneYear },
                      { l: "5 ans", v: performance.fiveYears },
                    ].map((p) => (
                      <div key={p.l} className={styles.perfItem}>
                        <div className={styles.perfLabel}>{p.l}</div>
                        <div
                          className={styles.perfValue}
                          style={{
                            color: p.v == null ? C.textDim : p.v >= 0 ? C.green : C.red,
                          }}
                        >
                          {fmtPct(p.v)}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className={styles.card}>
                  <div className={styles.cardHead}>
                    <h2 className={styles.cardTitle}>Données financières clés</h2>
                    <span className={styles.cardMeta}>indicateurs disponibles en base — pas de chiffres inventés</span>
                  </div>
                  <FilterableSheetTable
                    columns={[
                      { key: "label", label: "Indicateur", getValue: (r) => r.label },
                      { key: "current", label: "Récent", getValue: (r) => r.current },
                      { key: "previous", label: "Précédent", getValue: (r) => r.previous },
                      {
                        key: "variation",
                        label: "Variation",
                        getValue: (r) => r.variation,
                        render: (r) => (
                          <span
                            style={{
                              color: r.variation.startsWith("+")
                                ? C.green
                                : r.variation.startsWith("-")
                                  ? C.red
                                  : C.textDim,
                            }}
                          >
                            {r.variation}
                          </span>
                        ),
                      },
                    ]}
                    rows={keyRows.map((r) => ({
                      label: r.label,
                      current: r.current,
                      previous: r.previous,
                      variation: r.variation,
                    }))}
                  />
                </section>

                <section className={styles.card}>
                  <div className={styles.cardHead}>
                    <h2 className={styles.cardTitle}>Interims</h2>
                    <span className={styles.cardMeta}>cumuls depuis janvier · même période un an plus tôt</span>
                  </div>
                  <p className={styles.empty}>
                    Interims détaillés (PNB, résultat net trimestriel) non encore collectés pour cette valeur — N/D.
                  </p>
                </section>

                <section className={styles.card}>
                  <div className={styles.cardHead}>
                    <h2 className={styles.cardTitle}>Historique des dividendes</h2>
                    <span className={styles.cardMeta}>FCFA net / action · rendement %</span>
                  </div>
                  {dividendChart.length > 0 ? (
                    <>
                      <p className={styles.divSummary}>
                        {paidYears} exercice{paidYears > 1 ? "s" : ""} payé{paidYears > 1 ? "s" : ""}
                        {lastDiv
                          ? ` · dernier ${lastDiv.amount.toLocaleString("fr-FR")} FCFA — exercice ${lastDiv.year}${
                              lastDiv.yieldPct != null
                                ? ` · rendement ${String(lastDiv.yieldPct).replace(".", ",")} %`
                                : ""
                            }`
                          : ""}
                      </p>
                      <div className={styles.chartBox}>
                        <ResponsiveContainer width="100%" height={220}>
                          <ComposedChart data={dividendChart} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                            <CartesianGrid stroke={C.borderThin} strokeDasharray="3 3" />
                            <XAxis dataKey="year" stroke={C.textDim} fontSize={11} />
                            <YAxis
                              yAxisId="div"
                              stroke={C.textDim}
                              fontSize={11}
                              width={48}
                              tickFormatter={(v) => Math.round(Number(v)).toLocaleString("fr-FR")}
                            />
                            <YAxis
                              yAxisId="yield"
                              orientation="right"
                              stroke={C.textDim}
                              fontSize={11}
                              width={40}
                              tickFormatter={(v) => `${String(v).replace(".", ",")}%`}
                            />
                            <Tooltip
                              contentStyle={{
                                background: C.panel,
                                border: `1px solid ${C.border}`,
                                borderRadius: 8,
                                fontSize: "0.72rem",
                              }}
                              formatter={(value, name) => {
                                if (name === "yieldPct" || name === "Rendement") {
                                  if (value == null || !Number.isFinite(Number(value))) {
                                    return ["N/D", "Rendement"];
                                  }
                                  return [
                                    `${Number(value).toLocaleString("fr-FR", {
                                      maximumFractionDigits: 2,
                                    })} %`,
                                    "Rendement",
                                  ];
                                }
                                return [
                                  `${Number(value).toLocaleString("fr-FR")} FCFA`,
                                  "Dividende",
                                ];
                              }}
                              labelFormatter={(y) => `Exercice ${y}`}
                            />
                            <Legend
                              wrapperStyle={{ fontSize: "0.65rem", paddingTop: 4 }}
                              iconSize={8}
                              formatter={(value) =>
                                value === "amount" || value === "Dividende"
                                  ? "Dividende"
                                  : "Rendement"
                              }
                            />
                            <Bar
                              yAxisId="div"
                              dataKey="amount"
                              name="Dividende"
                              fill={C.gold}
                              radius={[4, 4, 0, 0]}
                            />
                            <Line
                              yAxisId="yield"
                              type="monotone"
                              dataKey="yieldPct"
                              name="Rendement"
                              stroke={C.blue}
                              strokeWidth={2}
                              dot={{ r: 3 }}
                              connectNulls
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                      <div className={styles.chartLegendBox}>
                        <h3 className={styles.chartLegendTitle}>Légende des courbes</h3>
                        <p className={styles.chartLegendLine}>
                          <span className={styles.legendSwatch} style={{ background: C.gold }} aria-hidden />
                          <span>
                            <strong>Dividende :</strong> montant net versé par action au titre de
                            l&apos;exercice (FCFA).
                          </span>
                        </p>
                        <p className={styles.chartLegendLine}>
                          <span className={styles.legendSwatch} style={{ background: C.blue }} aria-hidden />
                          <span>
                            <strong>Rendement :</strong> dividende ÷ cours de clôture de l&apos;année
                            (en %). Affiche N/D si le cours de l&apos;exercice est indisponible.
                          </span>
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className={styles.empty}>Aucun dividende renseigné (N/D).</p>
                  )}
                </section>

                <section className={styles.card}>
                  <div className={styles.cardHead}>
                    <h2 className={styles.cardTitle}>Chiffre d&apos;affaires et résultats</h2>
                    <span className={styles.cardMeta}>Md FCFA · CA ou PNB · comptes annuels</span>
                  </div>
                  {incomeChart.length > 0 ? (
                    <>
                      <div className={styles.chartBox}>
                        <ResponsiveContainer width="100%" height={240}>
                          <LineChart data={incomeChart} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                            <CartesianGrid stroke={C.borderThin} strokeDasharray="3 3" />
                            <XAxis dataKey="year" stroke={C.textDim} fontSize={11} />
                            <YAxis
                              stroke={C.textDim}
                              fontSize={11}
                              width={48}
                              tickFormatter={(v) =>
                                Math.abs(Number(v)) >= 100
                                  ? `${Math.round(Number(v))}`
                                  : String(v).replace(".", ",")
                              }
                            />
                            <Tooltip
                              contentStyle={{
                                background: C.panel,
                                border: `1px solid ${C.border}`,
                                borderRadius: 8,
                                fontSize: "0.78rem",
                              }}
                              formatter={(value, name) => {
                                const label =
                                  name === "ca"
                                    ? "Chiffre d'affaires"
                                    : name === "resultatNet"
                                      ? "Résultat net"
                                      : name === "resultatExploitation"
                                        ? "Résultat d'exploitation"
                                        : String(name);
                                if (value == null || !Number.isFinite(Number(value))) {
                                  return ["N/D", label];
                                }
                                return [
                                  `${Number(value).toLocaleString("fr-FR", {
                                    maximumFractionDigits: 2,
                                  })} Md`,
                                  label,
                                ];
                              }}
                              labelFormatter={(y) => `Exercice ${y}`}
                            />
                            <Legend
                              wrapperStyle={{ fontSize: "0.65rem", paddingTop: 4 }}
                              iconSize={8}
                              formatter={(value) =>
                                value === "ca"
                                  ? "Chiffre d'affaires"
                                  : value === "resultatNet"
                                    ? "Résultat net"
                                    : value === "resultatExploitation"
                                      ? "Résultat d'exploitation"
                                      : value
                              }
                            />
                            <Line
                              type="monotone"
                              dataKey="ca"
                              name="ca"
                              stroke={C.gold}
                              strokeWidth={2}
                              dot={{ r: 3 }}
                              connectNulls
                            />
                            <Line
                              type="monotone"
                              dataKey="resultatExploitation"
                              name="resultatExploitation"
                              stroke={C.blue}
                              strokeWidth={2}
                              dot={{ r: 3 }}
                              connectNulls
                            />
                            <Line
                              type="monotone"
                              dataKey="resultatNet"
                              name="resultatNet"
                              stroke={C.green}
                              strokeWidth={2}
                              dot={{ r: 3 }}
                              connectNulls
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div className={styles.chartLegendBox}>
                        <h3 className={styles.chartLegendTitle}>Légende des courbes</h3>
                        <p className={styles.chartLegendLine}>
                          <span className={styles.legendSwatch} style={{ background: C.gold }} aria-hidden />
                          <span>
                            <strong>Chiffre d&apos;affaires :</strong> montant total des ventes / prestations
                            sur l&apos;exercice, ou Produit Net Bancaire (PNB) pour les banques (en milliards de FCFA).
                          </span>
                        </p>
                        <p className={styles.chartLegendLine}>
                          <span className={styles.legendSwatch} style={{ background: C.blue }} aria-hidden />
                          <span>
                            <strong>Résultat d&apos;exploitation :</strong> profit (ou perte) lié à l&apos;activité
                            courante, avant intérêts et impôts.
                          </span>
                        </p>
                        <p className={styles.chartLegendLine}>
                          <span className={styles.legendSwatch} style={{ background: C.green }} aria-hidden />
                          <span>
                            <strong>Résultat net :</strong> bénéfice (ou perte) final de l&apos;exercice, après
                            toutes charges, intérêts et impôts.
                          </span>
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className={styles.empty}>
                      Comptes annuels (CA, résultat net, résultat d&apos;exploitation) non encore disponibles pour
                      cette valeur — N/D.
                    </p>
                  )}
                </section>
          </div>

          <aside className={styles.sideCol}>
            <section className={styles.sideCard}>
              <h3 className={styles.sideTitle}>Santé financière</h3>
              <div className={styles.healthScore}>
                <span className={styles.healthBig}>{health.overall.toFixed(1).replace(".", ",")} / 10</span>
                <span className={styles.healthPill} style={{ color: C.green }}>
                  {health.label}
                </span>
              </div>
              <div className={styles.healthBar}>
                <div className={styles.healthFill} style={{ width: `${health.overall * 10}%` }} />
              </div>
              <ul className={styles.pillarList}>
                {health.pillars.map((p) => (
                  <li key={p.key}>
                    <span>{p.label}</span>
                    <strong>{p.score.toFixed(1).replace(".", ",")}</strong>
                  </li>
                ))}
              </ul>
              <p className={styles.sideNote}>{health.note}</p>
            </section>

            <section className={styles.sideCard}>
              <h3 className={styles.sideTitle}>Gestion du risque</h3>
              <div className={styles.healthScore}>
                <span className={styles.healthBig}>{metrics.riskAnalysis.riskScore}/100</span>
                <span
                  className={styles.healthPill}
                  style={{
                    color:
                      metrics.riskAnalysis.riskScore < 40
                        ? C.green
                        : metrics.riskAnalysis.riskScore > 65
                          ? C.red
                          : C.gold,
                  }}
                >
                  {metrics.riskAnalysis.riskTier}
                </span>
              </div>
              <div className={styles.healthBar}>
                <div
                  className={styles.healthFill}
                  style={{
                    width: `${metrics.riskAnalysis.riskScore}%`,
                    background:
                      metrics.riskAnalysis.riskScore < 40
                        ? C.green
                        : metrics.riskAnalysis.riskScore > 65
                          ? C.red
                          : C.gold,
                  }}
                />
              </div>
              <ul className={styles.pillarList}>
                {metrics.riskAnalysis.pillars.map((p) => (
                  <li key={p.key}>
                    <span>{p.label.replace(/^Risque de /i, "").replace(/^Risque /i, "")}</span>
                    <strong>{p.score == null ? "N/D" : p.score}</strong>
                  </li>
                ))}
              </ul>
              <p className={styles.sideNote}>{metrics.riskAnalysis.summary}</p>
              {(metrics.riskAnalysis.maxDrawdownPercent != null ||
                metrics.riskAnalysis.var95Percent != null) && (
                <p className={styles.sideNote}>
                  {metrics.riskAnalysis.maxDrawdownPercent != null
                    ? `Drawdown max : ${String(metrics.riskAnalysis.maxDrawdownPercent).replace(".", ",")} %`
                    : "Drawdown max : N/D"}
                  {" · "}
                  {metrics.riskAnalysis.var95Percent != null
                    ? `VaR 95 % : ${String(metrics.riskAnalysis.var95Percent).replace(".", ",")} %`
                    : "VaR 95 % : N/D"}
                  {metrics.riskAnalysis.var99Percent != null
                    ? ` · VaR 99 % : ${String(metrics.riskAnalysis.var99Percent).replace(".", ",")} %`
                    : ""}
                  {metrics.riskAnalysis.cvar95Percent != null
                    ? ` · CVaR 95 % : ${String(metrics.riskAnalysis.cvar95Percent).replace(".", ",")} %`
                    : ""}
                </p>
              )}
            </section>

            <section className={styles.sideCard}>
              <h3 className={styles.sideTitle}>Identité</h3>
              <dl className={styles.identity}>
                <div>
                  <dt>Secteur</dt>
                  <dd>{company.sector}</dd>
                </div>
                <div>
                  <dt>Pays</dt>
                  <dd>
                    {company.countryFlag} {company.country}
                  </dd>
                </div>
                <div>
                  <dt>Ticker</dt>
                  <dd>{company.ticker}</dd>
                </div>
              </dl>
              <p className={styles.sideNote}>
                Profil émetteur détaillé (dirigeants, siège) non publié de façon homogène — N/D si absent des sources.
              </p>
            </section>

            <section className={styles.sideCard}>
              <h3 className={styles.sideTitle}>Signal</h3>
              <div className={styles.signalBox} style={{ borderColor: metrics.signal.color }}>
                <div style={{ color: metrics.signal.color, fontWeight: 800 }}>{metrics.signal.label}</div>
                <div className={styles.sideNote}>
                  Score {metrics.score}/100 · Confiance {metrics.confidence}
                </div>
                <p className={styles.signalText}>{metrics.signalSummary}</p>
              </div>
              <ul className={styles.pillarList} style={{ marginTop: 12 }}>
                <li>
                  <span>Court terme</span>
                  <strong>{metrics.horizonScores.court}</strong>
                </li>
                <li>
                  <span>Moyen terme</span>
                  <strong>{metrics.horizonScores.moyen}</strong>
                </li>
                <li>
                  <span>Long terme</span>
                  <strong>{metrics.horizonScores.long}</strong>
                </li>
                <li>
                  <span>Technique</span>
                  <strong>{metrics.technicalScore}</strong>
                </li>
                <li>
                  <span>Fondamental</span>
                  <strong>{metrics.fundamentalScore}</strong>
                </li>
                <li>
                  <span>Sectoriel</span>
                  <strong>{metrics.sectorScore}</strong>
                </li>
              </ul>
              {metrics.technical.available ? (
                <p className={styles.sideNote}>
                  RSI(14) : {metrics.technical.rsi14 ?? "N/D"}
                  {metrics.technical.macd
                    ? ` · MACD hist. ${metrics.technical.macd.histogram}`
                    : " · MACD N/D"}
                  {metrics.technical.sma10 != null ? ` · SMA10 ${metrics.technical.sma10}` : ""}
                  {metrics.technical.sma20 != null ? ` · SMA20 ${metrics.technical.sma20}` : ""}
                </p>
              ) : (
                <p className={styles.sideNote}>Indicateurs techniques : N/D (série trop courte).</p>
              )}
              <Link href={`/marche`} className={styles.inlineLink}>
                Voir dans le marché →
              </Link>
              <button type="button" className={styles.inlineLinkBtn} onClick={() => setTab("charts")}>
                Analyse graphique →
              </button>
            </section>

            <section className={styles.sideCard}>
              <h3 className={styles.sideTitle}>Provenance</h3>
              <dl className={styles.identity}>
                <div>
                  <dt>Source</dt>
                  <dd>
                    {company.dataSource ? DATA_SOURCE_LABELS[company.dataSource] ?? company.dataSource : "N/D"}
                  </dd>
                </div>
                <div>
                  <dt>Synchronisé</dt>
                  <dd>
                    {company.lastSyncedAt
                      ? new Date(company.lastSyncedAt).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "N/D"}
                  </dd>
                </div>
                <div>
                  <dt>Points de cours</dt>
                  <dd>{series.length || "N/D"}</dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>
      )}

      {tab === "projection" && (
        <CompanyProjectionPanel company={company} years={payload.years} metrics={metrics} />
      )}

      {tab === "comparison" && (
        <CompanyComparisonPanel company={company} companies={peers} years={payload.years} />
      )}

      {tab === "financials" && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Données financières</h2>
          <FilterableSheetTable
            columns={[
              { key: "label", label: "Indicateur", getValue: (r) => r.label },
              { key: "current", label: "Récent", getValue: (r) => r.current },
              { key: "previous", label: "Précédent", getValue: (r) => r.previous },
              { key: "variation", label: "Variation", getValue: (r) => r.variation },
            ]}
            rows={[
              ...keyRows.map((r) => ({
                label: r.label,
                current: r.current,
                previous: r.previous,
                variation: r.variation,
              })),
              {
                label: "Produit net / résultat net / bilan",
                current: "N/D — comptes détaillés non encore ingérés",
                previous: "N/D",
                variation: "N/D",
              },
            ]}
          />
        </section>
      )}

      {tab === "interims" && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Interims</h2>
          <p className={styles.empty}>
            Aucun interim structuré en base pour {company.ticker} (N/D). Les publications BRVM seront branchées
            ultérieurement.
          </p>
        </section>
      )}

      {tab === "dividends" && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Dividendes</h2>
            <span className={styles.cardMeta}>FCFA net par action</span>
          </div>
          {dividendSchedule.length > 0 ? (
            <FilterableSheetTable
              columns={[
                { key: "year", label: "Exercice", getValue: (r) => r.year },
                { key: "amount", label: "Montant", getValue: (r) => r.amount },
                { key: "exDate", label: "Détachement", getValue: (r) => r.exDate ?? "" },
                { key: "paymentDate", label: "Paiement", getValue: (r) => r.paymentDate ?? "" },
              ]}
              rows={dividendSchedule.map((d) => ({
                year: String(d.year),
                amount: `${d.amount.toLocaleString("fr-FR")} FCFA`,
                exDate: fmtDivDate(d.exDate),
                paymentDate: fmtDivDate(d.paymentDate),
              }))}
            />
          ) : (
            <p className={styles.empty}>Aucun dividende (N/D).</p>
          )}
        </section>
      )}

      {tab === "societe" && (
        <>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Société</h2>
            <dl className={styles.profileMeta}>
              <div>
                <dt>Raison sociale</dt>
                <dd>{company.name}</dd>
              </div>
              <div>
                <dt>Ticker</dt>
                <dd>{company.ticker}</dd>
              </div>
              <div>
                <dt>ISIN</dt>
                <dd>{isin ?? "N/D"}</dd>
              </div>
              <div>
                <dt>Nombre de titres</dt>
                <dd>
                  {profileMeta?.sharesOutstanding != null
                    ? profileMeta.sharesOutstanding.toLocaleString("fr-FR")
                    : "N/D"}
                </dd>
              </div>
              <div>
                <dt>Flottant</dt>
                <dd>
                  {profileMeta?.floatPercent != null
                    ? `${String(profileMeta.floatPercent).replace(".", ",")}%`
                    : "N/D"}
                </dd>
              </div>
              <div>
                <dt>Valorisation</dt>
                <dd>{profileMeta?.valuationLabel ?? "N/D"}</dd>
              </div>
              <div>
                <dt>Téléphone</dt>
                <dd>{profileMeta?.phone ?? "N/D"}</dd>
              </div>
              <div>
                <dt>Fax</dt>
                <dd>{profileMeta?.fax ?? "N/D"}</dd>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <dt>Adresse</dt>
                <dd>{profileMeta?.address ?? "N/D"}</dd>
              </div>
            </dl>

            <h3 className={styles.profileDescTitle}>Description</h3>
            {description ? (
              <p className={styles.profileDesc}>{description}</p>
            ) : (
              <p className={styles.empty}>
                Description non disponible pour l&apos;instant (N/D). Elle sera complétée lors des
                prochaines synchronisations.
              </p>
            )}
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Détails</h2>
            <dl className={styles.profileMeta}>
              <div>
                <dt>Secteur</dt>
                <dd>{company.sector || "N/D"}</dd>
              </div>
              <div>
                <dt>Pays</dt>
                <dd>
                  {company.country
                    ? `${company.countryFlag} ${company.country}`
                    : "N/D"}
                </dd>
              </div>
              <div>
                <dt>Industrie</dt>
                <dd>{profileMeta?.industry ?? "N/D"}</dd>
              </div>
              <div>
                <dt>Direction générale</dt>
                <dd>{profileMeta?.ceo ?? profileMeta?.directors ?? "N/D"}</dd>
              </div>
              <div>
                <dt>Présidence</dt>
                <dd>{profileMeta?.chairman ?? "N/D"}</dd>
              </div>
              <div>
                <dt>Introduction en bourse</dt>
                <dd>{formatListingDate(listedSince ?? profileMeta?.listingDate)}</dd>
              </div>
              <div>
                <dt>Site web</dt>
                <dd>
                  {profileMeta?.website ? (
                    <a
                      href={websiteHref(profileMeta.website) ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.extLink}
                    >
                      {websiteLabel(profileMeta.website)}
                    </a>
                  ) : (
                    "N/D"
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <div className={styles.societeSplit}>
            <ShareholdingPanel profileMeta={profileMeta} />

            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Autres actions du même secteur</h2>
              <p className={styles.sideNote} style={{ marginTop: 0, marginBottom: 8 }}>
                Secteur {company.sector}
              </p>
              {sectorPeers.length === 0 ? (
                <p className={styles.empty}>Aucune autre société de ce secteur en base (N/D).</p>
              ) : (
                <ul className={styles.peerList}>
                  {sectorPeers.map((p) => (
                    <li key={p.ticker}>
                      <Link href={`/actions/${p.ticker}`} className={styles.peerLink}>
                        <span className={styles.peerTicker}>{p.ticker}</span>
                        <span className={styles.peerName}>
                          {p.countryFlag} {p.name}
                        </span>
                        <strong className={styles.peerPrice}>
                          {p.lastPrice > 0
                            ? `${Math.round(p.lastPrice).toLocaleString("fr-FR")} FCFA`
                            : "N/D"}
                        </strong>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}

      {tab === "actualites" && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Actualités</h2>
          {news.length === 0 ? (
            <p className={styles.empty}>Aucune actualité pour l&apos;instant (N/D).</p>
          ) : (
            <ul className={styles.metaList}>
              {news.map((n) => (
                <li key={n.id}>
                  <time dateTime={n.publishedAt}>{n.publishedAt.slice(0, 10)}</time>
                  <a href={n.url} target="_blank" rel="noopener noreferrer">
                    {n.title}
                  </a>
                </li>
              ))}
            </ul>
          )}

          <h3 className={styles.profileDescTitle} style={{ marginTop: 22 }}>
            Événements
          </h3>
          {events.length === 0 ? (
            <p className={styles.empty}>Aucun événement corporate pour l&apos;instant (N/D).</p>
          ) : (
            <ul className={styles.metaList}>
              {events.map((ev) => (
                <li key={ev.id}>
                  <time dateTime={ev.eventDate}>
                    {ev.endDate ? `${ev.eventDate} → ${ev.endDate}` : ev.eventDate}
                  </time>
                  <span>
                    {ev.title}
                    {ev.comment ? ` — ${ev.comment}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "documents" && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Documents déposés</h2>
          {documents.length === 0 ? (
            <p className={styles.empty}>Aucun document pour l&apos;instant (N/D).</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className={styles.docsTable}>
                <thead>
                  <tr>
                    <th scope="col">Publié</th>
                    <th scope="col">Type</th>
                    <th scope="col">Période</th>
                    <th scope="col">Intitulé</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((d) => {
                    const label = d.filename || d.title || d.url;
                    return (
                      <tr key={d.id}>
                        <td>{d.publishedAt ?? "N/D"}</td>
                        <td>{d.docType ?? "N/D"}</td>
                        <td>{d.periodLabel ?? "N/D"}</td>
                        <td>
                          <a href={d.url} target="_blank" rel="noopener noreferrer">
                            {label}
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
