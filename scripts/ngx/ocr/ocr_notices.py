#!/usr/bin/env python3
"""OCR des avis NGX (dividendes / actions de société) dont le PDF est une image (texte pdftotext vide).

  /workspace/ocrenv/bin/python scripts/ngx/ocr/ocr_notices.py [--tickers GTCO,ZENITHBANK] [--workers 2] [--force]

Pour chaque docs/<TICKER>/notices/*.pdf dont le .txt compte < 60 caractères : OCR des 3 premières pages (150 dpi),
écrit <doc>.ocr.txt (pages séparées par \\f). Les avis OCRisés sont signalés « ocr » dans dividend_notices.json.
"""
import argparse, glob, os, sys
import fitz
from multiprocessing import Pool

sys.path.insert(0, os.path.dirname(__file__))
from ocr_statements import DOCS, ocr_boxes, layout_text  # noqa: E402


def work(pdf):
    out = pdf[:-4] + ".ocr.txt"
    try:
        doc = fitz.open(pdf)
        pages = []
        for i in range(min(3, len(doc))):
            boxes, w, _h = ocr_boxes(doc[i], 150)
            pages.append(layout_text(boxes, w))
        open(out, "w").write("\f".join(pages))
        return pdf, sum(len(p) for p in pages)
    except Exception as e:  # noqa: BLE001
        return pdf, f"ERR {e}"


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers")
    ap.add_argument("--workers", type=int, default=2)
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    tick = a.tickers.split(",") if a.tickers else None
    todo = []
    for txt in sorted(glob.glob(os.path.join(DOCS, "*", "notices", "*.txt"))):
        if txt.endswith(".ocr.txt"):
            continue
        t = txt.split(os.sep)[-3]
        if tick and t not in tick:
            continue
        pdf = txt[:-4] + ".pdf"
        if os.path.getsize(txt) >= 60 or not os.path.exists(pdf):
            continue
        if os.path.exists(pdf[:-4] + ".ocr.txt") and not a.force:
            continue
        todo.append(pdf)
    print(len(todo), "notices to OCR", flush=True)
    with Pool(a.workers) as p:
        for pdf, n in p.imap_unordered(work, todo):
            print(os.path.basename(pdf)[:60], n, flush=True)
