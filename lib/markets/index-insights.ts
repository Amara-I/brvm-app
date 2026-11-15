// Lecture d'un indice : risque (volatilité, repli), participation des composantes,
// et synthèse en phrases courtes avec chiffres mis en avant. Fonctions pures.
// Aucun chiffre inventé : une donnée absente est omise de la phrase ou affichée N/D.

import type { TradeSignal } from "@/lib/calc/calc-metrics";
import { formatPrice, formatPriceRange } from "@/lib/technical-analysis/level-label";
import type { ScenarioBias, TechnicalAnalysis } from "@/lib/technical-analysis/types";
import type { ConstituentMove, IndexSeriesPoint } from "@/lib/markets/index-sheet";

const NBSP = /[\u202f\u00a0]/g;

export interface IndexRisk {
  /** Volatilité annualisée (%) des variations quotidiennes sur 1 an. */
  volatility1YPercent: number | null;
  /** Repli maximal (%) d'un sommet à un creux sur 1 an (négatif). */
  maxDrawdown1YPercent: number | null;
  /** Écart (%) au plus haut de 52 semaines (≤ 0). */
  fromHigh52wPercent: number | null;
  /** Écart (%) au plus bas de 52 semaines (≥ 0). */
  fromLow52wPercent: number | null;
  /** Écart (%) au plus haut historique (≤ 0). */
  fromAthPercent: number | null;
}

