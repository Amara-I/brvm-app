/** Texte d'un PDF NGX (couche texte). Pas de stockage du fichier en base. */

export type NgxPdfItem = { str: string; x: number; y: number };

type TextItem = NgxPdfItem;

export async function extractNgxPdfText(bytes: Uint8Array): Promise<string> {
  const { extractTextItems } = await import("unpdf");
  const extracted = await extractTextItems(new Uint8Array(bytes));
  const pages = extracted.items as TextItem[][];
  const lines: string[] = [];
  for (const items of pages) {
    const buckets = new Map<number, TextItem[]>();
    for (const item of items) {
      const y = Math.round(item.y);
      const bucket = buckets.get(y) ?? [];
      bucket.push(item);
      buckets.set(y, bucket);
    }
    const ys = [...buckets.keys()].sort((a, b) => b - a);
    for (const y of ys) {
      const line = (buckets.get(y) ?? [])
        .sort((a, b) => a.x - b.x)
        .map((item) => item.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (line) lines.push(line);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export async function extractNgxPdfItems(bytes: Uint8Array): Promise<NgxPdfItem[][]> {
  const { extractTextItems } = await import("unpdf");
  const extracted = await extractTextItems(new Uint8Array(bytes));
  return extracted.items as NgxPdfItem[][];
}
