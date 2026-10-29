import { describe, expect, it } from "vitest";
import type { AdjustmentAction } from "@/lib/corporate-actions/types";
import {
  buildDividendCalendar,
  compareDividendRows,
  topYieldByCompany,
  yieldPercent,
  type DividendCalendarDbRow,
} from "./dividend-calendar-build";

function row(over: Partial<DividendCalendarDbRow>): DividendCalendarDbRow {
  return {
    id: "dv-1",
    companyId: "c-sgbc",
    year: 2025,
    amount: 2000,
    exDate: null,
    paymentDate: null,
    source: "SIKAFINANCE",
    ticker: "SGBC",
    name: "Société Générale CI",
    sector: "Finance",
    country: "Côte d'Ivoire",
    countryFlag: "🇨🇮",
    ...over,
  };
}

const TODAY = "2026-10-29";
const prices = (close: number, date = "2026-10-28") => new Map([["c-sgbc", { close, date }]]);

describe("yieldPercent", () => {
  it("rapporte le dividende au cours", () => {
    expect(yieldPercent(2000, 25000)).toBe(8);
    expect(yieldPercent(1740, 29000)).toBe(6);
  });
  it("renvoie null sans cours ou sans montant", () => {
    expect(yieldPercent(2000, null)).toBeNull();
    expect(yieldPercent(2000, 0)).toBeNull();
    expect(yieldPercent(0, 100)).toBeNull();
  });
});

describe("compareDividendRows", () => {
  const official = { source: "BRVM_OFFICIEL", exDate: null, paymentDate: null };
  const datedSika = { source: "SIKAFINANCE", exDate: "2026-05-10", paymentDate: null };
  const sika = { source: "SIKAFINANCE", exDate: null, paymentDate: null };
  const manual = { source: "MANUEL", exDate: null, paymentDate: null };
  const datedManual = { source: "MANUEL", exDate: null, paymentDate: "2026-05-20" };

  it("classe : BRVM officiel, puis lignes datées, puis Sikafinance, puis saisie manuelle", () => {
    const sorted = [manual, sika, datedManual, official, datedSika].sort(compareDividendRows);
    expect(sorted).toEqual([official, datedSika, datedManual, sika, manual]);
  });
});

