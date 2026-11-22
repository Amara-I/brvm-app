import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import I18nProvider from "@/components/i18n/I18nProvider";
import { fr } from "@/lib/i18n/messages/fr";
import { en } from "@/lib/i18n/messages/en";

let mockPath = "/marche";
vi.mock("next/navigation", () => ({ usePathname: () => mockPath }));

import MobileBottomNav from "./MobileBottomNav";

const render = (locale: "fr" | "en" = "fr", menuOpen = false) =>
  renderToStaticMarkup(
    <I18nProvider locale={locale} messages={(locale === "en" ? en : fr) as typeof fr}>
      <MobileBottomNav menuOpen={menuOpen} onToggleMenu={() => undefined} />
    </I18nProvider>,
  );

describe("MobileBottomNav", () => {
  it("affiche les 4 destinations et le bouton Menu", () => {
    mockPath = "/marche";
    const html = render();
    for (const href of ["/marche", "/screener", "/graphes", "/portefeuille"]) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).toContain("Marché");
    expect(html).toContain("Menu");
    expect(html).toContain('aria-label="Navigation mobile"');
  });

  it("marque la page courante, y compris les sous-pages", () => {
    mockPath = "/graphes/SNTS";
    const html = render();
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/href="\/graphes"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/graphes"/);
  });

  it("ne marque aucun lien sur une page hors barre", () => {
    mockPath = "/actualites";
    expect(render()).not.toContain('aria-current="page"');
  });

  it("le bouton Menu reflète l'état du tiroir", () => {
    mockPath = "/marche";
    expect(render("fr", true)).toContain('aria-expanded="true"');
    expect(render("fr", false)).toContain('aria-expanded="false"');
  });

  it("est traduit en anglais", () => {
    mockPath = "/marche";
    const html = render("en");
    expect(html).toContain("Market");
    expect(html).toContain("Portfolio");
    expect(html).toContain('aria-label="Mobile navigation"');
  });
});
