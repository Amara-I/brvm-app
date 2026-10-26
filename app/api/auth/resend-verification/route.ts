// POST /api/auth/resend-verification — renvoie un email de confirmation (session requise).

import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { issueAuthToken } from "@/lib/auth/tokens";
import { buildAuthLink } from "@/lib/auth/app-url";
import {
  isDevAuthPreviewEnabled,
  isEmailConfigured,
  sendAuthEmail,
  userMessageForMailFailure,
} from "@/lib/auth/email";
import { isDatabaseUnavailable } from "@/lib/db/is-database-unavailable";
import { getI18n } from "@/lib/i18n/get-i18n";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const { t, locale } = getI18n();
  const user = await getCurrentUser();
  if (!user?.id) return apiError(t("common.api.authRequired"), 401);

  let dbUser;
  try {
    dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true, emailVerified: true },
    });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return apiError(t("common.unavailable"), 503);
    }
    throw error;
  }
  if (!dbUser?.email) return apiError(t("common.api.accountMissing"), 404);
  if (dbUser.emailVerified) return apiSuccess({ alreadyVerified: true });

  if (!isEmailConfigured()) {
    return apiError(t("mail.notConfigured"), 503);
  }

  const rawToken = await issueAuthToken(user.id, "EMAIL_VERIFY");
  if (!rawToken) {
    return apiError(t("common.api.verifyLinkFailedShort"), 503);
  }

  const mailed = await sendAuthEmail("verify", dbUser.email, rawToken, locale);
  if (!mailed.ok) {
    console.error("[auth] renvoi email de confirmation échoué", mailed.error);
    return apiError(userMessageForMailFailure(mailed, locale), 502);
  }

  return apiSuccess({
    sent: true,
    ...(isDevAuthPreviewEnabled() ? { devVerifyUrl: buildAuthLink("/verifier-email", rawToken) } : {}),
  });
}
