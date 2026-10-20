/**
 * Lecture heuristique d'un relevé de titres SGI (texte déjà extrait).
 *
 * Trois mises en page, dans cet ordre de préférence quand elles extraient
 * autant de quantités :
 *   1. `colonnes` — ligne d'en-tête (Code, Libellé, Qté, PRU, Cours…)
 *   2. `blocs`   — champs « Quantité : 120 » répétés
 *   3. `lignes`  — une position par ligne, nombres en fin de ligne
 *
 * Ajouter une SGI : voir `docs/import-releve-sgi.md`.
 */

import { parseFrNumber, segmentAmountLine } from "./french-number";
import { fold, soften } from "./fold";
import {
  amountsClose,
  detectHeaderLine,
  peelNumbers,
  splitColumns,
  type HeaderHit,
  type HeaderRole,
} from "./headers";
import { createSecurityMatcher, extractIsin, type SecurityMatcher } from "./match-security";
import { STATEMENT_MAX_ROWS, StatementImportError } from "./messages";
import { termsFromLabel } from "./instrument-terms";
import { classifyInstrument } from "./noise";
import { nonStockMatch, tryParseHistoryText } from "./positions";
import type {
  DocumentKind,
  IgnoredLine,
  SecurityCatalogEntry,
  StatementParseResult,
  StatementRowDraft,
} from "./types";

type Amounts = {
  label: string;
  isin: string | null;
  quantity: number | null;
  avgBuyPrice: number | null;
  lastPrice: number | null;
  valuation: number | null;
};

type RawRow = Omit<StatementRowDraft, "id">;

const MONTHS: Record<string, number> = {
  janvier: 1,
  fevrier: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  aout: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  decembre: 12,
};

const ISSUERS: readonly { re: RegExp; label: string }[] = [
  { re: /sgi[\s-]*ci\b/, label: "SGI-CI" },
  { re: /hudson/, label: "Hudson & Cie" },
  { re: /bici[\s-]*bourse/, label: "BICI Bourse" },
  { re: /sgi[\s-]*benin/, label: "SGI Bénin" },
  { re: /atlantique[\s-]+finance/, label: "Atlantique Finance" },
  { re: /\bedc\b/, label: "EDC" },
  { re: /impaxis/, label: "Impaxis" },
  { re: /cgf[\s-]*bourse/, label: "CGF Bourse" },
  { re: /matha/, label: "Matha Capital" },
  { re: /sgi[\s-]*togo/, label: "SGI Togo" },
  { re: /sgi[\s-]*mali/, label: "SGI Mali" },
  { re: /coris[\s-]*bourse/, label: "Coris Bourse" },
];

const FIELD_RES: readonly { kind: "ticker" | "name" | "isin" | "quantity" | "pru" | "last" | "valuation"; re: RegExp }[] =
  [
    { kind: "ticker", re: /^(?:code(?:\s+valeur|\s+titre)?|ticker|symbole|mn[eé]mo(?:technique)?)\s*[:：-]\s*(.+)$/i },
    { kind: "isin", re: /^isin\s*[:：-]\s*(.+)$/i },
    { kind: "name", re: /^(?:d[eé]signation|libell[eé]|intitul[eé]|soci[eé]t[eé]|titre|valeur)\s*[:：-]\s*(.+)$/i },
    { kind: "quantity", re: /^(?:quantit[eé]|qt[eé]|nombre(?:\s+de\s+titres)?)\s*[:：-]\s*(.+)$/i },
    { kind: "pru", re: /^(?:pru|prix\s+de\s+revient(?:\s+unitaire)?|prix\s+moyen|co[uû]t\s+(?:de\s+revient|moyen)|cmp|pmp|prmp)\s*[:：-]\s*(.+)$/i },
    { kind: "last", re: /^(?:dernier\s+cours|cours(?:\s+du\s+jour)?|cl[oô]ture)\s*[:：-]\s*(.+)$/i },
    { kind: "valuation", re: /^(?:valoris(?:ation|[eé]e)|[eé]valuation|valeur\s+boursi[eè]re|montant)\s*[:：-]\s*(.+)$/i },
  ];

export function normalizeStatementText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/\u00a0|\u202f/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n");
}

