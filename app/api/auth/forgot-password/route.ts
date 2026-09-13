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
  MAIL_USER_MESSAGES,
  sendAuthEmail,
  userMessageForMailFailure,
} from "@/lib/auth/email";
import { isDatabaseUnavailable } from "@/lib/db/is-database-unavailable";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  if (!isEmailConfigured()) {
    return apiError(MAIL_USER_MESSAGES.not_configured, 503);
  }

  const email = parsed.data.email.toLowerCase();
  let devResetUrl: string | undefined;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user?.passwordHash) {
      const rawToken = await issueAuthToken(user.id, "PASSWORD_RESET");
      if (!rawToken) {
        return apiError("Impossible de générer le lien de réinitialisation pour le moment.", 503);
      }
      const mailed = await sendAuthEmail("reset", email, rawToken);
      if (!mailed.ok) {
        console.error("[auth] envoi email de reset échoué", mailed.error);
        return apiError(userMessageForMailFailure(mailed), 502);
      }
      if (isDevAuthPreviewEnabled()) {
        devResetUrl = buildAuthLink("/reinitialiser-mot-de-passe", rawToken);
      }
    }
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return apiError("Service temporairement indisponible. Réessayez dans quelques instants.", 503);
    }
    console.error("[auth] forgot-password : impossible de traiter la demande", error);
    return apiError(MAIL_USER_MESSAGES.send_failed, 502);
  }

  return apiSuccess({
    sent: true,
    ...(devResetUrl ? { devResetUrl } : {}),
  });
}
