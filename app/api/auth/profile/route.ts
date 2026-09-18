import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, apiValidationError, privateCacheHeaders } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { updateProfileSchema } from "@/lib/auth/schemas";
import { issueAuthToken } from "@/lib/auth/tokens";
import { buildAuthLink } from "@/lib/auth/app-url";
import {
  isDevAuthPreviewEnabled,
  sendAuthEmail,
  userMessageForMailFailure,
} from "@/lib/auth/email";
import { isDatabaseUnavailable } from "@/lib/db/is-database-unavailable";
import { isAdminRoleOrEmail } from "@/lib/auth/admin-emails";
import { parsePortfolioType } from "@/lib/portfolio-types";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.id) return apiError("Connexion requise", 401);

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        passwordHash: true,
        role: true,
        preferredPortfolioType: true,
      },
    });
    if (!dbUser) return apiError("Compte introuvable", 404);

    return apiSuccess(
      {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        emailVerified: Boolean(dbUser.emailVerified),
        hasPassword: Boolean(dbUser.passwordHash),
        isAdmin: isAdminRoleOrEmail({ role: dbUser.role, email: dbUser.email }),
        preferredPortfolioType: parsePortfolioType(dbUser.preferredPortfolioType),
      },
      { headers: privateCacheHeaders() }
    );
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return apiError("Service temporairement indisponible. Réessayez dans quelques instants.", 503);
    }
    throw error;
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.id) return apiError("Connexion requise", 401);

  const body = await request.json().catch(() => null);
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const current = await prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true },
    });
    if (!current) return apiError("Compte introuvable", 404);

    const nextEmail = parsed.data.email?.toLowerCase();
    const emailChanged = Boolean(nextEmail && nextEmail !== current.email);

    if (emailChanged && nextEmail) {
      const taken = await prisma.user.findUnique({ where: { email: nextEmail } });
      if (taken) return apiError("Un compte existe déjà avec cette adresse email", 409);
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(emailChanged && nextEmail
          ? { email: nextEmail, emailVerified: null }
          : {}),
        ...(parsed.data.preferredPortfolioType !== undefined
          ? { preferredPortfolioType: parsed.data.preferredPortfolioType }
          : {}),
      },
      select: { id: true, email: true, name: true, emailVerified: true, preferredPortfolioType: true },
    });

    let mailError: string | undefined;
    let devVerifyUrl: string | undefined;
    if (emailChanged && updated.email) {
      const rawToken = await issueAuthToken(updated.id, "EMAIL_VERIFY");
      if (!rawToken) {
        mailError = "Adresse mise à jour, mais le lien de confirmation n'a pas pu être généré.";
      } else {
        const mailed = await sendAuthEmail("verify", updated.email, rawToken);
        if (!mailed.ok) mailError = userMessageForMailFailure(mailed);
        if (isDevAuthPreviewEnabled()) {
          devVerifyUrl = buildAuthLink("/verifier-email", rawToken);
        }
      }
    }

    return apiSuccess({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      emailVerified: Boolean(updated.emailVerified),
      preferredPortfolioType: parsePortfolioType(updated.preferredPortfolioType),
      ...(mailError ? { mailError } : {}),
      ...(devVerifyUrl ? { devVerifyUrl } : {}),
    });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return apiError("Service temporairement indisponible. Réessayez dans quelques instants.", 503);
    }
    throw error;
  }
}
