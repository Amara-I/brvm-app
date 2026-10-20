/**
 * Lecture d'une photo, d'une capture ou d'un PDF image.
 *
 * 1. Modèle de vision (Vercel AI Gateway) si `AI_GATEWAY_API_KEY` ou
 *    `VERCEL_OIDC_TOKEN` est présent — une requête, JSON validé par Zod,
 *    puis la même réconciliation que les autres modèles.
 * 2. Sinon OCR local (`tesseract.js`, français) pour JPEG / PNG / WEBP.
 *    Un PDF sans texte n'est pas rasterisé ici (pas de canvas natif) :
 *    le message demande une photo, sauf si la vision est configurée.
 *
 * Le fichier n'est pas écrit sur disque. Aucune clé n'est journalisée.
 */

import type { GatewayModelId } from "ai";
import { StatementImportError } from "./messages";
import type { StatementUpload } from "./parse-upload";
import {
  parseVisionDocument,
  visionDocumentSchema,
  visionFallbackText,
  visionSystemPrompt,
  type VisionDocument,
} from "./templates/vision";

const DEFAULT_VISION_MODEL = "google/gemini-2.5-flash";

export type Transcript =
  | { mode: "text"; text: string }
  | { mode: "vision"; document: VisionDocument; text: string };

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

async function visionTranscribe(file: StatementUpload): Promise<Extract<Transcript, { mode: "vision" }>> {
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
      schema: visionDocumentSchema,
      name: "releve_sgi",
      description: "Relevé SGI classé dans un modèle : mouvements-titres, positions ou operations.",
    }),
    maxRetries: 0,
    timeout: 25_000,
    system: visionSystemPrompt(),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Classe ce relevé dans un modèle et extrais les lignes. Ne calcule pas le PRU : la réconciliation se fait ensuite.",
          },
          part,
        ],
      },
    ],
  });

  const document = parseVisionDocument(result.output);
  if (!document) throw new Error("JSON de vision invalide");
  return { mode: "vision", document, text: visionFallbackText(document) };
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

export async function transcribeStatement(file: StatementUpload): Promise<Transcript> {
  if (visionConfigured()) {
    try {
      const transcript = await visionTranscribe(file);
      if (transcript.document.lignes.length > 0 || transcript.document.rows.length > 0 || transcript.text.trim()) {
        return transcript;
      }
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
    return { mode: "text", text };
  } catch (error) {
    if (error instanceof StatementImportError) throw error;
    const message = error instanceof Error ? error.message : "";
    console.error("[sgi-statement] OCR impossible", message.slice(0, 180));
    throw new StatementImportError("UNREADABLE");
  }
}
