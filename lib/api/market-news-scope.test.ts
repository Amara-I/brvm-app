import { expect, it } from "vitest";
import { marketNewsWhere } from "./market-news-scope";
it("préserve toutes les nouvelles historiques sans filtre", () => expect(marketNewsWhere()).toEqual({}));
it("scope un ticker à sa place sans ambiguïté", () => expect(marketNewsWhere("NGX", "MTNN")).toEqual({ company: { ticker: "MTNN", exchange: "NGX" } }));
it("inclut les communiqués généraux étiquetés mais pas ceux sans provenance de place", () => expect(marketNewsWhere("BRVM")).toEqual({ OR: [{ company: { exchange: "BRVM" } }, { companyId: null, sourceName: { startsWith: "BRVM · " } }] }));