describe("buildDividendCalendar", () => {
  it("renvoie un jeu vide sans ligne", () => {
    const d = buildDividendCalendar({ rows: [], dateRows: [], today: TODAY });
    expect(d.events).toEqual([]);
    expect(d.companies).toBe(0);
    expect(d.priceDate).toBeNull();
  });

  it("ajoute exercice, dernier cours et rendement", () => {
    const d = buildDividendCalendar({
      rows: [row({ amount: 2000, paymentDate: "2026-06-10" })],
      dateRows: [],
      prices: prices(25000),
      today: TODAY,
    });
    const ev = d.events[0];
    expect(ev.year).toBe(2025);
    expect(ev.close).toBe(25000);
    expect(ev.yieldPercent).toBe(8);
    expect(d.priceDate).toBe("2026-10-28");
    expect(d.companies).toBe(1);
  });

  it("laisse rendement et cours à null sans cours (N/D)", () => {
    const ev = buildDividendCalendar({ rows: [row({})], dateRows: [], today: TODAY }).events[0];
    expect(ev.close).toBeNull();
    expect(ev.yieldPercent).toBeNull();
  });

  it("garde une seule ligne par société et exercice : la source officielle prime", () => {
    const d = buildDividendCalendar({
      rows: [
        row({ id: "manual", source: "MANUEL", amount: 1900 }),
        row({ id: "sika", source: "SIKAFINANCE", amount: 2000, exDate: "2026-05-10" }),
        row({ id: "official", source: "BRVM_OFFICIEL", amount: 2000 }),
      ],
      dateRows: [],
      today: TODAY,
    });
    expect(d.events).toHaveLength(1);
    expect(d.events[0].id).toBe("official");
    expect(d.events[0].source).toBe("BRVM officiel");
  });

  it("sans ligne officielle, une ligne datée passe avant Sikafinance non datée, puis la saisie manuelle", () => {
    const d = buildDividendCalendar({
      rows: [
        row({ id: "manual", source: "MANUEL" }),
        row({ id: "sika", source: "SIKAFINANCE" }),
        row({ id: "datedManual", source: "MANUEL", paymentDate: "2026-06-10" }),
      ],
      dateRows: [],
      today: TODAY,
    });
    expect(d.events.map((e) => e.id)).toEqual(["datedManual"]);
    const noDates = buildDividendCalendar({
      rows: [row({ id: "manual", source: "MANUEL" }), row({ id: "sika", source: "SIKAFINANCE" })],
      dateRows: [],
      today: TODAY,
    });
    expect(noDates.events.map((e) => e.id)).toEqual(["sika"]);
    expect(noDates.events[0].source).toBe("Sikafinance");
  });

  it("libellés de source : BRVM officiel, Sikafinance, Saisie manuelle", () => {
    const d = buildDividendCalendar({
      rows: [
        row({ id: "a", year: 2025, source: "BRVM_OFFICIEL" }),
        row({ id: "b", year: 2024, source: "SIKAFINANCE" }),
        row({ id: "c", year: 2023, source: "MANUEL" }),
      ],
      dateRows: [],
      today: TODAY,
    });
    const byId = Object.fromEntries(d.events.map((e) => [e.id, e.source]));
    expect(byId).toEqual({ a: "BRVM officiel", b: "Sikafinance", c: "Saisie manuelle" });
  });

  it("la ligne affichée garde ses dates ; une date absente est reprise d'une ligne sœur", () => {
    const d = buildDividendCalendar({
      rows: [row({ id: "official", source: "BRVM_OFFICIEL", exDate: null, paymentDate: "2026-06-10" })],
      dateRows: [
        { companyId: "c-sgbc", year: 2025, exDate: "2026-06-05", paymentDate: "2026-06-12", source: "SIKAFINANCE" },
        { companyId: "c-sgbc", year: 2025, exDate: null, paymentDate: "2026-06-12", source: "RICHBOURSE" },
        { companyId: "c-other", year: 2025, exDate: "2020-01-01", paymentDate: null, source: "SIKAFINANCE" },
      ],
      today: TODAY,
    });
    expect(d.events[0].paymentDate).toBe("2026-06-10");
    expect(d.events[0].exDate).toBe("2026-06-05");
    expect(d.events[0].precision).toBe("payment");
  });

  it("place les dividendes sans date au 31/12 de l'exercice et compte dates / sans date / à venir", () => {
    const d = buildDividendCalendar({
      rows: [
        row({ id: "a", year: 2025, paymentDate: "2026-12-10" }),
        row({ id: "b", year: 2024, paymentDate: "2025-06-10" }),
        row({ id: "c", year: 2023 }),
      ],
      dateRows: [],
      today: TODAY,
    });
    expect(d.events.find((e) => e.id === "c")?.displayDate).toBe("2023-12-31");
    expect(d.datedCount).toBe(2);
    expect(d.exerciceOnlyCount).toBe(1);
    expect(d.upcomingCount).toBe(1);
    expect(d.years).toEqual([2025, 2024, 2023]);
    expect(d.calendarYears).toEqual([2026, 2025, 2023]);
  });

  it("ajuste montant et cours d'un fractionnement : le rendement ne change pas", () => {
    const split = {
      ticker: "SGBC",
      kind: "SPLIT",
      effectiveDate: "2026-06-01",
      factor: 2,
      oldShares: 1,
      newShares: 2,
      adjustPrices: true,
      label: "2:1",
      sharesOutstandingBefore: null,
      sourceUrl: null,
    } as AdjustmentAction;
    const ev = buildDividendCalendar({
      rows: [row({ amount: 2000, exDate: "2026-05-01", paymentDate: "2026-05-10" })],
      dateRows: [],
      actions: new Map([["SGBC", [split]]]),
      prices: prices(25000, "2026-05-15"),
      today: TODAY,
    }).events[0];
    expect(ev.amount).toBe(1000);
    expect(ev.close).toBe(12500);
    expect(ev.yieldPercent).toBe(8);
  });

  it("ignore les montants nuls ou invalides", () => {
    const d = buildDividendCalendar({
      rows: [row({ id: "z", amount: 0 }), row({ id: "n", year: 2024, amount: Number.NaN })],
      dateRows: [],
      today: TODAY,
    });
    expect(d.events).toEqual([]);
  });
});

describe("topYieldByCompany", () => {
  it("retient le dernier dividende de chaque société puis le meilleur rendement", () => {
    const p = new Map([
      ["c-a", { close: 1000, date: "2026-10-28" }],
      ["c-b", { close: 1000, date: "2026-10-28" }],
    ]);
    const d = buildDividendCalendar({
      rows: [
        row({ id: "a25", companyId: "c-a", ticker: "AAA", year: 2025, amount: 50 }),
        row({ id: "a24", companyId: "c-a", ticker: "AAA", year: 2024, amount: 400 }),
        row({ id: "b25", companyId: "c-b", ticker: "BBB", year: 2025, amount: 80 }),
      ],
      dateRows: [],
      prices: p,
      today: TODAY,
    });
    const top = topYieldByCompany(d.events);
    expect(top?.ticker).toBe("BBB");
    expect(top?.yieldPercent).toBe(8);
  });
  it("renvoie null sans rendement calculable", () => {
    const d = buildDividendCalendar({ rows: [row({})], dateRows: [], today: TODAY });
    expect(topYieldByCompany(d.events)).toBeNull();
  });
});
