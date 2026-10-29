// Synthèse des perspectives d'avenir NGX : lecture défensive de companies.profile_meta.ngxOutlook.
// Les données sont rédigées hors application (recherche sourcée, chaque élément porte sa source, sa date et sa confiance)
// et chargées sans migration. Toute valeur absente ou invalide est ignorée : rien n'est déduit ni inventé.

import type { NgxConfidence } from "./fundamentals";

export const NGX_OUTLOOK_TYPES = ["guidance", "project", "analyst", "risk", "sector"] as const;
export type NgxOutlookItemType = (typeof NGX_OUTLOOK_TYPES)[number];

export interface NgxOutlookItem {
  type: NgxOutlookItemType;
  textFr: string | null;
  textEn: string | null;
  /** Date de la source : AAAA-MM-JJ, AAAA-MM ou AAAA (précision variable selon la source). */
  date: string | null;
  sourceName: string | null;
  url: string | null;
  confidence: NgxConfidence | null;
}

export interface NgxOutlookSummary {
  bullets: string[];
  watch: string[];
}

export interface NgxOutlookSynthesis {
  summary: { fr: NgxOutlookSummary; en: NgxOutlookSummary };
  items: NgxOutlookItem[];
  /** Horodatage ISO de la dernière mise à jour des données. */
  updatedAt: string | null;
}

const MAX_BULLETS = 8;
const MAX_ITEMS = 40;
const MAX_TEXT = 700;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s ? s.slice(0, MAX_TEXT) : null;
}

function safeUrl(value: unknown): string | null {
  const s = text(value);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function confidence(value: unknown): NgxConfidence | null {
  return value === "high" || value === "medium" || value === "low" ? value : null;
}

function partialDate(value: unknown): string | null {
  const s = text(value);
  return s && /^\d{4}(-\d{2}(-\d{2})?)?$/.test(s) ? s : null;
}

function isoStamp(value: unknown): string | null {
  const s = text(value);
  if (!s || !/^\d{4}-\d{2}-\d{2}/.test(s) || Number.isNaN(Date.parse(s))) return null;
  return s;
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(text).filter((s): s is string => s != null).slice(0, MAX_BULLETS);
}

function summary(value: unknown): NgxOutlookSummary {
  const r = record(value);
  return { bullets: strings(r?.bullets), watch: strings(r?.watch) };
}

/** null = aucune synthèse exploitable (le fiche affiche alors un état vide). */
export function parseNgxOutlook(meta: unknown): NgxOutlookSynthesis | null {
  const root = record(meta);
  const o = record(root?.ngxOutlook);
  if (!o) return null;

  const items: NgxOutlookItem[] = [];
  if (Array.isArray(o.items)) {
    for (const raw of o.items) {
      const r = record(raw);
      if (!r) continue;
      const type = NGX_OUTLOOK_TYPES.find((x) => x === r.type);
      const textFr = text(r.textFr);
      const textEn = text(r.textEn);
      if (!type || (!textFr && !textEn)) continue;
      items.push({
        type,
        textFr,
        textEn,
        date: partialDate(r.date),
        sourceName: text(r.sourceName),
        url: safeUrl(r.url),
        confidence: confidence(r.confidence),
      });
      if (items.length >= MAX_ITEMS) break;
    }
  }

  const fr = summary(o.summaryFr);
  const en = summary(o.summaryEn);
  const hasSummary = fr.bullets.length + fr.watch.length + en.bullets.length + en.watch.length > 0;
  if (!hasSummary && items.length === 0) return null;

  return { summary: { fr, en }, items, updatedAt: isoStamp(o.updatedAt) };
}

/** Texte dans la langue demandée, sinon dans l'autre langue. */
export function outlookText(item: NgxOutlookItem, locale: "fr" | "en"): string {
  return (locale === "fr" ? item.textFr ?? item.textEn : item.textEn ?? item.textFr) ?? "";
}

/** Résumé dans la langue demandée ; repli sur l'autre langue si la première est vide. */
export function outlookSummary(s: NgxOutlookSynthesis, locale: "fr" | "en"): NgxOutlookSummary {
  const main = s.summary[locale];
  const other = s.summary[locale === "fr" ? "en" : "fr"];
  return {
    bullets: main.bullets.length ? main.bullets : other.bullets,
    watch: main.watch.length ? main.watch : other.watch,
  };
}
