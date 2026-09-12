// ═══════════════════════════════════════════════════════════════════════════
// Client HTTP partagé pour les connecteurs d'ingestion
// ═══════════════════════════════════════════════════════════════════════════
// Centralise les bonnes pratiques exigées par le brief :
//   - User-Agent identifiable (INGESTION_USER_AGENT, cf. .env.example)
//   - Rate limiting par hôte (respecte le `Crawl-delay` de chaque robots.txt)
//   - Retry avec backoff exponentiel sur 429/500/502/503
//   - Cache local sur disque (TTL configurable) pour éviter de re-scraper
//     inutilement une page déjà récupérée récemment
//   - Vérification robots.txt avant toute requête (cf. lib/ingestion/robots.ts)
// ═══════════════════════════════════════════════════════════════════════════

import { createHash } from "node:crypto";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isPathAllowed } from "./robots";

const DEFAULT_USER_AGENT =
  process.env.INGESTION_USER_AGENT ??
  "BRVMAppBot/1.0 (+https://brvm-app.vercel.app; contact: admin@brvm-app.example)";

const CACHE_DIR = join(process.cwd(), ".cache", "ingestion");
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — les cours ne bougent pas seconde par seconde
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;

/// Délai minimal (ms) entre deux requêtes vers un même hôte. brvm.org déclare
/// explicitement `Crawl-delay: 10` dans son robots.txt — on l'honore. Pour les
/// sites qui ne déclarent pas de Crawl-delay (Sikafinance, Richbourse), on
/// applique un délai conservateur par défaut pour rester respectueux.
const HOST_MIN_DELAY_MS: Record<string, number> = {
  "www.brvm.org": 10_000,
  "www.sikafinance.com": 3_000,
  "www.richbourse.com": 3_000,
};
const DEFAULT_MIN_DELAY_MS = 3_000;

const lastRequestAtByHost = new Map<string, number>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRateLimit(hostname: string): Promise<void> {
  const minDelay = HOST_MIN_DELAY_MS[hostname] ?? DEFAULT_MIN_DELAY_MS;
  const lastAt = lastRequestAtByHost.get(hostname) ?? 0;
  const elapsed = Date.now() - lastAt;
  if (elapsed < minDelay) {
    await sleep(minDelay - elapsed);
  }
  lastRequestAtByHost.set(hostname, Date.now());
}

function cacheKeyFor(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

function readCache(url: string, ttlMs: number): string | null {
  try {
    const file = join(CACHE_DIR, `${cacheKeyFor(url)}.json`);
    if (!existsSync(file)) return null;
    const { fetchedAt, body } = JSON.parse(readFileSync(file, "utf-8"));
    if (Date.now() - fetchedAt > ttlMs) return null;
    return body as string;
  } catch {
    return null; // cache corrompu ou illisible → on re-fetch simplement
  }
}

function writeCache(url: string, body: string): void {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    const file = join(CACHE_DIR, `${cacheKeyFor(url)}.json`);
    writeFileSync(file, JSON.stringify({ url, fetchedAt: Date.now(), body }), "utf-8");
  } catch {
    // Le cache est un "best effort" — une erreur d'écriture ne doit jamais
    // faire échouer l'ingestion elle-même.
  }
}

export class HttpFetchError extends Error {
  constructor(
    message: string,
    public readonly httpStatus?: number
  ) {
    super(message);
    this.name = "HttpFetchError";
  }
}

export interface FetchHtmlOptions {
  /// Respecte le robots.txt de l'hôte avant de requêter (activé par défaut).
  checkRobots?: boolean;
  cacheTtlMs?: number;
  timeoutMs?: number;
}

