import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { sendNotificationEmail } from "./email";
import { deepLinkFor, isInQuietHours } from "./logic";
import { getOrCreatePrefs } from "./prefs";
import { typeEnabled, type NotificationTypeCode, type PrefsSnapshot } from "./types";

export type EmitNotificationInput = {
  userId: string;
  type: NotificationTypeCode;
  title: string;
  body: string;
  href?: string | null;
  ticker?: string | null;
  indexCode?: string | null;
  preferChart?: boolean;
  alertRuleId?: string | null;
  priceAlertId?: string | null;
  payload?: Prisma.InputJsonValue;
  prefs?: PrefsSnapshot;
  now?: Date;
  /** Si déjà une notif pour ce priceAlertId, ne pas recréer. */
  dedupePriceAlert?: boolean;
};

export type EmitResult =
  | { created: false; reason: "type_disabled" | "channel_off" | "duplicate" }
  | { created: true; id: string; emailed: boolean };

export async function emitNotification(input: EmitNotificationInput): Promise<EmitResult> {
  const prefs = input.prefs ?? (await getOrCreatePrefs(input.userId));
  if (!typeEnabled(prefs, input.type)) return { created: false, reason: "type_disabled" };
  if (!prefs.channelInApp && !prefs.channelEmail) return { created: false, reason: "channel_off" };

  if (input.dedupePriceAlert && input.priceAlertId) {
    const existing = await prisma.notificationEvent.findFirst({
      where: { userId: input.userId, priceAlertId: input.priceAlertId },
      select: { id: true },
    });
    if (existing) return { created: false, reason: "duplicate" };
  }

  const href =
    input.href ??
    deepLinkFor({
      type: input.type,
      ticker: input.ticker,
      indexCode: input.indexCode,
      preferChart: input.preferChart,
    });

  if (!prefs.channelInApp && prefs.channelEmail) {
    // Canal e-mail seul : on crée quand même l'événement (historique + stats admin).
  }

  const created = await prisma.notificationEvent.create({
    data: {
      userId: input.userId,
      type: input.type as NotificationType,
      title: input.title,
      body: input.body,
      href,
      ticker: input.ticker ?? null,
      indexCode: input.indexCode ?? null,
      alertRuleId: input.alertRuleId ?? null,
      priceAlertId: input.priceAlertId ?? null,
      payload: input.payload ?? undefined,
    },
  });

  let emailed = false;
  if (prefs.channelEmail) {
    const now = input.now ?? new Date();
    const quiet = isInQuietHours(now, prefs.quietHoursStart, prefs.quietHoursEnd);
    const digestHold = prefs.deliveryMode === "DIGEST";
    if (!quiet && !digestHold) {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { email: true },
      });
      if (user?.email) {
        const result = await sendNotificationEmail({
          to: user.email,
          title: input.title,
          body: input.body,
          href,
        });
        emailed = result.sent;
        await prisma.notificationEvent.update({
          where: { id: created.id },
          data: {
            emailSentAt: result.sent ? new Date() : null,
            emailError: result.sent ? null : result.error ?? result.skipped ?? null,
          },
        });
      }
    }
  }

  return { created: true, id: created.id, emailed };
}

/** Digest du jour : e-mails non envoyés (heures calmes ou mode digest). */
export async function flushPendingNotificationEmails(now = new Date()): Promise<{ sent: number; skipped: number }> {
  const pending = await prisma.notificationEvent.findMany({
    where: { emailSentAt: null, emailError: null },
    orderBy: { createdAt: "asc" },
    take: 80,
    include: { user: { select: { email: true, notificationPreference: true } } },
  });

  let sent = 0;
  let skipped = 0;
  for (const ev of pending) {
    const prefs = ev.user.notificationPreference;
    if (!prefs?.channelEmail || !ev.user.email) {
      skipped += 1;
      continue;
    }
    if (isInQuietHours(now, prefs.quietHoursStart, prefs.quietHoursEnd)) {
      skipped += 1;
      continue;
    }
    if (prefs.deliveryMode === "DIGEST") {
      // On n'envoie le digest que dans la fenêtre de clôture (15–17h), via l'évaluateur.
    }
    const result = await sendNotificationEmail({
      to: ev.user.email,
      title: ev.title,
      body: ev.body,
      href: ev.href,
    });
    if (result.sent) {
      sent += 1;
      await prisma.notificationEvent.update({
        where: { id: ev.id },
        data: { emailSentAt: new Date(), emailError: null },
      });
    } else {
      skipped += 1;
      await prisma.notificationEvent.update({
        where: { id: ev.id },
        data: { emailError: result.error ?? result.skipped ?? "send_failed" },
      });
    }
  }
  return { sent, skipped };
}
