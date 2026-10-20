/**
 * Une ligne par position.
 *
 * Un historique (colonne Sens, ou mots Achat/Vente) est agrégé :
 * quantité nette = achats − ventes, PRU = coût des achats restants
 * (une vente diminue la quantité au PRU courant, elle ne le change pas),
 * date = premier achat. Une position soldée disparaît.
 *
 * Un relevé de positions (pas de sens) est laissé aux parseurs historiques :
 * les quantités y sont déjà nettes.
 */

import { roundMoney } from "@/lib/api/portfolio-trades";
import { parseFrNumber, segmentAmountLine } from "./french-number";
import { fold } from "./fold";
import {
  detectHeaderLine,
  headerRole,
  peelNumbers,
  rolesLookLikeHeader,
  splitColumns,
  type ColumnDelimiter,
  type HeaderRole,
} from "./headers";
import { createSecurityMatcher, extractIsin, type SecurityMatcher } from "./match-security";
import { STATEMENT_MAX_ROWS } from "./messages";
import { classifyInstrument, classifyNoise } from "./noise";
import type {
  DocumentKind,
  IgnoredLine,
  InstrumentKind,
  SecurityCatalogEntry,
  SecurityMatch,
  StatementRowDraft,
} from "./types";

const IGNORED_CAP = 80;
const QTY_EPSILON = 0.0001;

export type HistoryParse = {
  rows: StatementRowDraft[];
  ignored: IgnoredLine[];
  ignoredCount: number;
  documentKind: DocumentKind;
  layoutLabel: string;
};

function normalize(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/\u00a0|\u202f/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n");
}

type Side = "achat" | "vente";

type Movement = {
  raw: string;
  label: string;
  isin: string | null;
  side: Side | null;
  quantity: number;
  unitPrice: number | null;
  lastPrice: number | null;
  date: string | null;
  kind: InstrumentKind;
  match: SecurityMatch;
};

type Lot = {
  key: string;
  label: string;
  isin: string | null;
  kind: InstrumentKind;
  match: SecurityMatch;
  qty: number;
  cost: number;
  firstBuy: string | null;
  lastPrice: number | null;
  raws: string[];
  sided: boolean;
};