function shiftYears(isoDay: string, years: number): string {
  const d = new Date(`${isoDay}T00:00:00.000Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Points quotidiens de la dernière année (la série composée est quotidienne sur 800 jours). */
export function lastYearPoints(series: readonly IndexSeriesPoint[]): IndexSeriesPoint[] {
  const last = series[series.length - 1];
  if (!last) return [];
  const from = shiftYears(last.time, -1);
  return series.filter((p) => p.time >= from);
}

export function computeIndexRisk(
  series: readonly IndexSeriesPoint[],
  opts: { athValue?: number | null } = {}
): IndexRisk {
  const year = lastYearPoints(series);
  const last = year[year.length - 1]?.value ?? null;

  let volatility1YPercent: number | null = null;
  if (year.length >= 30) {
    const rets: number[] = [];
    for (let i = 1; i < year.length; i++) {
      const a = year[i - 1]!.value;
      const b = year[i]!.value;
      if (a > 0 && b > 0) rets.push(Math.log(b / a));
    }
    if (rets.length >= 20) {
      const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
      const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1);
      volatility1YPercent = round2(Math.sqrt(variance) * Math.sqrt(252) * 100);
    }
  }

  let maxDrawdown1YPercent: number | null = null;
  if (year.length >= 2) {
    let peak = year[0]!.value;
    let worst = 0;
    for (const p of year) {
      if (p.value > peak) peak = p.value;
      if (peak > 0) worst = Math.min(worst, (p.value - peak) / peak);
    }
    maxDrawdown1YPercent = round2(worst * 100);
  }

  let fromHigh52wPercent: number | null = null;
  let fromLow52wPercent: number | null = null;
  if (last != null && year.length > 0) {
    const hi = Math.max(...year.map((p) => p.value));
    const lo = Math.min(...year.map((p) => p.value));
    if (hi > 0) fromHigh52wPercent = round2(((last - hi) / hi) * 100);
    if (lo > 0) fromLow52wPercent = round2(((last - lo) / lo) * 100);
  }
  const ath = opts.athValue ?? null;
  const fromAthPercent = last != null && ath != null && ath > 0 ? round2(Math.min(0, ((last - ath) / ath) * 100)) : null;

  return { volatility1YPercent, maxDrawdown1YPercent, fromHigh52wPercent, fromLow52wPercent, fromAthPercent };
}

export interface BreadthMove {
  ticker: string;
  name: string;
  changePercent: number;
}

export interface IndexBreadth {
  sessionDate: string;
  up: number;
  down: number;
  flat: number;
  total: number;
  topGainers: BreadthMove[];
  topLosers: BreadthMove[];
  /** Composantes officielles (true) ou périmètre approché (secteur, univers de cote). */
  basis: "official" | "universe" | "sector" | "board";
}

/**
 * Hausses / baisses du jour parmi les composantes. Seules les valeurs cotées à la
 * dernière séance commune comptent (un titre sans échange ce jour-là est ignoré).
 */
export function computeBreadth(
  moves: readonly ConstituentMove[],
  basis: IndexBreadth["basis"],
  top = 3
): IndexBreadth | null {
  const dated = moves.filter((m) => m.sessionDate && m.changePercent != null && Number.isFinite(m.changePercent));
  if (dated.length === 0) return null;
  const sessionDate = dated.reduce((max, m) => (m.sessionDate! > max ? m.sessionDate! : max), dated[0]!.sessionDate!);
  const today = dated.filter((m) => m.sessionDate === sessionDate);
  if (today.length < 3) return null;
  const rows: BreadthMove[] = today.map((m) => ({ ticker: m.ticker, name: m.name, changePercent: m.changePercent! }));
  const up = rows.filter((r) => r.changePercent > 0).length;
  const down = rows.filter((r) => r.changePercent < 0).length;
  const byChange = [...rows].sort((a, b) => b.changePercent - a.changePercent || a.ticker.localeCompare(b.ticker));
  return {
    sessionDate,
    up,
    down,
    flat: rows.length - up - down,
    total: rows.length,
    topGainers: byChange.filter((r) => r.changePercent > 0).slice(0, top),
    topLosers: [...byChange].reverse().filter((r) => r.changePercent < 0).slice(0, top),
    basis,
  };
}

/** Libellé du signal pour un indice : une lecture de marché, pas un ordre d'achat. */
export function indexReadingLabel(label: TradeSignal["label"], locale: "fr" | "en" = "fr"): string {
  const fr: Record<TradeSignal["label"], string> = {
    "ACHAT FORT": "Haussier fort",
    ACHAT: "Haussier",
    CONSERVER: "Neutre",
    ALLÉGER: "Baissier",
    VENDRE: "Baissier fort",
  };
  const en: Record<TradeSignal["label"], string> = {
    "ACHAT FORT": "Strong bullish",
    ACHAT: "Bullish",
    CONSERVER: "Neutral",
    ALLÉGER: "Bearish",
    VENDRE: "Strong bearish",
  };
  return (locale === "en" ? en : fr)[label] ?? label;
}

/** Morceau de phrase : `strong` met le chiffre en avant, `tone` le colore (hausse / baisse). */
export interface ReadingSegment {
  text: string;
  strong?: boolean;
  tone?: "pos" | "neg" | "neutral";
}

export interface ReadingLine {
  id: "level" | "range" | "trend" | "structure" | "momentum" | "levels" | "risk" | "scenario" | "breadth";
  segments: ReadingSegment[];
}

export interface IndexReadingInput {
  name: string;
  locale?: "fr" | "en";
  lastValue: number | null;
  lastDate: string | null;
  sessionChangePercent: number | null;
  changeYtdPercent: number | null;
  change1YPercent: number | null;
  high52w: number | null;
  low52w: number | null;
  risk: IndexRisk;
  analysis: TechnicalAnalysis | null;
  breadth: IndexBreadth | null;
}

function pct(value: number, locale: "fr" | "en", signed = true, digits = 1): string {
  const body = Math.abs(value)
    .toLocaleString(locale === "en" ? "en-GB" : "fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    .replace(NBSP, "\u202f");
  const eps = 0.5 * 10 ** -digits;
  const sign = !signed ? "" : value >= eps ? "+" : value <= -eps ? "−" : "";
  return locale === "en" ? `${sign}${body}%` : `${sign}${body}\u00a0%`;
}

function tone(value: number | null | undefined): ReadingSegment["tone"] {
  if (value == null) return "neutral";
  return value > 0.05 ? "pos" : value < -0.05 ? "neg" : "neutral";
}

function dateLabel(isoDay: string, locale: "fr" | "en"): string {
  return new Date(`${isoDay}T12:00:00.000Z`).toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

const s = (text: string): ReadingSegment => ({ text });
const b = (text: string, t?: ReadingSegment["tone"]): ReadingSegment => (t ? { text, strong: true, tone: t } : { text, strong: true });

function nearestZone(analysis: TechnicalAnalysis, kind: "support" | "resistance") {
  const last = analysis.structure.lastClose;
  if (last == null) return null;
  const pool = analysis.zones.filter((z) => z.kind === kind && (kind === "support" ? z.mid < last : z.mid > last));
  pool.sort((a, c) => Math.abs(a.mid - last) - Math.abs(c.mid - last));
  return pool[0] ?? null;
}

/** Synthèse « lecture de marché » d'un indice, phrase par phrase. */
export function buildIndexReading(input: IndexReadingInput): ReadingLine[] {
  const locale = input.locale ?? "fr";
  const en = locale === "en";
  const pts = (v: number) => formatPrice(v, "PTS", locale);
  const lines: ReadingLine[] = [];
  const { analysis, risk } = input;

  if (input.lastValue != null && input.lastDate) {
    const seg: ReadingSegment[] = en
      ? [s(`${input.name} closed the ${dateLabel(input.lastDate, locale)} session at `), b(pts(input.lastValue))]
      : [s(`${input.name} termine la séance du ${dateLabel(input.lastDate, locale)} à `), b(pts(input.lastValue))];
    if (input.sessionChangePercent != null) {
      seg.push(s(" ("), b(pct(input.sessionChangePercent, locale, true, 2), tone(input.sessionChangePercent)), s(")"));
    }
    seg.push(s("."));
    const perf: ReadingSegment[] = [];
    if (input.changeYtdPercent != null) {
      perf.push(s(en ? " Year to date: " : " Depuis le 1er janvier : "), b(pct(input.changeYtdPercent, locale), tone(input.changeYtdPercent)));
    }
    if (input.change1YPercent != null) {
      perf.push(
        s(perf.length ? (en ? "; over one year: " : " ; sur un an : ") : en ? " Over one year: " : " Sur un an : "),
        b(pct(input.change1YPercent, locale), tone(input.change1YPercent))
      );
    }
    if (perf.length) perf.push(s("."));
    lines.push({ id: "level", segments: [...seg, ...perf] });
  }

  if (risk.fromHigh52wPercent != null && risk.fromLow52wPercent != null && input.high52w != null && input.low52w != null) {
    const atHigh = Math.abs(risk.fromHigh52wPercent) < 0.05;
    lines.push({
      id: "range",
      segments: atHigh
        ? en
          ? [s("The index is "), b("at its 52-week high", "pos"), s(` (${pts(input.high52w)}).`)]
          : [s("L'indice est "), b("sur son plus haut de 52 semaines", "pos"), s(` (${pts(input.high52w)}).`)]
        : en
          ? [
              s("It stands "),
              b(`${pct(Math.abs(risk.fromHigh52wPercent), locale, false)} below`, "neg"),
              s(` its 52-week high (${pts(input.high52w)}) and `),
              b(`${pct(risk.fromLow52wPercent, locale, false)} above`, "pos"),
              s(` its low (${pts(input.low52w)}).`),
            ]
          : [
              s("Il évolue "),
              b(`${pct(Math.abs(risk.fromHigh52wPercent), locale, false)} sous`, "neg"),
              s(` son plus haut de 52 semaines (${pts(input.high52w)}) et `),
              b(`${pct(risk.fromLow52wPercent, locale, false)} au-dessus`, "pos"),
              s(` de son plus bas (${pts(input.low52w)}).`),
            ],
    });
  }

  if (analysis && analysis.structure.lastClose != null) {
    const st = analysis.structure;
    const last = st.lastClose!;
    const ma = st.sma200 ?? st.sma50;
    const maName = st.sma200 != null ? (en ? "200-session average" : "moyenne 200 séances") : en ? "50-session average" : "moyenne 50 séances";
    if (ma != null) {
      const above = last >= ma;
      const crossOk = st.sma50 != null && st.sma200 != null ? st.sma50 >= st.sma200 : null;
      const trend =
        above && crossOk !== false ? "up" : !above && crossOk !== true ? "down" : "mixed";
      const word =
        trend === "up" ? (en ? "bullish" : "haussière") : trend === "down" ? (en ? "bearish" : "baissière") : en ? "undecided" : "indécise";
      const seg: ReadingSegment[] = en
        ? [s("Underlying trend "), b(word, trend === "up" ? "pos" : trend === "down" ? "neg" : "neutral"), s(`: the index is ${above ? "above" : "below"} its ${maName} (${pts(ma)})`)]
        : [s("Tendance de fond "), b(word, trend === "up" ? "pos" : trend === "down" ? "neg" : "neutral"), s(` : l'indice est ${above ? "au-dessus" : "en dessous"} de sa ${maName} (${pts(ma)})`)];
      if (crossOk != null && st.sma50 != null) {
        seg.push(
          s(
            en
              ? `, and the 50-session average (${pts(st.sma50)}) is ${crossOk ? "above" : "below"} the 200.`
              : `, et la moyenne 50 séances (${pts(st.sma50)}) est ${crossOk ? "au-dessus" : "en dessous"} de la 200.`
          )
        );
      } else seg.push(s("."));
      lines.push({ id: "trend", segments: seg });
    }

    if (st.bias !== "neutral") {
      const bull = st.bias === "bullish";
      lines.push({
        id: "structure",
        segments: en
          ? [
              s("Short term: "),
              b(bull ? "bullish structure" : "bearish structure", bull ? "pos" : "neg"),
              s(bull ? ", recent peaks and troughs are rising." : ", recent peaks and troughs are falling."),
            ]
          : [
              s("À court terme : "),
              b(bull ? "structure haussière" : "structure baissière", bull ? "pos" : "neg"),
              s(bull ? ", les derniers sommets et creux montent." : ", les derniers sommets et creux descendent."),
            ],
      });
    }

    if (st.rsi14 != null) {
      const r = st.rsi14;
      const [fr, enW, t]: [string, string, ReadingSegment["tone"]] =
        r >= 70
          ? ["zone de surachat : la hausse est rapide, un répit est fréquent", "overbought zone: the rise is fast, a pause is common", "neg"]
          : r >= 55
            ? ["élan haussier, sans excès", "upward momentum, not stretched", "pos"]
            : r > 45
              ? ["élan neutre", "neutral momentum", "neutral"]
              : r > 30
                ? ["élan baissier, sans excès", "downward momentum, not stretched", "neg"]
                : ["zone de survente : la baisse est rapide, un rebond est fréquent", "oversold zone: the fall is fast, a rebound is common", "pos"];
      const rsi = r.toLocaleString(en ? "en-GB" : "fr-FR", { maximumFractionDigits: 0 });
      lines.push({
        id: "momentum",
        segments: [s(en ? "RSI (14) at " : "RSI (14) à "), b(rsi, t), s(en ? `: ${enW}.` : ` : ${fr}.`)],
      });
    }

    const sup = nearestZone(analysis, "support");
    const res = nearestZone(analysis, "resistance");
    if (sup || res) {
      const seg: ReadingSegment[] = [];
      if (sup) {
        seg.push(s(en ? "Nearest support: " : "Support le plus proche : "), b(formatPriceRange(sup.low, sup.high, "PTS", locale), "neutral"));
        seg.push(s(` (${pct(((sup.mid - last) / last) * 100, locale)})`));
      }
      if (res) {
        seg.push(s(sup ? (en ? "; resistance: " : " ; résistance : ") : en ? "Nearest resistance: " : "Résistance la plus proche : "));
        seg.push(b(formatPriceRange(res.low, res.high, "PTS", locale), "neutral"));
        seg.push(s(` (${pct(((res.mid - last) / last) * 100, locale)})`));
      }
      seg.push(s("."));
      lines.push({ id: "levels", segments: seg });
    }
  }

  if (risk.volatility1YPercent != null || risk.maxDrawdown1YPercent != null) {
    const seg: ReadingSegment[] = [];
    if (risk.volatility1YPercent != null) {
      seg.push(s(en ? "Annualised volatility " : "Volatilité annualisée "), b(pct(risk.volatility1YPercent, locale, false)));
    }
    if (risk.maxDrawdown1YPercent != null) {
      seg.push(s(seg.length ? (en ? "; largest pullback over one year " : " ; plus fort repli sur un an ") : en ? "Largest pullback over one year " : "Plus fort repli sur un an "));
      seg.push(b(pct(risk.maxDrawdown1YPercent, locale), tone(risk.maxDrawdown1YPercent)));
    }
    seg.push(s("."));
    lines.push({ id: "risk", segments: seg });
  }

  if (analysis && analysis.scenarios.length > 0 && analysis.structure.lastClose != null) {
    const top = [...analysis.scenarios].sort((a, c) => c.probability - a.probability)[0]!;
    const name: Record<ScenarioBias, [string, string]> = {
      bullish: ["haussier", "bullish"],
      neutral: ["neutre", "neutral"],
      bearish: ["baissier", "bearish"],
    };
    const t: ReadingSegment["tone"] = top.bias === "bullish" ? "pos" : top.bias === "bearish" ? "neg" : "neutral";
    const seg: ReadingSegment[] = [
      s(en ? "Most likely scenario: " : "Scénario le plus probable : "),
      b(en ? `${name[top.bias][1]} (${top.probability}%)` : `${name[top.bias][0]} (${top.probability}\u00a0%)`, t),
    ];
    if (top.invalidation != null) {
      const holds =
        top.bias === "bearish"
          ? en
            ? ", as long as the index stays below "
            : ", tant que l'indice reste sous "
          : top.bias === "bullish"
            ? en
              ? ", as long as the index holds above "
              : ", tant que l'indice tient au-dessus de "
            : en
              ? ", invalidated beyond "
              : ", remis en cause au-delà de ";
      seg.push(s(holds), b(pts(top.invalidation)));
    }
    if (top.targets[0] != null) {
      seg.push(s(en ? "; first target " : " ; premier objectif "), b(pts(top.targets[0]!), t));
    }
    seg.push(s("."));
    lines.push({ id: "scenario", segments: seg });
  }

  if (input.breadth) {
    const br = input.breadth;
    lines.push({
      id: "breadth",
      segments: en
        ? [s("Session breadth: "), b(`${br.up} up`, "pos"), s(" vs "), b(`${br.down} down`, "neg"), s(` (${br.flat} unchanged) among ${br.total} stocks.`)]
        : [
            s("Participation : "),
            b(`${br.up} hausse${br.up > 1 ? "s" : ""}`, "pos"),
            s(" contre "),
            b(`${br.down} baisse${br.down > 1 ? "s" : ""}`, "neg"),
            s(` (${br.flat} stable${br.flat > 1 ? "s" : ""}) parmi ${br.total} valeurs.`),
          ],
    });
  }

  return lines;
}
