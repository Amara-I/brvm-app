import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "./get-current-user";
import { isAdminEmail, isAdminRoleOrEmail } from "./admin-emails";

export type AdminUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  role: string;
};

export type AdminCheck = { ok: true; user: AdminUser } | { ok: false; status: 401 | 403 };

/// Garde réelle : session NextAuth + (`User.role = ADMIN` en base ou email
/// listé dans `ADMIN_EMAILS`). Ne jamais se fier à un paramètre client.
export async function requireAdmin(): Promise<AdminCheck> {
  const user = await getCurrentUser();
  if (!user?.id) return { ok: false, status: 401 };

  if (isAdminRoleOrEmail(user)) {
    return { ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role ?? "USER" } };
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, email: true },
    });
    if (dbUser?.role === "ADMIN" || isAdminEmail(dbUser?.email)) {
      return {
        ok: true,
        user: { id: user.id, email: user.email, name: user.name, role: "ADMIN" },
      };
    }
  } catch {
    // Base injoignable : on ne lève pas d'admin par défaut.
  }

  return { ok: false, status: 403 };
}
