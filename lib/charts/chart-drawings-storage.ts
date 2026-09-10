/**
 * Persistance locale des tracés graphiques (/graphes) par ticker.
 * Stockage navigateur uniquement (localStorage) — pas de compte serveur.
 */

export const CHART_DRAWINGS_STORAGE_KEY = "ouestbourse-chart-drawings-v1";

export type ChartDrawing =
  | { id: string; type: "horiz"; price: number }
  /** Fib 2 points (préféré) — high/low dérivés de p1/p2. */
  | { id: string; type: "fib"; t1: string; p1: number; t2: string; p2: number }
  /** Ancien format (haut/bas globaux) — encore lu pour compatibilité. */
  | { id: string; type: "fib"; high: number; low: number }
  | { id: string; type: "trend"; t1: string; p1: number; t2: string; p2: number }
  | { id: string; type: "measure"; t1: string; p1: number; t2: string; p2: number };

type Store = Record<string, ChartDrawing[]>;

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CHART_DRAWINGS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Store;
  } catch {
    return {};
  }
}

function writeStore(store: Store): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CHART_DRAWINGS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota / mode privé */
  }
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function isTwoPoint(d: Record<string, unknown>): boolean {
  return (
    typeof d.t1 === "string" &&
    typeof d.t2 === "string" &&
    isFiniteNumber(d.p1) &&
    isFiniteNumber(d.p2)
  );
}

function isDrawing(x: unknown): x is ChartDrawing {
  if (!x || typeof x !== "object") return false;
  const d = x as Record<string, unknown>;
  if (typeof d.id !== "string" || typeof d.type !== "string") return false;
  if (d.type === "horiz") return isFiniteNumber(d.price);
  if (d.type === "fib") {
    if (isTwoPoint(d)) return true;
    return isFiniteNumber(d.high) && isFiniteNumber(d.low);
  }
  if (d.type === "trend" || d.type === "measure") return isTwoPoint(d);
  return false;
}

export function getFibBounds(drawing: Extract<ChartDrawing, { type: "fib" }>): {
  high: number;
  low: number;
} {
  if ("p1" in drawing && "p2" in drawing) {
    return {
      high: Math.max(drawing.p1, drawing.p2),
      low: Math.min(drawing.p1, drawing.p2),
    };
  }
  return { high: drawing.high, low: drawing.low };
}

export function loadChartDrawings(ticker: string): ChartDrawing[] {
  const key = ticker.trim().toUpperCase();
  if (!key) return [];
  const list = readStore()[key];
  if (!Array.isArray(list)) return [];
  return list.filter(isDrawing);
}

export function saveChartDrawings(ticker: string, drawings: ChartDrawing[]): void {
  const key = ticker.trim().toUpperCase();
  if (!key) return;
  const store = readStore();
  if (drawings.length === 0) {
    delete store[key];
  } else {
    store[key] = drawings;
  }
  writeStore(store);
}

export function newDrawingId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `d-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatMeasureLabel(p1: number, p2: number): {
  text: string;
  up: boolean;
  pct: number;
} {
  const pct = p1 !== 0 ? ((p2 - p1) / Math.abs(p1)) * 100 : 0;
  const up = pct >= 0;
  const arrow = up ? "↑" : "↓";
  const pctTxt = `${up ? "+" : ""}${pct.toFixed(2).replace(".", ",")} %`;
  const abs = p2 - p1;
  const absTxt = `${abs >= 0 ? "+" : ""}${Math.round(abs).toLocaleString("fr-FR")}`;
  return { text: `${arrow} ${pctTxt} (${absTxt})`, up, pct };
}
