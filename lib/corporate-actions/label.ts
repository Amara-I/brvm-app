/** Libellé affiché (FR). Ex. « Fractionnement 1:10 le 26/10/2026 ». */
export function splitMarkerLabel(action: {
  oldShares: number;
  newShares: number;
  effectiveDate: string;
}): string {
  const [year, month, day] = action.effectiveDate.slice(0, 10).split("-");
  const ratio = `${trimShareCount(action.oldShares)}:${trimShareCount(action.newShares)}`;
  if (!year || !month || !day) return `Fractionnement ${ratio}`;
  return `Fractionnement ${ratio} le ${day}/${month}/${year}`;
}

function trimShareCount(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(value).replace(/\.0+$/, "");
}
