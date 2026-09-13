// POST /api/auth/forgot-password — demande de lien de réinitialisation.
// Réponse volontairement identique que le compte existe ou non (anti-énumération).

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiValidationError } from "@/lib/api/response";
import { forgotPasswordSchema } from "@/lib/auth/schemas";
import { issueAuthToken } from "@/lib/auth/tokens";
import { buildAuthLink } from "@/lib/auth/app-url";
import { isDevAuthPreviewEnabled, sendAuthEmail } from "@/lib/auth/email";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const email = parsed.data.email.toLowerCase();
  let devResetUrl: string | undefined;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user?.passwordHash) {
      const rawToken = await issueAuthToken(user.id, "PASSWORD_RESET");
      if (rawToken) {
        const mailed = await sendAuthEmail("reset", email, rawToken);
        if (!mailed.ok) {
          console.error("[auth] envoi email de reset échoué", mailed.error);
        }
        if (isDevAuthPreviewEnabled()) {
          devResetUrl = buildAuthLink("/reinitialiser-mot-de-passe", rawToken);
        }
      }
    }
  } catch (error) {
    // Toujours 200 : ne pas révéler l'existence du compte ni l'état de la base.
    console.error("[auth] forgot-password : impossible de traiter la demande", error);
  }

  return apiSuccess({
    sent: true,
    ...(devResetUrl ? { devResetUrl } : {}),
  });
}
