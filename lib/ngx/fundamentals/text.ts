// Analyse de texte issu de `pdftotext -layout` : lignes de tableau → libellé + colonnes numériques.

export interface Row {
  label: string;
  /** Colonnes numériques lues (négatif entre parenthèses, « - » = 0). */
  nums: number[];
  /** Jetons numériques bruts (pour détecter notes / décimales). */
  tokens: string[];
  raw: string;
  /** Index de ligne dans la page. */
  line: number;
}

// Nombre avec séparateurs de milliers, décimales, parenthèses ; « - » / « – » seuls = zéro.
const TOKEN_RE = /\(?-?\s?\d{1,3}(?:,\d{3})+(?:\.\d+)?\)?|\(?-?\d+(?:\.\d+)?\)?|(?<=\s)[-–—](?=\s|$)/g;

export function parseToken(tok: string): number | null {
  const t = tok.trim();
  if (/^[-–—]$/.test(t)) return 0;
  const neg = t.startsWith("(") || t.startsWith("-");
  const digits = t.replace(/[()\s-]/g, "").replace(/,/g, "");
  if (!digits) return null;
  const v = Number(digits);
  if (!Number.isFinite(v)) return null;
  return neg ? -v : v;
}

/** Ligatures (« fi », « fl », « ff »…) encodées en zone privée Unicode ou en formes de présentation par certains PDF. */
export function fixLigatures(s: string): string {
  return s
    .replace(/[\uF001\uFB01]/g, "fi")
    .replace(/[\uF002\uFB02]/g, "fl")
    .replace(/[\uF000\uFB00]/g, "ff")
    .replace(/\uFB03/g, "ffi")
    .replace(/\uFB04/g, "ffl");
}

/** Sépare le libellé (texte avant la première colonne chiffrée, séparée par ≥2 espaces ou fin de libellé) des nombres. */
export function parseRow(line: string, idx = 0): Row {
  // « 214,297,747 -      161,085,778 » : un tiret collé au chiffre précédent (une seule espace) puis un grand blanc
  // est un artefact (renvoi / marque), pas une colonne « nil » : il décalerait toutes les colonnes.
  const raw = fixLigatures(line).replace(/\t/g, "    ").replace(/(\d) [-–](?=\s{3,}[\d(])/g, "$1");
  // Le libellé s'arrête au premier jeton numérique précédé d'au moins 2 espaces, ou d'un « N »/« ₦ » collé.
  // Puce « – Basic » : le tiret initial suivi d'un mot fait partie du libellé, pas d'une colonne « zéro ».
  const probe = raw.replace(/^(\s*)[–—-](?=\s+[A-Za-z])/, "$1x");
  const m = /\s{2,}(?=[\s(₦N$-]*[\d(–—-])/.exec(probe);
  let label = raw;
  let rest = "";
  if (m) {
    label = raw.slice(0, m.index);
    rest = raw.slice(m.index);
  } else {
    // Ligne sans colonne séparée : tenter le dernier bloc de chiffres.
    const tail = /(\s[(\d][\d,.()\s–—-]*)$/.exec(raw);
    if (tail && /\d/.test(tail[1]) && /[A-Za-z]/.test(raw.slice(0, tail.index))) {
      label = raw.slice(0, tail.index);
      rest = tail[1];
    }
  }
  // Séparateur de milliers = espace (« 1 519 697 », états Fidelity 2025) : groupes de 3 chiffres séparés par UN espace
  if (rest && /(?<![\d,.])\d{1,3}(?: \d{3})+(?![\d,])/.test(rest)) {
    rest = rest.replace(/(?<![\d,.])\d{1,3}(?: \d{3})+(?![\d,])/g, (m0) => m0.replace(/ /g, ","));
  }
  const tokens = rest ? (rest.match(TOKEN_RE) ?? []).map((s) => s.trim()) : [];
  const nums = tokens.map(parseToken).filter((v): v is number => v !== null);
  return { label: label.trim(), nums, tokens, raw, line: idx };
}

export function parsePage(text: string): Row[] {
  const rows = text.split("\n").map((l, i) => parseRow(l, i));
  // Mise en page « libellé sous les chiffres » : lignes numériques sans libellé, suivies d'une ligne de libellé seul.
  // Détection stricte : la ligne de libellé suit immédiatement la ligne de chiffres pour ≥70 % de ces lignes.
  const emptyIdx = rows.map((r, i) => (r.nums.length >= 2 && !r.label ? i : -1)).filter((i) => i >= 0);
  const followed = emptyIdx.filter((i) => rows[i + 1] && rows[i + 1].nums.length === 0 && rows[i + 1].label).length;
  const normalRows = rows.filter((r) => r.label && r.nums.length >= 2).length;
  const reverse = emptyIdx.length >= 5 && followed / emptyIdx.length >= 0.7 && normalRows <= emptyIdx.length;
  if (reverse) {
    for (let i = 0; i < rows.length; i++) {
      const cur = rows[i];
      if (cur.nums.length < 2 || cur.label) continue;
      const nxt = rows[i + 1];
      if (nxt && nxt.nums.length === 0 && nxt.label) {
        cur.label = nxt.label;
        nxt.label = "";
        nxt.raw = "";
      }
    }
    return rows;
  }
  // Ligne de chiffres sans libellé, suivie immédiatement d'un libellé seul (puis d'une ligne vide) : « total sans titre
  // + titre en dessous » (ex. « Profit before income tax » imprimé sous ses montants).
  for (let i = 1; i < rows.length - 2; i++) {
    const cur = rows[i];
    const nxt = rows[i + 1];
    if (cur.nums.length >= 2 && !cur.label && rows[i - 1].nums.length >= 2 && nxt.nums.length === 0 && nxt.label && nxt.label.length < 80 && !/[:：]$/.test(nxt.label) && !/per\s+share|information|attributable|^notes?\b/i.test(nxt.label) && !rows[i + 2].label && rows[i + 2].nums.length === 0) {
      cur.label = nxt.label;
      nxt.label = "";
      nxt.raw = "";
    }
  }
  // Recolle les libellés coupés sur plusieurs lignes : ligne sans chiffres suivie d'une ligne
  // dont le libellé est vide ou commence par une minuscule / « the », « of »…
  for (let i = 1; i < rows.length; i++) {
    const cur = rows[i];
    const prev = rows[i - 1];
    if (cur.nums.length >= 1 && prev.nums.length === 0 && prev.label && (!cur.label || /^[a-z(]/.test(cur.label))) {
      if (prev.label.length < 120) cur.label = `${prev.label} ${cur.label}`.trim();
    }
  }
  return rows;
}

export function splitPages(text: string): string[] {
  const pages = text.split("\f");
  if (pages.length && !pages[pages.length - 1].trim()) pages.pop();
  return pages;
}

export const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/[:*]+$/g, "")
    .trim();
