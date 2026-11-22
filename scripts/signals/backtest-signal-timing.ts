/**
 * Backtest du timing des signaux techniques (lecture seule, aucun accès base).
 *
 * Entrée : CSV `exchange,ticker,date,close,volume` (clôtures canoniques) et,
 * en option, un JSON d'opérations sur titres (fractionnements) pour ajuster les cours.
 *
 *   npx ts-node --transpile-only scripts/signals/backtest-signal-timing.ts \
 *     --prices prices.csv [--actions actions.json] [--from 2018-01-01] [--engine current,proposed]
 *
 * Pour chaque séance, on recalcule le signal avec l'historique connu ce jour-là
 * (pas de fuite du futur). Un « événement » = entrée en ACHAT/ACHAT FORT (ou
 * ALLÉGER/VENDRE) depuis un autre libellé. Mesures :
 *   - déjà fait : hausse depuis le plus bas des 60 séances précédentes (baisse
 *     depuis le plus haut pour les ventes), en % et en ATR ;
 *   - retards : séances écoulées depuis cet extrême ;
 *   - rendements futurs 5 / 20 / 60 séances dans le sens du signal ;
 *   - taux de réussite à 20 séances, fréquence par titre et par an.
 */
import fs from "node:fs";
import { sliceForCacheRange } from "@/lib/charts/chart-series-cache";
import { adjustSeries } from "@/lib/corporate-actions/adjust";
import type { AdjustmentAction } from "@/lib/corporate-actions/types";
import { ngxSignalWindow } from "@/lib/ngx/technical-signal";
import { analyzePriceHistory } from "@/lib/technical-analysis/analyze";
import { legacySignalLabel } from "./legacy-signal";
import type { CloseInput } from "@/lib/technical-analysis/types";
import { DEFAULT_TIMING_PARAMS, type TimingParams } from "@/lib/technical-analysis/timing";

type Label = "ACHAT FORT" | "ACHAT" | "CONSERVER" | "ALLÉGER" | "VENDRE";
type Engine = (full: CloseInput[], exchange: string) => Label;

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const ENGINES: Record<string, Engine> = {
  // Production avant cette PR : BRVM sur l'aperçu SPARK (forme LTTB + ~80 séances), NGX sur ≈ 2 ans.
  current: (full, ex) =>
    legacySignalLabel(ex === "NGX" ? ngxSignalWindow(full) : sliceForCacheRange(full, "SPARK")),
  // Ancien moteur sur séances journalières complètes (fiche société BRVM).
  "current-daily": (full) => legacySignalLabel(full.slice(-900)),
  // Moteur de cette PR, avec la fenêtre que la production lui passe.
  proposed: (full, ex) =>
    analyzePriceHistory(ex === "NGX" ? ngxSignalWindow(full) : sliceForCacheRange(full, "SPARK")).signal.label,
};

/** `proposed@extensionAtr=3;runupAtr=8` : réglages alternatifs du timing. */
function variant(name: string): Engine | undefined {
  if (!name.startsWith("proposed@")) return undefined;
  const params: TimingParams = { ...DEFAULT_TIMING_PARAMS };
  for (const kv of name.slice("proposed@".length).split(";")) {
    const [k, v] = kv.split("=");
    if (k && v && k in params) (params as unknown as Record<string, number>)[k] = Number(v);
  }
  return (full, ex) =>
    analyzePriceHistory(ex === "NGX" ? ngxSignalWindow(full) : sliceForCacheRange(full, "SPARK"), {
      timingParams: params,
    }).signal.label;
}

const bull = (l: Label) => l === "ACHAT" || l === "ACHAT FORT";
const bear = (l: Label) => l === "ALLÉGER" || l === "VENDRE";

interface Event {
  ex: string;
  ticker: string;
  date: string;
  side: 1 | -1;
  strong: boolean;
  doneAtr: number | null;
  donePct: number;
  lag: number;
  f5: number | null;
  f20: number | null;
  f60: number | null;
}

function atr(closes: number[], end: number, period = 14): number | null {
  if (end < period) return null;
  let s = 0;
  for (let i = end - period + 1; i <= end; i++) s += Math.abs(closes[i]! - closes[i - 1]!);
  return s / period;
}

