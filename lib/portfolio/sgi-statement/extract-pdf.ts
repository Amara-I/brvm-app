/**
 * Extraction du texte d'un PDF « natif » (couche texte).
 * Pas d'OCR : un scan sans texte sélectionnable est refusé, avec un message
 * explicite. L'OCR (Tesseract) n'est pas raisonnable sur Vercel Hobby
 * (binaire / WASM lourd, durée) — voir docs/import-releve-sgi.md.
 *
 * Le fichier n'est jamais écrit sur disque : uniquement le buffer reçu.
 */

import { StatementImportError } from "./messages";

type TextItem = {
  str: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
};

export async function extractPdfText(bytes: Uint8Array): Promise<{ text: string; pageCount: number }> {
  if (bytes.length < 5 || Buffer.from(bytes.subarray(0, 5)).toString("latin1") !== "%PDF-") {
    throw new StatementImportError("INVALID_PDF");
  }

  let pages: TextItem[][] = [];
  let pageCount = 0;
  try {
    const { extractTextItems } = await import("unpdf");
    // pdf.js refuse un Buffer Node même s'il est un Uint8Array.
    const extracted = await extractTextItems(new Uint8Array(bytes));
    pageCount = extracted.totalPages;
    pages = extracted.items as TextItem[][];
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("[sgi-statement] lecture PDF impossible", message.slice(0, 180));
    throw new StatementImportError("UNREADABLE");
  }

  const text = pagesToText(pages);
  const letters = text.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (pageCount > 0 && letters.length < 25) {
    throw new StatementImportError("SCANNED_PDF");
  }
  return { text, pageCount };
}

function pagesToText(pages: readonly (readonly TextItem[])[]): string {
  const lines: string[] = [];
  for (const page of pages) {
    const buckets: { y: number; items: TextItem[] }[] = [];
    for (const item of page) {
      const str = item.str?.replace(/\s+/g, " ").trim() ?? "";
      if (!str) continue;
      const tolerance = Math.max(2, (item.fontSize || 10) * 0.45);
      const bucket = buckets.find((candidate) => Math.abs(candidate.y - item.y) <= tolerance);
      if (bucket) bucket.items.push({ ...item, str });
      else buckets.push({ y: item.y, items: [{ ...item, str }] });
    }
    buckets.sort((a, b) => b.y - a.y);
    for (const bucket of buckets) {
      bucket.items.sort((a, b) => a.x - b.x);
      let line = "";
      let cursor = 0;
      for (const item of bucket.items) {
        if (line) {
          const gap = item.x - cursor;
          line += gap > 18 ? "   " : " ";
        }
        line += item.str;
        cursor = item.x + (item.width > 0 ? item.width : item.str.length * (item.fontSize || 10) * 0.45);
      }
      if (line.trim()) lines.push(line.trim());
    }
  }
  return lines.join("\n");
}
