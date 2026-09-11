/** Formatage de variations % pour l'UI (jamais de faux chiffres : null → N/D). */

export type ChangeTone = "up" | "down" | "flat" | "nd";

export function changeTone(value: number | null | undefined): ChangeTone {
  if (value == null || Number.isNaN(value)) return "nd";
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "flat";
}

export function formatSignedPercent(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return "N/D";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function changeClassName(value: number | null | undefined): string {
  const tone = changeTone(value);
  if (tone === "nd") return "ob-nd";
  if (tone === "up") return "ob-chg-up";
  if (tone === "down") return "ob-chg-down";
  return "ob-chg-flat";
}