export function detectStatementMeta(text: string): { issuer: string | null; statementDate: string | null } {
  const lines = normalizeStatementText(text).split("\n");
  const head = soften(lines.slice(0, 40).join("\n")).replace(/\n/g, " ");
  return {
    issuer: detectIssuer(head),
    statementDate: detectStatementDate(head),
  };
}

function detectIssuer(head: string): string | null {
  for (const issuer of ISSUERS) {
    if (issuer.re.test(head)) return issuer.label;
  }
  return null;
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

function detectStatementDate(head: string): string | null {
  const numeric =
    /(?:arrete|releve|situation|date|portefeuille)[^0-9]{0,50}?(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/;
  const numericMatch = head.match(numeric);
  if (numericMatch) {
    const ymd = toYmd(numericMatch[1]!, numericMatch[2]!, numericMatch[3]!);
    if (ymd) return ymd;
  }
  const word =
    /(?:arrete|releve|situation|date|portefeuille)[^0-9]{0,40}?(\d{1,2})\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\s+(\d{4})/;
  const wordMatch = head.match(word);
  if (wordMatch) {
    const month = MONTHS[wordMatch[2]!];
    if (month) return toYmd(wordMatch[1]!, String(month), wordMatch[3]!);
  }
  return null;
}

function positive(value: number | null): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

function blankAmounts(): Omit<Amounts, "label" | "isin"> {
  return { quantity: null, avgBuyPrice: null, lastPrice: null, valuation: null };
}

function zipRoles(roles: HeaderRole[], numbers: number[]): Omit<Amounts, "label" | "isin"> {
  const out = blankAmounts();
  roles.forEach((role, index) => {
    const value = positive(numbers[index] ?? null);
    if (role === "quantity") out.quantity = value;
    if (role === "pru") out.avgBuyPrice = value;
    if (role === "last") out.lastPrice = value;
    if (role === "valuation") out.valuation = value;
  });
  return out;
}

function resolveByProduct(picked: number[]): Omit<Amounts, "label" | "isin"> | null {
  if (picked.length < 3) return null;
  let valIndex = 0;
  picked.forEach((value, index) => {
    if (value > (picked[valIndex] ?? 0)) valIndex = index;
  });
  const valuation = picked[valIndex]!;
  const others = picked.filter((_, index) => index !== valIndex);
  for (const quantity of others) {
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 10_000_000) continue;
    for (const price of others) {
      if (price === quantity || price <= 0) continue;
      if (!amountsClose(quantity * price, valuation)) continue;
      const rest = others.filter((value) => value !== quantity && value !== price);
      return {
        quantity,
        lastPrice: price,
        avgBuyPrice: rest[0] ?? null,
        valuation,
      };
    }
  }
  return null;
}

function assignLoose(values: number[]): Omit<Amounts, "label" | "isin"> {
  const nums = values.filter((value) => Number.isFinite(value) && value > 0);
  if (nums.length === 0) return blankAmounts();
  if (nums.length === 1) {
    const only = nums[0]!;
    if (Number.isInteger(only) && only < 1_000_000) return { ...blankAmounts(), quantity: only };
    return { ...blankAmounts(), valuation: only };
  }
  if (nums.length === 2) {
    const [left, right] = nums as [number, number];
    if (Number.isInteger(left) && right > left * 20) return { ...blankAmounts(), quantity: left, valuation: right };
    return { ...blankAmounts(), quantity: left, avgBuyPrice: right };
  }
  if (nums.length === 3) {
    const [a, b, c] = nums as [number, number, number];
    if (amountsClose(a * b, c)) return { quantity: a, avgBuyPrice: null, lastPrice: b, valuation: c };
    return { quantity: a, avgBuyPrice: b, lastPrice: null, valuation: c };
  }

  let picked = nums.slice(0, 6);
  if (picked.length > 4) {
    const drop = picked.findIndex((value, index) => index > 0 && index < picked.length - 1 && value < 100 && !Number.isInteger(value));
    if (drop >= 0) picked = picked.filter((_, index) => index !== drop);
  }
  const sliced = picked.slice(0, 4);
  const [a, b, c, d] = sliced;
  if (a != null && b != null && c != null && d != null) {
    if (amountsClose(a * c, d)) return { quantity: a, avgBuyPrice: b, lastPrice: c, valuation: d };
    if (amountsClose(a * b, d)) return { quantity: a, avgBuyPrice: c > 0 && c !== b ? c : null, lastPrice: b, valuation: d };
    return resolveByProduct(sliced) ?? { quantity: a, avgBuyPrice: b, lastPrice: c, valuation: d };
  }
  return assignLoose(sliced);
}

function fromCells(cells: string[], roles: (HeaderRole | null)[]): Amounts | null {
  const bucket: Partial<Record<HeaderRole, string>> = {};
  roles.forEach((role, index) => {
    if (!role || bucket[role] != null) return;
    bucket[role] = cells[index] ?? "";
  });
  const label = [bucket.ticker, bucket.name].filter((part) => part && part.trim()).join(" ").trim();
  const quantity = positive(parseFrNumber(bucket.quantity ?? ""));
  if (!label && quantity == null) return null;
  const joined = label || cells.join(" ").trim();
  return {
    label: joined,
    isin: extractIsin(bucket.isin ?? "") ?? extractIsin(joined),
    quantity,
    avgBuyPrice: positive(parseFrNumber(bucket.pru ?? "")),
    lastPrice: positive(parseFrNumber(bucket.last ?? "")),
    valuation: positive(parseFrNumber(bucket.valuation ?? "")),
  };
}

function amountsFromNumbers(numbers: number[], roles: readonly (HeaderRole | null)[] | null): Omit<Amounts, "label" | "isin"> {
  const numericRoles = (roles ?? []).filter(
    (role): role is HeaderRole => role === "quantity" || role === "pru" || role === "last" || role === "valuation"
  );
  if (numericRoles.length > 0 && numericRoles.length === numbers.length) {
    const zipped = zipRoles(numericRoles, numbers);
    if (zipped.quantity) return zipped;
  }
  return assignLoose(numbers);
}

function scoreNumbers(numbers: number[], roles: readonly (HeaderRole | null)[] | null): number {
  if (numbers.length === 0 || numbers.length > 6) return -1;
  const amounts = amountsFromNumbers(numbers, roles);
  if (!amounts.quantity) return -1;
  let score = numbers.length;
  if (
    amounts.lastPrice != null &&
    amounts.valuation != null &&
    amountsClose(amounts.quantity * amounts.lastPrice, amounts.valuation)
  ) {
    score += 50;
  }
  return score;
}

function fromPeel(line: string, roles: readonly (HeaderRole | null)[] | null): Amounts | null {
  const segmented = segmentAmountLine(line);
  if (segmented) {
    let best = segmented.alternatives[0] ?? [];
    let bestScore = -1;
    for (const alternative of segmented.alternatives) {
      const score = scoreNumbers(alternative, roles);
      if (score > bestScore) {
        bestScore = score;
        best = alternative;
      }
    }
    if (best.length > 0) {
      return {
        label: segmented.label,
        isin: extractIsin(line),
        ...amountsFromNumbers(best, roles),
      };
    }
  }

  const peeled = peelNumbers(line);
  const numbers = peeled.numbers.filter((item) => !item.percent).map((item) => item.value);
  if (!peeled.label || numbers.length === 0) return null;
  return {
    label: peeled.label,
    isin: extractIsin(line),
    ...amountsFromNumbers(numbers, roles),
  };
}

function consistent(amounts: Amounts | null): boolean {
  if (!amounts?.quantity || !amounts.valuation) return false;
  const price = amounts.lastPrice ?? amounts.avgBuyPrice;
  if (!price) return false;
  return amountsClose(amounts.quantity * price, amounts.valuation);
}

function parseAligned(line: string, header: HeaderHit): Amounts | null {
  const cells =
    header.delimiter === "phrases" ? splitColumns(line, "multi") : splitColumns(line, header.delimiter);
  const mapped = cells.length === header.roles.length ? fromCells(cells, header.roles) : null;
  const peeled = fromPeel(line, header.roles);
  if (mapped && peeled) {
    if (!consistent(mapped) && consistent(peeled)) return peeled;
    if (mapped.quantity) return mapped;
  }
  if (mapped?.quantity) return mapped;
  return peeled;
}

export function buildStatementRow(amounts: Amounts, matcher: SecurityMatcher, rawLine: string): RawRow | null {
  const label = amounts.label.replace(/\s+/g, " ").trim().slice(0, 180);
  if (!label && amounts.quantity == null) return null;
  const isin = amounts.isin ?? extractIsin(label);
  const instrumentKind = classifyInstrument(label);
  const terms = termsFromLabel(label, instrumentKind);
  const match = instrumentKind === "action" ? matcher(label, isin) : nonStockMatch();
  const warnings: string[] = [];
  if (amounts.quantity == null) warnings.push("Quantité manquante ou invalide.");
  if (amounts.avgBuyPrice == null) warnings.push("PRU manquant — à compléter avant l’enregistrement.");
  if (instrumentKind === "action" && match.confidence === "aucune") warnings.push("Aucune société cotée ne correspond à cette ligne.");
  else if (instrumentKind === "action" && match.ambiguous) warnings.push("Plusieurs sociétés possibles — vérifiez le titre.");
  if (
    amounts.quantity != null &&
    amounts.lastPrice != null &&
    amounts.valuation != null &&
    !amountsClose(amounts.quantity * amounts.lastPrice, amounts.valuation)
  ) {
    warnings.push("La valorisation s’écarte de quantité × cours.");
  }
  return {
    rawLine: rawLine.replace(/\s+/g, " ").trim().slice(0, 400),
    label: label || "Ligne sans libellé",
    isin,
    quantity: amounts.quantity,
    avgBuyPrice: amounts.avgBuyPrice,
    lastPrice: amounts.lastPrice,
    valuation: amounts.valuation,
    tradeDate: null,
    instrumentKind,
    couponRate: terms.couponRate,
    nominal: null,
    maturityDate: terms.maturityDate,
    manager: terms.manager,
    priceMode: "FCFA",
    tracked: true,
    match,
    warnings,
  };
}

function isTotalLine(line: string): boolean {
  const folded = fold(line);
  return /^(total|sous total|portefeuille global|net a payer|solde general)\b/.test(folded);
}

function isFurniture(line: string): boolean {
  const folded = fold(line);
  if (!folded) return true;
  if (/^(page|confidentiel)\b/.test(folded)) return true;
  return /^(tel|telephone|fax|email|e mail|adresse|rib|iban|compte|client|agence)\b/.test(folded);
}

function isSectionBreak(line: string): boolean {
  const folded = fold(line);
  return /^(mouvements|operations du|avis d|detail des operations|historique des|ordres en cours)\b/.test(folded);
}

function matchField(line: string): { kind: (typeof FIELD_RES)[number]["kind"]; value: string } | null {
  const trimmed = line.trim();
  for (const field of FIELD_RES) {
    const match = trimmed.match(field.re);
    if (match?.[1]) return { kind: field.kind, value: match[1].trim() };
  }
  return null;
}

function parseColumns(text: string, matcher: SecurityMatcher): RawRow[] {
  const rows: RawRow[] = [];
  let header: HeaderHit | null = null;
  for (const line of normalizeStatementText(text).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || isFurniture(trimmed)) continue;
    const nextHeader = detectHeaderLine(trimmed);
    if (nextHeader) {
      header = nextHeader;
      continue;
    }
    if (!header) continue;
    if (isTotalLine(trimmed)) break;
    if (isSectionBreak(trimmed)) {
      if (rows.length > 0) break;
      continue;
    }
    if (!/\d/.test(trimmed)) continue;
    const amounts = parseAligned(trimmed, header);
    if (!amounts) continue;
    const row = buildStatementRow(amounts, matcher, trimmed);
    if (row) rows.push(row);
  }
  return rows;
}

