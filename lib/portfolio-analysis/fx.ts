import { XOF_PER_EUR, indicativeFcfa } from "@/lib/markets/fx";

/** Même formule que `indicativeFcfa`, sans l'arrondi entier de la colonne « Cours FCFA ». */
export function ngnToFcfaExact(ngn: number, ngnPerEur: number): number | null {
  if (!(ngnPerEur > 0) || !Number.isFinite(ngn)) return null;
  const fcfa = (ngn * XOF_PER_EUR) / ngnPerEur;
  return Number.isFinite(fcfa) ? fcfa : null;
}

/** Affichage : identique à la colonne « Cours FCFA » (arrondi à l'entier). */
export function ngnToFcfaDisplay(ngn: number, ngnPerEur: number): number | null {
  return indicativeFcfa(ngn, ngnPerEur);
}

export function amountToFcfa(
  amount: number,
  currency: "XOF" | "NGN",
  ngnPerEur: number | null
): number | null {
  if (!Number.isFinite(amount)) return null;
  if (currency === "XOF") return amount;
  if (ngnPerEur == null) return null;
  return ngnToFcfaExact(amount, ngnPerEur);
}
