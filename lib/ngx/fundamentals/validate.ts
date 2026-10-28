// Étape 4 — validation et assemblage des séries annuelles par société.
//   • lecture de l'exercice « courant » dans les états audités de l'année N ;
//   • recoupement avec la colonne comparative des états audités de N+1 (retraitements signalés) ;
//   • EPS × actions ≈ résultat net (actions : annuaire NGX) ;
//   • bon sens (signes, ordres de grandeur) ;
//   • niveau de confiance par champ + file de revue.
import { bestDividend, type DividendCandidate } from "./dividends";
import { summarizeNotices, type DividendNotice, type NoticeDps } from "./notices";
import type { Confidence, NgxCompanyConfig, StatementExtraction } from "./types";

export interface ExtractedDoc {
  file: string;
  url: string;
  guessedFiscalYear: number;
  createdAt: string;
  extraction: StatementExtraction;
  dividends: DividendCandidate[];
}

export const CORE_FIELDS = ["revenue", "operatingProfit", "netProfit", "equity", "eps"] as const;
export type CoreField = (typeof CORE_FIELDS)[number];
export const ALL_FIELDS = [...CORE_FIELDS, "dps"] as const;
export type AnyField = (typeof ALL_FIELDS)[number];

export interface StagedRow {
  ticker: string;
  fiscalYear: number;
  currency: string | null;
  unit: string | null;
  /** Montants en milliards de la devise de présentation. */
  revenueBn: number | null;
  revenueBasis: string | null;
  operatingProfitBn: number | null;
  operatingBasis: string | null;
  netProfitBn: number | null;
  netProfitBasis: string | null;
  netProfitTotalBn: number | null;
  equityBn: number | null;
  equityBasis: string | null;
  eps: number | null;
  dps: number | null;
  dpsKind: string | null;
  /** « afs », « notice », « afs+notice » */
  dpsSource: string;
  /** Résumé des avis NGX retenus pour l'exercice. */
  dpsNotice: string;
  dpsNoticeFiles: string;
  /** Écart relatif flux de trésorerie vs actions × dividendes annoncés (null si non évaluable). */
  dpsCashGap: number | null;
  sharesOutstanding: number | null;
  impliedShares: number | null;
  conf: Record<AnyField, Confidence>;
  /** Valeurs du comparatif de N+1 quand elles diffèrent de >1 % (retraitement). */
  restated: Partial<Record<AnyField, number>>;
  /** Écart relatif signé (retraité − original) / |original|, en %, pour chaque valeur retraitée. */
  restatedPct: Partial<Record<AnyField, number>>;
  sourceFile: string;
  sourceUrl: string;
  pages: string;
  notes: string[];
}

export interface ReviewItem {
  ticker: string;
  fiscalYear: number | null;
  field: AnyField | "document";
  severity: "low" | "medium" | "info";
  reason: string;
  value: number | null;
  sourceFile: string;
  page: number | null;
}

const REL = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-12);
const AGREE = 0.01;

interface Val {
  /** Valeur en unité de base (devise entière) ; EPS/DPS en devise par action. */
  cur: number | null;
  prior: number | null;
  page: number | null;
  label: string | null;
}

function fieldVal(doc: ExtractedDoc | undefined, name: "revenue" | "operatingProfit" | "netProfit" | "equity" | "eps" | "netProfitTotal"): Val {
  const none: Val = { cur: null, prior: null, page: null, label: null };
  if (!doc) return none;
  const x = doc.extraction;
  const mult = x.unitMultiplier;
  let f = name === "netProfit" ? (x.fields.netProfitOwners ?? x.fields.netProfit) : name === "netProfitTotal" ? x.fields.netProfit : x.fields[name];
  if (!f) return none;
  const m = name === "eps" ? 1 : mult;
  if (m === null) return { cur: null, prior: null, page: f.page, label: f.label };
  const sc = (v: number | null) => (v === null ? null : v * m);
  return { cur: sc(f.values[0]), prior: sc(f.values[1]), page: f.page, label: f.label };
}

/** Documents du même exercice écartés par pickDocs (doublons, réémissions). */
const ALTERNATES = new WeakMap<ExtractedDoc, ExtractedDoc[]>();

