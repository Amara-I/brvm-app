import { describe, expect, it, vi } from "vitest";
import {
  clampLimit,
  groupByKeyDateDesc,
  latestCanonicalIndexValueIdsSql,
  latestCanonicalPriceIdsSql,
  loadLatestCanonicalIndexValues,
  loadLatestCanonicalPrice,
  loadLatestCanonicalPrices,
  loadYearEndCanonicalPrices,
  utcDay,
  yearEndCanonicalPriceIdsSql,
} from "./latest-canonical";

const flat = (sql: string) => sql.replace(/\s+/g, " ").trim();
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("latestCanonicalPriceIdsSql", () => {
  it("LATERAL … LIMIT n sur les lignes canoniques, ids dédoublonnés", () => {
    const q = latestCanonicalPriceIdsSql(["a", "b", "a", ""], { limit: 2 });
    const sql = flat(q.text);
    expect(sql).toContain("FROM unnest($1::text[]) AS c(id) CROSS JOIN LATERAL");
    expect(sql).toContain("WHERE ph.company_id = c.id AND ph.is_canonical = true");
    expect(sql).toContain("ORDER BY ph.date DESC LIMIT $2");
    expect(q.values).toEqual([["a", "b"], 2]);
  });

  it("bornes de date en jours UTC (lte / lt)", () => {
    const q = latestCanonicalPriceIdsSql(["a"], {
      onOrBefore: new Date("2026-11-15T23:30:00.000Z"),
      before: new Date(Date.UTC(2026, 0, 1)),
    });
    const sql = flat(q.text);
    expect(sql).toContain("AND ph.date <= $2::date AND ph.date < $3::date");
    expect(q.values).toEqual([["a"], "2026-11-15", "2026-01-01", 1]);
  });

  it("indices : même forme sur market_index_values", () => {
    const q = latestCanonicalIndexValueIdsSql(["i1"]);
    const sql = flat(q.text);
    expect(sql).toContain("FROM market_index_values miv WHERE miv.market_index_id = i.id AND miv.is_canonical = true");
    expect(sql).toContain("ORDER BY miv.date DESC LIMIT $2");
    expect(q.values).toEqual([["i1"], 1]);
  });

  it("fin d'année : DISTINCT ON (société, année) trié par date décroissante", () => {
    const q = yearEndCanonicalPriceIdsSql(["a"], { onOrBefore: d("2026-11-15") });
    const sql = flat(q.text);
    expect(sql).toContain("SELECT DISTINCT ON (ph.company_id, EXTRACT(YEAR FROM ph.date)) ph.id");
    expect(sql).toContain("ORDER BY ph.company_id, EXTRACT(YEAR FROM ph.date), ph.date DESC");
    expect(q.values).toEqual([["a"], "2026-11-15"]);
  });
});

describe("utilitaires", () => {
  it("clampLimit borne entre 1 et 50", () => {
    expect(clampLimit(undefined)).toBe(1);
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(2.7)).toBe(2);
    expect(clampLimit(500)).toBe(50);
    expect(clampLimit(Number.NaN)).toBe(1);
  });

  it("utcDay garde le jour UTC", () => {
    expect(utcDay(new Date("2026-03-01T23:59:59.999Z"))).toBe("2026-03-01");
  });

  it("groupByKeyDateDesc regroupe et trie par date décroissante", () => {
    const rows = [
      { k: "a", date: d("2026-01-02") },
      { k: "b", date: d("2026-01-01") },
      { k: "a", date: d("2026-01-05") },
    ];
    const out = groupByKeyDateDesc(rows, (r) => r.k);
    expect(out.get("a")!.map((r) => utcDay(r.date))).toEqual(["2026-01-05", "2026-01-02"]);
    expect(out.get("b")!.length).toBe(1);
  });
});

function fakeDb(ids: string[], rows: Array<Record<string, unknown>>) {
  return {
    $queryRaw: vi.fn(async () => ids.map((id) => ({ id }))),
    priceHistory: { findMany: vi.fn(async () => rows) },
    marketIndexValue: { findMany: vi.fn(async () => rows) },
  } as never;
}

describe("chargeurs", () => {
  it("dernier + précédent par société, dans l'ordre date décroissante", async () => {
    const rows = [
      { id: "p1", companyId: "a", date: d("2026-11-12") },
      { id: "p2", companyId: "a", date: d("2026-11-13") },
      { id: "p3", companyId: "b", date: d("2026-11-13") },
    ];
    const db = fakeDb(["p1", "p2", "p3"], rows);
    const out = await loadLatestCanonicalPrices(db, ["a", "b", "c"], { limit: 2 });
    expect(out.get("a")!.map((r) => r.id)).toEqual(["p2", "p1"]);
    expect(out.get("b")!.map((r) => r.id)).toEqual(["p3"]);
    expect(out.has("c")).toBe(false);
    const findMany = (db as unknown as { priceHistory: { findMany: ReturnType<typeof vi.fn> } }).priceHistory.findMany;
    expect(findMany).toHaveBeenCalledWith({ where: { id: { in: ["p1", "p2", "p3"] } } });
  });

  it("loadLatestCanonicalPrice renvoie une ligne par société", async () => {
    const db = fakeDb(["p2"], [{ id: "p2", companyId: "a", date: d("2026-11-13") }]);
    const out = await loadLatestCanonicalPrice(db, ["a"]);
    expect(out.get("a")!.id).toBe("p2");
  });

  it("aucune requête quand la liste est vide", async () => {
    const db = fakeDb([], []);
    expect((await loadLatestCanonicalPrices(db, [])).size).toBe(0);
    expect((await loadLatestCanonicalIndexValues(db, [])).size).toBe(0);
    expect(await loadYearEndCanonicalPrices(db, [])).toEqual([]);
    expect((db as unknown as { $queryRaw: ReturnType<typeof vi.fn> }).$queryRaw).not.toHaveBeenCalled();
  });

  it("indices regroupés par marketIndexId", async () => {
    const db = fakeDb(["v1"], [{ id: "v1", marketIndexId: "i1", date: d("2026-11-13") }]);
    const out = await loadLatestCanonicalIndexValues(db, ["i1"]);
    expect(out.get("i1")!.map((r) => r.id)).toEqual(["v1"]);
  });
});
