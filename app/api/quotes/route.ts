// GET /api/quotes?market=BRVM|NGX&tickers=SNTS,SGBC — derniers cours « live ».
//
// Réponse minuscule (ticker, clôture, clôture précédente, variation, date, horodatage)
// lue dans le cache serveur des derniers cours (lib/quotes/latest-quotes.ts) :
// invalidé à chaque écriture de cours, il évite toute requête base pendant les
// sondages clients. Le CDN mutualise en plus les appels identiques 15 s.

import { NextRequest } from "next/server";
import { apiError, apiSuccess, cacheHeaders } from "@/lib/api/response";
import { getLatestQuotes } from "@/lib/quotes/latest-quotes";
import { parseQuoteMarket, parseTickerList } from "@/lib/quotes/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const market = parseQuoteMarket(params.get("market"));
  if (!market) return apiError("Paramètre market attendu : BRVM ou NGX", 422);
  const tickers = parseTickerList(params.get("tickers"));
  try {
    const payload = await getLatestQuotes(market, tickers);
    return apiSuccess(payload, { headers: cacheHeaders(15, 30) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError("Derniers cours indisponibles", 503, message);
  }
}
