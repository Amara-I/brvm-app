// ═══════════════════════════════════════════════════════════════════════════
// POST /api/auth/register — Création de compte (email/mot de passe)
// ═══════════════════════════════════════════════════════════════════════════
// NextAuth Credentials ne fournit pas d'inscription. Cette route crée
// l'utilisateur (bcrypt), émet un jeton de confirmation et envoie l'email
// si un fournisseur (Resend / SMTP) est configuré. La connexion reste
// possible avant confirmation (soft gate + bandeau).
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, apiValidationError } from "@/lib/api/response";
import { hashPassword } from "@/lib/auth/password";
import { registerSchema } from "@/lib/auth/schemas";
import { issueAuthToken } from "@/lib/auth/tokens";
import { buildAuthLink } from "@/lib/auth/app-url";
import { isDevAuthPreviewEnabled, sendAuthEmail } from "@/lib/auth/email";
import { isDatabaseUnavailable } from "@/lib/db/is-database-unavailable";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const email = parsed.data.email.toLowerCase();
  let existing;
  try {
    existing = await prisma.user.findUnique({ where: { email } });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return apiError("Service temporairement indisponible. Réessayez dans quelques instants.", 503);
    }
    throw error;
  }
  if (existing) return apiError("Un compte existe déjà avec cette adresse email", 409);

  const passwordHash = await hashPassword(parsed.data.password);
  let user;
  try {
    user = await prisma.user.create({
      data: { email, passwordHash, name: parsed.data.name ?? null },
    });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return apiError("Service temporairement indisponible. Réessayez dans quelques instants.", 503);
    }
    throw error;
  }

  const rawToken = await issueAuthToken(user.id, "EMAIL_VERIFY");
  let verificationEmailSent = false;
  if (rawToken) {
    const mailed = await sendAuthEmail("verify", email, rawToken);
    verificationEmailSent = mailed.ok && mailed.provider !== "log";
    if (!mailed.ok) {
      console.error("[auth] envoi email de confirmation échoué", mailed.error);
    }
  }

  return apiSuccess(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      verificationEmailSent,
      ...(isDevAuthPreviewEnabled() && rawToken
        ? { devVerifyUrl: buildAuthLink("/verifier-email", rawToken) }
        : {}),
    },
    { status: 201 }
  );
}