function detectColumns(text: string): number {
  for (const line of normalizeStatementText(text).split("\n")) {
    if (detectHeaderLine(line)) return 100;
  }
  return 0;
}

type Block = {
  lines: string[];
  ticker?: string;
  name?: string;
  isin?: string;
  quantity?: number;
  avgBuyPrice?: number;
  lastPrice?: number;
  valuation?: number;
};

function parseBlocks(text: string, matcher: SecurityMatcher): RawRow[] {
  const blocks: Block[] = [];
  let current: Block | null = null;

  const flush = () => {
    if (!current) return;
    if (current.quantity != null || current.ticker || current.name) blocks.push(current);
    current = null;
  };

  for (const line of normalizeStatementText(text).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }
    const field = matchField(trimmed);
    if (!field) continue;
    const startsNextBlock =
      !!current &&
      ((field.kind === "ticker" && (!!current.ticker || current.quantity != null)) ||
        (field.kind === "name" && !!current.name && (!!current.ticker || current.quantity != null)));
    if (startsNextBlock) flush();
    current ??= { lines: [] };
    current.lines.push(trimmed);
    if (field.kind === "ticker") current.ticker = field.value;
    if (field.kind === "name") current.name = field.value;
    if (field.kind === "isin") current.isin = extractIsin(field.value) ?? field.value;
    if (field.kind === "quantity") current.quantity = positive(parseFrNumber(field.value)) ?? undefined;
    if (field.kind === "pru") current.avgBuyPrice = positive(parseFrNumber(field.value)) ?? undefined;
    if (field.kind === "last") current.lastPrice = positive(parseFrNumber(field.value)) ?? undefined;
    if (field.kind === "valuation") current.valuation = positive(parseFrNumber(field.value)) ?? undefined;
  }
  flush();

  return blocks.flatMap((block) => {
    const label = [block.ticker, block.name].filter(Boolean).join(" ").trim();
    const row = buildStatementRow(
      {
        label,
        isin: block.isin ? extractIsin(block.isin) : null,
        quantity: block.quantity ?? null,
        avgBuyPrice: block.avgBuyPrice ?? null,
        lastPrice: block.lastPrice ?? null,
        valuation: block.valuation ?? null,
      },
      matcher,
      block.lines.join(" | ")
    );
    return row ? [row] : [];
  });
}

