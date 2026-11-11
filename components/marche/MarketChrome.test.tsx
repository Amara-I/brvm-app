import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import I18nProvider from "@/components/i18n/I18nProvider";
import { fr } from "@/lib/i18n/messages/fr";
import { en } from "@/lib/i18n/messages/en";
import MarketChrome from "./MarketChrome";

const render = (node: React.ReactNode, locale: "fr" | "en" = "fr") =>
  renderToStaticMarkup(
    <I18nProvider locale={locale} messages={(locale === "en" ? en : fr) as typeof fr}>
      {node}
    </I18nProvider>,
  );

const base = {
  lastUpdate: "11 nov. 2026",
  refreshing: false,
  onRefresh: () => undefined,
  companiesCount: 46,
  buySignals: 8,
  avgYield: "5,24 %",
  indexPills: [
    { code: "BRVM-C", name: "BRVM Composite", value: 215.42, changePercent: 0.35, date: "2026-11-11", source: "brvm" },
  ],
  currency: "FCFA",
  exchangeCode: "BRVM",
  exchangeName: "BRVM",
  region: "UEMOA",
};

describe("MarketChrome KPI capitalisation", () => {
  it("place l'unité (Mds FCFA / Mds ₦) sur sa propre ligne", () => {
    const brvm = render(<MarketChrome {...base} totalMktCap={21527.58} />);
    expect(brvm).toContain("Capitalisation totale");
    expect(brvm).toMatch(/kpiAmount[^"]*"[^>]*>21[\s\u00a0\u202f]527,58</);
    expect(brvm).toMatch(/kpiUnit[^"]*"[^>]*>Mds FCFA</);
    expect(brvm).not.toContain("21 527,58 Mds FCFA");

    const ngx = render(
      <MarketChrome
        {...base}
        totalMktCap={89_412.3}
        capCurrency="₦"
        currency="NGN"
        exchangeCode="NGX"
        exchangeName="NGX"
      />,
    );
    expect(ngx).toMatch(/kpiUnit[^"]*"[^>]*>Mds ₦</);
  });

  it("affiche N/D si la capitalisation est absente", () => {
    const html = render(<MarketChrome {...base} totalMktCap={0} />);
    expect(html).toContain("N/D");
    expect(html).not.toContain("Mds FCFA");
  });
});
