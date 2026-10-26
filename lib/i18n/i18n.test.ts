import { describe, expect, it } from "vitest";
import { negotiateLocale } from "./config";
import { displayReason, displaySignal } from "./labels";
import { diffMessageKeys } from "./message-keys";
import { en } from "./messages/en";
import { fr } from "./messages/fr";
import type { SignalReason } from "@/lib/calc/calc-metrics";

describe("négociation de langue", () => {
  it("reste en français par défaut", () => {
    expect(negotiateLocale(null)).toBe("fr");
    expect(negotiateLocale("")).toBe("fr");
    expect(negotiateLocale("fr-FR,fr;q=0.9,en;q=0.8")).toBe("fr");
    expect(negotiateLocale("en;q=0.5,fr;q=0.5")).toBe("fr");
  });

  it("choisit l'anglais quand il est strictement préféré", () => {
    expect(negotiateLocale("en-US,en;q=0.9")).toBe("en");
    expect(negotiateLocale("en-GB,fr;q=0.4")).toBe("en");
  });
});

describe("dictionnaires FR / EN", () => {
  it("aligne les clés et refuse les traductions vides ou oubliées", () => {
    expect(diffMessageKeys(fr, en)).toEqual([]);
  });
});

describe("libellés financiers", () => {
  it("conserve les signaux français et les traduit en anglais", () => {
    expect(displaySignal("ACHAT FORT", "fr")).toBe("ACHAT FORT");
    expect(displaySignal("ACHAT FORT", "en")).toBe("STRONG BUY");
    expect(displaySignal("VENDRE", "en")).toBe("SELL");
    expect(displaySignal("N/D", "en")).toBe("N/D");
  });

  it("affiche la phrase française telle quelle et une phrase anglaise à partir du code", () => {
    const reason: SignalReason = {
      kind: "positif",
      code: "per.low",
      text: "PER bas (8,50) : valorisation attractive.",
      params: { per: 8.5 },
    };
    expect(displayReason(reason, "fr")).toBe(reason.text);
    expect(displayReason(reason, "en")).toBe("Low P/E (8.50): attractive valuation.");
  });
});
