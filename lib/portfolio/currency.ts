// Devise d'une ligne de portefeuille : celle de la place du titre.
// Les montants d'une ligne (PRU, prix des opérations, objectif, stop) sont
// saisis et stockés dans cette devise — FCFA (BRVM) ou ₦ (NGX). Jamais mélangés
// dans un même total ; la conversion en FCFA n'est qu'indicative.

export type PortfolioCurrency = "XOF" | "NGN";

export function portfolioCurrencyOf(company: {
  exchange?: string | null;
  currency?: string | null;
}): PortfolioCurrency {
  return company.currency === "NGN" || company.exchange === "NGX" ? "NGN" : "XOF";
}

/** Sépare des lignes par devise (ordre conservé). */
export function splitByCurrency<T>(
  items: T[],
  currencyOf: (item: T) => PortfolioCurrency
): { XOF: T[]; NGN: T[] } {
  const out: { XOF: T[]; NGN: T[] } = { XOF: [], NGN: [] };
  for (const item of items) out[currencyOf(item)].push(item);
  return out;
}
