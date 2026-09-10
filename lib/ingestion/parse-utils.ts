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

const FRENCH_MONTHS: Record<string, number> = {
  janvier: 1,
  fevrier: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  aout: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  decembre: 12,
};

/** Parse « 10 septembre 2026 » → YYYY-MM-DD (UTC). */
export function parseFrenchDate(raw: string): string | null {
  const normalized = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const m = normalized.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = FRENCH_MONTHS[m[2]!];
  const year = Number(m[3]);
  if (!month || !Number.isFinite(day) || day < 1 || day > 31 || !Number.isFinite(year)) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Parse « 27/08/2026 » → YYYY-MM-DD (UTC). */
export function parseDdMmYyyy(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
