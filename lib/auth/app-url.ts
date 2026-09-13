type EnvMap = Record<string, string | undefined>;

/** Ligne d'env collée comme valeur (`NEXTAUTH_URL=https://…` ou `AUTH_URL=https`). */
const PASTED_ENV_ASSIGNMENT = /^(NEXTAUTH_URL|AUTH_URL)\s*=/i;

/**
 * True si `value` est une URL http(s) absolue utilisable comme origine de l'app.
 * Rejette le schéma seul (`https`, `https:`), une assignation d'env collée
 * comme valeur, et un hostname du type `nextauth_url=https` (Chrome
 * DNS_PROBE_POSSIBLE après déconnexion).
 */
export function isValidAppBaseUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (PASTED_ENV_ASSIGNMENT.test(trimmed)) return false;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  if (!parsed.hostname) return false;
  if (parsed.hostname.includes("=")) return false;
  return true;
}

/// URL publique de l'app (liens de confirmation / reset).
/// Priorité : NEXTAUTH_URL → AUTH_URL → https://VERCEL_URL → localhost.
/// Une valeur invalide (pas une URL http(s) absolue, `NEXTAUTH_URL=…`,
/// ou `https` seul) est ignorée — on continue vers le fallback suivant.
export function getAppBaseUrl(env: EnvMap = process.env): string {
  for (const raw of [env.NEXTAUTH_URL, env.AUTH_URL]) {
    const explicit = raw?.trim();
    if (!explicit || !isValidAppBaseUrl(explicit)) continue;
    return explicit.replace(/\/$/, "");
  }

  const vercel = env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }

  return "http://localhost:3000";
}

/**
 * Cible de redirection NextAuth : n'utilise `baseUrl` (NEXTAUTH_URL interne)
 * que s'il est une origine http(s) valide. Sinon `getAppBaseUrl()`.
 * Évite de renvoyer le navigateur vers le host littéral `nextauth_url=https`.
 */
export function resolveAuthRedirectUrl(
  url: string,
  nextAuthBaseUrl: string,
  env?: EnvMap
): string {
  const safeBase = isValidAppBaseUrl(nextAuthBaseUrl)
    ? nextAuthBaseUrl.replace(/\/$/, "")
    : getAppBaseUrl(env);

  if (url.startsWith("/")) return `${safeBase}${url}`;
  try {
    const parsed = new URL(url);
    if (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.origin === safeBase
    ) {
      return url;
    }
  } catch {
    // URL mal formée → accueil
  }
  return safeBase;
}

export function buildAuthLink(path: string, token: string, env?: EnvMap): string {
  const url = new URL(path, `${getAppBaseUrl(env)}/`);
  url.searchParams.set("token", token);
  return url.toString();
}
