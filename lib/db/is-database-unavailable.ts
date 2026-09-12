/** Erreurs Prisma / réseau qui indiquent une base absente ou injoignable
 *  (pas un bug de requête). Sert au repli d'affichage local. */
export function isDatabaseUnavailable(err: unknown): boolean {
  const parts: string[] = [];
  if (err instanceof Error) {
    parts.push(err.name, err.message);
    const cause = (err as Error & { cause?: unknown }).cause;
    if (cause instanceof Error) parts.push(cause.message);
    else if (cause != null) parts.push(String(cause));
  } else {
    parts.push(String(err));
  }
  const text = parts.join(" ");
  return /Can't reach database|Environment variable not found: DATABASE_URL|P1000|P1001|P1017|ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|Connection refused|PrismaClientInitializationError/i.test(
    text
  );
}

/** Table / colonne absente (migration pas encore appliquée) — pas un crash page. */
export function isMissingDatabaseObject(err: unknown): boolean {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code?: unknown }).code;
    if (code === "P2021" || code === "P2022") return true;
  }
  const text = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return /P2021|P2022|does not exist|n'existe pas|Unknown (arg|table|column|field)|relation .+ does not exist/i.test(
    text
  );
}
