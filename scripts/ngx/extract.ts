// Étape 3 — extraction : texte des états audités téléchargés → champs (CA, résultat, capitaux propres, BPA, DPS).
//   npx ts-node --transpile-only scripts/ngx/extract.ts [--tickers DANGCEM,GTCO]
// Écrit staged/extracted/<TICKER>.json. Aucune écriture en base.
import fs from "node:fs";
import path from "node:path";
import { NGX_COMPANIES } from "../../lib/ngx/fundamentals/companies";
import { extractDividends } from "../../lib/ngx/fundamentals/dividends";
import { extractStatements } from "../../lib/ngx/fundamentals/extract";
import type { NgxManifestEntry } from "../../lib/ngx/fundamentals/types";
import type { ExtractedDoc } from "../../lib/ngx/fundamentals/validate";
import { DOCS_DIR, EXTRACTED_DIR, MANIFEST_PATH, tickerFilter } from "./stage";

function main() {
  const manifest: NgxManifestEntry[] = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const only = tickerFilter();
  fs.mkdirSync(EXTRACTED_DIR, { recursive: true });
  for (const company of NGX_COMPANIES) {
    if (only && !only.includes(company.ticker)) continue;
    const entries = manifest.filter((m) => m.ticker === company.ticker && m.docType === "AUDITED_FS");
    const docs: ExtractedDoc[] = [];
    let missing = 0;
    for (const e of entries) {
      const txt = path.join(DOCS_DIR, company.ticker, e.file.replace(/\.pdf$/i, ".txt"));
      if (!fs.existsSync(txt)) {
        missing++;
        continue;
      }
      let text = fs.readFileSync(txt, "utf8");
      // PDF image seule : texte OCR des pages d'états (scripts/ngx/ocr/ocr_statements.py), pages non OCRisées vides
      const ocrTxt = txt.replace(/\.txt$/, ".ocr.txt");
      const hasOcr = fs.existsSync(ocrTxt);
      let ocrPages: number[] = [];
      if (hasOcr) {
        text = fs.readFileSync(ocrTxt, "utf8");
        const metaPath = ocrTxt.replace(/\.ocr\.txt$/, ".ocr.json");
        if (fs.existsSync(metaPath)) ocrPages = (JSON.parse(fs.readFileSync(metaPath, "utf8")).ocr_pages as number[]) ?? [];
      }
      const extraction = extractStatements(text, company);
      // « ocr » = au moins un des états utilisés (résultat, bilan) provient d'une page OCRisée
      if (hasOcr && [extraction.pages.income, extraction.pages.balance].some((pg) => pg !== null && ocrPages.includes(pg))) {
        extraction.ocr = true;
        extraction.warnings.push("ocr_text");
      }
      const fy = extraction.fiscalYear ?? e.guessedFiscalYear;
      docs.push({
        file: e.file,
        url: e.url,
        guessedFiscalYear: e.guessedFiscalYear,
        createdAt: e.createdAt,
        extraction,
        dividends: extraction.interim ? [] : extractDividends(text, fy),
      });
    }
    fs.writeFileSync(path.join(EXTRACTED_DIR, `${company.ticker}.json`), JSON.stringify({ ticker: company.ticker, docs }, null, 1));
    const ok = docs.filter((d) => d.extraction.fiscalYear && !d.extraction.interim && d.extraction.fields.netProfit).length;
    console.log(`${company.ticker.padEnd(12)} docs=${docs.length}/${entries.length} (texte manquant: ${missing}) exploitables=${ok}`);
  }
}

main();
