import type { TFunc } from "@/lib/i18n/create-i18n";

export function notificationTypeLabel(code: string, t: TFunc, fallback?: string): string {
  switch (code) {
    case "PRIX":
      return t("notifications.types.price");
    case "SIGNAUX":
      return t("notifications.types.signals");
    case "PORTEFEUILLE":
      return t("notifications.types.portfolio");
    case "INDICES":
      return t("notifications.types.indices");
    case "SYSTEME":
      return t("notifications.types.system");
    default:
      return fallback ?? code;
  }
}
