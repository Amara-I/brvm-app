import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { sendNotificationEmail } from "./email";
import { isUniqueViolation, SAME_TEXT_WINDOW_DAYS } from "./dedupe";
import { deepLinkFor, isInQuietHours, type AlertExchange } from "./logic";
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
  /** Place du titre (lien profond vers la fiche NGX). Défaut BRVM. */
  exchange?: AlertExchange | null;
  alertRuleId?: string | null;
  priceAlertId?: string | null;
  payload?: Prisma.InputJsonValue;
  prefs?: PrefsSnapshot;
  now?: Date;
  /** Si déjà une notif pour ce priceAlertId, ne pas recréer. */
  dedupePriceAlert?: boolean;
  /**
   * Clé stable de l'information (cf. ./dedupe) : si un événement de cet
   * utilisateur porte déjà cette clé, rien n'est recréé — même après lecture.
   */
  dedupeKey?: string;
  /**
   * Rappels volontairement répétés (ouverture / clôture de séance) : pas de
   * repli « texte identique ». La clé reste appliquée.
   */
  allowSameText?: boolean;
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

  if (input.dedupeKey) {
    const existing = await prisma.notificationEvent.findFirst({
      where: { userId: input.userId, payload: { path: ["dedupeKey"], equals: input.dedupeKey } },
      select: { id: true },
    });
    if (existing) return { created: false, reason: "duplicate" };
  }

  if (!input.allowSameText) {
    // Repli : même texte, même titre/indice, récemment → même information
    // (couvre aussi les événements créés avant les clés).
    const now = input.now ?? new Date();
    const since = new Date(now.getTime() - SAME_TEXT_WINDOW_DAYS * 86_400_000);
    const sameText = await prisma.notificationEvent.findFirst({
      where: {
        userId: input.userId,
        type: input.type as NotificationType,
        title: input.title,
        body: input.body,
        ticker: input.ticker ?? null,
        indexCode: input.indexCode ?? null,
        createdAt: { gte: since },
      },
      select: { id: true },
    });
    if (sameText) return { created: false, reason: "duplicate" };
  }

  const href =
    input.href ??
    deepLinkFor({
      type: input.type,
      ticker: input.ticker,
      indexCode: input.indexCode,
      preferChart: input.preferChart,
      exchange: input.exchange,
    });

  if (!prefs.channelInApp && prefs.channelEmail) {
    // Canal e-mail seul : on crée quand même l'événement (historique + stats admin).
  }

  const payload: Prisma.InputJsonValue | undefined = input.dedupeKey
    ? {
        ...(input.payload && typeof input.payload === "object" && !Array.isArray(input.payload)
          ? (input.payload as Prisma.InputJsonObject)
          : input.payload !== undefined
            ? { value: input.payload }
            : {}),
        dedupeKey: input.dedupeKey,
      }
    : input.payload;

  let created;
  try {
    created = await prisma.notificationEvent.create({
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
        payload: payload ?? undefined,
      },
    });
  } catch (err) {
    // Index unique (user_id, payload->>'dedupeKey') : évaluation concurrente
    // (cron + bouton + page) — l'autre passage a déjà créé l'événement.
    if (isUniqueViolation(err)) return { created: false, reason: "duplicate" };
    throw err;
  }

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
