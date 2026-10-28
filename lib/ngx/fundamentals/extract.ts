// Étape 3 — extraction déterministe des états financiers (compte de résultat, bilan) depuis le texte
// `pdftotext -layout` d'un rapport d'états financiers audités. Pas de LLM : localisation de pages par
// score, lecture des colonnes (note / groupe / société), détection d'unité et de devise.
import type { FieldName, NgxCompanyConfig, RawField, StatementExtraction } from "./types";
import { norm, parsePage, splitPages, type Row } from "./text";
import { detectUnit, type UnitInfo } from "./units";

const INCOME_HEAD =
  /statements?\s+of\s+(?:profit\s+or\s+loss|profit\s+and\s+loss|comprehensive\s+income|income|profit\s*\/?\s*\(?loss\)?|profit\s+or\s+loss\s+and\s+other\s+comprehensive\s+income|total\s+comprehensive\s+income)|income\s+statements?|profit\s+and\s+loss\s+account|statements?\s+of\s+(?:operations|earnings)/i;
const BALANCE_HEAD = /statements?\s+of\s+financial\s+position|balance\s+sheets?|statements?\s+of\s+assets\s+and\s+liabilities/i;

const REVENUE_CORPORATE =
  /^(?:total\s+)?(?:net\s+)?(?:revenues?|turnover|sales|net\s+sales|gross\s+revenue|revenue\s+from\s+contracts?\s+with\s+customers|revenue\s+from\s+(?:sale|sales|continuing|contract)[a-z\s]*|revenue\s*\(net\)|income\s+from\s+contracts?\s+with\s+customers|contract\s+revenue|revenue\s*-\s*net)(?:\s*\(note[^)]*\))?$/;
const REVENUE_BANK_PRIMARY = /^(?:total\s+)?gross\s+earnings$/;
const REVENUE_BANK_FALLBACK = /^(?:total\s+)?(?:operating\s+income|income|interest\s+(?:and\s+(?:similar|other)\s+)?(?:income|revenue)|interest\s+income(?:\s+calculated.*)?|total\s+interest\s+income|interest\s+and\s+similar\s+income)$/;
const OPERATING =
  /^(?:operating\s+(?:profit|income|result)s?(?:\s*\/\s*\(?loss\)?)?(?:\s+before[a-z\s]*)?|\(?loss\)?\s*\/?\s*profit\s+from\s+operat[a-z\s]*|profit\s*\/?\s*\(?loss\)?\s+from\s+operat[a-z\s]*|profit\s+from\s+operat[a-z\s]*|results?\s+from\s+operating\s+activities|operating\s+\(?(?:loss|profit)\)?(?:\s*\/\s*\(?(?:loss|profit)\)?)?|trading\s+profit|profit\s+from\s+operations|operating\s+profit\s*\/?\s*\(?loss\)?)$/;
const PBT =
  /^(?:profit|\(?loss\)?)(?:\s*\/?\s*\(?(?:loss|profit)\)?)?\s+(?:before\s+(?:income\s+)?tax(?:ation)?|before\s+taxation|for\s+the\s+year\s+before\s+tax[a-z\s]*)$|^(?:profit|\(?loss\)?)\s*\/?\s*\(?(?:loss|profit)?\)?\s*before\s+(?:income\s+)?tax(?:ation)?$|^(?:loss|profit)\s+before\s+tax$|^(?:profit|\(?loss\)?)\s+before\s+(?:minimum\s+tax|levy|income\s+tax\s+and\s+levy)[a-z\s]*$|^(?:profit|\(?loss\)?)\s+before\s+(?:income\s+and\s+windfall|windfall|[a-z]+\s+and\s+[a-z]+)\s+tax(?:es|ation)?$|^(?:profit|\(?loss\)?)\s*\/?\s*\(?(?:loss|profit)?\)?\s+before\s+(?:income\s+)?tax(?:ation)?\s+(?:expenses?|charge)$/;
