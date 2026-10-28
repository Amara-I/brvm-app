// Avis de dividende NGX (« Corporate Action », convocations d'AGM, communiqués de résultats) : lecture déterministe
// du DPS, du type (interim / final / total), de la période et des dates (qualification, clôture du registre, paiement, AGM).
// Aucune donnée n'est inférée : un montant n'est retenu que s'il est écrit « dividend ... <montant> » dans le texte.
import { fixLigatures } from "./text";

export type NoticeType = "final" | "interim" | "total" | "special" | "unspecified";

export interface DividendNotice {
  ticker?: string;
  /** Type écrit dans l'avis ; « unspecified » = « Proposed Dividend » sans qualificatif (résolu avec la période). */
  type: NoticeType;
  /** Dividende par action en ₦. */
  dps: number;
  /** Fin de période de l'avis (« Period Ended 31 December 2023 ») ; null si absente. */
  periodEnd: { year: number; month: number } | null;
  qualificationDate?: string;
  closureDate?: string;
  paymentDate?: string;
  agmDate?: string;
  /** Texte issu d'un OCR : confiance plafonnée. */
  ocr?: boolean;
  file?: string;
  url?: string;
  title?: string;
  createdAt?: string;
  disclosureKind?: string;
  snippet: string;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH_RE = String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`;
const monthIdx = (s: string) => MONTHS.findIndex((m) => m.startsWith(s.toLowerCase().slice(0, 3))) + 1;

const DAY_FIRST = new RegExp(String.raw`(\d{1,2})(?:st|nd|rd|th)?[\s,.-]*(?:of\s+)?(${MONTH_RE})\b[\s,.]*(20\d\d)`, "i");
const MONTH_FIRST = new RegExp(String.raw`\b(${MONTH_RE})\b\.?[\s,]*(\d{1,2})(?:st|nd|rd|th)?[\s,.-]*(20\d\d)`, "i");

/** Première date « 31 December 2023 » / « December 31, 2023 » du texte, au format AAAA-MM-JJ. */
export function parseDate(s: string): string | null {
  const a = DAY_FIRST.exec(s);
  const b = MONTH_FIRST.exec(s);
  const pick = a && b ? (a.index <= b.index ? "a" : "b") : a ? "a" : b ? "b" : null;
  if (!pick) return null;
  const [d, m, y] = pick === "a" ? [a![1], a![2], a![3]] : [b![2], b![1], b![3]];
  const day = Number(d), mon = monthIdx(m);
  if (!mon || day < 1 || day > 31) return null;
  return `${y}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function periodEnd(flat: string): DividendNotice["periodEnd"] {
  const re = new RegExp(String.raw`(?:period(?:\s+ended)?|year\s+ended|half[\s-]*year\s+ended|(?:six|nine|three)\s+months\s+ended|ended)\s*[:\-]?\s*(?:the\s+)?(?:(?:year|period)\s+ended\s+)?([^.]{0,40})`, "gi");
  for (const m of flat.matchAll(re)) {
    const d = parseDate(m[1].slice(0, 36));
    if (d) return { year: Number(d.slice(0, 4)), month: Number(d.slice(5, 7)) };
  }
  const fy = /\b(?:full[\s-]*year|FY)\s*(20\d\d)/i.exec(flat);
  if (fy) return { year: Number(fy[1]), month: 12 };
  return null;
}

/** Texte qui suit la première occurrence de `label` suivie d'une date (les libellés cités en introduction sont ignorés). */
function after(flat: string, label: RegExp, len = 140): string | null {
  const re = new RegExp(label.source, "gi");
  for (const m of flat.matchAll(re)) {
    const t = flat.slice(m.index! + m[0].length, m.index! + m[0].length + len);
    if (parseDate(t.slice(0, Math.min(len, 70)))) return t;
  }
  return null;
}

const AMOUNT = String.raw`(?:(₦|NGN|N)\s?)?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?![\d,]\d)(?!\d)\s?(kobo|k\b)?`;
const NOT_AMOUNT = String.raw`(?!\s*(?:%|per\s?cent|billion|million|bn\b|trillion|thousand|m\b|b\b))`;

function toNaira(cur: string | undefined, num: string, suffix: string | undefined): number | null {
  const v = Number(num.replace(/,/g, ""));
  if (!Number.isFinite(v)) return null;
  const abbrev = !!suffix && /^k$/i.test(suffix);
  void cur;
  // « 25k » / « 98 Kobo » = kobo ; « N2.45k » (décimale + k) = ₦2.45
  if (cur && num.includes(".")) return v; // « N1.40 kobo » (coquille) = ₦1.40
  if (suffix && !(abbrev && num.includes("."))) return v / 100;
  return v;
}

/**
 * @param text texte brut d'un avis (pdftotext ou OCR)
 */
export function parseDividendNotice(text: string, meta: { createdAt?: string; title?: string; kind?: string; ocr?: boolean }): DividendNotice[] {
  const flat = fixLigatures(text).replace(/[\u00a0\s]+/g, " ");
  if (!/dividend/i.test(flat)) return [];
  const pe = periodEnd(flat);
  const out: DividendNotice[] = [];
  const seen = new Set<string>();
  const push = (type: NoticeType, cur: string | undefined, num: string, suffix: string | undefined, idx: number, len: number) => {
    const dps = toNaira(cur, num, suffix);
    if (dps === null || dps <= 0 || dps >= 1000) return;
    const key = `${type}:${dps}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ type, dps: Math.round(dps * 1e6) / 1e6, periodEnd: pe, ocr: meta.ocr, snippet: flat.slice(Math.max(0, idx - 30), idx + len + 60).trim() });
  };
  const kindOf = (s: string | undefined): NoticeType => {
    const k = (s ?? "").toLowerCase();
    return /final/.test(k) ? "final" : /interim/.test(k) ? "interim" : /total/.test(k) ? "total" : /special/.test(k) ? "special" : "unspecified";
  };
  // (1) « [Proposed] [Final|Interim|Total] Dividend [(Final)] [per share]: 25k »
  const r1 = new RegExp(String.raw`\b(proposed\s+final|proposed\s+interim|final|interim|total|special|proposed)?\s*dividends?\s*(?:\(\s*(final|interim)\s*\))?\s*(?:per\s+(?:ordinary\s+)?share\s*(?:\(dps\))?\s*)?(?::|-|–)\s*${AMOUNT}${NOT_AMOUNT}`, "gi");
  for (const m of flat.matchAll(r1)) {
    if (new RegExp(`^\\s*(?:st|nd|rd|th)?\\s*(?:of\\s+)?${MONTH_RE}\\b`, "i").test(flat.slice(m.index! + m[0].length, m.index! + m[0].length + 14))) continue;
    push(kindOf(m[2] ?? m[1]), m[3], m[4], m[5], m.index!, m[0].length);
  }
  // (2) « a final dividend of N16.00 per share », « dividend of 50 kobo per share », « total dividend ... to N2.75k »
  const r2 = new RegExp(String.raw`\b(final|interim|special|total|proposed)?\s*dividends?(?:\s+per\s+(?:ordinary\s+)?share)?(?:\s*\(dps\))?\s+(?:of|at|to|is|was)\s+(?:a\s+)?(?:total\s+of\s+)?${AMOUNT}${NOT_AMOUNT}`, "gi");
  for (const m of flat.matchAll(r2)) push(kindOf(m[1]), m[2], m[3], m[4], m.index!, m[0].length);
  // (3) « bringing the total dividend for the year to N2.75k »
  const r3 = new RegExp(String.raw`total\s+dividends?\s+for\s+the\s+(?:financial\s+)?year(?:\s+ended\s+[^,]{0,25}?20\d\d)?\s+to\s+${AMOUNT}${NOT_AMOUNT}`, "gi");
  for (const m of flat.matchAll(r3)) push("total", m[1], m[2], m[3], m.index!, m[0].length);

  // Dates
  const flatD = flat.replace(new RegExp(String.raw`period(?:\s+ended)?\s*[:\-]?\s*(?:the\s+)?(?:year\s+ended\s+)?(?:\d{1,2}(?:st|nd|rd|th)?[\s,]*)?${MONTH_RE}\b[\s,.]*(?:\d{1,2}(?:st|nd|rd|th)?[\s,.]*)?20\d\d`, "gi"), " ");
  const qual = after(flatD, /qualification\s+date\s*[:\-]?/i) ?? after(flatD, /register\s+of\s+members\s+(?:as\s+at|at|on)\s+(?:the\s+)?close\s+of\s+business\s+on/i, 60);
  const clos = after(flatD, /closure\s+(?:of\s+(?:the\s+)?(?:register|books)|date)\s*(?:\([^)]*\))?\s*[:\-]?/i, 90);
  const pay = after(flatD, /(?:payment|pay)\s+date\s*[:\-]?|date\s+of\s+payment\s*[:\-]?/i, 120);
  let payText = pay;
  const wp = /dividends?\s+(?:will|shall)\s+be\s+(?:paid|payable)/i.exec(flatD);
  if (wp && wp.index > 0) {
    const back = flatD.slice(Math.max(0, wp.index - 45), wp.index);
    if (/\bby\b/i.test(back) && parseDate(back)) payText = back;
  }
  const agm = after(flatD, /(?:agm\s+date|annual\s+general\s+meeting[^.]{0,80}?(?:on|date)|details\s+of\s+annual\s+general\s+meeting[^.]{0,120}?on)\s*[:\-]?/i, 90);
  const dates = { qualificationDate: qual ? parseDate(qual) : null, closureDate: clos ? parseDate(clos) : null, paymentDate: payText ? parseDate(payText) : null, agmDate: agm ? parseDate(agm) : null };
  for (const n of out) {
    if (dates.qualificationDate) n.qualificationDate = dates.qualificationDate;
    if (dates.closureDate) n.closureDate = dates.closureDate;
    if (dates.paymentDate) n.paymentDate = dates.paymentDate;
    if (dates.agmDate) n.agmDate = dates.agmDate;
    n.createdAt = meta.createdAt;
    n.title = meta.title;
    n.disclosureKind = meta.kind;
  }
  // « unspecified » + total identique à une autre valeur typée : conserver seulement la valeur typée
  return out.filter((n) => !(n.type === "unspecified" && out.some((o) => o !== n && o.type !== "unspecified" && o.dps === n.dps)));
}

// ---------------------------------------------------------------------------------------------------------------
// Regroupement des avis par exercice : final / interim / total, avec complétude.
// ---------------------------------------------------------------------------------------------------------------

export interface NoticeDps {
  fiscalYear: number;
  final: number | null;
  interim: number | null;
  /** Total annoncé tel quel (« Total Dividend: 55k »). */
  statedTotal: number | null;
  /** DPS annuel quand il est complet (total annoncé ou final + interim), sinon null. */
  total: number | null;
  /** « total » (annoncé), « final+interim », « final_only », « interim_only » */
  completeness: "total_stated" | "final+interim" | "final_only" | "interim_only";
  ocr: boolean;
  /** Date de dépôt du (dernier) avis retenu. */
  latestCreatedAt: string;
  files: string[];
  paymentDate?: string;
  qualificationDate?: string;
}

/** Exercice et type d'un avis, d'après la période écrite ou, à défaut, la date de dépôt (cycle annuel de fin `fyEndMonth`). */
export function noticeFiscalYear(n: DividendNotice, fyEndMonth: number): { fy: number; type: "final" | "interim" | "total" | "special" } | null {
  let type: "final" | "interim" | "total" | "special";
  let fy: number;
  const created = n.createdAt ? new Date(n.createdAt) : null;
  if (n.periodEnd) {
    fy = n.periodEnd.month <= fyEndMonth ? n.periodEnd.year : n.periodEnd.year + 1;
    type = n.type === "unspecified" ? (n.periodEnd.month === fyEndMonth ? "final" : "interim") : n.type;
  } else {
    if (!created || Number.isNaN(created.getTime())) return null;
    const cm = created.getUTCMonth() + 1;
    const cy = created.getUTCFullYear();
    // mois écoulés depuis la clôture : un avis déposé dans les 7 mois qui suivent la clôture concerne l'exercice clos (final)
    const since = (cm - fyEndMonth + 12) % 12;
    const closedYear = cm > fyEndMonth ? cy : cy - 1; // année civile de la dernière clôture
    const isAfterClose = since >= 1 && since <= 7;
    if (isAfterClose) {
      fy = closedYear;
      type = n.type === "unspecified" ? "final" : n.type;
    } else {
      fy = closedYear + 1; // exercice en cours : acompte
      type = n.type === "unspecified" ? "interim" : n.type;
    }
  }
  return { fy, type };
}

export function summarizeNotices(notices: DividendNotice[], fyEndMonth: number): Map<number, NoticeDps> {
  const by = new Map<number, Map<string, DividendNotice[]>>();
  for (const n of notices) {
    const k = noticeFiscalYear(n, fyEndMonth);
    if (!k || k.type === "special") continue;
    const m = by.get(k.fy) ?? by.set(k.fy, new Map()).get(k.fy)!;
    (m.get(k.type) ?? m.set(k.type, []).get(k.type)!).push(n);
  }
  const out = new Map<number, NoticeDps>();
  for (const [fy, types] of by) {
    // dernier dépôt gagne (révisions) ; à date égale, le montant le plus fréquent
    const latest = (list: DividendNotice[] | undefined): DividendNotice | null => {
      if (!list?.length) return null;
      const day = (x: DividendNotice) => (x.createdAt ?? "").slice(0, 10);
      const top = list.map(day).sort().at(-1)!;
      const ofDay = list.filter((x) => day(x) === top);
      const freq = new Map<number, number>();
      list.forEach((x) => freq.set(x.dps, (freq.get(x.dps) ?? 0) + 1));
      return ofDay.sort((a, b) => (freq.get(b.dps) ?? 0) - (freq.get(a.dps) ?? 0))[0];
    };
    const fin = latest(types.get("final"));
    const int = latest(types.get("interim"));
    const tot = latest(types.get("total"));
    const picked = [fin, int, tot].filter((x): x is DividendNotice => !!x);
    if (!picked.length) continue;
    let total: number | null = null;
    let completeness: NoticeDps["completeness"];
    if (tot) {
      total = tot.dps;
      completeness = "total_stated";
    } else if (fin && int) {
      total = Math.round((fin.dps + int.dps) * 1e6) / 1e6;
      completeness = "final+interim";
    } else completeness = fin ? "final_only" : "interim_only";
    const last = picked.map((p) => p.createdAt ?? "").sort().at(-1) ?? "";
    out.set(fy, {
      fiscalYear: fy,
      final: fin?.dps ?? null,
      interim: int?.dps ?? null,
      statedTotal: tot?.dps ?? null,
      total,
      completeness,
      ocr: picked.some((p) => p.ocr),
      latestCreatedAt: last,
      files: picked.map((p) => p.file ?? "").filter(Boolean),
      paymentDate: fin?.paymentDate ?? picked.find((p) => p.paymentDate)?.paymentDate,
      qualificationDate: fin?.qualificationDate ?? picked.find((p) => p.qualificationDate)?.qualificationDate,
    });
  }
  return out;
}