function pickDocs(docs: ExtractedDoc[]): Map<number, ExtractedDoc> {
  const byFy = new Map<number, ExtractedDoc[]>();
  for (const d of docs) {
    const fy = d.extraction.fiscalYear;
    if (!fy || d.extraction.interim) continue;
    (byFy.get(fy) ?? byFy.set(fy, []).get(fy)!).push(d);
  }
  const KEYS = ["revenue", "operatingProfit", "netProfit", "equity", "eps"] as const;
  const score = (d: ExtractedDoc) => CORE_FIELDS.filter((k) => d.extraction.fields[k]).length * 10 + (d.extraction.unitMultiplier ? 5 : 0) + (d.extraction.fields.equity ? 1 : 0) - (d.extraction.unaudited ? 4 : 0);
  // accord avec les documents voisins : colonne « précédent » de N+1 = colonne « courant » de N (écarte les trimestriels / doublons)
  const agreement = (d: ExtractedDoc, fy: number) => {
    let n = 0;
    for (const nb of byFy.get(fy + 1) ?? []) {
      for (const k of KEYS) {
        const a = fieldVal(d, k).cur;
        const b = fieldVal(nb, k).prior;
        if (a !== null && b !== null && REL(a, b) <= AGREE) n++;
      }
    }
    for (const nb of byFy.get(fy - 1) ?? []) {
      for (const k of KEYS) {
        const a = fieldVal(d, k).prior;
        const b = fieldVal(nb, k).cur;
        if (a !== null && b !== null && REL(a, b) <= AGREE) n++;
      }
    }
    return n;
  };
  const out = new Map<number, ExtractedDoc>();
  for (const [fy, list] of byFy) {
    const scored = list.map((d) => ({ d, s: score(d) + (list.length > 1 ? agreement(d, fy) * 6 : 0) }));
    scored.sort((a, b) => b.s - a.s || b.d.createdAt.localeCompare(a.d.createdAt));
    out.set(fy, scored[0].d);
    // Règle des doublons : meilleur score (champs lus + accord avec les exercices voisins, non audité pénalisé), à égalité le dépôt le plus récent.
    if (scored.length > 1) ALTERNATES.set(scored[0].d, scored.slice(1).map((x) => x.d));
  }
  return out;
}

/** Document virtuel : colonne comparative (exercice N) des états audités de N+1, quand les états de N sont illisibles/absents. */
function virtualFromNext(next: ExtractedDoc, fy: number): ExtractedDoc {
  const ex = next.extraction;
  const fields: StatementExtraction["fields"] = {};
  for (const [k, f] of Object.entries(ex.fields)) {
    if (f && f.values[1] !== null) fields[k as keyof StatementExtraction["fields"]] = { ...f, values: [f.values[1], null] };
  }
  return {
    file: next.file,
    url: next.url,
    guessedFiscalYear: fy,
    createdAt: next.createdAt,
    dividends: next.dividends.filter((c) => c.fiscalYear === fy),
    extraction: { ...ex, fiscalYear: fy, fields, warnings: [...ex.warnings, "from_comparative_of_next_year"] },
  };
}

const coreCount = (d: ExtractedDoc | undefined) => (d ? CORE_FIELDS.filter((k) => d.extraction.fields[k]).length : 0);

/**
 * Correction d'unité par EPS × actions : si les actions implicites (résultat net / BPA) valent 10^k × les actions
 * de l'annuaire NGX (k = ±3 ou ±6, tolérance ±15 %), l'unité lue (milliers/millions) est fausse pour ce document.
 * Retourne un facteur à appliquer au multiplicateur d'unité (1 = aucune correction).
 */
export function unitCorrection(doc: ExtractedDoc, shares: number | null): number {
  const x = doc.extraction;
  if (!shares || !x.unitMultiplier) return 1;
  const np = (x.fields.netProfitOwners ?? x.fields.netProfit)?.values[0];
  const eps = x.fields.eps?.values[0];
  if (np == null || !eps) return 1;
  const ratio = Math.abs((np * x.unitMultiplier) / eps) / shares;
  if (ratio >= 0.85 && ratio <= 1.15) return 1;
  for (const k of [3, -3, 6, -6]) {
    const r = ratio / 10 ** k;
    if (r >= 0.85 && r <= 1.15) return 10 ** -k;
  }
  return 1;
}