const NET_PROFIT =
  /^(?:profit|\(?loss\)?|net\s+profit|net\s+income|total\s+profit)(?:\s*\/?\s*\(?(?:loss|profit)\)?)?\s*(?:for\s+the\s+(?:year|period)|after\s+(?:income\s+)?tax(?:ation)?|for\s+the\s+financial\s+year|for\s+the\s+year\s+after\s+tax[a-z\s]*|from\s+continuing\s+operations)?(?:\s*\(?(?:note[^)]*)\)?)?$|^(?:profit|loss)\s*\/?\s*\(?(?:loss|profit)?\)?\s+(?:for\s+the\s+(?:year|period)|after\s+(?:income\s+)?tax(?:ation)?)(?:\s+from\s+continuing\s+operations)?$/;
const ATTRIB_OWNERS =
  /^(?:(?:profit|\(?loss\)?|net\s+profit)(?:\s*\/\s*\(?(?:loss|profit)\)?)?\s+(?:for\s+the\s+(?:year|period)\s+)?attributable\s+to\s+)?(?:the\s+)?(?:owners?|equity\s+holders?|shareholders?|ordinary\s+shareholders?|holders\s+of\s+the\s+parent)(?:\s+of\s+(?:the\s+)?(?:parent|company|bank|group|holding[a-z\s]*|[a-z\s]{3,40}))?(?:\s+\(note[^)]*\))?:?$/;
