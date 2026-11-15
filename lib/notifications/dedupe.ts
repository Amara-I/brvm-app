// Anti-doublon des notifications : une même information n'est notifiée qu'une
// fois. Clé stable par information (place, titre, séance, valeur) + repli
// « même texte » pour les événements créés avant la clé ; l'affichage
// regroupe aussi les doublons déjà en base.

/** Fenêtre du repli « texte identique » (jours). */
export const SAME_TEXT_WINDOW_DAYS = 14;

/** Fenêtre de non-répétition d'un même signal (ACHAT FORT persistant) sur un titre. */
export const SIGNAL_REPEAT_WINDOW_DAYS = 30;

/** Date de séance YYYY-MM-DD d'un cours (UTC, colonne @db.Date). */
export function sessionDateOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function norm(value: string | number): string {
  return String(value).trim().replace(/\s+/g, "_").toUpperCase();
}

/** Clé stable : ex. "PF_MOVE:SHEC:2026-11-13", "DAILY:rule123:2026-11-13". */
export function dedupeKey(kind: string, ...parts: Array<string | number | null | undefined>): string {
  return [norm(kind), ...parts.filter((p) => p != null && p !== "").map((p) => norm(p as string | number))].join(":");
}

/** Montant normalisé pour une clé (évite 2170 vs 2170.0000). */
export function amountKey(n: number): string {
  if (!Number.isFinite(n)) return "ND";
  return String(Math.round(n * 100) / 100);
}

export type GroupableNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  ticker: string | null;
  indexCode: string | null;
  readAt: Date | string | null;
  createdAt: Date | string;
};

/** Signature d'affichage : deux événements identiques pour l'utilisateur = un seul. */
export function displaySignature(n: Pick<GroupableNotification, "type" | "title" | "body" | "ticker" | "indexCode">): string {
  return [n.type, n.ticker ?? "", n.indexCode ?? "", n.title.trim(), n.body.trim()].join("\u0001");
}

/**
 * Regroupe les doublons (déjà triés du plus récent au plus ancien) : on garde
 * le plus récent ; le groupe est lu seulement si tous ses membres le sont.
 */
export function collapseDuplicateNotifications<T extends GroupableNotification>(
  events: T[]
): Array<T & { duplicateCount: number }> {
  const groups = new Map<string, { head: T; count: number; unread: boolean }>();
  for (const ev of events) {
    const sig = displaySignature(ev);
    const g = groups.get(sig);
    if (!g) groups.set(sig, { head: ev, count: 1, unread: ev.readAt == null });
    else {
      g.count += 1;
      if (ev.readAt == null) g.unread = true;
    }
  }
  return [...groups.values()].map((g) => ({
    ...g.head,
    readAt: g.unread ? null : g.head.readAt,
    duplicateCount: g.count,
  }));
}

/** Prisma P2002 (contrainte / index unique) — doublon concurrent. */
export function isUniqueViolation(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && (err as { code?: string }).code === "P2002");
}