function roundQty(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function toYmd(dayRaw: string, monthRaw: string, yearRaw: string): string | null {
  const day = Number(dayRaw);
  const month = Number(monthRaw);
  let year = Number(yearRaw);
  if (yearRaw.length === 2) year += year >= 70 ? 1900 : 2000;
  if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseFlexibleDate(value: string): string | null {
  const iso = value.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return toYmd(iso[3]!, iso[2]!, iso[1]!);
  const numeric = value.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  if (numeric) return toYmd(numeric[1]!, numeric[2]!, numeric[3]!);
  return null;
}

export function parseSide(value: string): Side | null {
  const folded = fold(value);
  if (!folded) return null;
  if (/\b(vente|sell|rachat|cession)\b/.test(folded) || folded === "v") return "vente";
  if (/\b(achat|buy|souscription|acquisition)\b/.test(folded) || folded === "a") return "achat";
  return null;
}

function untrackedMatch(): SecurityMatch {
  return {
    companyId: null,
    ticker: null,
    name: null,
    confidence: "moyenne",
    score: 0.7,
    ambiguous: false,
    reason: "aucune",
    candidates: [],
  };
}

function clip(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 180);
}

function pushIgnored(bag: IgnoredLine[], count: { n: number }, raw: string, reason: IgnoredLine["reason"]) {
  count.n += 1;
  if (reason === "vide") return;
  if (bag.length >= IGNORED_CAP) return;
  bag.push({ raw: clip(raw) || "—", reason });
}

function cellMap(cells: string[], roles: readonly (HeaderRole | null)[]): Partial<Record<HeaderRole, string>> {
  const bucket: Partial<Record<HeaderRole, string>> = {};
  roles.forEach((role, index) => {
    if (!role || bucket[role] != null) return;
    const value = cells[index]?.trim() ?? "";
    if (value && value !== "-" && value !== "—") bucket[role] = value;
  });
  return bucket;
}

function movementFromParts(
  parts: {
    raw: string;
    label: string;
    isin: string | null;
    side: Side | null;
    quantity: number | null;
    unitPrice: number | null;
    lastPrice: number | null;
    date: string | null;
  },
  matcher: SecurityMatcher
): Movement | null {
  const quantity = parts.quantity;
  if (quantity == null || !Number.isFinite(quantity) || Math.abs(quantity) <= QTY_EPSILON) return null;
  let side = parts.side;
  let qty = quantity;
  if (qty < 0) {
    side = side ?? "vente";
    qty = Math.abs(qty);
  }
  const label = clip(parts.label.replace(/\b(achat|vente|souscription|rachat|cession)\b/gi, " "));
  if (!label || !/[A-Za-zÀ-ÿ]{2,}/.test(label)) return null;
  if (headerRole(label) && fold(label).split(" ").length < 3) return null;
  const kind = classifyInstrument(label);
  const isin = parts.isin ?? extractIsin(label);
  const match = kind === "action" ? matcher(label, isin) : untrackedMatch();
  return {
    raw: clip(parts.raw),
    label,
    isin,
    side,
    quantity: qty,
    unitPrice: parts.unitPrice != null && parts.unitPrice > 0 ? parts.unitPrice : null,
    lastPrice: parts.lastPrice != null && parts.lastPrice > 0 ? parts.lastPrice : null,
    date: parts.date,
    kind,
    match,
  };
}

function movementFromCells(
  cells: string[],
  roles: readonly (HeaderRole | null)[],
  raw: string,
  matcher: SecurityMatcher
): Movement | null {
  if (cells.length < 2) return null;
  const bucket = cellMap(cells, roles);
  const label = [bucket.ticker, bucket.name].filter(Boolean).join(" ").trim();
  const quantity = parseFrNumber(bucket.quantity ?? "");
  const pru = parseFrNumber(bucket.pru ?? "");
  const last = parseFrNumber(bucket.last ?? "");
  const amount = parseFrNumber(bucket.valuation ?? "");
  const side = parseSide(bucket.side ?? "") ?? parseSide(raw);
  const unit = pru ?? (side || !last ? last : null) ?? (quantity && amount ? amount / Math.abs(quantity) : null);
  const tradePrice = side ? unit : pru ?? (quantity && amount && !last ? amount / Math.abs(quantity) : pru);
  return movementFromParts(
    {
      raw,
      label: label || cells.filter((cell) => /[A-Za-zÀ-ÿ]/.test(cell)).join(" "),
      isin: extractIsin(bucket.isin ?? "") ?? extractIsin(raw),
      side,
      quantity,
      unitPrice: side ? tradePrice : pru ?? last,
      lastPrice: side ? (pru != null && last != null ? last : null) : last,
      date: bucket.date ? parseFlexibleDate(bucket.date) : parseFlexibleDate(raw),
    },
    matcher
  );
}

function amountScore(numbers: number[], roles: readonly HeaderRole[]): number {
  if (roles.length === 0 || numbers.length !== roles.length) return -1;
  let quantity: number | null = null;
  let price: number | null = null;
  let amount: number | null = null;
  roles.forEach((role, index) => {
    const value = numbers[index] ?? null;
    if (role === "quantity") quantity = value;
    if ((role === "pru" || role === "last") && price == null) price = value;
    if (role === "valuation") amount = value;
  });
  let score = 1;
  if (quantity != null && quantity > 0 && quantity < 1_000_000) score += 5;
  if (price != null && price > 0 && price < 5_000_000) score += 2;
  if (quantity != null && price != null && amount != null && amount > 0) {
    const gap = Math.abs(quantity * price - amount) / amount;
    if (gap <= 0.02) score += 100;
    else if (gap <= 0.15) score += 20;
  }
  return score;
}

function looseAmounts(
  line: string,
  roles: readonly HeaderRole[]
): { label: string; quantity: number | null; unitPrice: number | null; lastPrice: number | null } | null {
  const segmented = segmentAmountLine(line);
  if (segmented && roles.length > 0) {
    let best: number[] | null = null;
    let bestScore = -1;
    for (const alternative of segmented.alternatives) {
      const score = amountScore(alternative, roles);
      if (score > bestScore) {
        bestScore = score;
        best = alternative;
      }
    }
    if (best && bestScore > 0) {
      let quantity: number | null = null;
      let unitPrice: number | null = null;
      let lastPrice: number | null = null;
      let amount: number | null = null;
      roles.forEach((role, index) => {
        const value = best?.[index] ?? null;
        if (role === "quantity") quantity = value;
        if (role === "pru") unitPrice = value;
        if (role === "last") lastPrice = value;
        if (role === "valuation") amount = value;
      });
      if (unitPrice == null && amount != null && quantity) unitPrice = amount / Math.abs(quantity);
      return { label: segmented.label, quantity, unitPrice, lastPrice };
    }
  }

  const peeled = peelNumbers(line);
  const numbers = peeled.numbers.filter((item) => !item.percent).map((item) => item.value);
  if (numbers.length === 0) return null;
  return {
    label: peeled.label,
    quantity: numbers[0] ?? null,
    unitPrice: numbers[1] ?? null,
    lastPrice: null,
  };
}

function movementFromLoose(line: string, roles: readonly (HeaderRole | null)[], matcher: SecurityMatcher): Movement | null {
  let rest = line.trim();
  const date = parseFlexibleDate(rest);
  if (date) rest = rest.replace(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/, " ");
  const isin = extractIsin(rest);
  if (isin) rest = rest.replace(isin, " ");
  const side = parseSide(rest);
  const numericRoles = roles.filter(
    (role): role is HeaderRole => role === "quantity" || role === "pru" || role === "last" || role === "valuation"
  );
  const amounts = looseAmounts(rest, numericRoles);
  if (!amounts) return null;
  return movementFromParts(
    {
      raw: line,
      label: amounts.label,
      isin,
      side,
      quantity: amounts.quantity,
      unitPrice: side ? (amounts.unitPrice ?? amounts.lastPrice) : amounts.unitPrice,
      lastPrice: side ? null : amounts.lastPrice,
      date,
    },
    matcher
  );
}

function looksLikeHistory(roles: readonly (HeaderRole | null)[], rows: readonly string[][]): boolean {
  if (roles.includes("side")) {
    return rows.some((row) => parseSide(row.join(" ")) != null || row.some((cell) => (parseFrNumber(cell) ?? 0) < 0));
  }
  return rows.some((row) => parseSide(row.join(" ")) != null);
}

function instrumentKey(move: Movement): string {
  if (move.kind === "action" && move.match.companyId) return `c:${move.match.companyId}`;
  if (move.isin) return `i:${move.isin}:${move.kind}`;
  return `l:${fold(move.label)}:${move.kind}`;
}

function applyBuy(lot: Lot, move: Movement) {
  lot.qty += move.quantity;
  if (move.unitPrice != null) lot.cost += move.quantity * move.unitPrice;
  if (move.date && (!lot.firstBuy || move.date < lot.firstBuy)) lot.firstBuy = move.date;
  if (move.lastPrice != null) lot.lastPrice = move.lastPrice;
  lot.raws.push(move.raw);
}

function applySell(lot: Lot, move: Movement) {
  const pru = lot.qty > QTY_EPSILON ? lot.cost / lot.qty : 0;
  lot.qty -= move.quantity;
  lot.cost = Math.max(0, lot.cost - move.quantity * pru);
  if (move.lastPrice != null) lot.lastPrice = move.lastPrice;
  lot.raws.push(move.raw);
  lot.sided = true;
}

function emptyLot(move: Movement, key: string): Lot {
  return {
    key,
    label: move.label,
    isin: move.isin,
    kind: move.kind,
    match: move.match,
    qty: 0,
    cost: 0,
    firstBuy: null,
    lastPrice: null,
    raws: [],
    sided: false,
  };
}

function aggregate(movements: Movement[], ignored: IgnoredLine[], count: { n: number }): { rows: StatementRowDraft[]; documentKind: DocumentKind } {
  const sided = movements.filter((move) => move.side != null);
  const plain = movements.filter((move) => move.side == null);
  const ordered = [...sided].sort((a, b) => {
    if (a.date && b.date && a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    return 0;
  });

  const lots = new Map<string, Lot>();
  for (const move of ordered) {
    const key = instrumentKey(move);
    const lot = lots.get(key) ?? emptyLot(move, key);
    lot.sided = true;
    if (move.match.confidence === "haute" || move.match.confidence === "moyenne") lot.match = move.match;
    if (move.label.length > lot.label.length) lot.label = move.label;
    if (move.side === "vente") applySell(lot, move);
    else applyBuy(lot, move);
    lots.set(key, lot);
  }

  let keptPlain = false;
  for (const move of plain) {
    const key = instrumentKey(move);
    if (lots.has(key)) {
      pushIgnored(ignored, count, move.raw, "couverte");
      continue;
    }
    const lot = emptyLot(move, key);
    applyBuy(lot, move);
    lots.set(key, lot);
    keptPlain = true;
  }

  const drafts: Omit<StatementRowDraft, "id">[] = [];
  const sorted = [...lots.values()].sort((a, b) => {
    if (a.firstBuy && b.firstBuy && a.firstBuy !== b.firstBuy) return a.firstBuy < b.firstBuy ? -1 : 1;
    return a.label.localeCompare(b.label, "fr");
  });

  for (const lot of sorted) {
    if (lot.qty <= QTY_EPSILON) {
      pushIgnored(ignored, count, `${lot.label} — quantité nette nulle`, "soldee");
      continue;
    }
    const avg = lot.cost > 0 && lot.qty > 0 ? roundMoney(lot.cost / lot.qty) : null;
    const warnings: string[] = [];
    if (lot.kind === "obligation") {
      warnings.push("Obligation non suivie dans le portefeuille — elle ne sera pas enregistrée sans société cotée.");
    } else if (lot.kind === "fcp") {
      warnings.push("FCP non suivi dans le portefeuille — il ne sera pas enregistré sans société cotée.");
    } else if (lot.match.confidence === "aucune") {
      warnings.push("Aucune société cotée ne correspond à cette ligne.");
    } else if (lot.match.ambiguous) {
      warnings.push("Plusieurs sociétés possibles — vérifiez le titre.");
    }
    if (avg == null) warnings.push("PRU manquant — à compléter avant l’enregistrement.");
    const raws = [...new Set(lot.raws)].slice(0, 4);
    drafts.push({
      rawLine: raws.length > 1 ? `${raws[0]} · ${lot.raws.length} opérations` : (raws[0] ?? lot.label),
      label: lot.label,
      isin: lot.isin,
      quantity: roundQty(lot.qty),
      avgBuyPrice: avg,
      lastPrice: lot.lastPrice,
      valuation: lot.lastPrice != null ? roundMoney(lot.qty * lot.lastPrice) : null,
      tradeDate: lot.firstBuy,
      instrumentKind: lot.kind,
      tracked: lot.kind === "action",
      match: lot.match,
      warnings,
    });
  }

  const rows = drafts.slice(0, STATEMENT_MAX_ROWS).map((row, index) => ({ ...row, id: `p${index + 1}` }));
  const documentKind: DocumentKind = keptPlain && sided.length > 0 ? "mixte" : "historique";
  return { rows, documentKind };
}

function finish(movements: Movement[], ignored: IgnoredLine[], count: { n: number }): HistoryParse | null {
  if (!movements.some((move) => move.side)) return null;
  const aggregated = aggregate(movements, ignored, count);
  return {
    rows: aggregated.rows,
    ignored,
    ignoredCount: count.n,
    documentKind: aggregated.documentKind,
    layoutLabel: aggregated.documentKind === "mixte" ? "Historique et positions" : "Une position par titre",
  };
}

function readMatrix(matrix: readonly (readonly string[])[]): { header: number; roles: (HeaderRole | null)[] } | null {
  const limit = Math.min(matrix.length, 40);
  for (let index = 0; index < limit; index += 1) {
    const cells = (matrix[index] ?? []).map((cell) => String(cell ?? "").trim()).filter((cell, i, arr) => cell.length > 0 || i < arr.length - 1);
    const trimmed = [...cells];
    while (trimmed.length > 0 && !trimmed[trimmed.length - 1]) trimmed.pop();
    const roles = trimmed.map((cell) => headerRole(cell));
    const known = roles.filter(Boolean).length;
    if (!rolesLookLikeHeader(roles) || known < Math.ceil(roles.length * 0.6)) continue;
    return { header: index, roles };
  }
  return null;
}

/** CSV / Excel : `null` si ce n'est pas un historique d'opérations. */
export function tryParseHistoryMatrix(
  matrix: readonly (readonly string[])[],
  catalog: readonly SecurityCatalogEntry[]
): HistoryParse | null {
  const rows = matrix.map((row) => row.map((cell) => String(cell ?? "").replace(/\u00a0|\u202f/g, " ").trim()));
  const found = readMatrix(rows);
  if (!found) return null;
  const body = rows.slice(found.header + 1).filter((row) => row.some((cell) => cell.length > 0));
  if (!looksLikeHistory(found.roles, body)) return null;

  const matcher = createSecurityMatcher(catalog);
  const ignored: IgnoredLine[] = [];
  const count = { n: 0 };
  for (let index = 0; index < found.header; index += 1) {
    const raw = rows[index]?.filter(Boolean).join(" ") ?? "";
    if (!raw.trim()) continue;
    pushIgnored(ignored, count, raw, classifyNoise(raw) ?? "section");
  }
  pushIgnored(ignored, count, (rows[found.header] ?? []).filter(Boolean).join(" | "), "en-tete");

  const movements: Movement[] = [];
  for (const row of body) {
    const raw = row.filter(Boolean).join(" | ");
    const noise = classifyNoise(row.filter(Boolean).join(" "));
    if (noise && noise !== "sans-instrument") {
      pushIgnored(ignored, count, raw, noise);
      continue;
    }
    if (rolesLookLikeHeader(row.map((cell) => headerRole(cell)))) {
      pushIgnored(ignored, count, raw, "en-tete");
      continue;
    }
    const aligned = row.length === found.roles.length ? movementFromCells(row, found.roles, raw, matcher) : null;
    const move = aligned ?? movementFromLoose(raw, found.roles, matcher);
    if (!move) {
      pushIgnored(ignored, count, raw, noise ?? "sans-instrument");
      continue;
    }
    movements.push(move);
  }

  return finish(movements, ignored, count);
}

function lineCells(line: string, delimiter: ColumnDelimiter, width: number): string[] | null {
  if (delimiter === "phrases") {
    const cells = splitColumns(line, "multi");
    return cells.length === width ? cells : null;
  }
  const cells = splitColumns(line, delimiter);
  return cells.length === width ? cells : null;
}

/** Texte déjà extrait : `null` si aucun historique d'achats/ventes n'est détecté. */
export function tryParseHistoryText(text: string, catalog: readonly SecurityCatalogEntry[]): HistoryParse | null {
  const lines = normalize(text).split("\n");
  let headerAt = -1;
  let roles: (HeaderRole | null)[] = [];
  let delimiter: ColumnDelimiter = "multi";
  for (let index = 0; index < Math.min(lines.length, 80); index += 1) {
    const hit = detectHeaderLine(lines[index] ?? "");
    if (!hit) continue;
    headerAt = index;
    roles = hit.roles;
    delimiter = hit.delimiter;
    break;
  }
  if (headerAt < 0) return null;

  const body = lines.slice(headerAt + 1).map((line) => line.trim()).filter(Boolean);
  const probe = body.slice(0, 40).map((line) => lineCells(line, delimiter, roles.length) ?? [line]);
  if (!looksLikeHistory(roles, probe)) return null;

  const matcher = createSecurityMatcher(catalog);
  const ignored: IgnoredLine[] = [];
  const count = { n: 0 };
  for (let index = 0; index < headerAt; index += 1) {
    const raw = (lines[index] ?? "").trim();
    if (!raw) continue;
    pushIgnored(ignored, count, raw, classifyNoise(raw) ?? "section");
  }
  pushIgnored(ignored, count, (lines[headerAt] ?? "").trim(), "en-tete");

  const movements: Movement[] = [];
  for (const raw of body) {
    const nextHeader = detectHeaderLine(raw);
    if (nextHeader) {
      roles = nextHeader.roles;
      delimiter = nextHeader.delimiter;
      pushIgnored(ignored, count, raw, "en-tete");
      continue;
    }
    const noise = classifyNoise(raw);
    if (noise) {
      pushIgnored(ignored, count, raw, noise);
      continue;
    }
    const cells = lineCells(raw, delimiter, roles.length);
    const move = (cells ? movementFromCells(cells, roles, raw, matcher) : null) ?? movementFromLoose(raw, roles, matcher);
    if (!move) {
      pushIgnored(ignored, count, raw, "sans-instrument");
      continue;
    }
    movements.push(move);
  }

  return finish(movements, ignored, count);
}
