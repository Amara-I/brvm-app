// ═══════════════════════════════════════════════════════════════════════════
// GET /api/companies/full — Jeu de données complet du dashboard, étape 8
// ═══════════════════════════════════════════════════════════════════════════
// Utilisé par le bouton "⟳ Actualiser les données" du dashboard (le premier
// rendu passe, lui, par un appel direct côté serveur à
// `getCompaniesFullDataset()` dans `app/page.tsx`, sans HTTP superflu).
// ═══════════════════════════════════════════════════════════════════════════

import { getCompaniesFullDataset } from "@/lib/api/companies-full-dataset";
import { apiSuccess, cacheHeaders } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function GET() {
  const dataset = await getCompaniesFullDataset();
  return apiSuccess(dataset, { headers: cacheHeaders(30) });
}
