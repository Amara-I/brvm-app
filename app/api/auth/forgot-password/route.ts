// POST /api/auth/forgot-password — demande de lien de réinitialisation.
// Si le fournisseur email n'est pas configuré : erreur française visible.
// Si le compte n'existe pas : succès générique (anti-énumération).

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, apiValidationError } from "@/lib/api/response";
import { forgotPasswordSchema } from "@/lib/auth/schemas";
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

export async function POST(request: NextRequest) {
  const { t, locale } = getI18n();
  const body = await request.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  if (!isEmailConfigured()) {
    return apiError(t("mail.notConfigured"), 503);
  }

  const email = parsed.data.email.toLowerCase();
  let devResetUrl: string | undefined;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user?.passwordHash) {
      const rawToken = await issueAuthToken(user.id, "PASSWORD_RESET");
      if (!rawToken) {
        return apiError(t("common.api.resetLinkFailed"), 503);
      }
      const mailed = await sendAuthEmail("reset", email, rawToken, locale);
      if (!mailed.ok) {
        console.error("[auth] envoi email de reset échoué", mailed.error);
        return apiError(userMessageForMailFailure(mailed, locale), 502);
      }
      if (isDevAuthPreviewEnabled()) {
        devResetUrl = buildAuthLink("/reinitialiser-mot-de-passe", rawToken);
      }
    }
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return apiError(t("common.unavailable"), 503);
    }
    console.error("[auth] forgot-password : impossible de traiter la demande", error);
    return apiError(t("mail.sendFailed"), 502);
  }

  return apiSuccess({
    sent: true,
    ...(devResetUrl ? { devResetUrl } : {}),
  });
}
