// ═══════════════════════════════════════════════════════════════════════════
// Middleware Next.js — rate limiting des routes API (étape 9, volet Sécurité)
// ═══════════════════════════════════════════════════════════════════════════
// S'applique aux routes `/api/**` (sauf `GET /api/health`, sonde d'uptime
// hors quota pour ne jamais 429 un monitor). Politique volontairement simple :
//   - Routes d'authentification (`/api/auth/**`, y compris l'inscription) :
//     limite stricte (10 req/min/IP) pour limiter le bruteforce de mots de
//     passe et le spam d'inscriptions.
//   - Reste de l'API (marché, sociétés, portefeuille, export, cron) :
//     limite large (60 req/min/IP), suffisante pour un usage normal du
//     dashboard (rafraîchissement manuel, export Excel) tout en bloquant un
//     script abusif.
// Le cron d'ingestion (`/api/cron/ingest`) reste protégé PRIORITAIREMENT par
// `CRON_SECRET` (cf. route dédiée) — le rate limiting ici est une couche de
// défense supplémentaire, pas le mécanisme d'autorisation principal.
//
// ⚠️ Cf. `lib/security/rate-limit.ts` pour la limite connue de l'approche en
// mémoire sur infrastructure serverless multi-instances (à durcir avec
// Redis/Vercel KV avant mise en production réelle — cf. COMPLIANCE_CHECKLIST.md).
// ═══════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isLocale,
  LOCALE_COOKIE,
  LOCALE_HEADER,
  LOCALE_MAX_AGE,
  negotiateLocale,
  type Locale,
} from "./lib/i18n/config";
import { chrome as enChrome } from "./lib/i18n/messages/parts/en/chrome";
import { chrome as frChrome } from "./lib/i18n/messages/parts/fr/chrome";
import { checkRateLimit, type RateLimitResult } from "./lib/security/rate-limit";

const DEFAULT_API_LIMIT = { limit: 60, windowMs: 60_000 };
const AUTH_API_LIMIT = { limit: 10, windowMs: 60_000 };

function getClientIp(request: NextRequest): string {
  // `NextRequest.ip` n'existe que sur certaines plateformes (Vercel Edge) ;
  // on retombe sur `X-Forwarded-For` (posé par le proxy Vercel/CDN en amont)
  // puis sur une valeur fixe en dernier recours (dev local sans proxy).
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  return "unknown";
}

function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}

function requestLocale(request: NextRequest): Locale {
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  return negotiateLocale(request.headers.get("accept-language"));
}

function withLocale(request: NextRequest, locale: Locale, responseHeaders?: Record<string, string>) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER, locale);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (responseHeaders) {
    for (const [key, value] of Object.entries(responseHeaders)) response.headers.set(key, value);
  }
  if (!isLocale(request.cookies.get(LOCALE_COOKIE)?.value)) {
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: LOCALE_MAX_AGE,
      sameSite: "lax",
    });
  }
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const locale = requestLocale(request);

  // Sonde d'uptime (`GET /api/health`) : requête légère, pas de secrets.
  // On la laisse hors quota pour qu'un monitor (UptimeRobot, cron) ne
  // reçoive jamais un 429 même si l'IP est partagée.
  if (pathname === "/api/health") {
    return NextResponse.next();
  }

  if (!pathname.startsWith("/api/")) {
    return withLocale(request, locale);
  }

  const isAuthRoute = pathname.startsWith("/api/auth/");
  const config = isAuthRoute ? AUTH_API_LIMIT : DEFAULT_API_LIMIT;
  const ip = getClientIp(request);
  const key = `${ip}:${isAuthRoute ? "auth" : "api"}`;

  const result = checkRateLimit(key, config);
  const headers = rateLimitHeaders(result);

  if (!result.allowed) {
    const message = locale === "en" ? enChrome.rateLimit : frChrome.rateLimit;
    return NextResponse.json(
      { ok: false, error: message },
      { status: 429, headers: { ...headers, "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)) } }
    );
  }

  return withLocale(request, locale, headers);
}

export const config = {
  matcher: [
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