function detectBlocks(text: string): number {
  let fields = 0;
  let quantities = 0;
  for (const line of normalizeStatementText(text).split("\n")) {
    const field = matchField(line);
    if (!field) continue;
    fields += 1;
    if (field.kind === "quantity") quantities += 1;
  }
  return quantities >= 1 && fields >= 3 ? fields : 0;
}

function parseLoose(text: string, matcher: SecurityMatcher): RawRow[] {
  const rows: RawRow[] = [];
  for (const line of normalizeStatementText(text).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || isFurniture(trimmed) || isTotalLine(trimmed) || isSectionBreak(trimmed)) continue;
    if (matchField(trimmed) || detectHeaderLine(trimmed)) continue;
    if (!/\d/.test(trimmed)) continue;
    const amounts = fromPeel(trimmed, ["quantity", "pru", "last", "valuation"]);
    if (!amounts?.label || !/[A-Za-zÀ-ÿ]{3,}/.test(amounts.label)) continue;
    if (headerishLabel(amounts.label)) continue;
    if (/^(arrete|releve|situation|date)\b/.test(fold(amounts.label))) continue;
    const row = buildStatementRow(amounts, matcher, trimmed);
    if (row && (row.quantity != null || row.match.confidence !== "aucune")) rows.push(row);
  }
  return rows;
}