export interface BuildOptions {
  fromYear?: number;
  toYear?: number;
  /** Actions en circulation (annuaire NGX). */
  shares: number | null;
  /** Avis de dividende NGX (étape « disclosures ») de la société. */
  notices?: DividendNotice[];
}

const afsSrc = (s: string) => s === "afs";
const UP: Record<Confidence, Confidence> = { none: "none", low: "medium", medium: "high", high: "high" };
const DOWN: Record<Confidence, Confidence> = { none: "none", low: "low", medium: "low", high: "medium" };
const CASH_TOL = 0.12;

/** Dividendes payés (flux de trésorerie) de l'exercice `fy`, en devise entière : colonne courante des états de `fy`, sinon colonne précédente des états de `fy+1`. */
function cashPaid(byFy: Map<number, ExtractedDoc>, fy: number): number | null {
  const d = byFy.get(fy);
  const m = d?.extraction.unitMultiplier;
  const v = d?.extraction.dividendsPaid?.values[0];
  if (d && m && v != null && v > 0) return v * m;
  const n = byFy.get(fy + 1);
  const m2 = n?.extraction.unitMultiplier;
  const v2 = n?.extraction.dividendsPaid?.values[1];
  if (n && m2 && v2 != null && v2 > 0) return v2 * m2;
  return null;
}

/**
 * Recoupement avec le flux de trésorerie : dividendes payés en N+1 ≈ actions × (final N + acompte N+1).
 * Retourne l'écart relatif du meilleur scénario (acompte N+1 connu, puis nul) ou null si non évaluable.
 */
export function cashCheck(finalN: number | null, interimNext: number | null, shares: number | null, paidNext: number | null): { gap: number; expected: number } | null {
  if (!shares || !paidNext || finalN === null) return null;
  const cands = [interimNext ?? 0, ...(interimNext ? [0] : [])].map((i) => shares * (finalN + i));
  const best = cands.map((e) => ({ e, g: REL(e, paidNext) })).sort((a, b) => a.g - b.g)[0];
  return { gap: best.g, expected: best.e };
}

