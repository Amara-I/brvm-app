import type { TFunc } from "./create-i18n";
import type { FormatApi } from "./format";

const SPLIT_LABEL =
  /^Fractionnement (\d+(?:\.\d+)?):(\d+(?:\.\d+)?)(?: le (\d{2})\/(\d{2})\/(\d{4}))?$/;

/**
 * Le serveur formule toujours le libellé français (« Fractionnement 1:10 le 26/10/2026 »).
 * En français on le réaffiche tel quel. En anglais on reconstruit la phrase
 * (« 1-for-10 stock split on 26/10/2026 ») avec une date en-GB.
 */
export function localizeSplitLabel(label: string, t: TFunc, format: FormatApi): string {
  if (format.locale === "fr") return label;
  const match = label.match(SPLIT_LABEL);
  if (!match) return label;
  const ratio = t("charts.split.ratio", { old: match[1]!, new: match[2]! });
  const day = match[3];
  const month = match[4];
  const year = match[5];
  if (!day || !month || !year) return t("charts.split.bare", { ratio });
  const date = format.date(new Date(Number(year), Number(month) - 1, Number(day)), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return t("charts.split.withDate", { ratio, date });
}
