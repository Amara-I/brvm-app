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
  for (const line of text.split(/\r?\n/)) {
    const match = line
      .trim()
      .match(/^(NGX[A-Z0-9]+)\s+(.+?)\s+((?:\d{1,3}(?:,\d{3})*\.\d{2}\s*)+)$/);
    if (!match) continue;
    const code = match[1]!;
    if (seen.has(code)) continue;
    const numbers = [...match[3]!.matchAll(/\d{1,3}(?:,\d{3})*\.\d{2}/g)]
      .map((hit) => parseNumber(hit[0]))
      .filter((n): n is number => n != null && n > 0);
    if (numbers.length === 0) continue;
    const value = numbers[numbers.length - 1]!;
    const prior = numbers.length >= 2 ? numbers[numbers.length - 2]! : null;
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
