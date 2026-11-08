import { describe, expect, it } from "vitest";
import { assembleSiteSearchCatalog } from "./catalog";
import { parseSearchCatalog, stockDocument } from "./documents";
import { educationDocuments } from "./education-documents";
import { applySearchKey, isSearchShortcut, searchSite } from "./match";
import { pageDocuments } from "./pages";
import { companyHref, indexHref } from "./routes";

const companies = [
  { ticker: "SGBC", name: "Société Générale de Banques", sector: "Banques", exchange: "BRVM" },
  { ticker: "BNBC", name: "Bernabé", sector: "Distribution", exchange: "BRVM" },
  { ticker: "MTNN", name: "MTN Nigeria", sector: "Télécoms", exchange: "NGX" },
  { ticker: "NPN", name: "Naspers", sector: "Tech", exchange: "JSE" },
];

const indices = [
  { code: "BRVM_COMPOSITE", name: "BRVM Composite", exchange: "BRVM" },
  { code: "NGX_ASI", name: "NGX All-Share", exchange: "NGX" },
];

describe("routes par place", () => {
  it("envoie BRVM vers les URLs historiques et les autres places vers /marches", () => {
    expect(companyHref({ ticker: "SNTS" })).toBe("/actions/SNTS");
    expect(companyHref({ ticker: "MTNN", exchange: "NGX" })).toBe("/marches/ngx/actions/MTNN");
    expect(companyHref({ ticker: "NPN", exchange: "jse" })).toBe("/marches/jse/actions/NPN");
    expect(indexHref({ code: "BRVM_COMPOSITE", exchange: "BRVM" })).toBe("/indices/BRVM_COMPOSITE");
    expect(indexHref({ code: "NGX_ASI", exchange: "NGX" })).toBe("/marches/ngx/indices/NGX_ASI");
    expect(indexHref({ code: "JSE_ALSI", exchange: "JSE" })).toBe("/marches/jse/indices/JSE_ALSI");
  });
});

