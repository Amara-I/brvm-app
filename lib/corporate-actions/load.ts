// Charge les opérations sur titres. Table absente ou base injoignable :
// repli sur le catalogue (SNTS forcé). La table, une fois migrée, fait foi
// pour les fractionnements historiques (adjust_prices après vérification).

import { prisma } from "@/lib/prisma";
import { isDatabaseUnavailable, isMissingDatabaseObject } from "@/lib/db/is-database-unavailable";
import { priceDivisor } from "./adjust";
import { BRVM_SPLIT_CATALOG, catalogFactor, catalogLabel } from "./catalog";
import { splitMarkerLabel } from "./label";
import type { AdjustmentAction } from "./types";

const CACHE_MS = 30_000;

let cache: { at: number; rows: AdjustmentAction[] } | null = null;

export function clearCorporateActionCache(): void {
  cache = null;
}

function fromCatalog(entry: (typeof BRVM_SPLIT_CATALOG)[number], adjustPrices: boolean): AdjustmentAction {
  return {
    ticker: entry.ticker,
    kind: entry.kind,
    effectiveDate: entry.effectiveDate,
    factor: catalogFactor(entry),
    oldShares: entry.oldShares,
    newShares: entry.newShares,
    adjustPrices,
    label: catalogLabel(entry),
    sharesOutstandingBefore: entry.sharesOutstandingBefore ?? null,
    sourceUrl: entry.sourceUrl ?? null,
    note: entry.note,
  };
}

export function builtinActions(): AdjustmentAction[] {
  return BRVM_SPLIT_CATALOG.filter((entry) => entry.forceAdjust || entry.defaultAdjust).map((entry) =>
    fromCatalog(entry, true)
  );
}

function decorate(action: AdjustmentAction): AdjustmentAction {
  const entry = BRVM_SPLIT_CATALOG.find(
    (item) => item.ticker === action.ticker && item.effectiveDate === action.effectiveDate
  );
  return {
    ...action,
    label: action.label || splitMarkerLabel(action),
    sharesOutstandingBefore: action.sharesOutstandingBefore ?? entry?.sharesOutstandingBefore ?? null,
    factor: action.factor > 0 ? action.factor : entry ? catalogFactor(entry) : 1,
  };
}

function mergeWithBuiltin(rows: AdjustmentAction[]): AdjustmentAction[] {
  const out = rows.map(decorate);
  for (const entry of BRVM_SPLIT_CATALOG) {
    if (!entry.forceAdjust) continue;
    const found = out.find((row) => row.ticker === entry.ticker && row.effectiveDate === entry.effectiveDate);
    if (!found) out.push(fromCatalog(entry, true));
  }
  return out;
}

export async function loadCorporateActions(): Promise<AdjustmentAction[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows;
  try {
    const rows = await prisma.corporateAction.findMany({
      include: { company: { select: { ticker: true } } },
    });
    const mapped = mergeWithBuiltin(
      rows.map((row) =>
        decorate({
          ticker: row.company.ticker,
          companyId: row.companyId,
          kind: row.type,
          effectiveDate: row.effectiveDate.toISOString().slice(0, 10),
          factor: Number(row.newShares) / Number(row.oldShares),
          oldShares: Number(row.oldShares),
          newShares: Number(row.newShares),
          adjustPrices: row.adjustPrices,
          label: "",
          sourceUrl: row.sourceUrl,
          note: row.note,
        })
      )
    );
    cache = { at: Date.now(), rows: mapped };
    return mapped;
  } catch (err) {
    if (isMissingDatabaseObject(err) || isDatabaseUnavailable(err)) return builtinActions();
    throw err;
  }
}

export async function actionsForTicker(ticker: string, companyId?: string): Promise<AdjustmentAction[]> {
  const all = await loadCorporateActions();
  const symbol = ticker.toUpperCase();
  return all.filter((action) => {
    if (companyId && action.companyId) return action.companyId === companyId;
    return action.ticker === symbol;
  });
}

export async function actionsByCompanyId(): Promise<Map<string, AdjustmentAction[]>> {
  const all = await loadCorporateActions();
  const map = new Map<string, AdjustmentAction[]>();
  for (const action of all) {
    if (!action.companyId) continue;
    const list = map.get(action.companyId) ?? [];
    list.push(action);
    map.set(action.companyId, list);
  }
  return map;
}

export async function actionsByTicker(): Promise<Map<string, AdjustmentAction[]>> {
  const all = await loadCorporateActions();
  const map = new Map<string, AdjustmentAction[]>();
  for (const action of all) {
    const list = map.get(action.ticker) ?? [];
    list.push(action);
    map.set(action.ticker, list);
  }
  return map;
}

/** Diviseur synchrone après un `loadCorporateActions` (collier d'ingestion). */
export async function priceDivisorForTicker(ticker: string, date: string): Promise<number> {
  return priceDivisor(await actionsForTicker(ticker), date);
}
