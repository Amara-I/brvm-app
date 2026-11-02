import { expect, it } from "vitest";
import { proposalSchema, checkedObservations } from "./proposal";
import { trustedDocumentUrl } from "./document";
const row = { year: 2025, field: "revenue" as const, valueAsPrinted: "123,456", currency: "NGN" as const, unit: "thousands" as const,
  scope: "group" as const, page: 17, evidence: "Group Revenue 123,456 NGN thousands 2025", caveat: "" };
it("n’accepte que les citations réellement présentes sur la page", () => {
  const proposal = proposalSchema.parse({ company: "Example", observations: [row, { ...row, valueAsPrinted: "9999" }, { ...row, page: 18 }] });
  expect(checkedObservations(proposal, [{ page: 17, text: row.evidence }], [2025], new Date("2026-11-02"))).toEqual([row]);
});
it("rejette devise/périmètre inconnus, année non manquante ou non révolue", () => {
  const p = { company: "Example", observations: [row, { ...row, currency: "UNKNOWN" as const }, { ...row, scope: "UNKNOWN" as const }] };
  expect(checkedObservations(p, [{ page: 17, text: row.evidence }], [], new Date("2026-11-02"))).toEqual([]);
  expect(checkedObservations(p, [{ page: 17, text: row.evidence }], [2025], new Date("2025-01-01"))).toEqual([]);
});
it("limite les téléchargements aux PDF officiels du bon marché, sans credentials ni URL de redirection", () => {
  expect(trustedDocumentUrl("https://doclib.ngxgroup.com/Financial_NewsDocs/a.pdf", "NGX")).toBe(true);
  for (const u of ["https://127.0.0.1/a.pdf", "http://doclib.ngxgroup.com/a.pdf", "https://doclib.ngxgroup.com.evil.test/a.pdf", "https://x:y@doclib.ngxgroup.com/a.pdf", "https://doclib.ngxgroup.com/a.pdf?redirect=evil", "https://doclib.ngxgroup.com:8080/a.pdf"]) expect(trustedDocumentUrl(u, "NGX")).toBe(false);
  expect(trustedDocumentUrl("https://www.brvm.org/a.pdf", "NGX")).toBe(false);
});
