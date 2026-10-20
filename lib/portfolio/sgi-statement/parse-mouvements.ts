/**
 * Relevé de mouvements de titres (SGI).
 *
 * Colonnes : Titre | Date | Libellé | Valeur unitaire | Débit | Crédit | Solde.
 * Un en-tête de groupe porte le titre et le solde de clôture. Les lignes de
 * détail ont un titre vide et héritent du groupe. « Solde au … » est un solde
 * d'ouverture, pas un achat. En compte titres, le crédit est une entrée
 * (acquisition) et le débit une sortie (cession).
 */

import { roundMoney } from "@/lib/api/portfolio-trades";
import { canonAlias } from "./aliases";
import { parseFrNumber } from "./french-number";
import { fold } from "./fold";
import { createSecurityMatcher, type SecurityMatcher } from "./match-security";
import { termsFromLabel } from "./instrument-terms";
import { classifyInstrument, classifyNoise } from "./noise";
import { nonStockMatch, parseFlexibleDate, type HistoryParse } from "./positions";
import type { IgnoredLine, SecurityCatalogEntry, SecurityMatch, StatementRowDraft } from "./types";

const QTY_EPSILON = 0.0001;
const IGNORED_CAP = 80;

type ColKey = "titre" | "date" | "libelle" | "valeur" | "debit" | "credit" | "solde";

type Columns = Record<ColKey, number>;

type Cells = Record<ColKey, string>;

const COL_RES: readonly { key: ColKey; re: RegExp }[] = [
  { key: "valeur", re: /valeur\s+unitaire/i },
  { key: "libelle", re: /libell[eé]e?/i },
  { key: "titre", re: /\btitre\b/i },
  { key: "debit", re: /d[eé]bit/i },
  { key: "credit", re: /cr[eé]dit/i },
  { key: "date", re: /\bdate\b/i },
  { key: "solde", re: /\bsolde\b/i },
];

const HEADER_LABEL = "Relevé de mouvements de titres";

