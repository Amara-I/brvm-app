import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { createI18n } from "@/lib/i18n/create-i18n";
import { fixtureSheetInput } from "@/lib/ngx/__fixtures__";
import { buildNgxSheet } from "@/lib/ngx/sheet-model";
vi.mock("@/lib/i18n/get-i18n", () => ({ getI18n: () => createI18n("fr") }));
vi.mock("./FinancialBars", () => ({ default: () => null }));
import NgxSheetView from "./NgxSheetView";
it.each([true, false])("garde les huit sections dans l’ordre, comptes disponibles=%s", (hasAccounts) => {
  const input = fixtureSheetInput();
  if (!hasAccounts) { input.company.ratios = []; input.company.profileMeta = {}; }
  const html = renderToStaticMarkup(<NgxSheetView model={buildNgxSheet(input)} />);
  const ids = [...html.matchAll(/<section id="ngx-([^"]+)"/g)].map((m) => m[1]);
  expect(ids).toEqual(["presentation", "performance", "outlook", "price", "valuation", "sector", "dividends", "conclusion"]);
  expect(html).not.toContain("NaN");
  if (!hasAccounts) expect(html).toContain("N/D");
});
