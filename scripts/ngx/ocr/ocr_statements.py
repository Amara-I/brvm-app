#!/usr/bin/env python3
"""OCR des pages d'états financiers des PDF NGX « image seule » (étape 3b).

  python3 -m venv /workspace/ocrenv && /workspace/ocrenv/bin/pip install rapidocr-onnxruntime pymupdf
  /workspace/ocrenv/bin/python scripts/ngx/ocr/ocr_statements.py [--tickers PRESCO,JBERGER] [--workers 3] [--force]

Pour chaque document dont le texte pdftotext est vide (pages < 80 caractères) : repère les pages des états
(résultat, situation financière, variation des capitaux propres) par OCR basse résolution du haut de page,
puis OCR pleine page de ces seules pages. Écrit <doc>.ocr.txt (pages séparées par \\f, mise en page « layout »
reconstruite à partir des boîtes) ; les pages non OCRisées sont vides. Aucune écriture en base.
"""
import argparse, glob, json, os, re, sys, time
import numpy as np
import fitz
from multiprocessing import Pool

ROOT = os.environ.get("NGX_STAGE_ROOT", "/workspace/ngx-reports")
DOCS = os.path.join(ROOT, "docs")
_eng = None


def engine():
    global _eng
    if _eng is None:
        from rapidocr_onnxruntime import RapidOCR
        _eng = RapidOCR(intra_op_num_threads=2)
    return _eng


def render(page, dpi, clip=None):
    pix = page.get_pixmap(dpi=dpi, colorspace=fitz.csGRAY, clip=clip)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w)
    return np.stack([img] * 3, -1), pix.w, pix.h


def ocr_boxes(page, dpi, top_frac=None):
    clip = None
    if top_frac:
        r = page.rect
        clip = fitz.Rect(r.x0, r.y0, r.x1, r.y0 + r.height * top_frac)
    img, w, h = render(page, dpi, clip)
    res, _ = engine()(img)
    return res or [], w, h


def layout_text(boxes, width):
    """Boîtes OCR → texte à colonnes alignées (approche pdftotext -layout)."""
    items = []
    for b, tx, _c in boxes:
        xs = [p[0] for p in b]; ys = [p[1] for p in b]
        items.append((min(xs), max(xs), (min(ys) + max(ys)) / 2, max(ys) - min(ys), tx.strip()))
    if not items:
        return ""
    med_h = float(np.median([i[3] for i in items])) or 10.0
    items.sort(key=lambda i: i[2])
    lines, cur, cur_y = [], [], None
    for it in items:
        if cur_y is not None and abs(it[2] - cur_y) > 0.55 * med_h:
            lines.append(cur); cur = []
        cur.append(it)
        cur_y = float(np.mean([c[2] for c in cur]))
    if cur:
        lines.append(cur)
    cw = width / 200.0
    out = []
    for ln in lines:
        ln.sort(key=lambda i: i[0])
        s = ""
        for x0, _x1, _y, _h, tx in ln:
            col = int(round(x0 / cw))
            if len(s) + 2 > col:
                s += "  "
            else:
                s += " " * (col - len(s))
            s += tx
        out.append(s.rstrip())
    return "\n".join(out)


def norm(s):
    return re.sub(r"[^a-z]", "", s.lower())


KINDS = {
    "income": [r"profitorloss", r"incomestatement", r"statementsofcomprehensiveincome", r"statementofcomprehensiveincome", r"statementofprofit", r"profitandloss", r"statementsofprofit"],
    "balance": [r"financialposition", r"balancesheet"],
    "equity": [r"changesinequity", r"changesinshareholders"],
}


def classify(top_text):
    n = norm(top_text)
    hits = {k: any(re.search(p, n) for p in pats) for k, pats in KINDS.items()}
    return hits


def digits(text):
    return len(re.findall(r"\d[\d,\.]{3,}", text))


