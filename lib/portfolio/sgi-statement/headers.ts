import { parseFrNumber } from "./french-number";
import { fold } from "./fold";

export type HeaderRole = "isin" | "ticker" | "name" | "quantity" | "pru" | "last" | "valuation" | "variation";

export type ColumnDelimiter = "tab" | "pipe" | "semi" | "multi" | "phrases";

export type HeaderHit = {
  roles: (HeaderRole | null)[];
  delimiter: ColumnDelimiter;
};

/**
 * Libellés d'en-tête déjà repliés. Le plus long gagne à une position donnée.
 * Pour une nouvelle SGI, ajouter ici le mot de colonne inconnu avant d'écrire
 * un parseur dédié.
 */
export const HEADER_PHRASES: readonly { role: HeaderRole; phrase: string }[] = [
  { role: "isin", phrase: "code isin" },
  { role: "isin", phrase: "isin" },
  { role: "ticker", phrase: "code valeur" },
  { role: "ticker", phrase: "code titre" },
  { role: "ticker", phrase: "mnemotechnique" },
  { role: "ticker", phrase: "mnemo technique" },
  { role: "ticker", phrase: "symbole" },
  { role: "ticker", phrase: "ticker" },
  { role: "ticker", phrase: "mnemo" },
  { role: "ticker", phrase: "code" },
  { role: "name", phrase: "designation" },
  { role: "name", phrase: "libelle" },
  { role: "name", phrase: "intitule" },
  { role: "name", phrase: "instrument" },
  { role: "name", phrase: "societe" },
  { role: "valuation", phrase: "valeur boursiere" },
  { role: "valuation", phrase: "valeur de marche" },
  { role: "name", phrase: "valeur" },
  { role: "name", phrase: "titre" },
  { role: "name", phrase: "nom" },
  { role: "quantity", phrase: "nombre de titres" },
  { role: "quantity", phrase: "quantite" },
  { role: "quantity", phrase: "nombre" },
  { role: "quantity", phrase: "nbre" },
  { role: "quantity", phrase: "qte" },
  { role: "quantity", phrase: "qty" },
  { role: "pru", phrase: "prix de revient unitaire" },
  { role: "pru", phrase: "prix de revient moyen" },
  { role: "pru", phrase: "prix de revient" },
  { role: "pru", phrase: "cout de revient" },
  { role: "pru", phrase: "cout moyen" },
  { role: "pru", phrase: "prix moyen" },
  { role: "pru", phrase: "prix d achat" },
  { role: "pru", phrase: "prix unitaire" },
  { role: "pru", phrase: "prmp" },
  { role: "pru", phrase: "pru" },
  { role: "pru", phrase: "cmp" },
  { role: "pru", phrase: "pmp" },
  { role: "last", phrase: "dernier cours" },
  { role: "last", phrase: "cours du jour" },
  { role: "last", phrase: "cours" },
  { role: "last", phrase: "cloture" },
  { role: "valuation", phrase: "valorisation" },
  { role: "valuation", phrase: "evaluation" },
  { role: "valuation", phrase: "montant" },
  { role: "valuation", phrase: "valo" },
  { role: "variation", phrase: "variation" },
  { role: "variation", phrase: "perf" },
  { role: "variation", phrase: "var" },
];

const HEADER_STOPWORDS = new Set([
  "de",
  "du",
  "des",
  "la",
  "le",
  "les",
  "d",
  "unitaire",
  "fcfa",
  "xof",
  "en",
  "au",
  "aux",
  "et",
  "par",
  "jour",
  "moyen",
  "nette",
  "net",
]);

const NUMBER_CORE =
  "[+-]?(?:\\d{1,3}(?:[ \\u00A0]\\d{3})+(?:[.,]\\d+)?|\\d{1,3}(?:\\.\\d{3})+(?:,\\d+)?|\\d+(?:,\\d+)?|\\d+\\.\\d+)";

const NUMBER_TAIL = new RegExp(
  `(${NUMBER_CORE})(?:\\s*(?:fcfa|xof|f\\s*cfa|cfa))?(?:\\s*%)?\\s*$`,
  "i"
);

export function headerRole(cell: string): HeaderRole | null {
  const f = fold(cell);
  if (!f) return null;
  let best: { role: HeaderRole; len: number } | null = null;
  for (const rule of HEADER_PHRASES) {
    const p = rule.phrase;
    const hit = f === p || f.startsWith(`${p} `) || f.endsWith(` ${p}`) || ` ${f} `.includes(` ${p} `);
    if (!hit) continue;
    if (!best || p.length > best.len) best = { role: rule.role, len: p.length };
  }
  return best?.role ?? null;
}

