// Détection de la devise et de l'unité d'un état financier.

export interface UnitInfo {
  currency: "NGN" | "USD" | null;
  multiplier: number | null;
  label: string | null;
}

const MULT: Array<[RegExp, number]> = [
  [/billions?|\bbn\b/i, 1e9],
  [/millions?|\bmn\b|\bm\b/i, 1e6],
  [/thousands?|'000|000s?\b|\bk\b/i, 1e3],
];

function multFromWord(w: string): number | null {
  for (const [re, m] of MULT) if (re.test(w)) return m;
  return null;
}

/** Analyse un bloc de texte d'en-tête (haut de page ou titre) à la recherche d'une mention d'unité. */
export function detectUnit(header: string): UnitInfo {
  const t = header.replace(/[’‘`]/g, "'");
  const patterns: Array<{ re: RegExp; currency: "NGN" | "USD"; word: (m: RegExpExecArray) => string }> = [
    // ₦'000 / N'000 / ₦’million / N million / NGN'm / N'm
    { re: /(?:₦|\bN(?![a-z])|NGN|NAIRA)\s?'?\s?(000|millions?|m\b|billions?|bn\b|thousands?)/i, currency: "NGN", word: (m) => m[1] },
    { re: /(?:\$|US\$|USD|US dollars?)\s?'?\s?(000|millions?|m\b|billions?|bn\b|thousands?)/i, currency: "USD", word: (m) => m[1] },
    { re: /in\s+(thousands?|millions?|billions?)\s+of\s+(naira|nigerian naira|us dollars?|dollars?)/i, currency: "NGN", word: (m) => m[1] },
    { re: /(naira|nigerian naira|us dollars?|dollars?)\s+(?:in\s+)?(thousands?|millions?|billions?)/i, currency: "NGN", word: (m) => m[2] },
    { re: /\b(thousands?|millions?)\s+of\s+(naira|nigerian naira|us dollars?|dollars?)/i, currency: "NGN", word: (m) => m[1] },
    { re: /amounts?\s+(?:are\s+)?in\s+(?:₦|N)\s*(thousands?|millions?|billions?)/i, currency: "NGN", word: (m) => m[1] },
  ];
  let best: { index: number; info: UnitInfo } | null = null;
  for (const p of patterns) {
    const m = p.re.exec(t);
    if (!m) continue;
    const mult = multFromWord(p.word(m));
    if (!mult) continue;
    const ctx = m[0].toLowerCase();
    const currency: "NGN" | "USD" = /dollar|\$|usd/.test(ctx) ? "USD" : p.currency;
    if (!best || m.index < best.index) best = { index: m.index, info: { currency, multiplier: mult, label: m[0].trim() } };
  }
  if (best) return best.info;
  // Unité sans symbole de devise lisible (« Wmillion » : ₦ mal encodé) : la devise est celle de la société.
  const bare = /(?:^|\s)'?\s?(000|millions?)\b/i.exec(t);
  if (bare) return { currency: null, multiplier: multFromWord(bare[1]), label: `${bare[0].trim()} (no currency symbol)` };
  // Devise seule, unité entière (« in Naira », « ₦ » sans multiplicateur).
  if (/\bin\s+naira\b|expressed in naira|amounts in naira/i.test(t)) return { currency: "NGN", multiplier: 1, label: "Naira" };
  return { currency: null, multiplier: null, label: null };
}