describe("recherche sur tout le site", () => {
  const catalog = assembleSiteSearchCatalog(companies, indices);

  it("ignore accents et casse sur le nom de société", () => {
    const bernabe = searchSite(catalog, "bernabe").flatMap((group) => group.items);
    expect(bernabe[0]?.code).toBe("BNBC");
    expect(bernabe[0]?.href).toBe("/actions/BNBC");
    const generale = searchSite(catalog, "societe generale").flatMap((group) => group.items);
    expect(generale.some((hit) => hit.code === "SGBC" && hit.href === "/actions/SGBC")).toBe(true);
  });

  it("groupe actions, indices, éducation et pages, places dérivées des documents", () => {
    const groups = searchSite(catalog, "ngx");
    const kinds = groups.map((group) => group.kind);
    expect(kinds.indexOf("stock")).toBeLessThan(kinds.indexOf("index"));
    expect(kinds.indexOf("index")).toBeLessThan(kinds.indexOf("page"));
    const stock = groups.find((group) => group.kind === "stock" && group.exchange === "NGX");
    expect(stock?.items[0]?.href).toBe("/marches/ngx/actions/MTNN");
    const index = groups.find((group) => group.kind === "index" && group.exchange === "NGX");
    expect(index?.items.some((hit) => hit.href === "/marches/ngx/indices/NGX_ASI")).toBe(true);
    expect(groups.some((group) => group.exchange === "JSE" || group.items.some((hit) => hit.exchange === "JSE"))).toBe(false);
  });

  it("trouve une place absente des catalogues historiques", () => {
    const groups = searchSite(catalog, "naspers");
    expect(groups.map((group) => group.exchange)).toContain("JSE");
    expect(groups[0]?.items[0]?.href).toBe("/marches/jse/actions/NPN");
    expect(pageDocuments(["ASE"]).some((page) => page.href === "/marches/ase")).toBe(true);
    expect(pageDocuments(["ASE"]).some((page) => page.href === "/marches/ase/indices")).toBe(true);
  });

  it("ne laisse pas un grand univers d'actions en masquer un autre", () => {
    const crowded = [
      ...Array.from({ length: 20 }, (_, index) =>
        stockDocument({ ticker: `B${index}`, name: `Banque ${index}`, sector: "Banques", exchange: "BRVM" }),
      ),
      stockDocument({ ticker: "MTNN", name: "Banque Nigeria", sector: "Banques", exchange: "NGX" }),
      stockDocument({ ticker: "NPN", name: "Banque Johannesburg", sector: "Banques", exchange: "JSE" }),
    ];
    expect(searchSite(crowded, "banque").map((group) => [group.exchange, group.items.length])).toEqual([
      ["BRVM", 5],
      ["JSE", 1],
      ["NGX", 1],
    ]);
  });

  it("trouve indices, leçons, guides de portefeuille, outils et pages de marché", () => {
    expect(searchSite(catalog, "composite").some((group) => group.items.some((hit) => hit.href === "/indices/BRVM_COMPOSITE"))).toBe(true);
    expect(searchSite(catalog, "all-share").some((group) => group.items.some((hit) => hit.href === "/marches/ngx/indices/NGX_ASI"))).toBe(true);

    const lessons = educationDocuments();
    expect(
      searchSite(lessons, "portefeuille rente").some((group) =>
        group.items.some((hit) => hit.href === "/education/types-de-portefeuille/portefeuille-rente"),
      ),
    ).toBe(true);
    const per = searchSite(lessons, "PER").flatMap((group) => group.items);
    expect(per[0]?.href).toBe("/education/valorisation/per-price-earnings-ratio");
    expect(per.some((hit) => hit.href.includes("performance-ytd"))).toBe(false);
    expect(
      searchSite(lessons, "gestion du risque").some((group) => group.items.some((hit) => hit.href.includes("gestion-du-risque"))),
    ).toBe(true);

    const pages = pageDocuments([]);
    const dividendPages = searchSite(pages, "dividende").flatMap((group) => group.items);
    expect(dividendPages.some((hit) => hit.href === "/calendrier-dividendes")).toBe(true);
    expect(dividendPages.some((hit) => hit.href === "/screener")).toBe(false);
    expect(searchSite(pages, "taille de position").some((group) => group.items.some((hit) => hit.href === "/outils/taille-position"))).toBe(true);
    expect(searchSite(pages, "screener ngx").some((group) => group.items.some((hit) => hit.href === "/marches/ngx/screener"))).toBe(true);
    expect(searchSite(pages, "graphiques").some((group) => group.items.some((hit) => hit.href === "/graphes"))).toBe(true);
  });

  it("sans requête, n'affiche que des actions, plafonnées par place", () => {
    const groups = searchSite(catalog, "");
    expect(groups.every((group) => group.kind === "stock")).toBe(true);
    expect(groups.map((group) => group.exchange)).toEqual(["BRVM", "JSE", "NGX"]);
  });
});

describe("catalogue HTTP", () => {
  it("rejette un lien qui n'est pas une route interne", () => {
    const parsed = parseSearchCatalog({
      data: {
        documents: [
          { id: "ok", kind: "page", title: "Outils", href: "/outils" },
          { id: "bad", kind: "page", title: "Ext", href: "https://example.com" },
          { id: "bad2", kind: "nope", title: "X", href: "/x" },
        ],
      },
    });
    expect(parsed?.map((doc) => doc.id)).toEqual(["ok"]);
  });
});

describe("clavier", () => {
  it("déplace, valide et ferme", () => {
    expect(applySearchKey({ key: "ArrowDown", index: 0, count: 3 })).toEqual({ type: "move", index: 1 });
    expect(applySearchKey({ key: "ArrowDown", index: 2, count: 3 })).toEqual({ type: "move", index: 2 });
    expect(applySearchKey({ key: "ArrowUp", index: 0, count: 3 })).toEqual({ type: "move", index: 0 });
    expect(applySearchKey({ key: "Enter", index: 1, count: 3 })).toEqual({ type: "select", index: 1 });
    expect(applySearchKey({ key: "Escape", index: 1, count: 3 })).toEqual({ type: "close" });
    expect(applySearchKey({ key: "Enter", index: 0, count: 0 })).toEqual({ type: "ignore" });
  });

  it("garde le raccourci / hors des champs de saisie", () => {
    expect(isSearchShortcut({ key: "/", targetTag: "DIV" })).toBe(true);
    expect(isSearchShortcut({ key: "/", targetTag: "INPUT" })).toBe(false);
    expect(isSearchShortcut({ key: "k", metaKey: true, targetTag: "BODY" })).toBe(true);
    expect(isSearchShortcut({ key: "/", ctrlKey: true })).toBe(false);
  });
});
