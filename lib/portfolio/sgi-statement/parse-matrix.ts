import { fold } from "./fold";
import { headerRole, rolesLookLikeHeader, type HeaderRole } from "./headers";
import { createSecurityMatcher } from "./match-security";
import { tryParseMouvementsMatrix } from "./parse-mouvements";
import { tryParseHistoryMatrix } from "./positions";
import { detectStatementMeta, finalizeStatement, readHeaderRow } from "./parse-statement";
import { MOUVEMENTS_TITRES } from "./templates/mouvements-titres";
import { OPERATIONS } from "./templates/operations";
import { POSITIONS } from "./templates/positions";
import { firstTemplate } from "./templates/run";
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

  const text = rows.map((row) => row.filter(Boolean).join(" ")).join("\n");
  const selected = firstTemplate([
    [
      {
        templateId: MOUVEMENTS_TITRES.id,
        family: MOUVEMENTS_TITRES.family,
        layoutId: MOUVEMENTS_TITRES.layoutId,
        label: MOUVEMENTS_TITRES.label,
        run: () => {
          const parsed = tryParseMouvementsMatrix(rows, catalog);
          if (!parsed) return null;
          return {
            rows: parsed.rows,
            ignored: parsed.ignored,
            ignoredCount: parsed.ignoredCount,
            documentKind: parsed.documentKind,
            label: parsed.layoutLabel,
          };
        },
      },
    ],
    [
      {
        templateId: OPERATIONS.id,
        family: OPERATIONS.family,
        layoutId: OPERATIONS.layoutId,
        label: OPERATIONS.label,
        run: () => {
          const parsed = tryParseHistoryMatrix(rows, catalog);
          if (!parsed) return null;
          return {
            rows: parsed.rows,
            ignored: parsed.ignored,
            ignoredCount: parsed.ignoredCount,
            documentKind: parsed.documentKind,
            label: parsed.layoutLabel,
          };
        },
      },
    ],
    [
      {
        templateId: POSITIONS.id,
        family: POSITIONS.family,
        layoutId: "matrice",
        label: "Fichier tabulé",
        run: () => {
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
          const matcher = createSecurityMatcher(catalog);
          const parsed = [];
          for (const row of rows.slice(headerIndex + 1)) {
            if (isTotalRow(row)) break;
            const raw = readHeaderRow(row, roles, matcher, row.filter(Boolean).join(" | "));
            if (raw) parsed.push({ ...raw, id: `m${parsed.length + 1}` });
          }
          if (!parsed.some((row) => (row.quantity ?? 0) > 0)) return null;
          return { rows: parsed, ignored: [], ignoredCount: 0, documentKind: "positions" as const };
        },
      },
    ],
  ]);
  if (!selected) return null;
  return finalizeStatement(selected.draft.rows, detectStatementMeta(text), { id: selected.layoutId, label: selected.label }, {
    documentKind: selected.draft.documentKind,
    ignored: selected.draft.ignored,
    ignoredCount: selected.draft.ignoredCount,
    templateId: selected.templateId,
    family: selected.family,
  });
}
