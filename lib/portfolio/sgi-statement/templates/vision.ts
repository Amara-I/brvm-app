/**
 * Sortie structurée du modèle de vision.
 *
 * Le prompt lui donne les trois modèles. Le JSON est validé ici, puis
 * `mouvements-titres` passe par la même réconciliation que le PDF et l'Excel.
 * Les deux autres modèles redeviennent un tableau texte, relu par le pipeline.
 */

import { z } from "zod";
import { parseFrNumber } from "../french-number";
import { reconcileMouvementLedger, type MouvementLine } from "../parse-mouvements";
import { finalizeStatement, parseStatementText } from "../parse-statement";
import type { SecurityCatalogEntry, StatementParseResult } from "../types";
import { MOUVEMENTS_TITRES } from "./mouvements-titres";
import { OPERATIONS } from "./operations";
import { POSITIONS } from "./positions";

const looseAmount = z.union([z.number(), z.string(), z.null()]);
const looseLabel = z.union([z.string(), z.null()]);

/** Schéma envoyé au modèle : pas de transform, pour rester un JSON Schema. */
export const visionLigneSchema = z.object({
  titre: looseLabel,
  date: looseLabel,
  libelle: looseLabel,
  valeurUnitaire: looseAmount,
  debit: looseAmount,
  credit: looseAmount,
  solde: looseAmount,
});

export const visionRowSchema = z.object({
  label: z.string(),
  isin: looseLabel,
  ticker: looseLabel,
  side: z.union([z.enum(["achat", "vente"]), z.null()]),
  quantity: looseAmount,
  unitPrice: looseAmount,
  date: looseLabel,
  kind: z.union([z.enum(["action", "obligation", "fcp"]), z.null()]),
});

export const visionDocumentSchema = z.object({
  template: z.enum(["mouvements-titres", "positions", "operations"]),
  lignes: z.array(visionLigneSchema),
  rows: z.array(visionRowSchema),
});

type RawLigne = z.infer<typeof visionLigneSchema>;
type RawRow = z.infer<typeof visionRowSchema>;

export type VisionLigne = {
  titre: string | null;
  date: string | null;
  libelle: string | null;
  valeurUnitaire: number | null;
  debit: number | null;
  credit: number | null;
  solde: number | null;
};

export type VisionRow = {
  label: string;
  isin: string | null;
  ticker: string | null;
  side: "achat" | "vente" | null;
  quantity: number | null;
  unitPrice: number | null;
  date: string | null;
  kind: "action" | "obligation" | "fcp" | null;
};

export type VisionDocument = {
  template: "mouvements-titres" | "positions" | "operations";
  lignes: VisionLigne[];
  rows: VisionRow[];
};

function asText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function asAmount(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return parseFrNumber(value);
}

function normalizeLigne(line: RawLigne): VisionLigne {
  return {
    titre: asText(line.titre),
    date: asText(line.date),
    libelle: asText(line.libelle),
    valeurUnitaire: asAmount(line.valeurUnitaire),
    debit: asAmount(line.debit),
    credit: asAmount(line.credit),
    solde: asAmount(line.solde),
  };
}

function normalizeRow(row: RawRow): VisionRow {
  return {
    label: row.label?.trim() ?? "",
    isin: asText(row.isin),
    ticker: asText(row.ticker),
    side: row.side,
    quantity: asAmount(row.quantity),
    unitPrice: asAmount(row.unitPrice),
    date: asText(row.date),
    kind: row.kind,
  };
}

export function parseVisionDocument(input: unknown): VisionDocument | null {
  const parsed = visionDocumentSchema.safeParse(input);
  if (!parsed.success) return null;
  return {
    template: parsed.data.template,
    lignes: parsed.data.lignes.map(normalizeLigne),
    rows: parsed.data.rows.map(normalizeRow),
  };
}

function block(profile: { id: string; rules: readonly string[] }): string {
  return [`Modèle ${profile.id} :`, ...profile.rules.map((rule) => `- ${rule}`)].join("\n");
}

/** Prompt unique : les règles des modèles, pas une paraphrase. */
export function visionSystemPrompt(): string {
  return [
    "Tu lis un relevé de titres d'une SGI de la BRVM.",
    "Choisis exactement un modèle et laisse l'autre tableau vide.",
    block(MOUVEMENTS_TITRES),
    "Pour ce modèle, remplis lignes. titre est null sur une ligne de détail. valeurUnitaire, debit, credit et solde sont des nombres ou null.",
    block(POSITIONS),
    block(OPERATIONS),
    "Pour positions ou operations, remplis rows. quantity et unitPrice sont des nombres. date est YYYY-MM-DD ou null. kind vaut action, obligation ou fcp.",
  ].join("\n\n");
}

export function visionRowsToText(rows: readonly VisionRow[]): string {
  const header = ["Date", "Libellé", "Code ISIN", "Sens", "Qté", "PU", "Montant"].join("\t");
  const body = rows.map((row) => {
    let label = (row.label || row.ticker || "").replace(/[\t\n\r]+/g, " ").trim();
    if (row.kind === "obligation" && !/\bobl|obligation|emprunt/i.test(label)) label = `OBL ${label}`.trim();
    if (row.kind === "fcp" && !/\bfcp|fonds|sicav|opcvm/i.test(label)) label = `FCP ${label}`.trim();
    const side = row.side === "vente" ? "Vente" : row.side === "achat" ? "Achat" : "";
    return [row.date ?? "", label, row.isin ?? "", side, row.quantity ?? "", row.unitPrice ?? "", ""].join("\t");
  });
  return [header, ...body].join("\n");
}

function lineFromVision(line: VisionLigne): { cells: MouvementLine; raw: string } {
  const cells: MouvementLine = {
    titre: line.titre ?? "",
    date: line.date ?? "",
    libelle: line.libelle ?? "",
    valeur: line.valeurUnitaire == null ? "" : String(line.valeurUnitaire),
    debit: line.debit == null ? "" : String(line.debit),
    credit: line.credit == null ? "" : String(line.credit),
    solde: line.solde == null ? "" : String(line.solde),
  };
  const raw = [cells.titre, cells.date, cells.libelle, cells.valeur, cells.debit, cells.credit, cells.solde]
    .filter((cell) => cell.length > 0)
    .join(" | ");
  return { cells, raw };
}

/**
 * Valide le JSON puis réconcilie.
 * `mouvements-titres` ne repasse pas par une détection de colonnes :
 * les nombres sont déjà ceux du modèle.
 */
export function applyVisionDocument(input: unknown, catalog: readonly SecurityCatalogEntry[]): StatementParseResult | null {
  const document = parseVisionDocument(input);
  if (!document) return null;
  if (document.template === "mouvements-titres") {
    if (document.lignes.length === 0) return null;
    const reconciled = reconcileMouvementLedger(document.lignes.map(lineFromVision), catalog);
    if (!reconciled) return null;
    return finalizeStatement(
      reconciled.rows,
      { issuer: null, statementDate: null },
      { id: MOUVEMENTS_TITRES.layoutId, label: reconciled.layoutLabel },
      {
        documentKind: reconciled.documentKind,
        ignored: reconciled.ignored,
        ignoredCount: reconciled.ignoredCount,
        templateId: MOUVEMENTS_TITRES.id,
        family: MOUVEMENTS_TITRES.family,
      }
    );
  }
  if (document.rows.length === 0) return null;
  const text = visionRowsToText(document.rows);
  return parseStatementText(text, catalog);
}

export function visionFallbackText(input: unknown): string {
  const document = parseVisionDocument(input);
  if (!document || document.rows.length === 0) return "";
  return visionRowsToText(document.rows);
}