function loadPrices(file: string): Map<string, { ex: string; points: CloseInput[] }> {
  const out = new Map<string, { ex: string; points: CloseInput[] }>();
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const [ex, ticker, date, close, volume] = line.trim().split(",");
    if (!ex || !ticker || !date || !(Number(close) > 0)) continue;
    const row = out.get(ticker) ?? { ex, points: [] };
    row.points.push({ time: date, value: Number(close), volume: volume ? Number(volume) : null });
    out.set(ticker, row);
  }
  for (const row of out.values()) {
    row.points.sort((a, b) => a.time.localeCompare(b.time));
    const dedup: CloseInput[] = [];
    for (const p of row.points) {
      if (dedup.length && dedup[dedup.length - 1]!.time === p.time) dedup[dedup.length - 1] = p;
      else dedup.push(p);
    }
    row.points = dedup;
  }
  return out;
}

function loadActions(file: string | undefined): Map<string, AdjustmentAction[]> {
  const out = new Map<string, AdjustmentAction[]>();
  if (!file) return out;
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Array<Record<string, unknown>>;
  for (const a of raw) {
    const newShares = Number(a.newShares);
    const oldShares = Number(a.oldShares);
    if (!(newShares > 0) || !(oldShares > 0)) continue;
    const action: AdjustmentAction = {
      ticker: String(a.ticker),
      kind: String(a.type) as AdjustmentAction["kind"],
      effectiveDate: String(a.effectiveDate).slice(0, 10),
      factor: newShares / oldShares,
      oldShares,
      newShares,
      adjustPrices: a.adjustPrices !== false,
      label: "",
    };
    out.set(action.ticker, [...(out.get(action.ticker) ?? []), action]);
  }
  return out;
}

const CODE: Record<Label, string> = { "ACHAT FORT": "F", ACHAT: "A", CONSERVER: "C", ALLÉGER: "L", VENDRE: "V" };
const labelDump: Record<string, { ex: string; start: number; labels: string }> = {};

