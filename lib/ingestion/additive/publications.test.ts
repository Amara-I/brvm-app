import { expect, it } from "vitest";
import { officialUrl, publishedDate, parseBrvmPublications, parseNgxPublications, nextBrvmPage } from "./publications";
it("refuse liens étrangers, credentials et dates calendaires fausses", () => {
  expect(officialUrl("https://www.brvm.org.evil.test/a", "https://www.brvm.org", "www.brvm.org")).toBeNull();
  expect(officialUrl("https://user:pass@www.brvm.org/a", "https://www.brvm.org", "www.brvm.org")).toBeNull();
  expect(publishedDate("31/02/2026")).toBeNull();
  expect(publishedDate("13/10/2026")).toBe("2026-10-13");
});
it("lit le tableau et non les bandeaux ; préfère le PDF et garde la date manquante", () => {
  const rows = parseBrvmPublications(`<a href='/cours'>SONATEL</a><table><tbody><tr><td><a href='/rapport'>SONATEL SN : Etats financiers Exercice 2025</a></td><td><a href='/rapport.pdf'>Télécharger</a></td></tr></tbody></table>`, "https://www.brvm.org/fr/rapports-societe-cotes/sonatel", "SNTS", (s) => s === "SONATEL SN" ? "SNTS" : null);
  expect(rows).toHaveLength(1); expect(rows[0].url).toBe("https://www.brvm.org/rapport.pdf"); expect(rows[0].periodLabel).toBe("2025"); expect(rows[0].publishedAt).toBeNull();
});
it("n’attribue pas à Sonatel une ligne Onatel présente dans son catalogue officiel", () => {
  const rows = parseBrvmPublications(`<table><tbody><tr><td><a href='/rapport'>ONATEL BF : Rapport 2022</a></td></tr></tbody></table>`, "https://www.brvm.org", "SNTS", () => "ONTBF");
  expect(rows).toEqual([]);
});
it("lit les communiqués NGX avec la date du dépôt et sans exercice inventé", () => {
  const rows = parseNgxPublications([{ URL: { Description: "AGM Notice", Url: "https://doclib.ngxgroup.com/notice.pdf" }, Created: "2026-03-20T10:00:00Z", CompanyName: "MTN", CompanySymbol: "MTNN", Type_of_Submission: "Corporate Actions" }], "MTNN");
  expect(rows[0].publishedAt).toBe("2026-03-20T10:00:00.000Z"); expect(rows[0].periodLabel).toBeNull();
});
it("ne suit que la pagination officielle même domaine", () => {
  expect(nextBrvmPage(`<li class='pager-next'><a href='?page=1'>suivant</a></li>`, "https://www.brvm.org/fr/rapports")).toBe("https://www.brvm.org/fr/rapports?page=1");
});

it("suit la pagination Bootstrap réellement publiée par la BRVM", () => {
  expect(nextBrvmPage(`<ul class='pagination'><li class='next'><a href='?page=1'>suivant</a></li></ul>`, "https://www.brvm.org/fr/rapports-societes-cotees")).toBe("https://www.brvm.org/fr/rapports-societes-cotees?page=1");
});

it("lit un titre BRVM non cliquable avec un simple lien Télécharger", () => {
  const rows = parseBrvmPublications(`<table><tbody><tr><td>SONATEL SN : Etats financiers Exercice 2025</td><td><a href='/sites/default/files/rapport.pdf'>Télécharger</a></td></tr></tbody></table>`, "https://www.brvm.org", "SNTS", s => s === "SONATEL SN" ? "SNTS" : null);
  expect(rows).toHaveLength(1); expect(rows[0].url).toContain("rapport.pdf");
});
