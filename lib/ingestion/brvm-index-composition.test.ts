import { describe, expect, it } from "vitest";
import {
  BRVM_30_AVIS_191_2026,
  fallbackBrvm30Avis191,
  parseAvisCompositionLinks,
  parseBrvm30CompositionText,
  resolveKnownTicker,
} from "./brvm-index-composition";

const KNOWN = BRVM_30_AVIS_191_2026.tickers;

describe("resolveKnownTicker", () => {
  it("corrige un OCR I/L (TILC → TTLC)", () => {
    expect(resolveKnownTicker("TILC", KNOWN)).toBe("TTLC");
    expect(resolveKnownTicker("TTLC", KNOWN)).toBe("TTLC");
    expect(resolveKnownTicker("XXXX", KNOWN)).toBeNull();
  });
});

describe("parseBrvm30CompositionText", () => {
  it("extrait 30 tickers officiels malgré le bruit OCR", () => {
    const text = `
      AVIS N 191 - 2026 / BRVM / DG
      La composition se présente comme suit :
      1- AFRICA GLOBAL LOGISTICS CI - SDSC
      2- BANK OF AFRICA BF - BOABF
      3- BANK OF AFRICA BN - BOAB
      4- BANK OF AFRICA CI - BOAC
      5- BANK OF AFRICA ML - BOAM
      6- BANK OF AFRICA NG - BOAN
      7- BANK OF AFRICA SN - BOAS
      8- BIIC BN - BICB
      9- CFAO MOTORS CI - CFAC
      10- CIE CI - CIEC
      11- CORIS BANK INTERNATIONAL BF - CBIBF
      12- ECOBANK CI - ECOC
      13- ECOBANK TRANS. INCORP. TG - ETIT
      14- ERIUM CI - SIVC
      15- EVIOSYS PACKAGING SIEM CI - SEMC
      16- NEI-CEDA CI - NEIC
      17- NSIA BANQUE CI - NSBC
      18- ORAGROUP TG - ORGT
      19- ORANGE CI - ORAC
      20- SAFCA CI - SAFC
      21- SAPH CI - SPHC
      22- SETAO CI - STAC
      23- SITAB CI - STBC
      24- SOCIETE GENERALE CI - SGBC
      25- SOCIETE IVOIRIENNE DE BANQUE CI - SIBC
      26- SOGB CI - SOGC
      27- SONATEL SN - SNTS
      28- SUCRIVOIRE CI - SCRC
      29- TOTALENERGIES MARKETING CI = TILC
      30- UNIWAX CI - UNXC
      Sociétés sortant de l'indice : FILTISAC CI = FTSC
    `;
    const tickers = parseBrvm30CompositionText(text, KNOWN);
    expect(tickers).toHaveLength(30);
    expect(tickers).toContain("TTLC");
    expect(tickers).not.toContain("FTSC");
    expect(new Set(tickers).size).toBe(30);
  });

  it("ignore un PDF binaire sans en-tête lisible", () => {
    expect(parseBrvm30CompositionText("¢(¢ SDSC ORAC xxxx", KNOWN)).toEqual([]);
  });
});

describe("fallbackBrvm30Avis191", () => {
  it("expose 30 titres officiels sans pondération", () => {
    const rows = fallbackBrvm30Avis191();
    expect(rows).toHaveLength(30);
    expect(rows.every((r) => r.weight == null && r.indexCode === "BRVM_30")).toBe(true);
    expect(rows[0]?.source).toBe("BRVM_OFFICIEL");
  });
});

describe("parseAvisCompositionLinks", () => {
  it("trouve un PDF d'avis BRVM 30", () => {
    const html = `
      <tr>
        <td><a href="/sites/default/files/20260701_-_avis_ndeg191_brvmdg_-_composition_de_lindice_brvm_30.pdf">
          Avis : Composition de l'indice BRVM 30
        </a></td>
        <td>01/07/2026</td>
      </tr>
    `;
    const links = parseAvisCompositionLinks(html);
    expect(links[0]?.href).toMatch(/avis_ndeg191/);
    expect(links[0]?.date).toBe("2026-07-01");
  });
});
