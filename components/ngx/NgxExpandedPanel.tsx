"use client";

// Ligne dépliée de la vue d'ensemble NGX : même contenu et même mise en page que la ligne
// dépliée BRVM (components/marche/MarketBoardClient.tsx → ExpandedPanel) — synthèse du signal,
// synthèse du risque, cartes clés, piliers de risque, raisons du signal, liens.
// Les chiffres de la ligne (cours, cap., note, signal) s'affichent tout de suite ; le détail
// (performances, ratios, risque, horizons…) est chargé à la demande pour ce seul ticker
// (GET /api/market/ngx-row/:ticker, quelques ko, cache serveur + CDN) et gardé en mémoire.

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SignalBadge from "@/components/ui/SignalBadge";
import ScoreBadge from "@/components/ui/ScoreBadge";
import ConfidenceDot from "@/components/ui/ConfidenceDot";
import EducationTermLink from "@/components/education/EducationTermLink";
import { useI18n } from "@/components/i18n/I18nProvider";
import { displayPillarNote, displayRiskSummary } from "@/components/marche/market-copy";
import styles from "@/components/marche/MarketBoard.module.css";
import { educationSlugForAnalysisLabel, educationSlugForRiskPillar } from "@/lib/education/analysis-terms";
import { localizedTypeDef } from "@/lib/i18n/portfolio-type-copy";
import { getPortfolioTypeDef } from "@/lib/portfolio-types/catalog";
import { PORTFOLIO_TYPE_IDS } from "@/lib/portfolio-types/constants";
import { NGX_PILLAR_KEYS } from "@/lib/ngx/score";
import type { NgxBoardRow } from "@/lib/markets/ngx-board-row";
import type { NgxRowDetail } from "@/lib/markets/ngx-row-detail";
import type { NgxScoreMode } from "@/lib/ngx/score";
import { trackFeature } from "@/components/analytics/track-client";
import { C } from "@/lib/theme/colors";

type DetailState = { status: "loading" } | { status: "error" } | { status: "ready"; data: NgxRowDetail };

// Mémoire de la session : re-déplier une ligne ne relance pas de requête.
const memo = new Map<string, NgxRowDetail>();
const inflight = new Map<string, Promise<NgxRowDetail | null>>();

/** Clé de cache : le ticker + le dernier cours, pour relire après une nouvelle séance. */
function memoKey(row: NgxBoardRow): string {
  return `${row.ticker}|${row.close ?? ""}`;
}