def process(args):
    pdf, force = args
    out = pdf[:-4] + ".ocr.txt"
    if os.path.exists(out) and not force:
        return pdf, "cached", 0
    t0 = time.time()
    doc = fitz.open(pdf)
    n = len(doc)
    found = {}
    scan_to = max(12, int(n * 0.75))
    for pn in range(2, min(n, scan_to)):
        boxes, w, h = ocr_boxes(doc[pn], 90, 0.5)
        text = " ".join(b[1] for b in boxes)
        hits = classify(text)
        if len(re.findall(r"\d{1,3}(?:,\d{3})+", text)) < 5:
            continue  # sommaire, rapport, notes narratives : pas de tableau chiffré
        # titre d'un état : mot-clé présent ET page numérique (vérifiée après OCR plein)
        for k, v in hits.items():
            if v and k not in found:
                found[k] = pn
        if "income" in found and "balance" in found and "equity" in found:
            break
        if "income" in found and "balance" in found and pn > max(found["income"], found["balance"]) + 4:
            break
    want = set()
    for k, pn in found.items():
        want.add(pn)
        if k in ("income", "balance"):
            want.add(pn + 1)
    pages = [""] * n
    meta = {"found": found, "ocr_pages": []}
    for pn in sorted(want):
        if pn >= n:
            continue
        boxes, w, h = ocr_boxes(doc[pn], 170)
        txt = layout_text(boxes, w)
        pages[pn] = txt
        meta["ocr_pages"].append(pn + 1)
    with open(out, "w") as f:
        f.write("\f".join(pages))
    with open(pdf[:-4] + ".ocr.json", "w") as f:
        json.dump(meta, f)
    return pdf, f"{meta['found']} pages={meta['ocr_pages']}", time.time() - t0


def process_mixed(args):
    """Document texte dont quelques pages (états) sont des images : OCR des seules pages quasi vides, texte conservé ailleurs."""
    pdf, force = args
    out = pdf[:-4] + ".ocr.txt"
    if os.path.exists(out) and not force:
        return pdf, "cached", 0
    t0 = time.time()
    orig = open(pdf[:-4] + ".txt", errors="ignore").read().split("\f")
    doc = fitz.open(pdf)
    small = [i for i, p in enumerate(orig[: len(doc)]) if len(p.strip()) < 80 and i >= 1][:40]
    pages = list(orig) + [""] * (len(doc) - len(orig))
    done = []
    for pn in small:
        boxes, w, h = ocr_boxes(doc[pn], 170)
        txt = layout_text(boxes, w)
        if digits(txt) >= 5 or len(txt) > 200:
            pages[pn] = txt
            done.append(pn + 1)
    with open(out, "w") as f:
        f.write("\f".join(pages))
    with open(pdf[:-4] + ".ocr.json", "w") as f:
        json.dump({"mode": "mixed", "ocr_pages": done}, f)
    return pdf, f"mixed pages={done}", time.time() - t0


def mixed_candidates():
    """Documents non image-seule dont l'extraction texte est incomplète (voir staged/extracted)."""
    res = set()
    for jf in glob.glob(os.path.join(ROOT, "staged", "extracted", "*.json")):
        t = os.path.basename(jf)[:-5]
        for x in json.load(open(jf))["docs"]:
            e = x["extraction"]
            if e.get("interim"):
                continue
            f = e.get("fields", {})
            if e.get("fiscalYear") is None or not f.get("revenue") or not f.get("netProfit") or not f.get("equity"):
                res.add(os.path.join(DOCS, t, x["file"]))
    return res


def image_only(pdf):
    txt = pdf[:-4] + ".txt"
    if not os.path.exists(txt):
        return False
    pages = open(txt, errors="ignore").read().split("\f")
    if len(pages) <= 1:
        return False
    small = sum(1 for p in pages if len(p.strip()) < 80)
    return small / len(pages) > 0.85 and len(pages) > 12


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers")
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--files", help="sous-chaîne de nom de fichier")
    ap.add_argument("--mixed", action="store_true", help="documents texte avec pages d'états en image (OCR des pages vides seulement)")
    a = ap.parse_args()
    only = set(a.tickers.split(",")) if a.tickers else None
    todo = []
    if a.mixed:
        cands = mixed_candidates()
        for pdf in sorted(cands):
            t = os.path.basename(os.path.dirname(pdf))
            if only and t not in only:
                continue
            if a.files and a.files not in pdf:
                continue
            if os.path.exists(pdf[:-4] + ".txt") and not image_only(pdf):
                todo.append((pdf, a.force))
        print(f"{len(todo)} documents mixtes", flush=True)
        with Pool(a.workers) as p:
            for pdf, info, dt in p.imap_unordered(process_mixed, todo):
                print(f"{os.path.basename(os.path.dirname(pdf))} {os.path.basename(pdf)[:48]} {info} {dt:.0f}s", flush=True)
        sys.exit(0)
    for d in sorted(glob.glob(os.path.join(DOCS, "*"))):
        t = os.path.basename(d)
        if only and t not in only:
            continue
        for pdf in sorted(glob.glob(os.path.join(d, "*.pdf"))):
            if a.files and a.files not in pdf:
                continue
            if image_only(pdf):
                todo.append((pdf, a.force))
    print(f"{len(todo)} documents image-seule", flush=True)
    with Pool(a.workers) as p:
        for pdf, info, dt in p.imap_unordered(process, todo):
            print(f"{os.path.basename(os.path.dirname(pdf))} {os.path.basename(pdf)[:48]} {info} {dt:.0f}s", flush=True)