function emptyCells(): Cells {
  return { titre: "", date: "", libelle: "", valeur: "", debit: "", credit: "", solde: "" };
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

/** Repère les 7 colonnes. `null` si ce n'est pas un relevé de mouvements. */
export function detectMouvementHeader(line: string): Columns | null {
  const found: { key: ColKey; at: number }[] = [];
  for (const column of COL_RES) {
    const match = column.re.exec(line);
    if (!match || match.index == null) return null;
    found.push({ key: column.key, at: match.index });
  }
  found.sort((a, b) => a.at - b.at);
  for (let index = 1; index < found.length; index += 1) {
    if (found[index]!.at <= found[index - 1]!.at) return null;
  }
  const columns = emptyCells() as unknown as Columns;
  for (const column of found) columns[column.key] = column.at;
  return columns;
}

function headerCells(row: readonly string[]): Columns | null {
  const joined = row.map((cell) => cell.trim());
  const folded = joined.map((cell) => fold(cell));
  const at: Partial<Columns> = {};
  folded.forEach((cell, index) => {
    if (!cell) return;
    if (at.valeur == null && /valeur unitaire/.test(cell)) at.valeur = index;
    else if (at.libelle == null && /libelle/.test(cell)) at.libelle = index;
    else if (at.titre == null && cell === "titre") at.titre = index;
    else if (at.debit == null && cell === "debit") at.debit = index;
    else if (at.credit == null && cell === "credit") at.credit = index;
    else if (at.date == null && cell === "date") at.date = index;
    else if (at.solde == null && cell === "solde") at.solde = index;
  });
  if (
    at.titre == null ||
    at.date == null ||
    at.libelle == null ||
    at.valeur == null ||
    at.debit == null ||
    at.credit == null ||
    at.solde == null
  ) {
    return null;
  }
  return at as Columns;
}

function columnsAreWide(columns: Columns): boolean {
  const starts = Object.values(columns).sort((a, b) => a - b);
  for (let index = 1; index < starts.length; index += 1) {
    if (starts[index]! - starts[index - 1]! < 10) return false;
  }
  return true;
}

/** OCR ou export sans colonnes alignées : date, libellé, cours, quantité, solde. */
function looseCells(line: string): Cells {
  const cells = emptyCells();
  const clean = line.replace(/\|/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) return cells;
  const dateMatch = clean.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/);
  if (!dateMatch || dateMatch.index == null) {
    const grouped = clean.match(/^(.*\D)\s+(\d+)\s*$/);
    if (grouped?.[1] && grouped[2] && /[A-Za-zÀ-ÿ]/.test(grouped[1])) {
      cells.titre = grouped[1].trim();
      cells.solde = grouped[2];
      return cells;
    }
    cells.titre = clean;
    return cells;
  }
  cells.date = dateMatch[0];
  let rest = `${clean.slice(0, dateMatch.index)} ${clean.slice(dateMatch.index + dateMatch[0].length)}`
    .replace(/\d{1,2}\/\d{1,2}\/\d{2,4}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const priceMatch = rest.match(/\d{1,3}(?: \d{3})+(?:[.,]\d+)?|\d+[.,]\d{3}/);
  if (priceMatch?.[0] != null && priceMatch.index != null) {
    cells.valeur = priceMatch[0];
    rest = `${rest.slice(0, priceMatch.index)} ${rest.slice(priceMatch.index + priceMatch[0].length)}`.replace(/\s+/g, " ").trim();
  }
  const nums = [...rest.matchAll(/\d+/g)];
  if (nums.length >= 3) {
    cells.debit = nums[nums.length - 3]![0];
    cells.credit = nums[nums.length - 2]![0];
    cells.solde = nums[nums.length - 1]![0];
  } else if (nums.length === 2) {
    cells.solde = nums[1]![0];
    const side = keywordSide(rest);
    if (side === "vente") cells.debit = nums[0]![0];
    else cells.credit = nums[0]![0];
  } else if (nums.length === 1) {
    cells.solde = nums[0]![0];
  }
  cells.libelle = rest
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cells;
}

function assignTokens(line: string, columns: Columns): Cells {
  const cells = emptyCells();
  const ordered = (Object.entries(columns) as [ColKey, number][]).sort((a, b) => a[1] - b[1]);
  for (const match of line.matchAll(/\S+/g)) {
    const token = match[0];
    const at = match.index ?? 0;
    let key: ColKey = ordered[0]![0];
    for (const [candidate, start] of ordered) {
      if (start <= at + 4) key = candidate;
    }
    cells[key] = cells[key] ? `${cells[key]} ${token}` : token;
  }
  return cells;
}

function cellsFromRow(row: readonly string[], columns: Columns): Cells {
  const cells = emptyCells();
  (Object.keys(columns) as ColKey[]).forEach((key) => {
    cells[key] = (row[columns[key]] ?? "").replace(/\s+/g, " ").trim();
  });
  return cells;
}

function isOpeningLabel(label: string): boolean {
  const folded = fold(label);
  return /\b(solde au|solde initial|solde d ouverture|report a nouveau|solde reporte)\b/.test(folded);
}

function isFreeLabel(label: string): boolean {
  const folded = fold(label);
  return /\b(attribution|gratuite|gratuit|split|division|regroupement)\b/.test(folded);
}

/** Sens lu dans le libellé, seulement si Débit et Crédit sont vides. */
function keywordSide(label: string): "achat" | "vente" | null {
  const folded = fold(label);
  if (/\b(vente|cession|rachat|sortie|transfert sortant)\b/.test(folded)) return "vente";
  if (/\b(achat|acquisition|souscription|apport|entree|attribution|transfert entrant)\b/.test(folded)) return "achat";
  if (/\btransfert\b/.test(folded)) {
    if (/\b(sortant|emis)\b/.test(folded)) return "vente";
    if (/\b(entrant|recu)\b/.test(folded)) return "achat";
  }
  return null;
}

function formatFcfa(value: number): string {
  const sign = value < 0 ? "−" : "+";
  const body = Math.abs(Math.round(value))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${body}`;
}

type Group = {
  label: string;
  target: number | null;
  qty: number;
  cost: number;
  costUnknown: boolean;
  firstBuy: string | null;
  lastSolde: number | null;
  hadFlow: boolean;
  realized: number;
  realizedKnown: boolean;
  sideConflict: boolean;
  raws: string[];
};

function blankGroup(label: string, target: number | null): Group {
  return {
    label,
    target,
    qty: 0,
    cost: 0,
    costUnknown: false,
    firstBuy: null,
    lastSolde: null,
    hadFlow: false,
    realized: 0,
    realizedKnown: true,
    sideConflict: false,
    raws: [],
  };
}

function sameTitle(a: string, b: string): boolean {
  return canonAlias(a) === canonAlias(b);
}

type Built = {
  rows: Omit<StatementRowDraft, "id">[];
  ignored: IgnoredLine[];
  ignoredCount: number;
};

function consume(entries: { cells: Cells; raw: string }[], matcher: SecurityMatcher): Built | null {
  const ignored: IgnoredLine[] = [];
  const count = { n: 0 };
  const drafts: Omit<StatementRowDraft, "id">[] = [];
  let group: Group | null = null;
  let pendingTitle = "";
  let seen = 0;

  const flush = () => {
    if (!group) return;
    const current = group;
    group = null;
    pendingTitle = "";
    const computed = Math.round(current.qty * 10_000) / 10_000;
    const headerOk = current.target == null || Math.abs(computed - current.target) <= 0.001;
    const lastOk = current.lastSolde == null || Math.abs(computed - current.lastSolde) <= 0.001;
    const balanced = headerOk && lastOk;
    const label = clip(current.label);
    if (!label) return;

    if (balanced && computed <= QTY_EPSILON) {
      const pnl =
        current.hadFlow && current.realizedKnown
          ? `, résultat réalisé ${formatFcfa(current.realized)} FCFA`
          : "";
      pushIgnored(ignored, count, `${label} — position soldée${pnl}`, "soldee");
      return;
    }

    let quantity = computed;
    let avg: number | null =
      !current.costUnknown && current.cost > 0 && computed > QTY_EPSILON ? roundMoney(current.cost / computed) : null;
    const warnings: string[] = [];
    let forceLow = current.sideConflict;

    if (!balanced && !current.hadFlow && current.target != null && current.target > QTY_EPSILON) {
      quantity = current.target;
      avg = null;
      forceLow = true;
      warnings.push(
        `Mouvements incomplets : la quantité ${quantity} est reprise du solde d'en-tête, le PRU est inconnu.`
      );
    } else if (!balanced) {
      forceLow = true;
      const expected = current.target ?? current.lastSolde;
      warnings.push(
        `Le solde du relevé (${expected ?? "N/D"}) ne correspond pas à la quantité calculée (${computed}).`
      );
      if (computed <= QTY_EPSILON) {
        pushIgnored(
          ignored,
          count,
          `${label} — position soldée, solde du relevé ${expected ?? "N/D"} différent de la quantité calculée`,
          "soldee"
        );
        return;
      }
    }

    if (avg == null) warnings.push("PRU manquant — à compléter avant l’enregistrement.");
    if (current.sideConflict) warnings.push("Le libellé contredit la colonne Débit ou Crédit — vérifiez le sens.");

    const kind = classifyInstrument(label);
    const base = kind === "action" ? matcher(label, null) : nonStockMatch();
    const match: SecurityMatch = forceLow && base.confidence !== "aucune" ? { ...base, confidence: "faible" } : base;
    if (kind === "action" && match.confidence === "aucune") warnings.push("Aucune société cotée ne correspond à cette ligne.");
    else if (kind === "action" && match.ambiguous) warnings.push("Plusieurs sociétés possibles — vérifiez le titre.");

    const terms = termsFromLabel(label, kind);
    const raws = [...new Set(current.raws)].slice(0, 3);
    drafts.push({
      rawLine: raws.length > 0 ? raws.join(" · ") : label,
      label,
      isin: null,
      quantity,
      avgBuyPrice: avg,
      lastPrice: null,
      valuation: null,
      tradeDate: avg == null && !current.hadFlow ? null : current.firstBuy,
      instrumentKind: kind,
      couponRate: terms.couponRate,
      nominal: null,
      maturityDate: terms.maturityDate,
      manager: terms.manager,
      priceMode: "FCFA",
      tracked: true,
      match,
      warnings,
    });
  };

  for (const entry of entries) {
    const cells = entry.cells;
    const raw = entry.raw;
    const noise = classifyNoise(raw);
    if (noise === "page" || noise === "disclaimer" || noise === "adresse" || noise === "section") {
      pushIgnored(ignored, count, raw, noise);
      continue;
    }
    if (detectMouvementHeader(raw) || fold(cells.titre) === "titre") {
      pushIgnored(ignored, count, raw, "en-tete");
      continue;
    }

    const titre = cells.titre.trim();
    const date = cells.date.trim();
    const libelle = cells.libelle.trim();
    const valeur = cells.valeur.trim();
    const debit = parseFrNumber(cells.debit);
    const credit = parseFrNumber(cells.credit);
    const solde = parseFrNumber(cells.solde);
    const noAmounts = !date && !libelle && !valeur && debit == null && credit == null;

    if (titre && noAmounts && solde == null) {
      if (group) group.label = `${group.label} ${titre}`.replace(/\s+/g, " ").trim();
      else pendingTitle = `${pendingTitle} ${titre}`.replace(/\s+/g, " ").trim();
      continue;
    }

    if (titre && noAmounts && solde != null) {
      const label = `${pendingTitle} ${titre}`.replace(/\s+/g, " ").trim();
      pendingTitle = "";
      if (group && sameTitle(group.label, label)) {
        group.target = solde;
        group.raws.push(raw);
        continue;
      }
      flush();
      group = blankGroup(label, solde);
      group.raws.push(raw);
      seen += 1;
      continue;
    }

    if (!group) {
      if (titre) {
        group = blankGroup(titre, null);
        seen += 1;
      } else {
        pushIgnored(ignored, count, raw, noise ?? "sans-instrument");
        continue;
      }
    } else if (titre && !sameTitle(group.label, titre)) {
      const carried = { date, libelle, valeur, debit, credit, solde, raw };
      flush();
      group = blankGroup(titre, null);
      seen += 1;
      applyMovement(group, carried);
      continue;
    }

    applyMovement(group, { date, libelle, valeur, debit, credit, solde, raw });
    seen += 1;
  }
  flush();

  if (seen === 0) return null;
  return { rows: drafts, ignored, ignoredCount: count.n };
}

