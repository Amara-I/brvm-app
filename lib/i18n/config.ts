// Locale UI OuestBourse. Pas de préfixe d'URL : le français reste sur les
// chemins existants, l'anglais est choisi par cookie (et Accept-Language
// au premier passage). Aucune colonne utilisateur — pas de migration.

export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";

/** Cookie lisible par le middleware, les Server Components et le client. */
export const LOCALE_COOKIE = "ouestbourse-locale";

/** En-tête posé par le middleware pour le premier rendu (cookie pas encore vu). */
export const LOCALE_HEADER = "x-ouestbourse-locale";

export const LOCALE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "fr" || value === "en";
}

/**
 * Anglais seulement si Accept-Language le préfère strictement au français.
 * Sinon français (défaut produit), y compris en cas d'égalité ou d'en-tête absent.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  let bestFr = 0;
  let bestEn = 0;
  let sawEn = false;

  for (const part of acceptLanguage.split(",")) {
    const [rawTag, ...params] = part.trim().split(";");
    const tag = rawTag?.trim().toLowerCase();
    if (!tag || tag === "*") continue;
    let q = 1;
    for (const param of params) {
      const [key, raw] = param.trim().split("=");
      if (key === "q") {
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) q = parsed;
      }
    }
    if (tag === "fr" || tag.startsWith("fr-")) bestFr = Math.max(bestFr, q);
    else if (tag === "en" || tag.startsWith("en-")) {
      sawEn = true;
      bestEn = Math.max(bestEn, q);
    }
  }

  if (sawEn && bestEn > bestFr) return "en";
  return DEFAULT_LOCALE;
}

/** BCP-47 utilisé par Intl. Dates en jour-mois-année (en-GB), groupement 1,234.56. */
export function intlLocale(locale: Locale): string {
  return locale === "en" ? "en-GB" : "fr-FR";
}
