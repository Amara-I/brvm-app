// ═══════════════════════════════════════════════════════════════════════════
// Vérification du robots.txt — respect obligatoire avant tout scraping
// ═══════════════════════════════════════════════════════════════════════════
import robotsParser from "robots-parser";

interface CachedRobots {
  parser: ReturnType<typeof robotsParser>;
  fetchedAt: number;
}

const ROBOTS_CACHE_TTL_MS = 60 * 60 * 1000; // 1h — le robots.txt change rarement
const cache = new Map<string, CachedRobots>();

async function getRobotsParser(origin: string): Promise<ReturnType<typeof robotsParser> | null> {
  const cached = cache.get(origin);
  if (cached && Date.now() - cached.fetchedAt < ROBOTS_CACHE_TTL_MS) {
    return cached.parser;
  }
  const robotsUrl = `${origin}/robots.txt`;
  try {
    const res = await fetch(robotsUrl);
    if (!res.ok) {
      // Pas de robots.txt (ou inaccessible) = pas de restriction déclarée.
      cache.set(origin, { parser: robotsParser(robotsUrl, ""), fetchedAt: Date.now() });
      return cache.get(origin)!.parser;
    }
    const body = await res.text();
    const parser = robotsParser(robotsUrl, body);
    cache.set(origin, { parser, fetchedAt: Date.now() });
    return parser;
  } catch {
    // En cas d'erreur réseau sur le robots.txt lui-même, on adopte la
    // position la plus prudente : on considère l'accès NON autorisé plutôt
    // que de scraper "à l'aveugle".
    return null;
  }
}

/// Vérifie qu'une URL précise peut être requêtée par notre User-Agent selon
/// le robots.txt de son hôte. Utilisé par `lib/ingestion/http-client.ts`
/// avant chaque requête sortante des connecteurs.
export async function isPathAllowed(url: string, userAgent: string): Promise<boolean> {
  const { origin } = new URL(url);
  const parser = await getRobotsParser(origin);
  if (!parser) return false;
  const allowed = parser.isAllowed(url, userAgent);
  // `isAllowed` peut retourner `undefined` si le robots.txt est ambigu ;
  // dans le doute, on autorise (comportement standard des crawlers), sauf
  // mention explicite de refus.
  return allowed !== false;
}

/// Retourne le `Crawl-delay` (en secondes) déclaré par un hôte pour un
/// User-Agent donné, ou `null` si non déclaré. Sert de documentation/043
/// vérification croisée avec les délais codés en dur dans http-client.ts.
export async function getCrawlDelaySeconds(url: string, userAgent: string): Promise<number | null> {
  const { origin } = new URL(url);
  const parser = await getRobotsParser(origin);
  if (!parser) return null;
  return parser.getCrawlDelay(userAgent) ?? null;
}
