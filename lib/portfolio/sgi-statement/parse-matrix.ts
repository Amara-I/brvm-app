import { fold } from "./fold";
import { headerRole, rolesLookLikeHeader, type HeaderRole } from "./headers";
import { createSecurityMatcher } from "./match-security";
import { tryParseHistoryMatrix } from "./positions";
import { detectStatementMeta, finalizeStatement, readHeaderRow } from "./parse-statement";
import type { SecurityCatalogEntry, StatementParseResult } from "./types";

function trimTrailing(cells: string[]): string[] {
  const copy = [...cells];
  while (copy.length > 0 && !copy[copy.length - 1]?.trim()) copy.pop();
  return copy;
}

function isTotalRow(cells: string[]): boolean {
  const folded = fold(cells.filter(Boolean).join(" "));
  return /^(total|sous total|portefeuille global|net a payer|solde general)\b/.test(folded);
}

/** CSV / Excel déjà découpé en cellules. `null` si aucune ligne d'en-tête. */
export function parseStatementMatrix(
  matrix: readonly (readonly string[])[],
  catalog: readonly SecurityCatalogEntry[]
): StatementParseResult | null {
  const rows = matrix
    .map((row) => row.map((cell) => String(cell ?? "").replace(/\u00a0|\u202f/g, " ").trim()))
    .filter((row) => row.some((cell) => cell.length > 0));
  if (rows.length === 0) return null;

  let headerIndex = -1;
  let roles: (HeaderRole | null)[] = [];
  for (let index = 0; index < Math.min(rows.length, 25); index += 1) {
    const cells = trimTrailing(rows[index] ?? []);
    const next = cells.map((cell) => headerRole(cell));
    const known = next.filter(Boolean).length;
    if (!rolesLookLikeHeader(next) || known < Math.ceil(next.length * 0.6)) continue;
    headerIndex = index;
    roles = next;
    break;
  }
  if (headerIndex < 0) return null;

  const history = tryParseHistoryMatrix(rows, catalog);
  if (history) {
    const text = rows.map((row) => row.filter(Boolean).join(" ")).join("\n");
    return finalizeStatement(history.rows, detectStatementMeta(text), { id: "positions", label: history.layoutLabel }, {
      documentKind: history.documentKind,
      ignored: history.ignored,
      ignoredCount: history.ignoredCount,
    });
  }

  const matcher = createSecurityMatcher(catalog);
  const parsed = [];
  for (const row of rows.slice(headerIndex + 1)) {
    if (isTotalRow(row)) break;
    const raw = readHeaderRow(row, roles, matcher, row.filter(Boolean).join(" | "));
    if (raw) parsed.push(raw);
  }
  if (!parsed.some((row) => (row.quantity ?? 0) > 0)) return null;

  const text = rows.map((row) => row.filter(Boolean).join(" ")).join("\n");
  return finalizeStatement(parsed, detectStatementMeta(text), {
    id: "matrice",
    label: "Fichier tabulé",
  });
}
