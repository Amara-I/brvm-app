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
  sendAppEmail,
  userMessageForMailFailure,
} from "@/lib/auth/email";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getI18n } from "@/lib/i18n/get-i18n";
import { resolveAdminTestRecipient } from "@/lib/mail/config";
import { BRAND_NAME } from "@/lib/theme/brand";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const COOLDOWN_MS = 60_000;
const lastAttemptAt = new Map<string, number>();

export async function GET() {
  const { t } = getI18n();
  const admin = await requireAdmin();
  if (!admin.ok) {
    return apiError(
      admin.status === 401 ? t("common.api.sessionRequired") : t("common.api.adminRequired"),
      admin.status
    );
  }
  return apiSuccess(describeAppMailSetup(), { headers: privateCacheHeaders() });
}

export async function POST(request: NextRequest) {
  const { t, locale } = getI18n();
  const admin = await requireAdmin();
  if (!admin.ok) {
    return apiError(
      admin.status === 401 ? t("common.api.sessionRequired") : t("common.api.adminRequired"),
      admin.status
    );
  }

  const requested = await readRequestedTo(request, t);
  if (!requested.ok) return requested.response;

  const recipient = resolveAdminTestRecipient(admin.user.email, requested.to);
  if (!recipient.ok) {
    if (recipient.reason === "missing_admin_email") {
      return apiError(t("common.api.adminNoEmail"), 400);
    }
    return apiError(t("common.api.adminEmailOnly"), 403);
  }

  if (!isEmailConfigured()) {
    return apiError(t("mail.notConfigured"), 503);
  }

  const now = Date.now();
  const previous = lastAttemptAt.get(admin.user.id) ?? 0;
  if (now - previous < COOLDOWN_MS) {
    return apiError(t("common.api.adminEmailCooldown"), 429);
  }
  lastAttemptAt.set(admin.user.id, now);

  const result = await sendAppEmail({
    to: recipient.to,
    subject: t("mail.testSubject", { brand: BRAND_NAME }),
    text: t("mail.testText", { brand: BRAND_NAME }),
    html: `<p>${t("mail.testHtmlLead")} <strong>${BRAND_NAME}</strong>.</p><p>${t("mail.testHtmlTail")}</p>`,
  });

  if (!result.ok) {
    const status = result.code === "not_configured" ? 503 : 502;
    return apiError(userMessageForMailFailure(result, locale), status);
  }

  return apiSuccess(
    { sent: true, provider: result.provider, to: recipient.to },
    { headers: privateCacheHeaders() }
  );
}

async function readRequestedTo(
  request: NextRequest,
  t: ReturnType<typeof getI18n>["t"]
): Promise<{ ok: true; to?: string } | { ok: false; response: ReturnType<typeof apiError> }> {
  const raw = await request.text();
  if (!raw.trim()) return { ok: true };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, response: apiError(t("common.api.invalidJson"), 400) };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, response: apiError(t("common.api.invalidJson"), 400) };
  }
  const to = (parsed as { to?: unknown }).to;
  if (to === undefined) return { ok: true };
  if (typeof to !== "string") {
    return { ok: false, response: apiError(t("common.api.adminToEmail"), 422) };
  }
  return { ok: true, to };
}