function runEngine(name: string, engine: Engine, data: ReturnType<typeof loadPrices>, from: string): Event[] {
  const events: Event[] = [];
  for (const [ticker, { ex, points }] of data) {
    const closes = points.map((p) => p.value);
    let prev: Label | null = null;
    let codes = "";
    let start = -1;
    for (let t = 0; t < points.length; t++) {
      if (points[t]!.time < from || t < 60) continue;
      const label = engine(points.slice(0, t + 1), ex);
      if (start < 0) start = t;
      codes += CODE[label];
      if (prev != null) {
        const side: 1 | -1 | 0 = bull(label) && !bull(prev) ? 1 : bear(label) && !bear(prev) ? -1 : 0;
        if (side !== 0) {
          const p = closes[t]!;
          const look = closes.slice(Math.max(0, t - 60), t + 1);
          const ext = side === 1 ? Math.min(...look) : Math.max(...look);
          const extIdx = t - 60 + look.lastIndexOf(ext) + (t < 60 ? 60 - t : 0);
          const a = atr(closes, t);
          const fwd = (h: number) => (t + h < closes.length ? (side * (closes[t + h]! - p)) / p : null);
          events.push({
            ex,
            ticker,
            date: points[t]!.time,
            side,
            strong: label === "ACHAT FORT" || label === "VENDRE",
            donePct: (side * (p - ext)) / ext,
            doneAtr: a && a > 0 ? (side * (p - ext)) / a : null,
            lag: t - extIdx,
            f5: fwd(5),
            f20: fwd(20),
            f60: fwd(60),
          });
        }
      }
      prev = label;
    }
    labelDump[ticker] = { ex, start, labels: codes, closes, dates: points.map((p) => p.time) } as never;
    process.stderr.write(`${name} ${ticker} ✓\n`);
  }
  return events;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[s.length >> 1]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
};
const pct = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(1)} %` : "—");

function summarize(events: Event[], tickerYears: number) {
  const nn = (xs: Array<number | null>) => xs.filter((x): x is number => x != null && Number.isFinite(x));
  const f20 = nn(events.map((e) => e.f20));
  return {
    n: events.length,
    perTickerYear: events.length / Math.max(tickerYears, 1e-9),
    donePctMedian: median(events.map((e) => e.donePct)),
    doneAtrMedian: median(nn(events.map((e) => e.doneAtr))),
    lagMedian: median(events.map((e) => e.lag)),
    f5: mean(nn(events.map((e) => e.f5))),
    f20: mean(f20),
    f60: mean(nn(events.map((e) => e.f60))),
    hit20: f20.length ? f20.filter((x) => x > 0).length / f20.length : NaN,
  };
}

function main() {
  const prices = arg("prices");
  if (!prices) throw new Error("--prices requis");
  const from = arg("from", "2018-01-01")!;
  const names = (arg("engine", "current,proposed") ?? "").split(",");
  const only = arg("tickers")?.split(",");
  const data = loadPrices(prices);
  const actions = loadActions(arg("actions"));
  for (const [ticker, row] of data) {
    if (only && !only.includes(ticker)) data.delete(ticker);
    const list = actions.get(ticker);
    if (list) row.points = adjustSeries(row.points, list);
  }
  const years = new Map<string, number>();
  for (const { ex, points } of data.values()) {
    const span = points.filter((p) => p.time >= from && p !== points[0]);
    if (span.length < 2) continue;
    years.set(ex, (years.get(ex) ?? 0) + span.length / 250);
  }
  const rows: string[] = [];
  const json: Record<string, unknown> = {};
  for (const name of names) {
    const engine = ENGINES[name] ?? variant(name);
    if (!engine) throw new Error(`moteur inconnu : ${name}`);
    const events = runEngine(name, engine, data, from);
    for (const ex of ["BRVM", "NGX"]) {
      for (const side of [1, -1] as const) {
        const subset = events.filter((e) => e.ex === ex && e.side === side);
        const s = summarize(subset, years.get(ex) ?? 0);
        json[`${name}|${ex}|${side}`] = s;
        rows.push(
          `| ${name} | ${ex} | ${side === 1 ? "achat" : "vente"} | ${s.n} | ${s.perTickerYear.toFixed(1)} | ${pct(s.donePctMedian)} | ${s.doneAtrMedian.toFixed(1)} | ${s.lagMedian} | ${pct(s.f5)} | ${pct(s.f20)} | ${pct(s.f60)} | ${pct(s.hit20)} |`
        );
      }
    }
    const dump = arg("labels");
    if (dump) fs.writeFileSync(`${dump}.${name.replace(/[^\w.-]+/g, "_")}.json`, JSON.stringify(labelDump));
    const out = arg("events");
    if (out) fs.writeFileSync(`${out}.${name.replace(/[^\w.-]+/g, "_")}.json`, JSON.stringify(events));
  }
  // Référence : rendement moyen de n'importe quelle séance (tendance de fond du marché).
  for (const ex of ["BRVM", "NGX"]) {
    const f: number[][] = [[], [], []];
    for (const { ex: e, points } of data.values()) {
      if (e !== ex) continue;
      const c = points.map((p) => p.value);
      for (let t = 60; t < c.length; t++) {
        if (points[t]!.time < from) continue;
        [5, 20, 60].forEach((h, k) => {
          if (t + h < c.length) f[k]!.push((c[t + h]! - c[t]!) / c[t]!);
        });
      }
    }
    rows.push(
      `| toute séance | ${ex} | — | — | — | — | — | — | ${pct(mean(f[0]!))} | ${pct(mean(f[1]!))} | ${pct(mean(f[2]!))} | ${pct(f[1]!.filter((x) => x > 0).length / f[1]!.length)} |`
    );
  }
  console.log("| Moteur | Place | Sens | Signaux | /titre/an | Déjà fait (méd.) | En ATR | Séances depuis l'extrême | +5 s. | +20 s. | +60 s. | Réussite 20 s. |");
  console.log("|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const r of rows) console.log(r);
  const jsonOut = arg("json");
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(json, null, 2));
}

main();
