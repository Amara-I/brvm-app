import { it, expect } from "vitest";
import * as XLSX from "xlsx";
import { buildBrvmWorkbook } from "./export-workbook";
import { appendNgxExport } from "./append-market-export";
it("sépare les devises et garde les absences distinctes des dividendes nuls", () => {
  const out = appendNgxExport(buildBrvmWorkbook([], [2025, 2026]), [{ ticker: "MTNN", name: "MTN", country: "Nigeria",
    sector: "Télécoms", prices: { 2026: 200 }, dividends: { 2025: 0 }, source: "NGX_OFFICIEL",
    priceAsOf: "2026-10-30", ingestedAt: "2026-10-30T17:00:00Z" }], [2025, 2026]);
  const book = XLSX.read(out, { type: "buffer" });
  expect(book.SheetNames).toEqual(["Données BRVM", "Projections", "Classements", "Données NGX"]);
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets["Données NGX"])[0];
  expect(data.Devise).toBe("NGN");
  expect(data["Cours 2025 (NGN)"]).toBe("N/D");
  expect(data["Div. 2025 (NGN)"]).toBe(0);
  expect(data["Cours 2026 (NGN)"]).toBe(200);
});
