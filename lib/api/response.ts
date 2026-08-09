// Helpers de réponse JSON partagés par toutes les API routes (app/api/**).
import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function apiSuccess<T>(data: T, init?: { status?: number; headers?: HeadersInit }) {
  return NextResponse.json({ ok: true, data }, { status: init?.status ?? 200, headers: init?.headers });
}

export function apiError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, error: message, details }, { status });
}

export function apiValidationError(error: ZodError) {
  return apiError("Paramètres invalides", 422, error.flatten());
}

export function apiNotFound(resource: string) {
  return apiError(`${resource} introuvable`, 404);
}

/// En-têtes de cache HTTP standard pour les endpoints de lecture PUBLIQUE
/// (données de marché identiques pour tout le monde), respectés par le CDN
/// Vercel côté edge. `swrSeconds` = durée pendant laquelle une réponse
/// périmée peut être resservie pendant qu'une version fraîche est recalculée
/// en arrière-plan (stale-while-revalidate).
///
/// ⚠️ NE JAMAIS utiliser sur une route retournant des données PERSONNALISÉES
/// par utilisateur (ex: portefeuille) : `public` autorise un cache PARTAGÉ
/// (CDN) à resservir la réponse à un AUTRE utilisateur pendant `s-maxage`,
/// ce qui provoquerait une fuite de données entre comptes. Utiliser
/// `privateCacheHeaders()` dans ce cas — cf. revue de sécurité étape 9.
export function cacheHeaders(maxAgeSeconds: number, swrSeconds = maxAgeSeconds * 2): HeadersInit {
  return {
    "Cache-Control": `public, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${swrSeconds}`,
  };
}

/// En-têtes de cache pour les endpoints retournant des données PERSONNALISÉES
/// (propres à l'utilisateur authentifié, ex: `GET /api/portfolio`).
/// `private` interdit tout cache PARTAGÉ (CDN/proxy) de mettre en cache la
/// réponse — seul le navigateur de l'utilisateur concerné peut la conserver,
/// et uniquement `maxAgeSeconds` (0 par défaut = jamais, toujours revalidé).
export function privateCacheHeaders(maxAgeSeconds = 0): HeadersInit {
  return {
    "Cache-Control": maxAgeSeconds > 0 ? `private, max-age=${maxAgeSeconds}, must-revalidate` : "private, no-store",
  };
}
