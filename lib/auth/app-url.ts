type EnvMap = Record<string, string | undefined>;

/// URL publique de l'app (liens de confirmation / reset).
/// Priorité : NEXTAUTH_URL → AUTH_URL → https://VERCEL_URL → localhost.
export function getAppBaseUrl(
  env: EnvMap = process.env
): string {
  const explicit = env.NEXTAUTH_URL?.trim() || env.AUTH_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }

  return "http://localhost:3000";
}

export function buildAuthLink(path: string, token: string, env?: EnvMap): string {
  const url = new URL(path, `${getAppBaseUrl(env)}/`);
  url.searchParams.set("token", token);
  return url.toString();
}