function phraseAt(folded: string, index: number): { role: HeaderRole; phrase: string } | null {
  if (index > 0 && folded[index - 1] !== " ") return null;
  let best: { role: HeaderRole; phrase: string } | null = null;
  for (const rule of HEADER_PHRASES) {
    const p = rule.phrase;
    if (!folded.startsWith(p, index)) continue;
    const after = index + p.length;
    if (after !== folded.length && folded[after] !== " ") continue;
    if (!best || p.length > best.phrase.length) best = { role: rule.role, phrase: p };
  }
  return best;
}

function scanPhrases(line: string): HeaderRole[] {
  const folded = fold(line);
  const roles: HeaderRole[] = [];
  let i = 0;
  while (i < folded.length) {
    if (folded[i] === " ") {
      i += 1;
      continue;
    }
    const match = phraseAt(folded, i);
    if (match) {
      roles.push(match.role);
      i += match.phrase.length;
      continue;
    }
    const next = folded.indexOf(" ", i);
    i = next === -1 ? folded.length : next + 1;
  }
  return roles;
}

function residualTokens(line: string, roles: HeaderRole[]): string[] {
  let folded = fold(line);
  const used = [...roles];
  for (const rule of [...HEADER_PHRASES].sort((a, b) => b.phrase.length - a.phrase.length)) {
    const idx = used.indexOf(rule.role);
    if (idx === -1) continue;
    if (!` ${folded} `.includes(` ${rule.phrase} `)) continue;
    folded = ` ${folded} `.replace(` ${rule.phrase} `, " ").trim();
    used.splice(idx, 1);
  }
  return folded.split(" ").filter((token) => token.length > 2 && !HEADER_STOPWORDS.has(token));
}

export function rolesLookLikeHeader(roles: readonly (HeaderRole | null)[]): boolean {
  const known = roles.filter((role): role is HeaderRole => role != null);
  if (known.length < 3) return false;
  const set = new Set(known);
  const identity = set.has("ticker") || set.has("name") || set.has("isin");
  const amount = set.has("pru") || set.has("last") || set.has("valuation");
  return identity && set.has("quantity") && amount;
}

function lineHasLargeAmount(line: string): boolean {
  const withoutDates = line.replace(/\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/g, " ");
  return /\d[\d \u00A0]{3,}/.test(withoutDates.replace(/[.,]\d+/g, ""));
}

export function detectHeaderLine(line: string): HeaderHit | null {
  const trimmed = line.trim();
  if (trimmed.length < 8 || trimmed.length > 220) return null;
  if (/[.!?]$/.test(trimmed)) return null;
  const folded = fold(trimmed);
  if (/indicatif|contractuel|veuillez|monsieur|madame|avertissement|disclaimer/.test(folded)) return null;
  if (lineHasLargeAmount(trimmed)) return null;

  const delimiters: ColumnDelimiter[] = ["tab", "pipe", "semi", "multi"];
  for (const delimiter of delimiters) {
    const cells = splitColumns(trimmed, delimiter);
    if (cells.length < 3) continue;
    const roles = cells.map((cell) => headerRole(cell));
    const known = roles.filter(Boolean).length;
    if (!rolesLookLikeHeader(roles)) continue;
    if (known < Math.ceil(roles.length * 0.6)) continue;
    return { roles, delimiter };
  }

  const roles = scanPhrases(trimmed);
  if (!rolesLookLikeHeader(roles)) return null;
  if (residualTokens(trimmed, roles).length > 2) return null;
  return { roles, delimiter: "phrases" };
}

export function splitColumns(line: string, delimiter: ColumnDelimiter): string[] {
  if (delimiter === "tab") return line.split("\t").map((c) => c.trim());
  if (delimiter === "pipe") return line.split("|").map((c) => c.trim()).filter((c, i, arr) => c.length > 0 || (i > 0 && i < arr.length - 1));
  if (delimiter === "semi") return line.split(";").map((c) => c.trim());
  if (delimiter === "multi") return line.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
  return [line.trim()];
}

export type PeeledNumber = { value: number; percent: boolean };

/** Retire les nombres en fin de ligne (espaces de milliers inclus). */
export function peelNumbers(line: string): { label: string; numbers: PeeledNumber[] } {
  let rest = line.trim();
  const found: PeeledNumber[] = [];

  for (let guard = 0; guard < 12 && rest.length > 0; guard += 1) {
    rest = rest.replace(/\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\s*$/, "").trim();
    const match = rest.match(NUMBER_TAIL);
    if (!match || match.index == null) break;
    if (match.index > 0 && /[/.-]/.test(rest[match.index - 1] ?? "")) break;
    const raw = match[1] ?? "";
    const full = match[0] ?? "";
    const value = parseFrNumber(raw);
    if (value == null) break;
    found.push({ value, percent: /%/.test(full) });
    rest = rest.slice(0, match.index).trim();
  }

  found.reverse();
  return { label: rest, numbers: found };
}

export function amountsClose(a: number, b: number, tolerance = 0.03): boolean {
  const denom = Math.max(Math.abs(b), 1);
  return Math.abs(a - b) / denom <= tolerance;
}
