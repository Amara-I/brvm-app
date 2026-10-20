/**
 * Nombres tels qu'imprimés sur un relevé BRVM :
 * « 1 234,50 », « 1.234,50 », « 1,234.50 », « 12,5 % », « 7 800 FCFA ».
 */
export function parseFrNumber(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (input == null) return null;

  let s = String(input).trim();
  if (!s || s === "-" || s === "+") return null;

  s = s.replace(/\u00a0|\u202f/g, " ");
  s = s.replace(/\s*(?:fcfa|xof|f\s*cfa|cfa|frs?)\s*$/i, "").trim();
  s = s.replace(/\s*%\s*$/, "").trim();
  s = s.replace(/\s/g, "");
  if (!s || s === "-" || s === "+") return null;

  const neg = s.startsWith("-");
  if (s.startsWith("+") || s.startsWith("-")) s = s.slice(1);
  if (!s) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, "");
    else s = s.replace(",", ".");
  } else if (lastDot >= 0) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  }

  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

function isNumericToken(token: string): boolean {
  return /^[+-]?\d{1,3}(?:[.,]\d+)?%?$/.test(token) || /^\d+[.,]\d+%?$/.test(token);
}

function parseGroup(tokens: string[]): number | null {
  const clean = tokens.map((token) => token.replace(/%$/, ""));
  if (clean.length === 1) return parseFrNumber(clean[0]);
  const [first, ...rest] = clean;
  if (!first || !/^\d{1,3}$/.test(first)) return null;
  const grouped = rest.every((token, index) =>
    index < rest.length - 1 ? /^\d{3}$/.test(token) : /^\d{3}(?:[.,]\d+)?$/.test(token)
  );
  if (!grouped) return null;
  const head = first + rest.map((token) => token.replace(/[.,]\d+$/, "")).join("");
  const decimal = rest[rest.length - 1]?.match(/[.,](\d+)$/);
  return parseFrNumber(decimal ? `${head}.${decimal[1]}` : head);
}

/** Toutes les façons de regrouper « 4 800 5 100 » en nombres (milliers ou tokens séparés). */
export function segmentNumericTokens(tokens: string[]): number[][] {
  const out: number[][] = [];
  const walk = (index: number, acc: number[]) => {
    if (out.length > 500) return;
    if (index >= tokens.length) {
      if (acc.length > 0) out.push(acc);
      return;
    }
    const single = parseGroup(tokens.slice(index, index + 1));
    if (single != null && single > 0) walk(index + 1, [...acc, single]);
    for (let length = 2; length <= 4 && index + length <= tokens.length; length += 1) {
      const grouped = parseGroup(tokens.slice(index, index + length));
      if (grouped != null && grouped > 0 && grouped !== single) walk(index + length, [...acc, grouped]);
    }
  };
  walk(0, []);
  return out;
}

/**
 * Sépare le libellé des nombres en fin de ligne, quand les espaces servent
 * à la fois de séparateur de milliers et de séparateur de colonnes.
 */
export function segmentAmountLine(line: string): { label: string; alternatives: number[][] } | null {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  let start = tokens.length;
  while (start > 0 && isNumericToken(tokens[start - 1]!)) start -= 1;
  if (start === tokens.length || start === 0) return null;
  const numeric = tokens.slice(start).filter((token) => token !== "%");
  if (numeric.length === 0) return null;
  const alternatives = segmentNumericTokens(numeric);
  if (alternatives.length === 0) return null;
  return { label: tokens.slice(0, start).join(" "), alternatives };
}
