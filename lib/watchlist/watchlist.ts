// Liste de suivi : règles pures (validation, limite) partagées par l'API et les tests.
import { z } from "zod";

/** Plafond par utilisateur : largement au-dessus des 47 sociétés BRVM, borne les abus. */
export const WATCHLIST_MAX_ITEMS = 100;

export const watchlistTickerSchema = z.object({
  ticker: z
    .string()
    .trim()
    .min(1)
    .max(12)
    .regex(/^[A-Za-z0-9._-]+$/, "Ticker invalide")
    .transform((v) => v.toUpperCase()),
});

/** true si l'ajout d'une nouvelle société dépasserait le plafond. */
export function watchlistIsFull(currentCount: number): boolean {
  return currentCount >= WATCHLIST_MAX_ITEMS;
}
