# NGX fundamentals loader (steps 1–5)

Deterministic (LLM-free) pipeline that turns NGX audited financial statements (AFS) into staged CSVs, then (optionally) into the database.
Sources are first-party NGX only: the company directory REST API and the `Financial_NewsDocs` PDFs on `doclib.ngxgroup.com` (browser UA, ~1 req/s).

| Step | Command | Output (`$NGX_STAGE_ROOT`, default `/workspace/ngx-reports`) |
|---|---|---|
| 1 discover | `npm run ngx:discover [-- --tickers GTCO,UBA]` | `staged/manifest.json`, `staged/company_directory.json` (shares, ISIN, last dividend) |
| 2 download | `npm run ngx:download` | `docs/<TICKER>/*.pdf` + `.txt` (`pdftotext -layout`) |
| 3 extract | `npm run ngx:extract` | `staged/extracted/<TICKER>.json` (per document: statement pages, unit/currency, values for current and prior column, DPS) |
| 4 validate | `npm run ngx:validate` | `staged/fundamentals.csv`, `dividends.csv`, `review_queue.csv`, `coverage_summary.{md,csv,json}` |
| 5 load | `npm run ngx:load -- --offline` (plan only) · default = dry-run · `--apply` + `NGX_LOAD_CONFIRM=yes` | inserts only, never overwrites |

Requires `poppler-utils` (`pdftotext`). Image-only PDFs are not OCR'd; those years are filled from the next year's comparative column when possible.

## Validation / confidence
* one document per fiscal year (interim documents excluded; duplicates resolved by agreement with the neighbouring years' comparative columns);
* cross-check of the current column against the **next** AFS's prior column (1 % tolerance) → `high`; a mismatch keeps the original value, marks it `medium` and records the restated value;
* EPS × NGX shares ≈ net profit (0.85–1.15 tight, 0.5–2 loose; share-count changes tolerated when a neighbouring year gives the same implied shares);
* unit (thousands/millions) read from the statement header and double-checked through EPS × shares (×1000 errors corrected, flagged);
* EPS printed in kobo under a "Naira" label is rescaled (flagged);
* sanity: operating profit vs revenue, net profit vs revenue, ROE, revenue ≤ 0, equity ≤ 0;
* banks: revenue = gross earnings (else interest income), "operating profit" = profit before tax (basis recorded);
* USD reporters (ETI) keep `currency=USD` and are **skipped** by step 5.

`high` is the only level loaded by default (`--min=medium` to relax). Everything else goes to `review_queue.csv` with the reason, file and page.

## Step 5 targets
`financial_ratios` (₦ bn, source `NGX_OFFICIEL`), `dividends` (₦/share), `company_documents`, and `companies.profile_meta.ngxFundamentals.years.<year>` = `{equityBn, epsNgn, sourceUrl}` (read by `lib/ngx/fundamentals.ts`).
Existing rows are never modified.
