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
