// POST /api/auth/resend-verification — renvoie un email de confirmation (session requise).

import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { issueAuthToken } from "@/lib/auth/tokens";
import { buildAuthLink } from "@/lib/auth/app-url";
import { isDevAuthPreviewEnabled, sendAuthEmail } from "@/lib/auth/email";
import { isDatabaseUnavailable } from "@/lib/db/is-database-unavailable";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getCurrentUser();
  if (!user?.id) return apiError("Connexion requise", 401);

  let dbUser;
  try {
    dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true, emailVerified: true },
    });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return apiError("Service temporairement indisponible. Réessayez dans quelques instants.", 503);
    }
    throw error;
  }
  if (!dbUser?.email) return apiError("Compte introuvable", 404);
  if (dbUser.emailVerified) return apiSuccess({ alreadyVerified: true });

  const rawToken = await issueAuthToken(user.id, "EMAIL_VERIFY");
  if (!rawToken) {
    return apiError("Impossible de générer un lien de confirmation pour le moment.", 503);
  }

  const mailed = await sendAuthEmail("verify", dbUser.email, rawToken);
  if (!mailed.ok) {
    console.error("[auth] renvoi email de confirmation échoué", mailed.error);
    return apiError("L'envoi de l'email a échoué. Réessayez dans quelques instants.", 502);
  }

  return apiSuccess({
    sent: mailed.provider !== "log",
    ...(isDevAuthPreviewEnabled() ? { devVerifyUrl: buildAuthLink("/verifier-email", rawToken) } : {}),
  });
}
