import type { AlertRuleKind, NotificationDeliveryMode, NotificationType } from "@prisma/client";

export const NOTIFICATION_TYPES = ["PRIX", "SIGNAUX", "PORTEFEUILLE", "INDICES", "SYSTEME"] as const;
export type NotificationTypeCode = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_TYPE_LABELS: Record<NotificationTypeCode, string> = {
  PRIX: "Prix",
  SIGNAUX: "Signaux",
  PORTEFEUILLE: "Portefeuille",
  INDICES: "Indices",
  SYSTEME: "Système",
};

export const ALERT_RULE_KINDS = ["DAILY_MOVE", "HORIZON_MOVE", "SIGNAL_ENTRY", "INDEX_MOVE"] as const;
export type AlertRuleKindCode = (typeof ALERT_RULE_KINDS)[number];

export const ALERT_RULE_KIND_LABELS: Record<AlertRuleKindCode, string> = {
  DAILY_MOVE: "Variation journalière",
  HORIZON_MOVE: "Variation d'horizon",
  SIGNAL_ENTRY: "Entrée de signal",
  INDEX_MOVE: "Variation d'indice",
};

export const HORIZON_CODES = ["1S", "1M"] as const;
export type AlertHorizonCode = (typeof HORIZON_CODES)[number];

export const HORIZON_DAYS: Record<AlertHorizonCode, number> = {
  "1S": 7,
  "1M": 30,
};

export const HORIZON_LABELS: Record<AlertHorizonCode, string> = {
  "1S": "1 semaine",
  "1M": "1 mois",
};

/** Collier officiel BRVM le plus courant (variation max d'une séance). */
export const BRVM_DAILY_COLLAR_PCT = 7.5;
/** Plafond accepté (certaines séances / titres peuvent aller à ±10 %). */
export const BRVM_DAILY_COLLAR_MAX_PCT = 10;
export const BRVM_DAILY_MOVE_MIN_PCT = 0.5;

export const DEFAULT_PORTFOLIO_MOVE_PCT = 5;
export const DEFAULT_INDEX_MOVE_PCT = 1.5;

export const BRVM_TZ = "Africa/Abidjan";
export const HEADLINE_INDEX_ALERT_CODES = ["BRVM_COMPOSITE", "BRVM_30"] as const;

export type DailyMoveParams = { percent: number };
export type HorizonMoveParams = { percent: number; horizon: AlertHorizonCode };
export type SignalEntryParams = { signal: "ACHAT FORT" | "ACHAT"; minScore?: number };
export type IndexMoveParams = { percent: number };

export type AlertRuleParams = DailyMoveParams | HorizonMoveParams | SignalEntryParams | IndexMoveParams;

export type PrefsSnapshot = {
  priceEnabled: boolean;
  signalEnabled: boolean;
  portfolioEnabled: boolean;
  indexEnabled: boolean;
  systemEnabled: boolean;
  channelInApp: boolean;
  channelEmail: boolean;
  deliveryMode: NotificationDeliveryMode;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  sessionReminders: boolean;
  portfolioMovePct: number;
  indexMovePct: number;
};

export const DEFAULT_PREFS: PrefsSnapshot = {
  priceEnabled: true,
  signalEnabled: false,
  portfolioEnabled: true,
  indexEnabled: false,
  systemEnabled: true,
  channelInApp: true,
  channelEmail: false,
  deliveryMode: "REALTIME",
  quietHoursStart: null,
  quietHoursEnd: null,
  sessionReminders: false,
  portfolioMovePct: DEFAULT_PORTFOLIO_MOVE_PCT,
  indexMovePct: DEFAULT_INDEX_MOVE_PCT,
};

export function isNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

export function isAlertRuleKind(value: string): value is AlertRuleKind {
  return (ALERT_RULE_KINDS as readonly string[]).includes(value);
}

export function typeEnabled(prefs: PrefsSnapshot, type: NotificationTypeCode): boolean {
  switch (type) {
    case "PRIX":
      return prefs.priceEnabled;
    case "SIGNAUX":
      return prefs.signalEnabled;
    case "PORTEFEUILLE":
      return prefs.portfolioEnabled;
    case "INDICES":
      return prefs.indexEnabled;
    case "SYSTEME":
      return prefs.systemEnabled;
  }
}