function applyMovement(
  group: Group,
  move: {
    date: string;
    libelle: string;
    valeur: string;
    debit: number | null;
    credit: number | null;
    solde: number | null;
    raw: string;
  }
) {
  group.raws.push(move.raw);
  if (isOpeningLabel(move.libelle)) {
    if (move.solde != null && !group.hadFlow) {
      group.qty = move.solde;
      if (move.solde > QTY_EPSILON) {
        const price = parseFrNumber(move.valeur);
        if (price != null && price > 0) group.cost = move.solde * price;
        else group.costUnknown = true;
      }
    }
    if (move.solde != null) group.lastSolde = move.solde;
    return;
  }

  let incoming = move.credit != null && move.credit > QTY_EPSILON ? move.credit : 0;
  let outgoing = move.debit != null && move.debit > QTY_EPSILON ? move.debit : 0;
  if (move.solde != null && group.lastSolde != null && (incoming === 0) !== (outgoing === 0)) {
    const delta = move.solde - group.lastSolde;
    if (incoming > 0 && delta < -0.001) {
      outgoing = incoming;
      incoming = 0;
    } else if (outgoing > 0 && delta > 0.001) {
      incoming = outgoing;
      outgoing = 0;
    }
  }
  const hinted = keywordSide(move.libelle);
  if (incoming === 0 && outgoing === 0 && hinted) {
    const fromSolde =
      group.lastSolde != null && move.solde != null ? Math.round((move.solde - group.lastSolde) * 10_000) / 10_000 : 0;
    const qty = Math.abs(fromSolde);
    if (qty > QTY_EPSILON) {
      if (hinted === "achat") incoming = qty;
      else outgoing = qty;
    }
  } else if (hinted && ((hinted === "achat" && outgoing > 0 && incoming === 0) || (hinted === "vente" && incoming > 0 && outgoing === 0))) {
    group.sideConflict = true;
  }

  const price = parseFrNumber(move.valeur);
  const free = isFreeLabel(move.libelle);
  const date = parseFlexibleDate(move.date);

  if (incoming > 0) {
    group.hadFlow = true;
    if (free || price == null || price <= 0) {
      if (!free) group.costUnknown = true;
    } else {
      group.cost += incoming * price;
    }
    group.qty += incoming;
    if (!group.firstBuy && date) group.firstBuy = date;
  }
  if (outgoing > 0) {
    group.hadFlow = true;
    const pru = group.qty > QTY_EPSILON && !group.costUnknown ? group.cost / group.qty : null;
    if (price != null && price > 0 && pru != null) group.realized += (price - pru) * outgoing;
    else group.realizedKnown = false;
    if (group.qty > QTY_EPSILON && !group.costUnknown) {
      const unit = group.cost / group.qty;
      group.cost = Math.max(0, group.cost - unit * Math.min(outgoing, group.qty));
    }
    group.qty -= outgoing;
    if (group.qty <= QTY_EPSILON) {
      group.qty = 0;
      group.cost = 0;
    }
  }
  if (move.solde != null) group.lastSolde = move.solde;
}

