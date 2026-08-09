// ═══════════════════════════════════════════════════════════════════════════
// Rate limiting — étape 9 (checklist de conformité, volet Sécurité)
// ═══════════════════════════════════════════════════════════════════════════
// Implémentation "fenêtre fixe" en mémoire, volontairement simple.
//
// ⚠️ LIMITE CONNUE (documentée, pas un oubli) : un `Map` en mémoire de
// processus ne fonctionne correctement que sur UNE SEULE instance serveur.
// En production sur Vercel (fonctions serverless multi-instances, souvent
// une invocation par instance froide), chaque instance a son propre
// compteur : la limite réelle appliquée est donc `limit × nombre
// d'instances actives`, pas `limit` strict. C'est un point d'amélioration
// identifié dans `COMPLIANCE_CHECKLIST.md` : brancher ce module sur Redis/
// Vercel KV (déjà prévu dans le stack cible, cf. `REDIS_URL` dans
// `.env.example`) via `INCR`+`EXPIRE` pour un comptage partagé et fiable
// entre instances avant mise en production réelle.
// ═══════════════════════════════════════════════════════════════════════════

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Purge périodique best-effort pour éviter une croissance mémoire non bornée
// (une clé par IP/fenêtre active). Ne bloque jamais une requête.
const CLEANUP_INTERVAL_MS = 5 * 60_000;
let lastCleanup = Date.now();
function cleanupIfNeeded(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitOptions {
  /// Nombre maximal de requêtes autorisées par fenêtre.
  limit: number;
  /// Durée de la fenêtre en millisecondes.
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /// Timestamp (ms epoch) de réinitialisation de la fenêtre courante.
  resetAt: number;
}

/// Vérifie et consomme un "jeton" pour `key` (typiquement `ip:route`) selon
/// une politique de fenêtre fixe. Pure fonction sur l'état interne du
/// module — sans effet de bord observable de l'extérieur autre que l'état
/// du rate limiter lui-même.
export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  cleanupIfNeeded(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + options.windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, limit: options.limit, remaining: options.limit - 1, resetAt };
  }

  if (existing.count >= options.limit) {
    return { allowed: false, limit: options.limit, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { allowed: true, limit: options.limit, remaining: options.limit - existing.count, resetAt: existing.resetAt };
}

/// Exposé uniquement pour les tests (réinitialise tout l'état du module).
export function __resetRateLimitStateForTests(): void {
  buckets.clear();
}
