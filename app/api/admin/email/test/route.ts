// GET|POST /api/admin/email/test — essai d'envoi (admin uniquement).
//
// POST envoie un message court à l'adresse de l'administrateur connecté.
// Un champ `to` n'est accepté que s'il est exactement cette adresse :
// la route n'est pas un relais ouvert.
// GET décrit la configuration (fournisseur choisi, EMAIL_FROM valide) sans
// rien envoyer et sans exposer d'identifiants.
//
// Runtime Node : nodemailer a besoin de net/tls, indisponible sur Edge.

import { NextRequest } from "next/server";
import { apiError, apiSuccess, privateCacheHeaders } from "@/lib/api/response";
import {
  describeAppMailSetup,
  isEmailConfigured,
  MAIL_USER_MESSAGES,
  sendAppEmail,
  userMessageForMailFailure,
} from "@/lib/auth/email";
import { requireAdmin } from "@/lib/auth/require-admin";
import { resolveAdminTestRecipient } from "@/lib/mail/config";
import { BRAND_NAME } from "@/lib/theme/brand";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const COOLDOWN_MS = 60_000;
const lastAttemptAt = new Map<string, number>();

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return apiError(admin.status === 401 ? "Authentification requise" : "Accès administrateur requis", admin.status);
  }
  return apiSuccess(describeAppMailSetup(), { headers: privateCacheHeaders() });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return apiError(admin.status === 401 ? "Authentification requise" : "Accès administrateur requis", admin.status);
  }

  const requested = await readRequestedTo(request);
  if (!requested.ok) return requested.response;

  const recipient = resolveAdminTestRecipient(admin.user.email, requested.to);
  if (!recipient.ok) {
    if (recipient.reason === "missing_admin_email") {
      return apiError("Le compte administrateur n'a pas d'adresse email.", 400);
    }
    return apiError("Le test ne peut être envoyé qu'à l'adresse de l'administrateur connecté.", 403);
  }

  if (!isEmailConfigured()) {
    return apiError(MAIL_USER_MESSAGES.not_configured, 503);
  }

  const now = Date.now();
  const previous = lastAttemptAt.get(admin.user.id) ?? 0;
  if (now - previous < COOLDOWN_MS) {
    return apiError("Un email de test a déjà été tenté il y a moins d'une minute.", 429);
  }
  lastAttemptAt.set(admin.user.id, now);

  const result = await sendAppEmail({
    to: recipient.to,
    subject: `${BRAND_NAME} — email de test`,
    text: `Ceci est un email de test envoyé par ${BRAND_NAME}. Si vous le recevez, le transport SMTP est opérationnel.`,
    html: `<p>Ceci est un email de test envoyé par <strong>${BRAND_NAME}</strong>.</p><p>Si vous le recevez, le transport SMTP est opérationnel.</p>`,
  });

  if (!result.ok) {
    const status = result.code === "not_configured" ? 503 : 502;
    return apiError(userMessageForMailFailure(result), status);
  }

  return apiSuccess(
    { sent: true, provider: result.provider, to: recipient.to },
    { headers: privateCacheHeaders() }
  );
}

async function readRequestedTo(
  request: NextRequest
): Promise<{ ok: true; to?: string } | { ok: false; response: ReturnType<typeof apiError> }> {
  const raw = await request.text();
  if (!raw.trim()) return { ok: true };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, response: apiError("Corps JSON invalide", 400) };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, response: apiError("Corps JSON invalide", 400) };
  }
  const to = (parsed as { to?: unknown }).to;
  if (to === undefined) return { ok: true };
  if (typeof to !== "string") {
    return { ok: false, response: apiError("Le champ to doit être une adresse email", 422) };
  }
  return { ok: true, to };
}
