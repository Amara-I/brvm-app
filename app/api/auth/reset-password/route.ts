// POST /api/auth/reset-password — consomme le jeton one-shot et pose le nouveau hash.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, apiValidationError } from "@/lib/api/response";
import { resetPasswordSchema } from "@/lib/auth/schemas";
import { consumeAuthToken } from "@/lib/auth/tokens";
import { hashPassword } from "@/lib/auth/password";
import { isDatabaseUnavailable } from "@/lib/db/is-database-unavailable";
import { getI18n } from "@/lib/i18n/get-i18n";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { t } = getI18n();
  const body = await request.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const consumed = await consumeAuthToken(parsed.data.token, "PASSWORD_RESET");
    if (!consumed) {
      return apiError(t("common.api.resetLinkInvalid"), 400);
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
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return apiError(t("common.unavailable"), 503);
    }
    throw error;
  }

  return apiSuccess({ reset: true });
}
