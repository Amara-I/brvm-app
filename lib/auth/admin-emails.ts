/// Emails autorisés à la vue admin en plus du rôle Prisma `User.role = ADMIN`.
/// Sert de bootstrap (pas d'UI pour promouvoir un compte) : liste séparée
/// par des virgules dans `ADMIN_EMAILS`. Comparaison insensible à la casse.
export function parseAdminEmails(raw = process.env.ADMIN_EMAILS): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.includes("@") && email.length <= 254);
}

export function isAdminEmail(email: string | null | undefined, raw = process.env.ADMIN_EMAILS): boolean {
  if (!email) return false;
  return parseAdminEmails(raw).includes(email.trim().toLowerCase());
}

export function isAdminRoleOrEmail(
  user: {
    role?: string | null;
    email?: string | null;
  } | null,
  raw = process.env.ADMIN_EMAILS
): boolean {
  if (!user) return false;
  return user.role === "ADMIN" || isAdminEmail(user.email, raw);
}
