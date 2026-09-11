import { describe, expect, it } from "vitest";
import { millionsFcfaToMds, parseSikaCompanySheetHtml } from "./sika-company-sheet-parser";

const SNTS_SHEET = `
<html><body>
  <div class="innerUpu">SN0000000019 - SNTS</div>
  <p class="alj"><b>La société : </b>La Société Nationale des Télécommunications du Sénégal (SONATEL), premier opérateur.</p>
  <p><b>Téléphone : </b>(+221) 33-839-12-00</p>
  <p><b>Fax : </b>(+221) 33-839-12-12</p>
  <p><b>Adresse : </b>6 Rue WAGANE DIOUF, Sénégal</p>
  <p><b>Dirigeants : </b>Directeur Général : Brelotte BA</p>
  <p><b>Nombre de titres : </b> 100&nbsp;000&nbsp;000</p>
  <p><b>Flottant : </b> 22,47%</p>
  <p><b>Valorisation de la société : </b> 3&nbsp;930&nbsp;000 MFCFA</p>
  <span class="no" id="lstActionnaires">FRANCE TELECOM*42,3;ETAT DU SENEGAL*27,7;PUBLIC (BRVM)*20;EMPLOYES SONATEL*10</span>
  <span class="f11">Les chiffres sont en millions de FCFA</span>
  <table class="tabSociete">
    <thead>
      <tr><th></th><th>2024</th><th>2025</th></tr>
    </thead>
    <tbody>
      <tr><td>Chiffre d'affaires</td><td>1&nbsp;776&nbsp;443</td><td>1&nbsp;923&nbsp;122</td></tr>
      <tr><td>Croissance CA</td><td>9,61%</td><td>8,26%</td></tr>
      <tr><td>Résultat net</td><td>393&nbsp;662</td><td>413&nbsp;588</td></tr>
      <tr><td>PER</td><td>9,98</td><td>9,50</td></tr>
      <tr><td>Dividende</td><td>1&nbsp;655,00</td><td>1&nbsp;740,00</td></tr>
    </tbody>
  </table>
</body></html>
`;

describe("millionsFcfaToMds", () => {
  it("convertit les millions Sika vers l'unité Mds du schéma", () => {
    expect(millionsFcfaToMds(1_923_122)).toBe(1923.12);
    expect(millionsFcfaToMds(1000)).toBe(1);
  });
});

describe("parseSikaCompanySheetHtml", () => {
  const parsed = parseSikaCompanySheetHtml(SNTS_SHEET, "snts", "2026-09-11T00:00:00.000Z", new Date("2026-09-11T00:00:00Z"));

  it("extrait ISIN, profil et actionnaires", () => {
    expect(parsed.profile.isin).toBe("SN0000000019");
    expect(parsed.profile.sharesOutstanding).toBe(100_000_000);
    expect(parsed.profile.floatPercent).toBe(22.47);
    expect(parsed.profile.shareholders).toHaveLength(4);
    expect(parsed.profile.shareholders[0]).toEqual({ name: "FRANCE TELECOM", percent: 42.3 });
    expect(parsed.profile.valuationLabel).toMatch(/3 930 000/);
    const cap = parsed.fundamentals.find((f) => f.year === 2026);
    expect(cap?.mktCapMds).toBe(3930);
  });

  it("persiste CA/RN en Mds uniquement grâce à la mention millions de FCFA", () => {
    const y2025 = parsed.fundamentals.find((f) => f.year === 2025);
    expect(y2025?.revenue).toBe(1923.12);
    expect(y2025?.netIncome).toBe(413.59);
    expect(y2025?.per).toBe(9.5);
    expect(y2025?.revenueGrowth).toBe(8.26);
    expect(y2025?.mktCapMds).toBeNull();
    expect(y2025?.netMargin).toBeCloseTo(21.51, 1);
  });

  it("extrait les dividendes annuels tels quels (FCFA / action)", () => {
    expect(parsed.dividends.map((d) => [d.year, d.amount])).toEqual([
      [2024, 1655],
      [2025, 1740],
    ]);
  });

  it("n'invente pas CA/RN si l'unité n'est pas publiée", () => {
    const html = SNTS_SHEET.replace("Les chiffres sont en millions de FCFA", "");
    const { fundamentals } = parseSikaCompanySheetHtml(html, "SNTS", "2026-09-11T00:00:00.000Z");
    expect(fundamentals.every((f) => f.revenue == null && f.netIncome == null)).toBe(true);
    expect(fundamentals.some((f) => f.per === 9.5)).toBe(true);
  });
});
