// Texte du PDF « COVERPAGE FOR DD-MM-YYYY » (ASI + indices sectoriels).

import { parseNgxDocDate } from "./dates";

export interface NgxIndexPrint {
  code: string;
  name: string;
  value: number;
  previous: number | null;
  changePercent: number | null;
}

export interface NgxCoverSnapshot {
  printDate: string;
  asi: NgxIndexPrint;
  indices: NgxIndexPrint[];
}

const WEEKDAY =
  "(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)";

function parseNumber(raw: string): number | null {
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function changePercent(value: number, previous: number | null): number | null {
  if (previous == null || !(previous > 0)) return null;
  return Math.round(((value - previous) / previous) * 10000) / 100;
}

export function parseCoverPageText(text: string): NgxCoverSnapshot | null {
  const printMatch =
    text.match(/Print Date\s+(\d{2}\/\d{2}\/\d{4})/i) ??
    text.match(/Daily Official List For\s+(\d{2}\/\d{2}\/\d{4})/i);
  const printDate = printMatch ? parseNgxDocDate(printMatch[1]!) : null;
  if (!printDate) return null;

  const sessions: { date: string; value: number }[] = [];
  const sessionRe = new RegExp(
    `${WEEKDAY}\\s+(\\d{2}\\/\\d{2}\\/\\d{4})\\s+([\\d,]+\\.\\d+)\\s+([\\d,]+\\.\\d+)`,
    "g"
  );
  for (const match of text.matchAll(sessionRe)) {
    const date = parseNgxDocDate(match[1]!);
    const indexValue = parseNumber(match[3]!);
    if (!date || indexValue == null || indexValue <= 0 || indexValue > 10_000_000) continue;
    sessions.push({ date, value: indexValue });
  }
  const current = sessions.find((row) => row.date === printDate) ?? sessions[sessions.length - 1];
  if (!current) return null;
  const currentIdx = sessions.findIndex((row) => row.date === current.date && row.value === current.value);
  const previous = currentIdx > 0 ? sessions[currentIdx - 1]!.value : null;

  const indices: NgxIndexPrint[] = [];
  const seen = new Set<string>();
  // Dans le PDF, le code d'un indice est parfois seul sur sa ligne (le libellé
  // et les nombres sont alors sur la ligne suivante) : on recolle les deux.
  const rawLines = text.split(/\r?\n/).map((line) => line.trim());
  const lines: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]!;
    if (/^NGX[A-Z0-9]+$/.test(line) && i + 1 < rawLines.length) {
      lines.push(`${line} ${rawLines[i + 1]}`);
      i++;
    } else {
      lines.push(line);
    }
  }
  // Colonnes de la semaine (« Symbol Description 19/10/2026 … 23/10/2026 ») :
  // on lit la colonne de la séance demandée, pas forcément la dernière.
  let headerDates: string[] = [];
  for (const line of lines) {
    if (/^Symbol\s+Description\b/i.test(line)) {
      headerDates = [...line.matchAll(/\d{2}\/\d{2}\/\d{4}/g)]
        .map((hit) => parseNgxDocDate(hit[0]))
        .filter((date): date is string => Boolean(date));
      continue;
    }
    const match = line.match(/^(NGX[A-Z0-9]+)\s+(.+?)\s+((?:\d{1,3}(?:,\d{3})*\.\d{2}\s*)+)$/);
    if (!match) continue;
    const code = match[1]!;
    if (seen.has(code)) continue;
    const numbers = [...match[3]!.matchAll(/\d{1,3}(?:,\d{3})*\.\d{2}/g)]
      .map((hit) => parseNumber(hit[0]))
      .filter((n): n is number => n != null && n > 0);
    if (numbers.length === 0) continue;
    const column = numbers.length === headerDates.length ? headerDates.indexOf(current.date) : -1;
    const at = column >= 0 ? column : numbers.length - 1;
    const value = numbers[at]!;
    const prior = at >= 1 ? numbers[at - 1]! : null;
    seen.add(code);
    indices.push({
      code,
      name: match[2]!.replace(/\s+/g, " ").trim(),
      value,
      previous: prior,
      changePercent: changePercent(value, prior),
    });
  }

  return {
    printDate: current.date,
    asi: {
      code: "NGX_ASI",
      name: "NGX All-Share Index",
      value: current.value,
      previous,
      changePercent: changePercent(current.value, previous),
    },
    indices,
  };
}
