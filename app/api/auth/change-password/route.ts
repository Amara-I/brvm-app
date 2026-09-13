import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, apiValidationError } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { changePasswordSchema } from "@/lib/auth/schemas";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { isDatabaseUnavailable } from "@/lib/db/is-database-unavailable";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.id) return apiError("Connexion requise", 401);

  const body = await request.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!dbUser) return apiError("Compte introuvable", 404);

    if (dbUser.passwordHash) {
      if (!parsed.data.currentPassword) {
        return apiError("Indiquez votre mot de passe actuel.", 400);
      }
      const valid = await verifyPassword(parsed.data.currentPassword, dbUser.passwordHash);
      if (!valid) return apiError("Le mot de passe actuel est incorrect.", 400);
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return apiSuccess({ updated: true });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return apiError("Service temporairement indisponible. Réessayez dans quelques instants.", 503);
    }
    throw error;
  }
}
