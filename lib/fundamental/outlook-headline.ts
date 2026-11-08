// Première phrase utile d'une synthèse de perspectives, pour la ligne repliée.
// Ne reformule pas le verdict (« Synthèse disponible ») et n'invente pas de chiffre.

import { outlookSummary, outlookText, type OutlookSynthesis } from "@/lib/outlook/synthesis";

const MAX = 110;

function clip(raw: string): string {
  const clean = raw.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (clean.length <= MAX) return clean;
  const cut = clean.slice(0, MAX - 1);
  const space = cut.lastIndexOf(" ");
  const base = (space > 60 ? cut.slice(0, space) : cut).trim();
  return `${base}…`;
}

/** null s'il n'y a ni puce, ni point de vigilance, ni élément sourcé. */
export function outlookHeadline(synthesis: OutlookSynthesis | null, locale: "fr" | "en"): string | null {
  if (!synthesis) return null;
  const summary = outlookSummary(synthesis, locale);
  const fromSummary = summary.bullets[0] ?? summary.watch[0] ?? null;
  const fromItem = synthesis.items.map((item) => outlookText(item, locale)).find((text) => text.trim().length > 0) ?? null;
  const text = clip(fromSummary ?? fromItem ?? "");
  return text || null;
}