const EPS = /(?:basic|diluted)?\s*(?:and\s+diluted\s+)?(?:earnings|loss|\(loss\))\s*(?:\/\s*\(?loss\)?\s*)?per\s+(?:ordinary\s+)?share|basic\s+(?:and\s+diluted\s+)?eps|earnings\s+per\s+share|\bEPS\b/i;
const TOTAL_EQUITY =
  /^(?:total\s+(?:shareholders'?\s+)?equity(?:\s+and\s+reserves)?|total\s+equity\s+attributable\s+to\s+(?:the\s+)?(?:owners?|equity\s+holders?|shareholders?)(?:\s+of\s+[a-z\s]+)?|total\s+shareholders'?\s+(?:equity|funds)|shareholders'?\s+(?:equity|funds)|total\s+(?:capital\s+and\s+)?reserves|net\s+assets)$/;
const EQUITY_ATTRIB =
  /^(?:total\s+)?(?:equity|capital\s+and\s+reserves|shareholders'?\s+(?:equity|funds))\s+attributable\s+to\s+(?:the\s+)?(?:owners?|equity\s+holders?|shareholders?|ordinary\s+shareholders?)(?:\s+of\s+(?:the\s+)?[a-z\s]+)?$|^equity\s+attributable\s+to\s+owners$/;

export interface PageInfo {
  index: number; // 0-based
  text: string;
  rows: Row[];
}

function yearTokens(s: string): number[] {
  return [...s.matchAll(/(?<!\d)(20[0-3]\d)(?!\d)/g)].map((m) => Number(m[1]));
}

/** Titre de la page : premières lignes non vides (les en-têtes de colonnes sont analysés à part). */
function headBlock(page: string, n = 14): string {
  return page.split("\n").slice(0, n).join("\n");
}

function isNotesPage(page: string): boolean {
  const head = headBlock(page, 8);
  return /^\s*notes?\s+to\s+the|\bnotes?\s+to\s+the\s+(?:consolidated\s+)?(?:and\s+separate\s+)?financial|accounting\s+policies|key\s+audit\s+matters|^\s*independent\s+auditor[^\n]{0,10}report|report\s+of\s+the\s+(?:independent\s+)?auditor|table\s+of\s+contents|\bcontents\b|segment(?:al)?\s+(?:information|report)|five[\s-]+year\s+(?:financial\s+)?summary/im.test(head);
}

/** Score d'une page comme compte de résultat. */
/**
 * Sociétés déclarant en USD (ETI) : les états sont publiés en version « - USD » et « - NGN », et les
 * communiqués de presse juxtaposent US$'000 et NGN'000. On ne retient que la page USD pure.
 */
function wrongCurrencyPage(p: PageInfo, currency: NgxCompanyConfig["currency"]): boolean {
  if (currency !== "USD") return false;
  const top = p.text.split("\n").slice(0, 30).join("\n");
  return /\bNGN\b|\bN'000|₦/.test(top) && !/US\$|\bUSD\b/.test(top);
}

/** Page à colonnes US$ et NGN juxtaposées (états ETI 2016-2018) : courant USD = 1re valeur, précédent USD = 3e. */
function isDualCurrency(page: string): boolean {
  const top = page.split("\n").slice(0, 30).join("\n");
  return /US\$/.test(top) && /\bNGN'?\s*000|\bN'000|₦/.test(top);
}

function incomeScore(p: PageInfo, kind: NgxCompanyConfig["kind"], currency: NgxCompanyConfig["currency"] = "NGN"): number {
  if (isNotesPage(p.text)) return 0;
  if (wrongCurrencyPage(p, currency)) return 0;
  const head = headBlock(p.text, 12);
  if (!INCOME_HEAD.test(head)) return 0;
  let s = 1;
  if (currency === "USD" && /\bUSD\b|US\$/.test(p.text.split("\n").slice(0, 30).join("\n"))) s += 1;
  const labels = p.rows.filter((r) => r.nums.length >= 2).map((r) => norm(r.label));
  const has = (re: RegExp) => labels.some((l) => re.test(l));
  if (kind === "bank") {
    if (has(/interest income|gross earnings|total income/)) s += 2;
    if (has(/net interest income/)) s += 1;
  } else if (has(REVENUE_CORPORATE) || has(/revenue|turnover|sales/)) s += 2;
  if (has(/tax/)) s += 1;
  if (has(NET_PROFIT) || has(/profit for the|profit after tax|(?:loss|profit)\s*(?:\/|for)/)) s += 2;
  if (has(/before (income )?tax/)) s += 1;
  if (p.rows.some((r) => EPS.test(r.label))) s += 1;
  if (/consolidated/i.test(head)) s += 0.5;
  if (/comprehensive income/i.test(head) && !/profit|loss|income statement/i.test(head.replace(/comprehensive income/gi, ""))) s -= 0.5;
  return s;
}

function balanceScore(p: PageInfo, currency: NgxCompanyConfig["currency"] = "NGN"): number {
  if (isNotesPage(p.text)) return 0;
  if (wrongCurrencyPage(p, currency)) return 0;
  const head = headBlock(p.text, 12);
  if (!BALANCE_HEAD.test(head)) return 0;
  const labels = p.rows.filter((r) => r.nums.length >= 1).map((r) => norm(r.label));
  let s = 1;
  if (labels.some((l) => /^total assets/.test(l))) s += 2;
  if (labels.some((l) => /total equity|shareholders'? (equity|funds)|net assets|total liabilities and equity/.test(l))) s += 2;
  if (/consolidated/i.test(head)) s += 0.5;
  return s;
}

/**
 * Nombre de colonnes numériques d'après les lignes de données (mode du nombre de valeurs des lignes dont
 * le premier jeton a un séparateur de milliers, donc pas de colonne « Note »), sinon d'après l'en-tête.
 */
export function columnLayout(page: string, rows?: Row[]): { n: number; groupFirst: boolean; hasNote: boolean; dual?: boolean } {
  const lines = page.split("\n").slice(0, 40);
  let headYears = 0;
  let bestLine = "";
  for (let i = 0; i < lines.length; i++) {
    const ys =
      yearTokens(lines[i]).length +
      [...lines[i].matchAll(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b\d{1,2}-[A-Za-z]{3}-\d{2,4}\b|\b[A-Za-z]{3}-\d{2,4}\b/g)].length;
    if (ys > headYears && ys <= 8 && !/\d{1,3},\d{3}/.test(lines[i])) {
      headYears = ys;
      bestLine = lines.slice(Math.max(0, i - 3), i + 1).join(" ");
    }
  }
  // Ordre des colonnes : ligne d'en-tête contenant à la fois « Group » et « Company/Bank » (position relative).
  let groupFirst = true;
  for (const l0 of lines.slice(0, 25)) {
    // « separate and consolidated statement… » est un titre, pas l'en-tête de colonnes
    const l = l0.replace(/\b(?:separate|company)\s+(?:and|&)\s+(?:consolidated|group)\b|\b(?:consolidated|group)\s+(?:and|&)\s+(?:separate|company)\b/gi, (m) => " ".repeat(m.length));
    const g = l.search(/\b(?:group|consolidated)\b/i);
    const c = l.search(/\b(?:company|bank|separate|parent)\b/i);
    if (g >= 0 && c >= 0 && /\s{3,}/.test(l.slice(Math.min(g, c)))) {
      groupFirst = g <= c;
      break;
    }
  }
  void bestLine;
  const hasNote = /\bnotes?\b/i.test(lines.join(" "));
  let n = 0;
  if (rows) {
    const hist = new Map<number, number>();
    for (const r of rows) {
      if (r.nums.length >= 2 && r.nums.length <= 8 && /\d,\d{3}/.test(r.tokens[0] ?? "")) hist.set(r.nums.length, (hist.get(r.nums.length) ?? 0) + 1);
    }
    let bestC = 0;
    for (const [k, c] of hist) if (c > bestC || (c === bestC && k < n)) { bestC = c; n = k; }
    if (bestC < 3) n = 0;
  }
  if (!n) n = headYears >= 2 ? headYears : 2;
  return { n, groupFirst, hasNote, dual: isDualCurrency(page) };
}

export function pickColumns(r: Row, layout: { n: number; groupFirst: boolean; dual?: boolean }): [number | null, number | null] | null {
  let v = r.nums.slice();
  const { n } = layout;
  // Colonne « Note » : entier court sans séparateur, en tête de ligne, quand il y a une colonne de trop.
  const firstTok = r.tokens[0] ?? "";
  const looksNote = /^\d{1,2}(?:\.\d)?$/.test(firstTok);
  if (v.length === n + 1 && looksNote) v = v.slice(1);
  else if (v.length > n + 1 && looksNote) v = v.slice(v.length - n);
  if (v.length < 2) return null;
  if (layout.dual && v.length >= 4) return [v[0], v[2]];
  if (!layout.groupFirst && v.length >= n && n >= 4) return [v[n / 2], v[n / 2 + 1]];
  return [v[0], v[1]];
}

interface FindResult {
  field: RawField;
  row: Row;
}

function findRow(
  pages: PageInfo[],
  pageIdxs: number[],
  matcher: (label: string, row: Row) => boolean,
  layoutOf: (p: PageInfo) => { n: number; groupFirst: boolean; dual?: boolean },
  opts: { minLine?: number } = {},
): FindResult | null {
  for (const pi of pageIdxs) {
    const p = pages[pi];
    if (!p) continue;
    const layout = layoutOf(p);
    for (const r of p.rows) {
      if (opts.minLine !== undefined && pi === pageIdxs[0] && r.line < opts.minLine) continue;
      if (r.nums.length < 2) continue;
      const label = norm(r.label);
      if (!label || !matcher(label, r)) continue;
      const cols = pickColumns(r, layout);
      if (!cols) continue;
      return { field: { values: cols, label: r.label.slice(0, 90), page: p.index + 1 }, row: r };
    }
  }
  return null;
}

/**
 * Banque islamique (Jaiz) : pas de ligne « gross earnings » ; revenu brut = produits bruts de financement et
 * d'investissement + commissions + autres produits d'exploitation (vérifié : 2021 = 24 177 427 + 1 108 774 + 557 162 = 25 843 363,
 * valeur « gross earnings » du comparatif 2022).
 */
function islamicGrossEarnings(pages: PageInfo[], idxs: number[], layoutOf: (p: PageInfo) => { n: number; groupFirst: boolean; dual?: boolean }): RawField | null {
  const g = findRow(pages, idxs, (l) => /^gross income from (?:islamic )?(?:financing|fiancing|fi?nancing)/.test(l), layoutOf);
  if (!g) return null;
  const fee = findRow(pages, idxs, (l) => /^fees? and commis+ions?$/.test(l), layoutOf);
  const oth = findRow(pages, idxs, (l) => /^other operating income$/.test(l), layoutOf);
  const sum = (i: 0 | 1) => {
    const a = g.field.values[i];
    if (a === null) return null;
    return a + (fee?.field.values[i] ?? 0) + (oth?.field.values[i] ?? 0);
  };
  return { values: [sum(0), sum(1)], label: "gross financing income + fees + other income [derived]", page: g.field.page };
}

/** Détermine l'exercice (année de la date de clôture) d'après l'en-tête d'un état. */
export function detectFiscalYear(page: string): { year: number | null; month: number | null } {
  const head = page.split("\n").slice(0, 30).join("\n");
  const re =
    /(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(20[0-3]\d)|(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20[0-3]\d)/gi;
  const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const found: Array<{ y: number; m: number }> = [];
  for (const m of head.matchAll(re)) {
    const mon = (m[2] ?? m[4]).toLowerCase();
    found.push({ y: Number(m[3] ?? m[6]), m: months.indexOf(mon) + 1 });
  }
  if (found.length) {
    // première date de colonne = exercice courant ; on prend la plus récente (colonnes courant/précédent)
    const best = found.reduce((a, b) => (b.y * 12 + b.m > a.y * 12 + a.m ? b : a));
    return { year: best.y, month: best.m };
  }
  const ys = yearTokens(head);
  return { year: ys.length ? Math.max(...ys) : null, month: null };
}

function unitFromPages(pages: PageInfo[], incomeIdx: number | null, balanceIdx: number | null): UnitInfo & { source: string } {
  const tryPage = (i: number | null, src: string) => {
    if (i === null || !pages[i]) return null;
    const head = pages[i].text.split("\n").slice(0, 40).join("\n");
    const u = detectUnit(head);
    return u.multiplier ? { ...u, source: src } : null;
  };
  const a = tryPage(incomeIdx, "income-page") ?? tryPage(balanceIdx, "balance-page");
  if (a) return a;
  // Page voisine (unité parfois répétée sur la page précédente/suivante) puis tout le début du document.
  for (const off of [-1, 1, 2]) {
    const i = incomeIdx === null ? null : incomeIdx + off;
    const r = i !== null && i >= 0 && i < pages.length ? tryPage(i, `income-page${off > 0 ? "+" : ""}${off}`) : null;
    if (r) return r;
  }
  return { currency: null, multiplier: null, label: null, source: "none" };
}

export function extractStatements(text: string, company: NgxCompanyConfig): StatementExtraction {
  const warnings: string[] = [];
  const rawPages = splitPages(text);
  const pages: PageInfo[] = rawPages.map((t, i) => ({ index: i, text: t, rows: parsePage(t) }));

  let incomeIdx = -1;
  let incomeBest = 0;
  let balanceIdx = -1;
  let balanceBest = 0;
  pages.forEach((p, i) => {
    const s = incomeScore(p, company.kind, company.currency);
    if (s >= 4 && s > incomeBest) {
      incomeBest = s;
      incomeIdx = i;
    }
  });
  // Le bilan suit le compte de résultat : chercher d'abord dans les 10 pages suivantes, sinon dans tout le document.
  const pickBalance = (from: number, to: number) => {
    for (let i = from; i < Math.min(to, pages.length); i++) {
      const sc = balanceScore(pages[i], company.currency);
      if (sc >= 4 && sc > balanceBest) {
        balanceBest = sc;
        balanceIdx = i;
      }
    }
  };
  if (incomeIdx >= 0) pickBalance(Math.max(0, incomeIdx - 3), incomeIdx + 10);
  if (balanceIdx < 0) pickBalance(0, pages.length);

  const out: StatementExtraction = {
    fiscalYear: null,
    currency: null,
    unitMultiplier: null,
    unitLabel: null,
    fields: {},
    revenueBasis: null,
    operatingBasis: null,
    pages: { income: incomeIdx >= 0 ? incomeIdx + 1 : null, balance: balanceIdx >= 0 ? balanceIdx + 1 : null },
    columnNote: null,
    periodEndMonth: null,
    interim: false,
    warnings,
  };
  if (incomeIdx < 0) {
    warnings.push("income_statement_not_found");
    return out;
  }
  const inc = pages[incomeIdx];
  const incLayout = columnLayout(inc.text, inc.rows);
  const layoutOfIncome = () => incLayout;
  const fy = detectFiscalYear(inc.text);
  out.fiscalYear = fy.year;
  out.periodEndMonth = fy.month;
  const headForPeriod = inc.text.split("\n").slice(0, 25).join(" ");
  if (/\b(?:three|six|nine|3|6|9)\s+months?\s+(?:ended|period)|half[\s-]?year|\bquarter(?:ly)?\b|(?:period|months?)\s+ended\s+(?:30|31)(?:st|th)?\s+(?:june|september|march)/i.test(headForPeriod) && !/year\s+ended/i.test(headForPeriod)) {
    out.interim = true;
    warnings.push("interim_document");
  }
  const u = unitFromPages(pages, incomeIdx, balanceIdx >= 0 ? balanceIdx : null);
  out.currency = u.currency ?? (u.multiplier ? company.currency : null);
  out.unitMultiplier = u.multiplier;
  out.unitLabel = u.label ? `${u.label} (${u.source})` : null;
  out.columnNote = `cols=${incLayout.n}${incLayout.groupFirst ? "" : " company-first"}`;

  const idxs = [incomeIdx, incomeIdx + 1].filter((i) => i < pages.length);
  const only = [incomeIdx];

  // --- Chiffre d'affaires
  if (company.kind === "bank") {
    const interest = findRow(pages, only, (l) => REVENUE_BANK_FALLBACK.test(l) && !/net interest/.test(l), layoutOfIncome);
    const gross =
      findRow(pages, only, (l) => REVENUE_BANK_PRIMARY.test(l), layoutOfIncome) ?? findGrossEarnings(pages, interest?.field.values ?? null, incLayout);
    const derived = gross ? null : islamicGrossEarnings(pages, only, layoutOfIncome);
    if (gross) {
      out.fields.revenue = gross.field;
      out.revenueBasis = "gross earnings";
    } else if (derived) {
      out.fields.revenue = derived;
      out.revenueBasis = "gross earnings";
      warnings.push("gross_earnings_derived_financing_income_plus_fees_and_other_income");
    } else if (interest) {
      out.fields.revenue = interest.field;
      out.revenueBasis = norm(interest.row.label);
    }
  } else {
    const rev = findRow(pages, only, (l) => REVENUE_CORPORATE.test(l) || /^revenue\b/.test(l) && l.length < 60 && !/cost|expense|tax/.test(l), layoutOfIncome);
    if (rev) {
      out.fields.revenue = rev.field;
      out.revenueBasis = norm(rev.row.label);
    }
  }
  // --- Résultat d'exploitation
  let opRow: FindResult | null = null;
  if (company.kind !== "bank") {
    opRow = findRow(pages, only, (l) => OPERATING.test(l), layoutOfIncome);
    if (opRow) out.operatingBasis = norm(opRow.row.label);
  }
  if (!opRow) {
    opRow = findRow(pages, only, (l) => PBT.test(l), layoutOfIncome);
    // Banque sans ligne « profit before tax » (ex. Jaiz 2016-2018) : « Operating profit » placé juste avant l'impôt
    if (!opRow && company.kind === "bank") {
      const r = findRow(pages, only, (l) => /^operating profit(?: before tax)?$/.test(l), layoutOfIncome);
      if (r && inc.rows.some((q) => q.line > r.row.line && /^(?:income\s+)?tax/.test(norm(q.label)))) {
        opRow = r;
        out.operatingBasis = `PBT:${norm(r.row.label)}`;
      }
    }
    if (opRow && !out.operatingBasis) out.operatingBasis = `PBT:${norm(opRow.row.label)}`;
  }
  if (opRow) out.fields.operatingProfit = opRow.field;
  // --- Résultat net (total), puis part du groupe
  let np: FindResult | null = null;
  const afterPbt = opRow && out.operatingBasis?.startsWith("PBT") ? opRow.row.line : 0;
  // Le total « profit for the year » (continuées + abandonnées) prime sur « … from continuing operations ».
  np =
    findRow(pages, only, (l, r) => NET_PROFIT.test(l) && !/before|from (?:discontinued|continuing)/.test(l) && r.line > afterPbt, layoutOfIncome) ??
    findRow(pages, only, (l, r) => NET_PROFIT.test(l) && !/before|from discontinued/.test(l) && r.line > afterPbt, layoutOfIncome);
  if (np) {
    out.fields.netProfit = np.field;
    // part attribuable aux actionnaires : première ligne « owners / equity holders » après le résultat net,
    // sous un intitulé « Profit attributable to » (et non « Total comprehensive income attributable to »).
    const ip = inc.rows;
    const npLine = np.row.line;
    for (let k = 0; k < ip.length; k++) {
      const r = ip[k];
      if (r.line <= npLine || r.line > npLine + 70 || r.nums.length < 2) continue;
      const l = norm(r.label);
      const direct = /^(?:profit|loss|\(?loss\)?).{0,50}attributable to (?:the )?(?:owners|equity holders|shareholders)/.test(l);
      const under = ATTRIB_OWNERS.test(l) && ip.slice(Math.max(0, k - 3), k).some((q) => /attributable/i.test(q.raw) && !/comprehensive/i.test(q.raw));
      if (!direct && !under) continue;
      const cols = pickColumns(r, layoutOfIncome());
      if (cols) {
        out.fields.netProfitOwners = { values: cols, label: r.label.slice(0, 90), page: inc.index + 1 };
        break;
      }
    }
  }
  // --- BPA (« Earnings per share » seul sur sa ligne puis « – Basic », ou libellé complet)
  let epsRow: (FindResult & { prio: number; kobo: boolean }) | null = null;
  for (const pi of idxs) {
    const p = pages[pi];
    p.rows.forEach((r, k) => {
      if (r.nums.length < 2) return;
      const direct = EPS.test(r.label);
      const above = p.rows.slice(Math.max(0, k - 5), k);
      const ctxRow = above.some((q) => EPS.test(q.raw) || /earnings\s+per\s+share/i.test(q.raw));
      const bullet = /^[–—-]?\s*(?:basic|diluted|basic and diluted)\b/i.test(r.label);
      const from = /^from\s+(?:profit|the\s+(?:year|period)|total|continuing|profit\s+for)/i.test(norm(r.label));
      if (!direct && !((bullet || from) && ctxRow)) return;
      const cols = pickColumns(r, layoutOfIncome());
      if (!cols) return;
      const prio = from && /continuing/i.test(r.label) ? 1 : 0;
      if (epsRow && epsRow.prio <= prio) return;
      const kobo = /kobo|\(k\)|\bk\b/i.test(r.label) || /kobo/i.test(r.raw) || (!direct && above.some((q) => /\bkobo\b/i.test(q.raw)));
      epsRow = { field: { values: cols, label: r.label.slice(0, 90), page: p.index + 1 }, row: r, prio, kobo };
    });
    if (epsRow) break;
  }
  if (epsRow) {
    const er = epsRow as FindResult & { kobo: boolean };
    const f = { ...er.field };
    if (er.kobo) {
      f.values = [f.values[0] === null ? null : f.values[0] / 100, f.values[1] === null ? null : f.values[1] / 100];
      f.label += " [kobo→₦]";
    }
    out.fields.eps = f;
  }
  // --- Bilan : capitaux propres
  if (balanceIdx >= 0) {
    const balLayout = columnLayout(pages[balanceIdx].text, pages[balanceIdx].rows);
    const layoutOfBalance = () => balLayout;
    const bIdxs = [balanceIdx, balanceIdx + 1].filter((i) => i < pages.length);
    const attrib = findRow(pages, bIdxs, (l) => EQUITY_ATTRIB.test(l) || /^total equity attributable/.test(l), layoutOfBalance);
    const total = findRow(pages, bIdxs, (l) => TOTAL_EQUITY.test(l), layoutOfBalance);
    const eq = attrib ?? total;
    if (eq) {
      out.fields.equity = eq.field;
      if (attrib && total) (out.fields as Record<string, RawField>).equityTotal = total.field;
    }
  } else warnings.push("balance_sheet_not_found");
  if (!out.fields.equity && out.fiscalYear) {
    const soce = equityFromChangesInEquity(pages, out.fiscalYear);
    if (soce) {
      out.fields.equity = soce;
      warnings.push("equity_from_statement_of_changes_in_equity");
    }
  }
  const dp = findDividendsPaid(pages);
  if (dp) out.dividendsPaid = dp;
  return out;
}

const CASHFLOW_HEAD = /statements?\s+of\s+cash\s*[- ]?flows?|cash\s*flows?\s+statements?/i;
const DIV_PAID_ROW = /^(?:\(?cash\)?\s+)?dividends?\s+(?:paid|payments?)(?!\s+to\s+(?:non|minority))|^payments?\s+of\s+(?:ordinary\s+|final\s+|interim\s+)?dividends?\b|^dividends?\s+paid\s+to\s+(?:equity\s+holders|shareholders|owners|ordinary|the\s+company'?s)/;

/**
 * « Dividendes payés » du tableau des flux de trésorerie (valeur absolue, unité du document ; [exercice, exercice précédent]).
 * Sert au recoupement DPS × nombre d'actions ≈ dividendes décaissés.
 */
export function findDividendsPaid(pages: PageInfo[]): RawField | null {
  for (const p of pages) {
    const head = p.text.split("\n").slice(0, 14).join(" ");
    if (!CASHFLOW_HEAD.test(head) || isNotesPage(p.text)) continue;
    const layout = columnLayout(p.text, p.rows);
    for (const r of p.rows) {
      if (r.nums.length < 1) continue;
      const label = norm(r.label);
      if (!DIV_PAID_ROW.test(label) || /non[- ]?controlling|minority|dividends?\s+received|tax/.test(label)) continue;
      const cols = pickColumns(r, layout);
      if (!cols || cols[0] === null) continue;
      return { values: [Math.abs(cols[0]), cols[1] === null ? null : Math.abs(cols[1])], label: r.label.slice(0, 90), page: p.index + 1 };
    }
  }
  return null;
}

const SOCE_HEAD = /statements?\s+of\s+changes\s+in\s+(?:shareholders'?\s+|owners'?\s+)?equity|statements?\s+of\s+changes\s+in\s+equity/i;

/**
 * Repli quand la page du bilan est une image (pas de texte) : solde de clôture du tableau de variation des
 * capitaux propres (dernier nombre de la ligne « Balance at 31 December <exercice> » = total des capitaux propres).
 * Seule la première page de l'état (colonnes Groupe) est lue ; la valeur « précédente » est le solde d'ouverture.
 */
export function equityFromChangesInEquity(pages: PageInfo[], fy: number): RawField | null {
  for (const p of pages) {
    if (isNotesPage(p.text) || !SOCE_HEAD.test(headBlock(p.text, 8))) continue;
    const closing: Array<{ row: Row; year: number }> = [];
    const opening: Array<{ row: Row; year: number }> = [];
    for (const r of p.rows) {
      const l = norm(r.label);
      const m = /^(?:balance|balances|closing balance|at|as at)\b.*?(20[0-3]\d)\s*$/i.exec(l);
      if (!m || r.nums.length < 3) continue;
      const isOpening = /\b0?1(?:st)?\s+(?:january|april|july|october)\b|\bopening\b|\bas restated\b|\brestated\b/i.test(l);
      (isOpening ? opening : closing).push({ row: r, year: Number(m[1]) });
    }
    const cur = [...closing].reverse().find((c) => c.year === fy);
    if (!cur) continue;
    const prev = closing.find((c) => c.year === fy - 1 && c.row.line < cur.row.line) ?? opening.find((c) => c.year === fy && c.row.line < cur.row.line);
    return {
      values: [cur.row.nums[cur.row.nums.length - 1], prev ? prev.row.nums[prev.row.nums.length - 1] : null],
      label: `${cur.row.label.slice(0, 60)} [total equity, statement of changes in equity]`,
      page: p.index + 1,
    };
  }
  return null;
}

/**
 * Banques : « Gross earnings » est rarement dans le compte de résultat ; on le lit dans les faits marquants,
 * le tableau de valeur ajoutée ou le résumé quinquennal (première occurrence hors notes). Garde-fou : doit être
 * compris entre 1× et 3,5× le produit d'intérêts du compte de résultat (sinon unité ou ligne différente).
 */
export function findGrossEarnings(pages: PageInfo[], interest: [number | null, number | null] | null, layout: { n: number }): FindResult | null {
  for (const p of pages) {
    if (isNotesPage(p.text) && !/value\s+added|highlights|financial\s+summary/i.test(headBlock(p.text, 10))) continue;
    for (const r of p.rows) {
      if (r.nums.length < 2 || !/^(?:total\s+)?gross\s+earnings(?:\s*\(?note[^)]*\)?)?$/.test(norm(r.label))) continue;
      const v = isDualCurrency(p.text) && r.nums.length >= 4 ? [r.nums[0], r.nums[2]] : r.nums.slice(0, 2);
      if (interest && interest[0] !== null && interest[0] > 0) {
        const ratio = v[0] / interest[0];
        if (ratio < 0.999 || ratio > 3.5) continue;
      } else if (v[0] <= 0) continue;
      void layout;
      return { field: { values: [v[0], v[1]], label: `${r.label.slice(0, 60)} [highlights/summary]`, page: p.index + 1 }, row: r };
    }
  }
  return null;
}
