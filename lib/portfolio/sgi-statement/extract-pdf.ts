/**
 * Extraction du texte d'un PDF « natif » (couche texte).
 * Un scan sans texte est signalé `SCANNED_PDF`. L'appelant peut alors
 * envoyer le PDF à un modèle de vision, ou demander une photo (OCR).
 * Voir docs/import-releve-sgi.md.
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
    let minX = Number.POSITIVE_INFINITY;
    for (const item of page) {
      const raw = item.str?.replace(/\u00a0|\u202f/g, " ") ?? "";
      if (!raw || /^\s+$/.test(raw)) continue;
      const str = raw.trim();
      if (!str) continue;
      if (item.x < minX) minX = item.x;
      const tolerance = Math.max(2, (item.fontSize || 10) * 0.45);
      const bucket = buckets.find((candidate) => Math.abs(candidate.y - item.y) <= tolerance);
      if (bucket) bucket.items.push({ ...item, str });
      else buckets.push({ y: item.y, items: [{ ...item, str }] });
    }
    if (!Number.isFinite(minX)) minX = 0;
    buckets.sort((a, b) => b.y - a.y);
    for (const bucket of buckets) {
      bucket.items.sort((a, b) => a.x - b.x);
      let line = "";
      for (const item of bucket.items) {
        const spaceW = Math.max(1, (item.fontSize || 10) * 0.28);
        const target = Math.max(0, Math.round((item.x - minX) / spaceW));
        if (line.length < target) line += " ".repeat(target - line.length);
        else if (line.length > 0 && !line.endsWith(" ")) line += " ";
        line += item.str;
      }
      const kept = line.replace(/\s+$/, "");
      if (kept.trim()) lines.push(kept);
    }
  }
  return lines.join("\n");
}