/// Récupère le HTML d'une URL en respectant robots.txt, le rate limiting par
/// hôte, avec retry/backoff sur erreurs transitoires, et un cache disque.
export async function fetchHtml(url: string, options: FetchHtmlOptions = {}): Promise<string> {
  const { checkRobots = true, cacheTtlMs = DEFAULT_CACHE_TTL_MS, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const { hostname } = new URL(url);

  const cached = readCache(url, cacheTtlMs);
  if (cached !== null) return cached;

  if (checkRobots) {
    const allowed = await isPathAllowed(url, DEFAULT_USER_AGENT);
    if (!allowed) {
      throw new HttpFetchError(`Bloqué par robots.txt de ${hostname} pour l'User-Agent ${DEFAULT_USER_AGENT}`);
    }
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await waitForRateLimit(hostname);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": DEFAULT_USER_AGENT, Accept: "text/html,application/xhtml+xml" },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 429 || res.status >= 500) {
        // Erreurs transitoires → backoff exponentiel puis retry.
        lastError = new HttpFetchError(`HTTP ${res.status} sur ${url}`, res.status);
        await sleep(500 * 2 ** attempt);
        continue;
      }
      if (res.status === 403) {
        // Pas de retry sur 403 : c'est un blocage délibéré (WAF, ban IP...),
        // réessayer immédiatement n'aiderait pas et violerait le rate limiting.
        throw new HttpFetchError(`HTTP 403 (accès refusé) sur ${url}`, 403);
      }
      if (!res.ok) {
        throw new HttpFetchError(`HTTP ${res.status} sur ${url}`, res.status);
      }

      const body = await res.text();
      writeCache(url, body);
      return body;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (err instanceof HttpFetchError && err.httpStatus === 403) throw err;
      if (attempt < MAX_RETRIES) await sleep(500 * 2 ** attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Échec de récupération de ${url}`);
}

export interface FetchJsonOptions {
  checkRobots?: boolean;
  cacheTtlMs?: number;
  timeoutMs?: number;
  method?: "GET" | "POST";
  body?: unknown;
}

/// POST/GET JSON avec le même rate-limit / robots / retry que `fetchHtml`.
/// Cache clé = URL + méthode + body sérialisé (utile pour GetHistos Sika).
export async function fetchJson<T = unknown>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const {
    checkRobots = true,
    cacheTtlMs = DEFAULT_CACHE_TTL_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    method = "GET",
    body,
  } = options;
  const { hostname } = new URL(url);
  const cacheUrl = method === "GET" ? url : `${url}::${method}::${JSON.stringify(body ?? null)}`;

  const cached = readCache(cacheUrl, cacheTtlMs);
  if (cached !== null) return JSON.parse(cached) as T;

  if (checkRobots) {
    const allowed = await isPathAllowed(url, DEFAULT_USER_AGENT);
    if (!allowed) {
      throw new HttpFetchError(`Bloqué par robots.txt de ${hostname} pour l'User-Agent ${DEFAULT_USER_AGENT}`);
    }
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await waitForRateLimit(hostname);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          "User-Agent": DEFAULT_USER_AGENT,
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json;charset=UTF-8" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 429 || res.status >= 500) {
        lastError = new HttpFetchError(`HTTP ${res.status} sur ${url}`, res.status);
        await sleep(500 * 2 ** attempt);
        continue;
      }
      if (res.status === 403) {
        throw new HttpFetchError(`HTTP 403 (accès refusé) sur ${url}`, 403);
      }
      if (!res.ok) {
        throw new HttpFetchError(`HTTP ${res.status} sur ${url}`, res.status);
      }

      const text = await res.text();
      writeCache(cacheUrl, text);
      return JSON.parse(text) as T;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (err instanceof HttpFetchError && err.httpStatus === 403) throw err;
      if (attempt < MAX_RETRIES) await sleep(500 * 2 ** attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Échec de récupération JSON de ${url}`);
}

/// GET binaire (PDF d'avis BRVM) — même robots / rate-limit / retry que le HTML.
export async function fetchBuffer(url: string, options: FetchHtmlOptions = {}): Promise<Buffer> {
  const { checkRobots = true, cacheTtlMs = 12 * 60 * 60 * 1000, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const { hostname } = new URL(url);

  const cached = readCache(url, cacheTtlMs);
  if (cached !== null) return Buffer.from(cached, "base64");

  if (checkRobots) {
    const allowed = await isPathAllowed(url, DEFAULT_USER_AGENT);
    if (!allowed) {
      throw new HttpFetchError(`Bloqué par robots.txt de ${hostname} pour l'User-Agent ${DEFAULT_USER_AGENT}`);
    }
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await waitForRateLimit(hostname);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": DEFAULT_USER_AGENT, Accept: "application/pdf,application/octet-stream,*/*" },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 429 || res.status >= 500) {
        lastError = new HttpFetchError(`HTTP ${res.status} sur ${url}`, res.status);
        await sleep(500 * 2 ** attempt);
        continue;
      }
      if (res.status === 403) {
        throw new HttpFetchError(`HTTP 403 (accès refusé) sur ${url}`, 403);
      }
      if (!res.ok) {
        throw new HttpFetchError(`HTTP ${res.status} sur ${url}`, res.status);
      }

      const body = Buffer.from(await res.arrayBuffer());
      writeCache(url, body.toString("base64"));
      return body;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (err instanceof HttpFetchError && err.httpStatus === 403) throw err;
      if (attempt < MAX_RETRIES) await sleep(500 * 2 ** attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Échec de récupération binaire de ${url}`);
}

