// Affichage monétaire. La BRVM continue d'utiliser `format.fcfa` (entier + « FCFA »).
// `formatMoney` sert dès qu'une place autre que la BRVM est montrée (NGN, FCFA indicatif).

import { intlLocale, type Locale } from "@/lib/i18n/config";

export function formatMoney(value: number, currency: string, locale: Locale): string {
  if (!Number.isFinite(value)) return "N/D";
  const code = currency.trim().toUpperCase();
  if (code === "XOF" || code === "FCFA") {
    const body = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 }).format(
      Math.round(value)
    );
    return `${body} FCFA`;
  }
  if (code === "NGN") {
    const body = new Intl.NumberFormat(locale === "en" ? "en-NG" : "fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
    return `₦${body}`;
  }
  const body = new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${body} ${code}`;
}
