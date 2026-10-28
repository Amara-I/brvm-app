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

Requires `poppler-utils` (`pdftotext`). Image-only PDFs are OCR'd (see below); years still missing are filled from the next year's comparative column when possible.

## OCR (image-only PDFs)
`tesseract` is not installable on the box (apt unsigned/500), so OCR uses RapidOCR (ONNX) in a venv:
```
python3 -m venv /workspace/ocrenv && /workspace/ocrenv/bin/pip install rapidocr-onnxruntime pymupdf
npm run ngx:ocr -- [--tickers PRESCO,JBERGER] [--workers 3] [--force] [--files substr]   # image-only AFS
npm run ngx:ocr -- --mixed                                                              # text PDFs whose statement pages are images
npm run ngx:ocr-notices -- [--tickers X]                                                # dividend notices with an empty text layer
```
* Only the statement pages are OCR'd: pages are located at 90 dpi (title keyword + ≥5 numbers, comma or space thousands), then OCR'd at 170 dpi (income and balance pages + the next page, equity statement).
* Output `<pdf>.ocr.txt` (same `\f` page layout as `pdftotext -layout`) and `<pdf>.ocr.json` (located pages). `extract.ts` uses it automatically when the PDF has no text layer and marks the document `ocr: true`.
* `--expand` re-OCRs the whole neighbourhood (±3 pages around the located statements, up to 5 pages) when the first pass found no income/balance page; `--mixed` handles text PDFs whose statement pages are scanned images.
* OCR repairs in `text.ts`: squashed labels (`Operatingprofit` → lexicon-based `unsquashLabel`, ≥2 dictionary words only), dotted thousands (`150.373.083`, `146,549.176`, `1.132,154`; a lone `569.237` only when the row already has ≥2 comma-thousand amounts), `Resuits`, stray dashes after a number.
* OCR balance pages vs equity statement: when the balance page is OCR'd and the SOCE closing balance differs by >1 %, the SOCE value wins (`equity_from_soce_over_ocr_balance_mismatch`).
* **OCR confidence cap**: values from OCR documents are at most `medium`, unless the next AFS's comparative column confirms them (then `high`).

## Dividends (DPS)
Sources, in order: the AFS (directors' report / EPS note / SOCE), then NGX corporate disclosures
(`npm run ngx:disclosures -- all [--tickers X] [--since 2016]`: lists `XFinancial_News` entries of dividend / closure-of-register /
earnings-release type, downloads the PDFs to `docs/<T>/notices/`, parses them into `staged/dividend_notices.json`).
* `notices.ts` parses interim / final / total amounts (₦, kobo, "N45 per share", "25k"), period end, qualification and payment dates.
  Each notice is assigned to a fiscal year from its period end (or its filing date vs. the fiscal year end) and a type; per FY+type the most recent notice wins. Special dividends are ignored.
* Merge (`validate.ts`): AFS and notice agree (1 %) → `high` (`dps_confirmed_by_ngx_notice`); AFS partial but notice total differs → notice total, `medium`;
  conflict → AFS value kept, one level lower + review item; notice only → `medium` if total/final+interim is stated, `low` for final-only/interim-only.
  OCR'd sources are capped at `medium` (`low` when notice-only).
* **Cash-flow check**: `paid(N+1) ≈ shares × (final(N) + interim(N+1))` (12 % tolerance, "dividends paid" from the next AFS's cash flow; shares = implied or directory). A match upgrades one level (`medium` max for OCR); a mismatch is an info review item; the gap is written to `dividends.csv` (`cashflow_gap`).

* **Kobo**: an AFS DPS printed in kobo (e.g. Zenith "270 kobo") is rescaled to naira when it matches a notice (`dps_kobo_to_naira`).
* **Partial tranche**: an AFS DPS equal to only the interim (or only the final) is completed by the notice total (`medium`).
* **USD reporters**: DPS currency is unverified (ETI) → capped at `low` with a review item (`dps_currency_unverified`).
* A single-payment notice confirms an AFS DPS of kind "unspecified".

## Duplicate documents and fiscal-year detection
* When several AFS cover the same fiscal year (e.g. FY2025 filed twice), `pickDocs` prefers the **audited** one (unaudited −4), then core-field completeness, agreement with neighbours, and finally the latest `createdAt`; losers are kept as alternates, flagged `duplicate_documents(N)`, and a `medium` review item is raised if net profit differs by >1 %.
* The fiscal year is read from the statement header (`Year ended 31 December 2018`, `31/12/2018` columns) rather than the filing date (`detectFiscalYear`), so late filings land in the right year.
* Banks: operating profit = profit before tax, also when the label is "Operating Profit/(Loss) Before Tax" (Jaiz).
* Latest fiscal year (FY2025) has no next-year comparative, so revenue/equity cannot reach `high` (`latest_year_no_comparative`) — this is a structural limit until FY2026 AFS are filed.

## Restated revenue rule
The value **as originally reported** is kept. If the next AFS's comparative differs by more than 1 %: confidence `medium`, `restated_in_next_year` records the restated value and `restated_pct` (signed %) quantifies it (columns in `fundamentals.csv`).

## Validation / confidence
* one document per fiscal year (interim documents excluded; duplicates resolved by agreement with the neighbouring years' comparative columns);
* cross-check of the current column against the **next** AFS's prior column (1 % tolerance) → `high`; a mismatch keeps the original value, marks it `medium` and records the restated value;
* EPS × NGX shares ≈ net profit (0.85–1.15 tight, 0.5–2 loose; share-count changes tolerated when a neighbouring year gives the same implied shares);
* unit (thousands/millions) read from the statement header and double-checked through EPS × shares (×1000 errors corrected, flagged);
* EPS printed in kobo under a "Naira" label is rescaled (flagged);
* sanity: operating profit vs revenue, net profit vs revenue, ROE, revenue ≤ 0, equity ≤ 0;
* missing unit (header shows only "N", text lost): inferred from net profit ≈ EPS × shares (directory shares, ±15 %), else from a neighbouring year's unit when the implied share counts agree (handles reverse splits, e.g. Transcorp); flagged `unit_inferred_by_eps_shares`, label "(inferred …)";
* banks: revenue = gross earnings (else interest income), "operating profit" = profit before tax (basis recorded);
* USD reporters (ETI) keep `currency=USD` (values extracted from the US$'000 column of dual-currency pages) and are **skipped** by step 5. Proposal: store a `currency` in `profile_meta.ngxFundamentals.years.<year>` and display natively as "US$", or use the NGN columns ETI itself publishes on the same pages rather than an invented FX rate; nothing is loaded for ETI until decided. ETI EPS is published in US cents.

`high` is the only level loaded by default (`--min=medium` to relax). Everything else goes to `review_queue.csv` with the reason, file and page.

## Step 5 targets
`financial_ratios` (₦ bn, source `NGX_OFFICIEL`), `dividends` (₦/share), `company_documents`, and `companies.profile_meta.ngxFundamentals.years.<year>` = `{equityBn, epsNgn, sourceUrl}` (read by `lib/ngx/fundamentals.ts`).
Existing rows are never modified.