export function buildStagedRows(company: NgxCompanyConfig, docs: ExtractedDoc[], opts: BuildOptions): { rows: StagedRow[]; review: ReviewItem[] } {
  const from = opts.fromYear ?? 2016;
  const to = opts.toYear ?? 2025;
  const byFy = pickDocs(docs);
  const noticeSums: Map<number, NoticeDps> = summarizeNotices(opts.notices ?? [], company.fyEndMonth);
  const unitFixed = new Map<number, number>();
  for (const [fy, d] of byFy) {
    const f = unitCorrection(d, opts.shares);
    if (f !== 1) {
      unitFixed.set(fy, f);
      byFy.set(fy, { ...d, extraction: { ...d.extraction, unitMultiplier: d.extraction.unitMultiplier! * f, warnings: [...d.extraction.warnings, `unit_corrected_x${f}_by_eps_shares`] } });
    }
  }
  const rows: StagedRow[] = [];
  const review: ReviewItem[] = [];
  const add = (fy: number | null, field: ReviewItem["field"], severity: ReviewItem["severity"], reason: string, value: number | null, file: string, page: number | null) =>
    review.push({ ticker: company.ticker, fiscalYear: fy, field, severity, reason, value, sourceFile: file, page });

  // Document(s) non utilisables
  for (const d of docs) {
    if (d.extraction.interim) continue; // simple doublon intermédiaire
    const ex = d.extraction;
    if (!ex.fiscalYear) add(d.guessedFiscalYear, "document", "low", `exercice non lu (${ex.warnings.join(",") || "?"})`, null, d.file, null);
    else if (Math.abs(ex.fiscalYear - d.guessedFiscalYear) > 1) add(ex.fiscalYear, "document", "info", `exercice lu ${ex.fiscalYear} ≠ exercice supposé ${d.guessedFiscalYear} (titre/date de dépôt)`, null, d.file, null);
  }

  for (let fy = from; fy <= to; fy++) {
    let doc = byFy.get(fy);
    let next = byFy.get(fy + 1);
    const notes: string[] = [];
    if (next && coreCount(doc) <= 1) {
      const v = virtualFromNext(next, fy);
      if (coreCount(v) > coreCount(doc)) {
        doc = v;
        next = undefined;
        notes.push(`from_comparative_of_${fy + 1}_statements`);
      }
    }
    const conf = { revenue: "none", operatingProfit: "none", netProfit: "none", equity: "none", eps: "none", dps: "none" } as Record<AnyField, Confidence>;
    const restated: StagedRow["restated"] = {};
    const restatedPct: StagedRow["restatedPct"] = {};
    const row: StagedRow = {
      ticker: company.ticker,
      fiscalYear: fy,
      currency: null,
      unit: null,
      revenueBn: null,
      revenueBasis: null,
      operatingProfitBn: null,
      operatingBasis: null,
      netProfitBn: null,
      netProfitBasis: null,
      netProfitTotalBn: null,
      equityBn: null,
      equityBasis: null,
      eps: null,
      dps: null,
      dpsKind: null,
      dpsSource: "",
      dpsNotice: "",
      dpsNoticeFiles: "",
      dpsCashGap: null,
      sharesOutstanding: opts.shares,
      impliedShares: null,
      conf,
      restated,
      restatedPct,
      sourceFile: doc?.file ?? "",
      sourceUrl: doc?.url ?? "",
      pages: "",
      notes,
    };
    rows.push(row);
    if (!doc) {
      notes.push("no_annual_report_text_for_year");
      add(fy, "document", "low", "aucun état audité exploitable pour cet exercice", null, "", null);
      continue;
    }
    const ex = doc.extraction;
    if (unitFixed.has(fy) && !notes.some((n) => n.startsWith("from_comparative"))) {
      notes.push(`unit_corrected_x${unitFixed.get(fy)}_by_eps_shares(${ex.unitLabel})`);
      add(fy, "document", "info", `unité « ${ex.unitLabel} » corrigée ×${unitFixed.get(fy)} d'après EPS × actions (annuaire NGX)`, null, doc.file, ex.pages.income);
    }
    if (ex.unaudited) notes.push("unaudited_document");
    const alts = ALTERNATES.get(doc) ?? [];
    if (alts.length) {
      notes.push(`duplicate_documents(${alts.length})`);
      const mine = fieldVal(doc, "netProfit").cur;
      const diverging = alts.filter((a) => {
        const v = fieldVal(a, "netProfit").cur;
        return mine !== null && v !== null && REL(mine, v) > 0.01;
      });
      if (diverging.length) add(fy, "document", "medium", `document(s) du même exercice avec un résultat net différent (${diverging.map((a) => a.file.slice(0, 40)).join(", ")}) : retenu ${doc.file.slice(0, 40)} (meilleur score, puis dépôt le plus récent)`, mine, doc.file, ex.pages.income);
    }
    row.currency = ex.currency;
    row.unit = ex.unitLabel;
    row.pages = `income:${ex.pages.income ?? "-"} balance:${ex.pages.balance ?? "-"}`;
    if (!ex.unitMultiplier) {
      notes.push("unit_missing");
      add(fy, "document", "low", "unité (milliers/millions) non détectée : montants non convertis", null, doc.file, ex.pages.income);
    }
    if (!ex.currency) notes.push("currency_unknown");
    if (ex.currency && ex.currency !== company.currency) {
      notes.push(`currency_${ex.currency}_differs_from_config_${company.currency}`);
      add(fy, "document", "medium", `devise lue ${ex.currency} ≠ devise configurée ${company.currency}`, null, doc.file, ex.pages.income);
    }

    const V = {
      revenue: fieldVal(doc, "revenue"),
      operatingProfit: fieldVal(doc, "operatingProfit"),
      netProfit: fieldVal(doc, "netProfit"),
      netProfitTotal: fieldVal(doc, "netProfitTotal"),
      equity: fieldVal(doc, "equity"),
      eps: fieldVal(doc, "eps"),
    };
    // BPA publié en kobo sous un libellé « (Naira) » (ou l'inverse) : un écart de ×100 sur les actions implicites le révèle
    if (opts.shares && V.eps.cur && V.netProfit.cur !== null && ex.unitMultiplier) {
      const ratio = Math.abs(V.netProfit.cur / V.eps.cur) / opts.shares;
      const adj = ratio >= 0.002 && ratio <= 0.06 ? 0.01 : ratio >= 45 && ratio <= 500 ? 100 : null;
      if (adj !== null) {
        const fixed = V.eps.cur * adj;
        const r2 = Math.abs(V.netProfit.cur / fixed) / opts.shares;
        if (r2 >= 0.2 && r2 <= 5) {
          notes.push(`eps_scaled_x${adj}_unit_mislabelled`);
          V.eps.cur = fixed;
          if (V.eps.prior !== null) V.eps.prior = V.eps.prior * adj;
        }
      }
    }
    const C = {
      revenue: fieldVal(next, "revenue"),
      operatingProfit: fieldVal(next, "operatingProfit"),
      netProfit: fieldVal(next, "netProfit"),
      equity: fieldVal(next, "equity"),
      eps: fieldVal(next, "eps"),
    };
    // Le comparatif de N+1 doit porter sur la même base de montants (propriétaires ↔ propriétaires)
    const sameNpBasis = (next?.extraction.fields.netProfitOwners ? 1 : 0) === (doc.extraction.fields.netProfitOwners ? 1 : 0);

    const bn = (v: number | null) => (v === null ? null : Math.round((v / 1e9) * 1e6) / 1e6);
    row.revenueBn = bn(V.revenue.cur);
    row.revenueBasis = ex.revenueBasis;
    row.operatingProfitBn = bn(V.operatingProfit.cur);
    row.operatingBasis = ex.operatingBasis;
    row.netProfitBn = bn(V.netProfit.cur);
    row.netProfitBasis = ex.fields.netProfitOwners ? "attributable to owners" : ex.fields.netProfit ? "profit for the year (total)" : null;
    row.netProfitTotalBn = bn(V.netProfitTotal.cur);
    row.equityBn = bn(V.equity.cur);
    row.equityBasis = ex.fields.equity?.label ?? null;
    row.eps = V.eps.cur;

    // --- recoupement avec le comparatif de N+1
    const agreed: Partial<Record<CoreField, boolean>> = {};
    const hasComp: Partial<Record<CoreField, boolean>> = {};
    for (const k of CORE_FIELDS) {
      const p = V[k].cur;
      const c = C[k].prior;
      if (p === null || c === null) continue;
      if (k === "netProfit" && !sameNpBasis) continue;
      hasComp[k] = true;
      if (REL(p, c) <= AGREE) agreed[k] = true;
      else {
        agreed[k] = false;
        restated[k] = k === "eps" ? c : Math.round((c / 1e9) * 1e6) / 1e6;
        restatedPct[k] = Math.round(((c - p) / Math.abs(p || 1)) * 1000) / 10;
        notes.push(`restated_${k}`);
        add(fy, k, "medium", `valeur différente dans le comparatif des états ${fy + 1} (${(REL(p, c) * 100).toFixed(1)} % d'écart) : retraitement ou erreur de lecture`, p, doc.file, V[k].page);
      }
    }

    // --- bon sens
    const fail: Partial<Record<CoreField, string>> = {};
    const rev = V.revenue.cur;
    const op = V.operatingProfit.cur;
    const np = V.netProfit.cur;
    const eq = V.equity.cur;
    if (rev !== null && rev <= 0) fail.revenue = "chiffre d'affaires ≤ 0";
    if (rev !== null && rev > 0) {
      const opCap = company.kind === "bank" ? 1.0 : 1.05;
      if (op !== null && op > rev * opCap) fail.operatingProfit = `résultat d'exploitation/avant impôt (${bn(op)} Md) > chiffre d'affaires (${bn(rev)} Md)`;
      if (np !== null && Math.abs(np) > rev * 1.5) fail.netProfit = `résultat net (${bn(np)} Md) > 1,5× chiffre d'affaires (${bn(rev)} Md)`;
    }
    if (op !== null && np !== null && op > 0 && np > op * 3 && Math.abs(np) > 1e9) notes.push("net_profit_gt_3x_operating(tax credit or gains?)");
    if (eq !== null && eq <= 0) {
      notes.push("negative_or_zero_equity");
      add(fy, "equity", "medium", "capitaux propres ≤ 0 (réel ou erreur de ligne)", eq, doc.file, V.equity.page);
    }
    if (eq !== null && np !== null && eq > 0 && Math.abs(np / eq) > 3) fail.equity = `ROE ${(np / eq * 100).toFixed(0)} % : capitaux propres ou résultat suspects`;

    // --- EPS × actions
    let epsOk: "tight" | "loose" | "fail" | null = null;
    if (np !== null && V.eps.cur !== null && V.eps.cur !== 0 && ex.unitMultiplier) {
      if (Math.sign(np) !== Math.sign(V.eps.cur)) epsOk = "fail";
      else {
        const implied = Math.abs(np / V.eps.cur);
        row.impliedShares = Math.round(implied);
        if (opts.shares) {
          const r = implied / opts.shares;
          epsOk = r >= 0.85 && r <= 1.15 ? "tight" : r >= 0.5 && r <= 2.0 ? "loose" : "fail";
          if (epsOk === "fail") notes.push(`implied_shares_ratio_${r.toFixed(2)}`);
        }
      }
    }
    // cohérence avec les actions implicites des exercices voisins (augmentation de capital, fusion…)
    const neighborImplied = [fy - 1, fy + 1]
      .map((y) => byFy.get(y))
      .map((d) => {
        if (!d?.extraction.unitMultiplier) return null;
        const npv = fieldVal(d, "netProfit").cur;
        const e = fieldVal(d, "eps").cur;
        return npv !== null && e ? Math.abs(npv / e) : null;
      })
      .filter((v): v is number => v !== null);
    if (epsOk === "fail" && row.impliedShares && neighborImplied.some((n) => [n, n * 100, n / 100].some((m) => REL(m, row.impliedShares!) <= 0.03))) {
      epsOk = "loose";
      notes.push("implied_shares_consistent_with_neighbor_year");
    }
    if (epsOk === "fail") {
      add(fy, "eps", "low", `EPS × actions incohérent : actions implicites ${row.impliedShares?.toLocaleString("en-US") ?? "?"} vs annuaire NGX ${opts.shares?.toLocaleString("en-US") ?? "?"}`, V.eps.cur, doc.file, V.eps.page);
    }

    // --- confiance par champ
    const sev = (k: CoreField): Confidence => {
      const v = V[k].cur;
      if (v === null) return "none";
      if (!ex.unitMultiplier && k !== "eps") return "low";
      if (fail[k]) return "low";
      if (hasComp[k]) return agreed[k] ? "high" : "medium";
      // OCR sans confirmation par une colonne comparative : « medium » au mieux
      if (ex.ocr) return "medium";
      // pas de comparatif : seuls résultat net et EPS peuvent être validés par EPS × actions
      if ((k === "netProfit" || k === "eps") && epsOk === "tight") return "high";
      return "medium";
    };
    for (const k of CORE_FIELDS) {
      conf[k] = sev(k);
      if (fail[k]) add(fy, k, "low", fail[k]!, V[k].cur, doc.file, V[k].page);
    }
    if (epsOk === "fail") {
      for (const k of ["netProfit", "eps"] as const) if (conf[k] !== "none") conf[k] = hasComp[k] && agreed[k] ? "medium" : "low";
    } else if (epsOk === "loose") {
      for (const k of ["netProfit", "eps"] as const) if (conf[k] === "high" && !(hasComp[k] && agreed[k])) conf[k] = "medium";
    }
    if (!next && fy < 2025 && !notes.some((n) => n.startsWith("from_comparative"))) notes.push("no_next_year_comparative");
    if (!next && fy === 2025) notes.push("latest_year_no_comparative");

    // --- DPS : états audités (tableau / phrase), puis avis NGX, puis flux de trésorerie
    const own = bestDividend(doc.dividends.filter((c) => c.fiscalYear === fy));
    const comp = next ? bestDividend(next.dividends.filter((c) => c.fiscalYear === fy)) : null;
    const nd = noticeSums.get(fy);
    let dpsSource = "";
    if (own) {
      row.dps = own.dps;
      row.dpsKind = `${own.source}:${own.kind}${own.derived ? ":derived" : ""} p${own.page}`;
      dpsSource = "afs";
      const partial = own.kind === "final" || own.kind === "interim";
      if (comp && REL(own.dps, comp.dps) <= 0.005) conf.dps = partial ? "medium" : "high";
      else if (comp) {
        conf.dps = "medium";
        restated.dps = comp.dps;
        restatedPct.dps = Math.round(((comp.dps - own.dps) / Math.abs(own.dps || 1)) * 1000) / 10;
        add(fy, "dps", "medium", `DPS différent dans les états ${fy + 1} (${comp.dps} vs ${own.dps})`, own.dps, doc.file, own.page);
      } else conf.dps = partial ? "low" : "medium";
      if (partial) add(fy, "dps", "low", `DPS partiel (${own.kind} seulement)`, own.dps, doc.file, own.page);
      // désaccord entre sources internes (tableau « déclaré » vs interim+final)
      const alt = doc.dividends.filter((c) => c.fiscalYear === fy && c.kind === "total" && REL(c.dps, own.dps) > 0.02);
      if (alt.length) {
        conf.dps = conf.dps === "high" ? "medium" : conf.dps;
        add(fy, "dps", "info", `plusieurs totaux de DPS dans le document : retenu ${own.dps} (${row.dpsKind}), autres ${[...new Set(alt.map((a) => a.dps))].join("/")}`, own.dps, doc.file, own.page);
      }
      if (ex.ocr && conf.dps === "high") conf.dps = "medium";
    } else if (comp) {
      row.dps = comp.dps;
      row.dpsKind = `comparative:${comp.kind} p${comp.page}`;
      dpsSource = "afs";
      conf.dps = "low";
    }
    if (nd) {
      row.dpsNotice = [nd.final !== null ? `final ${nd.final}` : "", nd.interim !== null ? `interim ${nd.interim}` : "", nd.statedTotal !== null ? `total ${nd.statedTotal}` : "", `[${nd.completeness}]`, nd.latestCreatedAt.slice(0, 10)].filter(Boolean).join(" ");
      row.dpsNoticeFiles = nd.files.join(" | ");
      const nTot = nd.total;
      const afsPartial = own ? own.kind === "final" || own.kind === "interim" : false;
      const afsVal = row.dps;
      if (afsVal !== null && afsSrc(dpsSource)) {
        const single = !afsPartial ? (nd.completeness === "final_only" ? nd.final : nd.completeness === "interim_only" ? nd.interim : null) : null; // un seul versement annoncé : il vaut le total
        const cmp = nTot ?? (nd.final !== null && own?.kind === "final" ? nd.final : nd.interim !== null && own?.kind === "interim" ? nd.interim : single);
        if (cmp !== null && REL(afsVal, cmp) <= 0.01) {
          const bothPartial = afsPartial && nd.completeness !== "total_stated" && nd.completeness !== "final+interim";
          conf.dps = bothPartial ? (conf.dps === "low" ? "medium" : conf.dps) : nd.ocr && ex.ocr ? "medium" : "high";
          dpsSource = "afs+notice";
          notes.push("dps_confirmed_by_ngx_notice");
        } else if (cmp !== null && nTot !== null && afsPartial) {
          // les états ne donnent qu'une partie ; l'avis donne le total complet
          row.dps = nTot;
          row.dpsKind = `notice:${nd.completeness}`;
          conf.dps = nd.ocr ? "low" : "medium";
          dpsSource = "notice";
          add(fy, "dps", "info", `DPS des états (${afsVal}, ${own!.kind}) complété par l'avis NGX (${nTot})`, nTot, nd.files[0] ?? "", null);
        } else if (cmp !== null) {
          conf.dps = DOWN[conf.dps];
          add(fy, "dps", "medium", `avis NGX (${row.dpsNotice}) ≠ états audités (${afsVal}) : valeur des états conservée`, afsVal, nd.files[0] ?? "", null);
        }
      } else {
        // aucun DPS dans les états : l'avis NGX seul
        const v = nTot ?? nd.final ?? nd.interim;
        if (v !== null) {
          row.dps = v;
          row.dpsKind = `notice:${nd.completeness}`;
          dpsSource = "notice";
          conf.dps = nd.completeness === "total_stated" || nd.completeness === "final+interim" ? (nd.ocr ? "low" : "medium") : "low";
          if (nd.completeness === "final_only" || nd.completeness === "interim_only") add(fy, "dps", "low", `DPS partiel (${nd.completeness}) d'après l'avis NGX ${row.dpsNotice}`, v, nd.files[0] ?? "", null);
        }
      }
    }
    // flux de trésorerie : payé(N+1) ≈ actions × (final N + acompte N+1)
    if (row.dps !== null && (nd || own)) {
      const finalN = nd?.final ?? (own?.kind === "final" ? own.dps : null);
      const interimNext = noticeSums.get(fy + 1)?.interim ?? null;
      const cc = cashCheck(finalN, interimNext, row.impliedShares ?? opts.shares, cashPaid(byFy, fy + 1));
      if (cc) {
        row.dpsCashGap = Math.round(cc.gap * 1000) / 1000;
        if (cc.gap <= CASH_TOL) {
          notes.push(`dps_cashflow_ok(${(cc.gap * 100).toFixed(0)}%)`);
          conf.dps = nd?.ocr || ex.ocr ? (conf.dps === "low" ? "medium" : conf.dps) : UP[conf.dps];
        } else add(fy, "dps", "info", `flux de trésorerie : dividendes payés ${fy + 1} ≈ ${(cashPaid(byFy, fy + 1)! / 1e9).toFixed(2)} Md vs attendu ${(cc.expected / 1e9).toFixed(2)} Md (écart ${(cc.gap * 100).toFixed(0)} %)`, row.dps, doc.file, null);
      }
    }
    row.dpsSource = dpsSource;
    // Déclarant en USD (ETI, Seplat…) : le DPS des états est libellé dans une autre monnaie que les montants ; sans conversion
    // sourcée on ne le déclare pas fiable.
    if (row.dps !== null && ex.currency && ex.currency !== "NGN") {
      conf.dps = "low";
      notes.push("dps_currency_unverified");
      add(fy, "dps", "low", `DPS lu pour un déclarant en ${ex.currency} : monnaie du DPS non vérifiée (états en ${ex.currency}, actions cotées en NGN)`, row.dps, doc.file, null);
    }
  }

  // Changement de base (banques : produits d'intérêts ↔ gross earnings ; corporate : exploitation ↔ avant impôt)
  const canon = (key: "revenueBasis" | "operatingBasis", v: string | null) => {
    if (!v) return "";
    if (key === "operatingBasis") return /^PBT/i.test(v) ? "PBT" : "operating profit";
    return /gross earnings/i.test(v) ? "gross earnings" : /interest/i.test(v) ? "interest income" : "revenue";
  };
  for (const key of ["revenueBasis", "operatingBasis"] as const) {
    const bases = rows.map((r) => canon(key, r[key])).filter(Boolean);
    const counts = new Map<string, number>();
    bases.forEach((b) => counts.set(b, (counts.get(b) ?? 0) + 1));
    if (counts.size > 1) {
      const modal = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const field: AnyField = key === "revenueBasis" ? "revenue" : "operatingProfit";
      for (const r of rows) {
        const b = canon(key, r[key]);
        if (b && b !== modal) {
          r.notes.push(`${key}_differs_from_modal(${b} vs ${modal})`);
          if (r.conf[field] === "high") r.conf[field] = "medium";
          add(r.fiscalYear, field, "medium", `base différente des autres exercices : « ${b} » vs « ${modal} »`, null, r.sourceFile, null);
        }
      }
    }
  }
  return { rows, review };
}