function headerishLabel(label: string): boolean {
  const folded = fold(label);
  return /^(quantite|qte|cours|pru|valorisation|evaluation|code valeur|prix de revient)/.test(folded);
}

function detectLoose(text: string, matcher: SecurityMatcher): number {
  return parseLoose(text, matcher).length > 0 ? 1 : 0;
}

function withIds(rows: RawRow[]): StatementRowDraft[] {
  return rows.slice(0, STATEMENT_MAX_ROWS).map((row, index) => ({ ...row, id: `l${index + 1}` }));
}

export function readHeaderRow(
  cells: string[],
  roles: (HeaderRole | null)[],
  matcher: SecurityMatcher,
  rawLine: string
): RawRow | null {
  const amounts = fromCells(cells, roles);
  if (!amounts) return null;
  return buildStatementRow(amounts, matcher, rawLine);
}

export function finalizeStatement(
  rawRows: RawRow[],
  meta: { issuer: string | null; statementDate: string | null },
  layout: { id: string; label: string },
  extras?: { documentKind?: DocumentKind; ignored?: IgnoredLine[]; ignoredCount?: number }
): StatementParseResult {
  const truncated = rawRows.length > STATEMENT_MAX_ROWS;
  const rows = withIds(rawRows);
  const warnings = summarize(rows, truncated);
  if (!meta.issuer) warnings.unshift("SGI non reconnue : la lecture s’appuie sur les colonnes et les noms de valeurs.");
  if (!meta.statementDate) warnings.unshift("Date du relevé introuvable — vous pourrez la saisir avant d’enregistrer.");
  return {
    issuer: meta.issuer,
    statementDate: meta.statementDate,
    layoutId: layout.id,
    layoutLabel: layout.label,
    documentKind: extras?.documentKind ?? "positions",
    ignored: extras?.ignored ?? [],
    ignoredCount: extras?.ignoredCount ?? extras?.ignored?.length ?? 0,
    rows,
    warnings,
  };
}

