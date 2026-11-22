// ═══════════════════════════════════════════════════════════════════════════
// GET /api/companies/full — Jeu de données du dashboard marché / screener
// ═══════════════════════════════════════════════════════════════════════════
// Le jeu CANONIQUE est toujours lu en entier côté serveur (cache interne),
// puis allégé pour un visiteur (pas de ratios ni d'historique assez long
// pour recalculer le score). Même URL, deux corps possibles (session ou
// non) : jamais de cache CDN public.

import { getCompaniesFullDataset } from "@/lib/api/companies-full-dataset";
import { apiSuccess, privateCacheHeaders } from "@/lib/api/response";
import { getViewer, presentCompaniesFullDataset } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export async function GET() {
  const [dataset, viewer] = await Promise.all([getCompaniesFullDataset(), getViewer()]);
  const presented = presentCompaniesFullDataset(dataset, viewer);
  return apiSuccess(presented, { headers: privateCacheHeaders() });
}
