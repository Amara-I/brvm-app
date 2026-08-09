// Utilitaires de parsing partagés par les connecteurs (formats numériques FR).

/// Parse un nombre au format français tel qu'affiché sur BRVM.org/Sikafinance/
/// Richbourse : espaces (normaux, insécables `\u00A0`, insécables fines
/// `\u202F`) comme séparateur de milliers, virgule comme séparateur décimal.
/// Ex: "31 500" → 31500, "2,65" → 2.65, "-0,78" → -0.78.
export function parseFrenchNumber(raw: string): number | null {
  const cleaned = raw
    .replace(/[\u00A0\u202F\s]/g, "")
    .replace(",", ".")
    .replace(/%$/, "")
    .trim();
  if (cleaned === "" || cleaned === "-" || cleaned === "N/D") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/// Formate une Date en "YYYY-MM-DD" (UTC), format utilisé dans les URLs
/// BRVM.org et dans nos types internes.
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/// Dernier jour ouvré (lun-ven) à partir d'une date donnée (par défaut,
/// aujourd'hui). La BRVM ne cote pas le week-end — utile pour construire les
/// URLs d'ingestion sans avoir à gérer nous-mêmes le calendrier de séances.
export function lastBusinessDay(from: Date = new Date()): Date {
  const d = new Date(from);
  const day = d.getUTCDay(); // 0 = dimanche, 6 = samedi
  if (day === 0) d.setUTCDate(d.getUTCDate() - 2);
  else if (day === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}
