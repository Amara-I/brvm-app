import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACCRUED_COUPON_LABEL,
  combinePortfolioHeadline,
  valueOtherHolding,
} from "./other-holding-metrics";

describe("valueOtherHolding", () => {
  it("valorise une obligation au prix d’achat, puis au dernier prix saisi", () => {
    const purchase = valueOtherHolding({
      kind: "OBLIGATION",
      name: "OBL ETAT CI",
      quantity: 10,
      avgBuyPrice: 10000,
      priceMode: "FCFA",
    });
    expect(purchase.marketValue).toBe(100000);
    expect(purchase.valueBasisLabel).toBe("Prix d'achat");
    expect(purchase.accruedCoupon).toBe("N/D");

    const marked = valueOtherHolding({
      kind: "OBLIGATION",
      name: "OBL ETAT CI",
      quantity: 10,
      avgBuyPrice: 10000,
      latestValue: 10200,
      priceMode: "FCFA",
    });
    expect(marked.marketValue).toBe(102000);
    expect(marked.costBasis).toBe(100000);
    expect(marked.gainLoss).toBe(2000);
    expect(marked.valueBasisLabel).toBe("Dernier prix connu");
  });

  it("convertit un prix en % du nominal et refuse sans nominal", () => {
    const valued = valueOtherHolding({
      kind: "OBLIGATION",
      name: "OBL",
      quantity: 10,
      avgBuyPrice: 98,
      priceMode: "PERCENT",
      nominal: 10000,
    });
    expect(valued.marketValue).toBe(98000);
    expect(valued.valueBasisLabel).toBe("Prix d'achat (% du nominal)");

    const missing = valueOtherHolding({
      kind: "OBLIGATION",
      name: "OBL",
      quantity: 10,
      avgBuyPrice: 98,
      priceMode: "PERCENT",
    });
    expect(missing.marketValue).toBe("N/D");
    expect(missing.valueBasisLabel).toBe("N/D");
    expect(missing.costBasis).toBe("N/D");
  });

  it("calcule le coupon couru seulement avec taux, nominal et date d’achat", () => {
    const accrued = valueOtherHolding(
      {
        kind: "OBLIGATION",
        name: "OBL",
        quantity: 10,
        avgBuyPrice: 10000,
        nominal: 10000,
        couponRate: 6.25,
        buyDate: "2026-01-01",
      },
      "2026-07-01"
    );
    expect(accrued.accruedCoupon).toBe(3099.32);
    expect(accrued.accruedCouponLabel).toBe(ACCRUED_COUPON_LABEL);
    expect(accrued.marketValue).toBe(100000);

    const capped = valueOtherHolding(
      {
        kind: "OBLIGATION",
        name: "OBL",
        quantity: 10,
        avgBuyPrice: 10000,
        nominal: 10000,
        couponRate: 6.25,
        buyDate: "2026-01-01",
        maturityDate: "2026-02-01",
      },
      "2026-07-01"
    );
    expect(capped.accruedCoupon).toBe(530.82);

    const incomplete = valueOtherHolding(
      {
        kind: "OBLIGATION",
        name: "OBL",
        quantity: 10,
        avgBuyPrice: 10000,
        couponRate: 6.25,
        buyDate: "2026-01-01",
      },
      "2026-07-01"
    );
    expect(incomplete.accruedCoupon).toBe("N/D");
  });

  it("valorise un FCP à la VL saisie, sinon à la VL d’achat", () => {
    const purchase = valueOtherHolding({
      kind: "FCP",
      name: "FCP Horizon",
      quantity: 25,
      avgBuyPrice: 8000,
      priceMode: "PERCENT",
    });
    expect(purchase.marketValue).toBe(200000);
    expect(purchase.priceMode).toBe("FCFA");
    expect(purchase.valueBasisLabel).toBe("VL d'achat");

    const latest = valueOtherHolding({
      kind: "FCP",
      name: "FCP Horizon",
      quantity: 25,
      avgBuyPrice: 8000,
      latestValue: 10500,
    });
    expect(latest.marketValue).toBe(262500);
    expect(latest.valueBasisLabel).toBe("VL saisie");
    expect(latest.accruedCoupon).toBe("N/D");
  });
});

describe("combinePortfolioHeadline", () => {
  it("ajoute les obligations et FCP au total sans changer le calcul actions seul", () => {
    const stockOnly = combinePortfolioHeadline({ totalMarketValue: 100, totalCostBasis: 80, totalGainLoss: 20 }, []);
    expect(stockOnly.totalMarketValue).toBe(100);
    expect(stockOnly.totalGainLoss).toBe(20);
    expect(stockOnly.totalGainLossPercent).toBe(25);
    expect(stockOnly.assetTypeBreakdown).toEqual([{ type: "Actions", value: 100, weightPercent: 100 }]);

    const bond = valueOtherHolding({
      kind: "OBLIGATION",
      name: "OBL",
      quantity: 1,
      avgBuyPrice: 40,
      latestValue: 50,
    });
    const fund = valueOtherHolding({ kind: "FCP", name: "FCP", quantity: 1, avgBuyPrice: 10, latestValue: 10 });
    const mixed = combinePortfolioHeadline({ totalMarketValue: 100, totalCostBasis: 80, totalGainLoss: 20 }, [bond, fund]);
    expect(mixed.totalMarketValue).toBe(160);
    expect(mixed.totalGainLoss).toBe(30);
    expect(mixed.assetTypeBreakdown.map((slice) => slice.type)).toEqual(["Actions", "Obligations", "FCP"]);
  });
});

describe("migration portfolio_other_holdings", () => {
  const sql = readFileSync(
    path.join(process.cwd(), "prisma/migrations/20261020190000_portfolio_other_holdings/migration.sql"),
    "utf8"
  );

  it("est strictement additive", () => {
    expect(sql).toMatch(/CREATE TABLE "portfolio_other_holdings"/);
    expect(sql).toMatch(/CREATE TYPE "other_instrument_kind"/);
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bRENAME\b/i);
    expect(sql).not.toMatch(/portfolio_holdings/i);
    expect(sql).not.toMatch(/ALTER TABLE "(users|companies|price_history|portfolio_holdings|portfolio_trades)"/i);
  });
});
