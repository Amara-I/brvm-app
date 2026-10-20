/**
 * Lecture d'une photo, d'une capture ou d'un PDF image.
 *
 * 1. Modèle de vision (Vercel AI Gateway) si `AI_GATEWAY_API_KEY` ou
 *    `VERCEL_OIDC_TOKEN` est présent — une requête, sortie structurée.
 * 2. Sinon OCR local (`tesseract.js`, français) pour JPEG / PNG / WEBP.
 *    Un PDF sans texte n'est pas rasterisé ici (pas de canvas natif) :
 *    le message demande une photo, sauf si la vision est configurée.
 *
 * Le fichier n'est pas écrit sur disque. Aucune clé n'est journalisée.
 */

import type { GatewayModelId } from "ai";
import { z } from "zod";
import { StatementImportError } from "./messages";
import type { StatementUpload } from "./parse-upload";

const DEFAULT_VISION_MODEL = "google/gemini-2.5-flash";

const visionRowSchema = z.object({
  label: z.string(),
  isin: z.string().nullable(),
  ticker: z.string().nullable(),
  side: z.enum(["achat", "vente"]).nullable(),
  quantity: z.number().nullable(),
  unitPrice: z.number().nullable(),
  date: z.string().nullable(),
  kind: z.enum(["action", "obligation", "fcp"]).nullable(),
});

const visionSchema = z.object({
  rows: z.array(visionRowSchema),
});

export type VisionRow = z.infer<typeof visionRowSchema>;

export function visionConfigured(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY?.trim() || process.env.VERCEL_OIDC_TOKEN?.trim());
}

function mediaTypeOf(file: StatementUpload): string {
  const mime = file.mime.toLowerCase();
  if (mime.startsWith("image/") || mime === "application/pdf") return mime;
  const name = file.filename.toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

function isRaster(file: StatementUpload): boolean {
  const mime = mediaTypeOf(file);
  return mime === "image/png" || mime === "image/jpeg" || mime === "image/webp";
}

/** Transforme les lignes du modèle en tableau texte, ré-agrégé par le parseur. */
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

async function visionTranscribe(file: StatementUpload): Promise<string> {
  const { generateText, Output, gateway } = await import("ai");
  const modelId = (process.env.SGI_STATEMENT_VISION_MODEL?.trim() || DEFAULT_VISION_MODEL) as GatewayModelId;
  const mediaType = mediaTypeOf(file);
  const part =
    mediaType === "application/pdf"
      ? ({ type: "file", data: file.bytes, mediaType } as const)
      : ({ type: "image", image: file.bytes, mediaType } as const);

  const result = await generateText({
    model: gateway(modelId),
    output: Output.object({
      schema: visionSchema,
      name: "releve_sgi",
      description: "Lignes d'instruments d'un relevé de titres ou d'un historique d'opérations.",
    }),
    maxRetries: 0,
    timeout: 25_000,
    system:
      "Tu lis un relevé de titres d'une SGI de la BRVM (relevé de portefeuille, avis d'opéré ou historique). " +
      "Extrais chaque ligne d'instrument, sans agréger les achats et les ventes. " +
      "Ignore en-têtes, pieds de page, adresses, totaux, espèces, frais et numéros de page. " +
      "side vaut achat ou vente, ou null si la ligne est une position déjà nette. " +
      "quantity et unitPrice sont des nombres (pas de texte). date est YYYY-MM-DD ou null. " +
      "kind vaut action, obligation ou fcp.",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Extrais les lignes d'instruments de ce relevé." },
          part,
        ],
      },
    ],
  });

  const rows = result.output?.rows ?? [];
  if (rows.length === 0) return "";
  return visionRowsToText(rows);
}

async function ocrImage(bytes: Uint8Array): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("fra", 1, {
    cachePath: "/tmp/tesseract-cache",
    errorHandler: () => undefined,
  });
  try {
    await worker.setParameters({ preserve_interword_spaces: "1" });
    const recognized = await worker.recognize(Buffer.from(bytes));
    return recognized.data.text ?? "";
  } finally {
    await worker.terminate();
  }
}

export async function transcribeStatement(file: StatementUpload): Promise<string> {
  if (visionConfigured()) {
    try {
      const text = await visionTranscribe(file);
      if (text.trim()) return text;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      console.error("[sgi-statement] vision indisponible", message.slice(0, 180));
      if (!isRaster(file)) throw new StatementImportError("UNREADABLE");
    }
  } else if (!isRaster(file)) {
    throw new StatementImportError("SCANNED_PDF");
  }

  try {
    const text = await ocrImage(file.bytes);
    if (!text.trim()) throw new StatementImportError("UNREADABLE");
    return text;
  } catch (error) {
    if (error instanceof StatementImportError) throw error;
    const message = error instanceof Error ? error.message : "";
    console.error("[sgi-statement] OCR impossible", message.slice(0, 180));
    throw new StatementImportError("UNREADABLE");
  }
}
