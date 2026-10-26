import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, apiValidationError } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { changePasswordSchema } from "@/lib/auth/schemas";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { isDatabaseUnavailable } from "@/lib/db/is-database-unavailable";
import { getI18n } from "@/lib/i18n/get-i18n";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { t } = getI18n();
  const user = await getCurrentUser();
  if (!user?.id) return apiError(t("common.api.authRequired"), 401);

  const body = await request.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!dbUser) return apiError(t("common.api.accountMissing"), 404);

    if (dbUser.passwordHash) {
      if (!parsed.data.currentPassword) {
        return apiError(t("common.api.currentPasswordRequired"), 400);
      }
      const valid = await verifyPassword(parsed.data.currentPassword, dbUser.passwordHash);
      if (!valid) return apiError(t("common.api.currentPasswordWrong"), 400);
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return apiSuccess({ updated: true });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return apiError(t("common.unavailable"), 503);
    }
    throw error;
  }
}