function summarize(rows: StatementRowDraft[], truncated: boolean): string[] {
  const warnings: string[] = [];
  const unmatched = rows.filter((row) => row.instrumentKind === "action" && row.match.confidence === "aucune").length;
  if (unmatched > 0) warnings.push(`${unmatched} ligne(s) sans société reconnue — à corriger ou à exclure.`);
  const ambiguous = rows.filter((row) => row.match.ambiguous).length;
  if (ambiguous > 0) warnings.push(`${ambiguous} ligne(s) avec plusieurs correspondances possibles.`);
  const missingPru = rows.filter((row) => row.avgBuyPrice == null).length;
  if (missingPru > 0) warnings.push(`${missingPru} ligne(s) sans PRU — à compléter avant l’enregistrement.`);
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.match.ticker) continue;
    counts.set(row.match.ticker, (counts.get(row.match.ticker) ?? 0) + 1);
  }
  const duplicates = [...counts.entries()].filter(([, count]) => count > 1).map(([ticker]) => ticker);
  if (duplicates.length > 0) {
    warnings.push(
      `Certaines valeurs apparaissent plusieurs fois (${duplicates.join(", ")}) — les quantités cochées seront additionnées à l’enregistrement.`
    );
  }
  if (truncated) warnings.push(`Seules les ${STATEMENT_MAX_ROWS} premières lignes ont été conservées.`);
  return warnings;
}

export function parseStatementText(text: string, catalog: readonly SecurityCatalogEntry[]): StatementParseResult {
  const normalized = normalizeStatementText(text);
  const letters = normalized.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters.length < 15) {
    throw new StatementImportError("UNRECOGNIZED");
  }

  const history = tryParseHistoryText(normalized, catalog);
  if (history) {
    return finalizeStatement(history.rows, detectStatementMeta(normalized), { id: "positions", label: history.layoutLabel }, {
      documentKind: history.documentKind,
      ignored: history.ignored,
      ignoredCount: history.ignoredCount,
    });
  }

  const matcher = createSecurityMatcher(catalog);
  const layouts = [
    { id: "colonnes", label: "Tableau à colonnes", score: detectColumns(normalized), rows: [] as RawRow[], parse: () => parseColumns(normalized, matcher) },
    { id: "blocs", label: "Blocs libellé / valeur", score: detectBlocks(normalized), rows: [] as RawRow[], parse: () => parseBlocks(normalized, matcher) },
    { id: "lignes", label: "Lignes libres", score: detectLoose(normalized, matcher), rows: [] as RawRow[], parse: () => parseLoose(normalized, matcher) },
  ];

  const parsed = layouts
    .filter((layout) => layout.score > 0)
    .map((layout) => ({ ...layout, rows: layout.parse() }))
    .filter((layout) => layout.rows.some((row) => (row.quantity ?? 0) > 0));

  if (parsed.length === 0) throw new StatementImportError("UNRECOGNIZED");

  const columnar = parsed.find((layout) => layout.id === "colonnes");
  const winner =
    columnar ??
    [...parsed].sort((a, b) => {
      const qtyA = a.rows.filter((row) => (row.quantity ?? 0) > 0).length;
      const qtyB = b.rows.filter((row) => (row.quantity ?? 0) > 0).length;
      if (qtyB !== qtyA) return qtyB - qtyA;
      return b.score - a.score;
    })[0]!;
  return finalizeStatement(winner.rows, detectStatementMeta(normalized), { id: winner.id, label: winner.label });
}
