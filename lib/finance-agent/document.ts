import robotsParser from "robots-parser";
const HOSTS: Record<"BRVM" | "NGX", string[]> = { BRVM: ["www.brvm.org", "brvm.org"], NGX: ["doclib.ngxgroup.com", "www.mtn.ng"] };
export function trustedDocumentUrl(raw: string, exchange: "BRVM" | "NGX"): boolean {
  try { const u = new URL(raw); return u.protocol === "https:" && (!u.port || u.port === "443") && !u.username && !u.password &&
    HOSTS[exchange].includes(u.hostname) && /\.pdf$/i.test(u.pathname) && !u.search; } catch { return false; }
}
const UA = "OuestBourseFinancialResearch/1.0";
async function boundedBody(response: Response, limit: number): Promise<Uint8Array> {
  if (!response.body) throw new Error("Document vide");
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length;
    if (size > limit) throw new Error("Document trop volumineux"); chunks.push(value); } }
  finally { await reader.cancel().catch(() => undefined); }
  const bytes = new Uint8Array(size); let offset = 0; for (const c of chunks) { bytes.set(c, offset); offset += c.length; } return bytes;
}
export async function financialPages(url: string, exchange: "BRVM" | "NGX") {
  if (!trustedDocumentUrl(url, exchange)) throw new Error("Source hors périmètre");
  const signal = AbortSignal.timeout(25000);
  const origin = new URL(url).origin;
  const robots = await fetch(`${origin}/robots.txt`, { redirect: "error", signal, headers: { "User-Agent": UA } });
  if (robots.status !== 404) {
    if (!robots.ok) throw new Error("robots.txt invérifiable");
    const text = new TextDecoder().decode(await boundedBody(robots, 256000));
    const parser = robotsParser(`${origin}/robots.txt`, text);
    if (parser.isAllowed(url, UA) === false) throw new Error("robots.txt refuse ce document");
    // Un seul document par invocation ; respecter le Crawl-delay (défauts BRVM 10s, NGX 3s).
    const wait = Math.max(3, parser.getCrawlDelay(UA) ?? (exchange === "BRVM" ? 10 : 3));
    if (wait > 30) throw new Error("Crawl-delay incompatible avec le budget temps");
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
  const response = await fetch(url, { redirect: "error", signal, headers: { "User-Agent": UA, Accept: "application/pdf" } });
  if (!response.ok) throw new Error(`Source HTTP ${response.status}`);
  const bytes = await boundedBody(response, 8 * 1024 * 1024);
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new Error("Réponse non PDF");
  const { extractText } = await import("unpdf");
  const { text } = await extractText(bytes, { mergePages: false });
  const pages = (Array.isArray(text) ? text : [text]).map((text, i) => ({ page: i + 1, text }));
  // Les documents image ne sont pas « inventés » par OCR/LLM ; pas d'appel IA si rien n'est lisible.
  const relevant = pages.filter((p) => /revenue|operating.profit|net.income|chiffre.d.affaires|résultat|dividend/i.test(p.text));
  let remaining = 12000;
  return relevant.slice(0, 6).map((p) => { const text = p.text.slice(0, Math.min(4000, remaining)); remaining -= text.length; return { page: p.page, text }; }).filter((p) => p.text.length >= 100);
}
