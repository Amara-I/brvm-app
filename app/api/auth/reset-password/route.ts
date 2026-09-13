// POST /api/auth/reset-password — consomme le jeton one-shot et pose le nouveau hash.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, apiValidationError } from "@/lib/api/response";
import { resetPasswordSchema } from "@/lib/auth/schemas";
import { consumeAuthToken } from "@/lib/auth/tokens";
import { hashPassword } from "@/lib/auth/password";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const consumed = await consumeAuthToken(parsed.data.token, "PASSWORD_RESET");
  if (!consumed) {
    return apiError("Ce lien de réinitialisation est invalide ou a expiré. Demandez-en un nouveau.", 400);
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.user.update({
    where: { id: consumed.userId },
    data: {
      passwordHash,
      // Preuve de possession de la boîte mail → email considéré confirmé.
      emailVerified: new Date(),
    },
  });

  return apiSuccess({ reset: true });
}