export function fetchNgxRowDetail(row: NgxBoardRow): Promise<NgxRowDetail | null> {
  const key = memoKey(row);
  const hit = memo.get(key);
  if (hit) return Promise.resolve(hit);
  const running = inflight.get(key);
  if (running) return running;
  const p = fetch(`/api/market/ngx-row/${encodeURIComponent(row.ticker)}`)
    .then((res) => res.json())
    .then((json) => {
      if (json?.ok && json.data) {
        memo.set(key, json.data as NgxRowDetail);
        return json.data as NgxRowDetail;
      }
      return null;
    })
    .catch(() => null)
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

function AnalysisLabel({ french, text }: { french: string; text: string }) {
  const slug = educationSlugForAnalysisLabel(french);
  if (!slug) return <>{text}</>;
  return <EducationTermLink slug={slug}>{text}</EducationTermLink>;
}

export default function NgxExpandedPanel({ row }: { row: NgxBoardRow }) {
  const { t, format, labels, locale } = useI18n();
  const router = useRouter();
  const [state, setState] = useState<DetailState>(() => {
    const hit = memo.get(memoKey(row));
    return hit ? { status: "ready", data: hit } : { status: "loading" };
  });

  useEffect(() => {
    let alive = true;
    const hit = memo.get(memoKey(row));
    if (hit) {
      setState({ status: "ready", data: hit });
      return;
    }
    setState({ status: "loading" });
    fetchNgxRowDetail(row).then((data) => {
      if (!alive) return;
      setState(data ? { status: "ready", data } : { status: "error" });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.ticker, row.close]);

  // Le tableau défile horizontalement (11 colonnes) : le détail reste calé sur la largeur visible
  // du cadre de défilement (collé à gauche), pour être lisible sans défilement horizontal sur mobile.
  const panelRef = useRef<HTMLDivElement>(null);
  const [visibleWidth, setVisibleWidth] = useState<number | null>(null);
  useEffect(() => {
    const el = panelRef.current;
    const wrap = el?.closest("table")?.parentElement;
    if (!wrap) return;
    const update = () => setVisibleWidth(wrap.clientWidth > 0 ? wrap.clientWidth : null);
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(wrap);
    return () => ro?.disconnect();
  }, []);

  const d = state.status === "ready" ? state.data : null;
  const pending = state.status === "loading";
  const nd = "N/D";
  const wait = "…";
  const pick = (fn: (x: NgxRowDetail) => string): string => (d ? fn(d) : pending ? wait : nd);

  const naira = (v: number | null) => (v == null ? nd : format.money(v, "NGN"));
  const signedPct = (v: number | null, digits = 1) =>
    v == null ? nd : `${v >= 0 ? "+" : ""}${format.decimal(v, digits)} %`;
  const tone = (v: number | null | undefined) => (v == null ? C.textDim : v >= 0 ? C.green : C.red);
  const ofYear = (year: number | null) => (year == null ? undefined : t("ngx.market.detail.ofYear", { year }));
  const modeText = (mode: NgxScoreMode | null) =>
    mode === "FULL"
      ? t("ngx.market.modeFull")
      : mode === "PARTIAL"
        ? t("ngx.screener.tags.partial")
        : mode === "CHART_ONLY"
          ? t("ngx.screener.tags.chartOnly")
          : nd;

  const cards: Array<{ key: string; label: string; text: string; value: string; color?: string; node?: ReactNode; title?: string }> = [
    { key: "price", label: "Cours actuel", text: t("market.cards.price"), value: naira(row.close) },
    {
      key: "fcfa",
      label: "Cours FCFA",
      text: t("ngx.market.colFcfa"),
      value: row.fcfa != null && row.fcfa > 0 ? format.money(row.fcfa, "XOF") : nd,
      color: C.teal,
    },
    {
      key: "mktcap",
      label: "Cap. boursière",
      text: t("market.cards.mktCap"),
      value:
        row.marketCapBn != null && row.marketCapBn > 0
          ? t("market.capCurrency", { amount: format.number(row.marketCapBn), currency: "₦" })
          : nd,
      color: C.gold,
    },
    {
      key: "y1",
      label: "Var. 1 an",
      text: t("ngx.market.colChange1y"),
      value: signedPct(row.return1yPercent),
      color: tone(row.return1yPercent),
    },
    {
      key: "perf5",
      label: "Perf. 5 ans",
      text: t("market.cards.perf5"),
      value: pick((x) => signedPct(x.perf5Percent)),
      color: d ? tone(d.perf5Percent) : C.textDim,
    },
    {
      key: "perf10",
      label: "Perf. 10 ans",
      text: t("market.cards.perf10"),
      value: pick((x) => signedPct(x.perf10Percent)),
      color: d ? tone(d.perf10Percent) : C.textDim,
      title: d?.perf10Percent != null && d.firstYear != null ? t("ngx.market.detail.sinceYear", { year: d.firstYear }) : undefined,
    },
    {
      key: "yield",
      label: "Rendement div.",
      text: t("market.cards.divYield"),
      value: pick((x) => (x.yieldPercent == null ? nd : `${format.decimal(x.yieldPercent, 2)} %`)),
      color: C.teal,
      title: d?.dps != null ? `${format.money(d.dps, "NGN")}${d.dpsYear ? ` (${d.dpsYear})` : ""}` : undefined,
    },
    {
      key: "per",
      label: "PER",
      text: t("market.cards.per"),
      value: pick((x) => (x.per != null && x.per > 0 ? format.decimal(x.per, 2) : nd)),
      color: C.blue,
      title: ofYear(d?.perYear ?? null),
    },
    {
      key: "pbr",
      label: "P/B",
      text: t("ngx.market.detail.pbr"),
      value: pick((x) => (x.pbr != null && x.pbr > 0 ? format.decimal(x.pbr, 2) : nd)),
      color: C.blue,
    },
    {
      key: "roe",
      label: "ROE",
      text: t("ngx.market.detail.roe"),
      value: pick((x) => (x.roePercent == null ? nd : `${format.decimal(x.roePercent, 1)} %`)),
      color: d ? tone(d.roePercent) : C.textDim,
      title: ofYear(d?.roeYear ?? null),
    },
    {
      key: "eps",
      label: "BPA",
      text: t("ngx.market.detail.eps"),
      value: pick((x) => naira(x.eps)),
      title: ofYear(d?.epsYear ?? null),
    },
    {
      key: "range52",
      label: "Plus bas / haut 52 sem.",
      text: t("ngx.market.detail.range52"),
      value: pick((x) =>
        x.low52 == null || x.high52 == null ? nd : `${format.decimal(x.low52, 2)} – ${format.decimal(x.high52, 2)} ₦`,
      ),
    },
    {
      key: "vol",
      label: "Volatilité",
      text: t("market.cards.volatility"),
      value: pick((x) => (x.volatilityPercent == null ? nd : `${format.decimal(x.volatilityPercent, 1)} %`)),
    },
    {
      key: "risk",
      label: "Risque (volatilité)",
      text: t("market.cards.riskVol"),
      value: pick((x) => labels.riskLevel(x.riskLevel)),
    },
    {
      key: "riskMgmt",
      label: "Gestion du risque",
      text: t("market.cards.riskMgmt"),
      value: pick((x) => `${labels.riskTier(x.risk.tier)} · ${x.risk.score}/100`),
      color: d ? (d.risk.score < 40 ? C.green : d.risk.score > 65 ? C.red : C.gold) : C.textDim,
    },
    {
      key: "horizons",
      label: "Horizons C/M/L",
      text: t("market.cards.horizons"),
      value: pick((x) => (x.horizons ? `${x.horizons.court} / ${x.horizons.moyen} / ${x.horizons.long}` : nd)),
    },
    {
      key: "confidence",
      label: "Confiance",
      text: t("market.cards.confidence"),
      value: row.confidence ? labels.confidence(row.confidence) : nd,
      node: <ConfidenceDot value={row.confidence} />,
    },
    {
      key: "score",
      label: "Score / Signal",
      text: t("market.cards.scoreSignal"),
      value: `${row.score == null ? nd : `${Math.round(row.score)}/100`} · ${row.signal ? labels.signal(row.signal.label) : nd}`,
      node: (
        <>
          <ScoreBadge score={row.score} outOf showTier />{" "}
          {row.signal ? <SignalBadge label={row.signal.label} confidence={row.confidence} /> : <span className="ob-nd">N/D</span>}
        </>
      ),
    },
    { key: "mode", label: "Base de la note", text: t("ngx.market.scoreBasis"), value: modeText(row.scoreMode) },
  ];

  const sheetHref = `/marches/ngx/actions/${row.ticker}`;
  const chartHref = `/marches/ngx/actions/${row.ticker}?tab=charts`;

  return (
    <div
      ref={panelRef}
      className={styles.detail}
      onClick={(e) => e.stopPropagation()}
      data-testid={`ngx-detail-${row.ticker}`}
      style={visibleWidth ? { position: "sticky", left: 0, width: visibleWidth, boxSizing: "border-box" } : undefined}
    >
      {d?.signal ? (
        <p className={styles.detailSummary}>
          {labels.signalSummary({
            label: d.signal.label,
            score: row.score == null ? 0 : Math.round(row.score),
            confidence: d.signal.confidence,
            signalSummary: d.signal.summary,
            signalReasons: d.signal.reasons,
          })}
        </p>
      ) : null}
      {d ? (
        <p className={styles.detailSummary} style={{ color: C.textDim, fontSize: "0.78rem" }}>
          {displayRiskSummary({ riskTier: d.risk.tier, riskScore: d.risk.score, summary: d.risk.summary, pillars: d.risk.pillars }, locale, labels)}
        </p>
      ) : pending ? (
        <p className={styles.detailSummary} style={{ color: C.textDim, fontSize: "0.78rem" }} aria-live="polite">
          {t("ngx.market.detail.loading")}
        </p>
      ) : (
        <p className={styles.detailSummary} style={{ color: C.textDim, fontSize: "0.78rem" }}>
          {t("ngx.market.detail.error")}
        </p>
      )}
      <div className={styles.detailGrid}>
        {cards.map((c) => (
          <div key={c.key} className={styles.detailCard}>
            <div className={styles.detailLabel}>
              <AnalysisLabel french={c.label} text={c.text} />
            </div>
            <div className={styles.detailValue} style={c.color ? { color: c.color } : undefined} title={c.title ?? c.value}>
              {c.node ?? c.value}
            </div>
          </div>
        ))}
      </div>
      {d && d.risk.pillars.length > 0 && (
        <ul className={styles.reasonList}>
          {d.risk.pillars.map((p) => {
            const slug = educationSlugForRiskPillar(p.key);
            const pillarLabel = labels.riskPillar(p.key, p.label);
            return (
              <li key={p.key}>
                <span aria-hidden="true">●</span>{" "}
                {slug ? <EducationTermLink slug={slug}>{pillarLabel}</EducationTermLink> : pillarLabel} :{" "}
                {p.score == null ? "N/D" : `${p.score}/100`} — {displayPillarNote(p.note, locale, labels)}
              </li>
            );
          })}
        </ul>
      )}
      {d?.signal && d.signal.reasons.length > 0 && (
        <ul className={styles.reasonList}>
          {d.signal.reasons.map((r, i) => (
            <li key={`${r.kind}-${i}`}>
              <span aria-hidden="true">{r.kind === "positif" ? "▲" : r.kind === "negatif" ? "▼" : "●"}</span> {labels.reason(r)}
            </li>
          ))}
        </ul>
      )}
      {d && (
        <ul className={styles.reasonList} data-testid={`ngx-detail-pillars-${row.ticker}`}>
          <li>
            <span aria-hidden="true">●</span> {t("ngx.market.detail.pillarsTitle")} :{" "}
            {NGX_PILLAR_KEYS.map((k) => `${t(`ngx.sheet.score.pillar.${k}`)} ${d.pillars[k] == null ? "N/D" : Math.round(d.pillars[k]!)}`).join(" · ")}
          </li>
          <li>
            <span aria-hidden="true">●</span> {t("ngx.market.detail.policiesTitle")} :{" "}
            {PORTFOLIO_TYPE_IDS.map(
              (id) => `${localizedTypeDef(getPortfolioTypeDef(id), locale).label} ${d.policies[id] == null ? "N/D" : Math.round(d.policies[id]!)}`,
            ).join(" · ")}
          </li>
        </ul>
      )}
      <div className={styles.detailLinks}>
        <Link
          href={sheetHref}
          className={styles.primaryBtn}
          onMouseEnter={() => router.prefetch(sheetHref)}
          onFocus={() => router.prefetch(sheetHref)}
          onClick={() => trackFeature("marche", "ngx_company_sheet")}
        >
          {t("market.board.companyDetails")}
        </Link>
        <Link href={chartHref} className={styles.secondaryBtn} onClick={() => trackFeature("marche", "ngx_chart_analysis")}>
          {t("market.board.chartAnalysis")}
        </Link>
        <Link href="/marches/ngx/screener" className={styles.secondaryBtn}>
          {t("ngx.screener.link")}
        </Link>
      </div>
    </div>
  );
}
