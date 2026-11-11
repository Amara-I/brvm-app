import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import I18nProvider from "@/components/i18n/I18nProvider";
import { fr } from "@/lib/i18n/messages/fr";
import { en } from "@/lib/i18n/messages/en";
import ScoreBadge from "./ScoreBadge";
import SignalBadge from "./SignalBadge";
import ConfidenceDot from "./ConfidenceDot";
import ScoreSignalLegend from "./ScoreSignalLegend";

const render = (node: React.ReactNode, locale: "fr" | "en" = "fr") =>
  renderToStaticMarkup(
    <I18nProvider locale={locale} messages={(locale === "en" ? en : fr) as typeof fr}>
      {node}
    </I18nProvider>,
  );

describe("pastilles score / signal", () => {
  it("score : palier vert→rouge, valeur arrondie, N/D sans score", () => {
    const html = render(<ScoreBadge score={72.4} outOf showTier />);
    expect(html).toContain('data-tier="excellent"');
    expect(html).toContain("72/100");
    expect(html).toContain("Excellent");
    expect(html).toContain("--ob-fg:#166534");
    expect(render(<ScoreBadge score={44} />)).toContain('data-tier="average"');
    expect(render(<ScoreBadge score={null} />)).toContain("N/D");
  });

  it("signal : icône, famille et point de confiance", () => {
    const html = render(<SignalBadge label="CONSERVER" confidence="Faible" />);
    expect(html).toContain('data-family="hold"');
    expect(html).toContain("●");
    expect(html).toContain("ob-conf-dot");
    expect(html).toContain("--ob-fg:#b91c1c");
    expect(render(<SignalBadge label="VENDRE" />)).toContain("▼");
    expect(render(<SignalBadge label="ACHAT" />)).toContain('data-family="buy"');
  });

  it("confiance : point + libellé, N/D si inconnue", () => {
    expect(render(<ConfidenceDot value="Moyenne" />)).toContain("Moyenne");
    expect(render(<ConfidenceDot value={null} />)).toContain("N/D");
  });

  it("légende courte FR / EN", () => {
    const frHtml = render(<ScoreSignalLegend />);
    expect(frHtml).toContain("Bon");
    expect(frHtml).toContain("Conserver");
    const enHtml = render(<ScoreSignalLegend />, "en");
    expect(enHtml).toContain("Good");
    expect(enHtml).toContain("Confidence");
  });
});
