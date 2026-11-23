import { describe, expect, it } from "vitest";
import { cleanNewsTitle, isHttpUrl, newsSlug, toNewsRows } from "./normalize";

const NOW = new Date("2026-11-23T12:00:00Z");
const co = { id: "c1", ticker: "SNTS" };

describe("cleanNewsTitle", () => {
  it("compacte les espaces et tronque", () => {
    expect(cleanNewsTitle("  Sonatel \n  publie   ses résultats ")).toBe("Sonatel publie ses résultats");
    expect(cleanNewsTitle("a".repeat(400))).toHaveLength(300);
  });
});

describe("isHttpUrl", () => {
  it("n'accepte que http(s)", () => {
    expect(isHttpUrl("https://www.sikafinance.com/marches/x-1")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("pas une url")).toBe(false);
  });
});

describe("newsSlug", () => {
  it("est stable et dépend du ticker et de l'URL", () => {
    expect(newsSlug("SNTS", "https://a/1")).toBe(newsSlug("SNTS", "https://a/1"));
    expect(newsSlug("SNTS", "https://a/1")).not.toBe(newsSlug("SNTS", "https://a/2"));
    expect(newsSlug("SNTS", "https://a/1")).not.toBe(newsSlug("ORAC", "https://a/1"));
    expect(newsSlug("SNTS", "https://a/1")).toMatch(/^snts-[0-9a-f]{12}$/);
  });
});

describe("toNewsRows", () => {
  const item = (title: string, url: string, publishedAt: string | null = null) => ({
    title,
    url,
    sourceName: "Sikafinance",
    publishedAt,
  });

  it("filtre titres courts, URL invalides et doublons", () => {
    const rows = toNewsRows(
      co,
      [
        item("Sonatel : résultats du troisième trimestre", "https://x/1"),
        item("Sonatel : résultats du troisième trimestre", "https://x/1"),
        item("court", "https://x/2"),
        item("Titre valide mais URL dangereuse", "javascript:1"),
      ],
      NOW
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ companyId: "c1", sourceName: "Sikafinance", publishedAt: NOW });
  });

  it("garde la date de la source si valide et non future, sinon la date de collecte", () => {
    const rows = toNewsRows(
      co,
      [
        item("Une actualité datée du 20 novembre", "https://x/a", "2026-11-20T08:00:00Z"),
        item("Une actualité datée dans le futur", "https://x/b", "2027-01-01T00:00:00Z"),
        item("Une actualité avec date illisible", "https://x/c", "hier"),
      ],
      NOW
    );
    expect(rows[0].publishedAt.toISOString()).toBe("2026-11-20T08:00:00.000Z");
    expect(rows[1].publishedAt).toEqual(NOW);
    expect(rows[2].publishedAt).toEqual(NOW);
  });
});
