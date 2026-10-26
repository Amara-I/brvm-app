import { describe, expect, it } from "vitest";
import { displayPosition, operationDateFromTrade } from "./positions";
import type { AdjustmentAction } from "./types";

const snts: AdjustmentAction = {
  ticker: "SNTS",
  kind: "SPLIT",
  effectiveDate: "2026-10-26",
  factor: 10,
  oldShares: 1,
  newShares: 10,
  adjustPrices: true,
  label: "Fractionnement 1:10 le 26/10/2026",
};

describe("positions SNTS", () => {
  it("multiplie la quantité et divise le PRU sans changer le coût", () => {
    const shown = displayPosition(
      {
        quantity: 10,
        avgBuyPrice: 40000,
        createdAt: "2024-03-01T00:00:00.000Z",
        targetPrice: 50000,
        stopPrice: 30000,
      },
      [{ side: "ACHAT", quantity: 10, price: 40000, tradedAt: "2024-03-01" }],
      [snts]
    );
    expect(shown.quantity).toBe(100);
    expect(shown.avgBuyPrice).toBe(4000);
    expect(shown.quantity * shown.avgBuyPrice).toBe(400000);
    expect(shown.targetPrice).toBe(5000);
    expect(shown.stopPrice).toBe(3000);
  });

  it("ne double pas un relevé SGI arrêté après le split", () => {
    const notes = "Import relevé SGI · SGI-CI · arrêté au 27/10/2026";
    expect(operationDateFromTrade({ tradedAt: "2024-03-01", notes })).toBe("2026-10-27");
    const shown = displayPosition(
      { quantity: 100, avgBuyPrice: 4000, createdAt: "2026-10-27T12:00:00.000Z" },
      [{ side: "ACHAT", quantity: 100, price: 4000, tradedAt: "2024-03-01", notes }],
      [snts]
    );
    expect(shown.quantity).toBe(100);
    expect(shown.avgBuyPrice).toBe(4000);
    expect(shown.quantityFactor).toBe(1);
  });

  it("ajuste un relevé arrêté avant le split", () => {
    const shown = displayPosition(
      { quantity: 10, avgBuyPrice: 40000, createdAt: "2026-09-30T00:00:00.000Z" },
      [
        {
          side: "ACHAT",
          quantity: 10,
          price: 40000,
          tradedAt: "2024-03-01",
          notes: "Import relevé SGI · arrêté au 30/09/2026",
        },
      ],
      [snts]
    );
    expect(shown.quantity).toBe(100);
    expect(shown.avgBuyPrice).toBe(4000);
  });
});
