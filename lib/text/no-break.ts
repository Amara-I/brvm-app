// Espaces insécables pour les chiffres affichés dans les textes (moteur technique, lecture,
// signaux) : un nombre comme « 246 932,60 pts », « 4 197 FCFA » ou « +3,6 % » ne doit
// jamais être coupé en fin de ligne.

/** Espace fine insécable (U+202F) : séparateur de milliers. */
export const NNBSP = "\u202f";
/** Espace insécable (U+00A0) : entre un nombre et son unité (FCFA, pts, %, ₦…). */
export const NBSP = "\u00a0";

const GROUP = /(\d)[ \u00a0\u202f](?=\d{3}(?!\d))/g;
const UNIT = /(\d)[ \u202f](?=%|FCFA\b|pts\b|XOF\b|NGN\b|₦|Mds\b|Md\b|ans?\b|séances?\b|sessions?\b|fois\b|times\b)/g;

/**
 * Rend insécables les espaces internes d'un nombre (milliers) et l'espace avant son unité.
 * Les autres espaces (dont « 4 100 – 4 300 », autour du tiret) restent sécables.
 */
export function keepNumbersTogether(text: string): string {
  if (!text) return text;
  // Deux passes : « 1 234 567 » a des groupes qui se chevauchent.
  return text.replace(GROUP, `$1${NNBSP}`).replace(GROUP, `$1${NNBSP}`).replace(UNIT, `$1${NBSP}`);
}

/** Remplace les espaces de groupement renvoyés par Intl par l'espace fine insécable. */
export function normalizeGrouping(text: string): string {
  return text.replace(/[\u00a0\u202f]/g, NNBSP);
}