function finish(built: Built | null): HistoryParse | null {
  if (!built) return null;
  return {
    rows: built.rows as StatementRowDraft[],
    ignored: built.ignored,
    ignoredCount: built.ignoredCount,
    documentKind: "historique",
    layoutLabel: HEADER_LABEL,
  };
}

export function tryParseMouvementsMatrix(
  matrix: readonly (readonly string[])[],
  catalog: readonly SecurityCatalogEntry[]
): HistoryParse | null {
  const rows = matrix.map((row) => row.map((cell) => String(cell ?? "").replace(/\u00a0|\u202f/g, " ").trim()));
  let headerAt = -1;
  let columns: Columns | null = null;
  for (let index = 0; index < Math.min(rows.length, 30); index += 1) {
    const found = headerCells(rows[index] ?? []);
    if (!found) continue;
    headerAt = index;
    columns = found;
    break;
  }
  if (!columns || headerAt < 0) return null;

  const matcher = createSecurityMatcher(catalog);
  const entries = rows.slice(headerAt + 1).flatMap((row) => {
    if (!row.some((cell) => cell.trim())) return [];
    return [{ cells: cellsFromRow(row, columns!), raw: row.filter(Boolean).join(" | ") }];
  });
  return finish(consume(entries, matcher));
}

export function tryParseMouvementsText(text: string, catalog: readonly SecurityCatalogEntry[]): HistoryParse | null {
  const lines = text.split("\n");
  let headerAt = -1;
  let columns: Columns | null = null;
  for (let index = 0; index < Math.min(lines.length, 40); index += 1) {
    const found = detectMouvementHeader(lines[index] ?? "");
    if (!found) continue;
    headerAt = index;
    columns = found;
    break;
  }
  if (!columns || headerAt < 0) return null;

  const matcher = createSecurityMatcher(catalog);
  const wide = columnsAreWide(columns);
  const entries: { cells: Cells; raw: string }[] = [];
  for (const line of lines.slice(headerAt + 1)) {
    if (!line.trim()) continue;
    if (detectMouvementHeader(line)) {
      entries.push({ cells: emptyCells(), raw: line.trim() });
      continue;
    }
    entries.push({ cells: wide ? assignTokens(line, columns) : looseCells(line), raw: line.trim() });
  }
  return finish(consume(entries, matcher));
}
