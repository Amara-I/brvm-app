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


def scan_image(page, top_frac=None, target_w=1700):
    """Scan « une image plein page » : on OCRise l'image native (agrandie en bicubique) plutôt qu'un rendu de la page.
    Les scans basse résolution (416-830 px de large) donnent sinon un OCR illisible."""
    try:
        imgs = page.get_images(full=True)
        if len(imgs) != 1:
            return None
        xref = imgs[0][0]
        pix = fitz.Pixmap(page.parent, xref)
        if pix.colorspace is None or pix.colorspace.n != 1:
            pix = fitz.Pixmap(fitz.csGRAY, pix)
        if pix.width < 300 or pix.height < 400:
            return None
        g = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width)
        if top_frac:
            g = g[: int(g.shape[0] * top_frac)]
        sc = max(1.0, target_w / g.shape[1])
        if sc > 1.01:
            import cv2
            g = cv2.resize(g, None, fx=sc, fy=sc, interpolation=cv2.INTER_CUBIC)
        return np.stack([g] * 3, -1), g.shape[1], g.shape[0]
    except Exception:  # noqa: BLE001
        return None


_NUM = re.compile(r"^([(（\[]?)(-?)(\d[\d.,:;/\- ]*\d)([)）\]]?)$")


def fix_numeric(tx):
    """OCR de tableaux : séparateurs de milliers lus « . : ; / - » → « , » ; groupes recollés (241779.455 → 241,779,455)."""
    t = tx.strip().replace("（", "(").replace("）", ")")
    m = _NUM.match(t)
    if not m:
        return tx
    body = m.group(3)
    if re.fullmatch(r"\d{5,}", body) and not re.fullmatch(r"(19|20)\d{2}", body):
        return f"{m.group(1)}{m.group(2)}{int(body):,}{m.group(4)}"
    seps = re.findall(r"[.,:;/\- ]", body)
    if not seps:
        return tx
    last = re.split(r"[.,:;/\- ]", body)[-1]
    digits_only = re.sub(r"[^\d]", "", body)
    if len(last) == 3 and len(digits_only) >= 4:
        grp = f"{int(digits_only):,}" if not digits_only.startswith("0") else digits_only
        return f"{m.group(1)}{m.group(2)}{grp}{m.group(4)}"
    return tx


def ocr_boxes(page, dpi, top_frac=None):
    si = scan_image(page, top_frac)
    if si is not None:
        img, w, h = si
        res, _ = engine()(img)
        return [(b, fix_numeric(tx), c) for b, tx, c in (res or [])], w, h
    clip = None
    if top_frac:
        r = page.rect
        clip = fitz.Rect(r.x0, r.y0, r.x1, r.y0 + r.height * top_frac)
    img, w, h = render(page, dpi, clip)
    res, _ = engine()(img)
    return res or [], w, h


LABELS = [
    "Statement of profit or loss and other comprehensive income", "Statement of profit or loss", "Statement of comprehensive income",
    "Statement of financial position", "Statement of changes in equity", "Statement of cash flows", "Income statement", "Balance sheet",
    "Revenue", "Turnover", "Cost of sales", "Gross profit", "Marketing expenses", "Administrative expenses", "Selling and distribution expenses",
    "Operating profit", "Operating expenses", "Investment income", "Other gains and losses", "Other income", "Finance cost", "Finance costs", "Finance income",
    "Profit before tax", "Profit before income tax", "Profit before taxation", "Income tax expense", "Taxation", "Profit for the year", "Profit after tax",
    "Other comprehensive income", "Total comprehensive income", "Attributable to", "Owners of the company", "Non-controlling interests",
    "Earnings per share", "Basic earnings per share", "Diluted earnings per share", "Basic earnings per share (N)", "Diluted earnings per share (N)",
    "Total equity", "Total assets", "Total liabilities", "Total equity and liabilities", "Non-current assets", "Current assets", "Current liabilities",
    "Non-current liabilities", "Share capital", "Share premium", "Retained earnings", "Cash and cash equivalents", "Trade and other receivables",
    "Inventories", "Property, plant and equipment", "Borrowings", "Trade and other payables", "Equity attributable to owners of the company",
    "Gross earnings", "Interest income", "Interest expense", "Net interest income", "Impairment loss on trade and other receivables",
    "Foreign exchange acquisition loss", "Items that will not be reclassified subsequently to profit or loss",
    "Items that may be reclassified subsequently to profit or loss", "Equity", "Assets", "Liabilities", "Notes",
]
_LABEL_KEYS = [(re.sub(r"[^a-z]", "", l.lower()), l) for l in LABELS]


def snap_label(tx):
    """OCR de scans : « Rewenwe », « Operatingprofit », « STATIMENTOFTINANCTALPOSITION » → libellé canonique
    (comparaison sur les seules lettres, ratio ≥ 0.86). Les textes numériques ou trop courts sont laissés tels quels."""
    import difflib
    t = tx.strip()
    k = re.sub(r"[^a-z]", "", t.lower())
    if len(k) < 5 or re.search(r"\d{3}", t) or len(t) > 90:
        return tx
    best, br = None, 0.0
    for key, lab in _LABEL_KEYS:
        if abs(len(key) - len(k)) > max(3, len(key) // 4):
            continue
        r = difflib.SequenceMatcher(None, k, key).ratio()
        if r > br:
            best, br = lab, r
    if best and br >= 0.8:
        return best.upper() if t.isupper() else best
    return tx


def layout_text(boxes, width):
    """Boîtes OCR → texte à colonnes alignées (approche pdftotext -layout)."""
    items = []
    for b, tx, _c in boxes:
        xs = [p[0] for p in b]; ys = [p[1] for p in b]
        items.append((min(xs), max(xs), (min(ys) + max(ys)) / 2, max(ys) - min(ys), snap_label(fix_numeric(tx.strip()))))
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
        if any(re.search(r"per share", i[4], re.I) for i in ln):
            # BPA : l'OCR perd la virgule décimale (553 → 5.53) ; la colonne Note (1-2 chiffres) est conservée.
            ln = [(a, b, c, d, f"{int(t) / 100:.2f}" if re.fullmatch(r"\d{3}", t) else t) for a, b, c, d, t in ln]
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
    "income": [r"profitorloss", r"incomestatement", r"statementsofcomprehensiveincome", r"statementofcomprehensiveincome", r"statementofprofit", r"profitandloss", r"statementsofprofit",
               r"statementof\w{0,12}loss\w{0,12}comprehensiveincome", r"orlossand\w{0,8}comprehensive"],
    "balance": [r"financialposition", r"balancesheet", r"statementof\w{0,4}financial\w{0,3}(position|posit)"],
    "equity": [r"changesinequity", r"changesinshareholders", r"changesin\w{0,3}quity", r"changesin\w{0,3}equit"],
}


def classify(top_text):
    n = norm(top_text)
    hits = {k: any(re.search(p, n) for p in pats) for k, pats in KINDS.items()}
    return hits


def digits(text):
    return len(re.findall(r"\d[\d,\.]{3,}", text))


def page_overrides():
    """scripts/ngx/ocr/pages.json : { "<sous-chaîne du nom de fichier>": [pages 1-indexées des états] }.
    Pour les scans dont le titre est trop dégradé à 90 dpi pour le localisateur."""
    p = os.path.join(os.path.dirname(__file__), "pages.json")
    return json.load(open(p)) if os.path.exists(p) else {}


def process_pages(pdf, pages1):
    """OCR pleine page (170 dpi) des pages indiquées, sans localisateur."""
    t0 = time.time()
    doc = fitz.open(pdf)
    n = len(doc)
    pages = [""] * n
    # PDF hybride (couche texte + quelques pages image, ex. bilan scanné) : on garde la couche texte des autres pages.
    txt = pdf[:-4] + ".txt"
    if os.path.exists(txt):
        tp = open(txt, errors="ignore").read().split("\f")
        for i in range(min(n, len(tp))):
            pages[i] = tp[i]
        for p1 in pages1:
            if 0 <= p1 - 1 < n:
                pages[p1 - 1] = ""
    done = []
    for p1 in pages1:
        pn = p1 - 1
        if 0 <= pn < n:
            boxes, w, h = ocr_boxes(doc[pn], 170)
            pages[pn] = layout_text(boxes, w)
            done.append(p1)
    open(pdf[:-4] + ".ocr.txt", "w").write("\f".join(pages))
    json.dump({"found": {}, "manual_pages": pages1, "ocr_pages": done}, open(pdf[:-4] + ".ocr.json", "w"))
    return pdf, f"manual pages={done}", time.time() - t0


def process_redo(job):
    pdf, pages1 = job
    return process_pages(pdf, pages1)


def process(args):
    pdf, force = args
    out = pdf[:-4] + ".ocr.txt"
    if os.path.exists(out) and not force:
        return pdf, "cached", 0
    for key, pages1 in page_overrides().items():
        if key in os.path.basename(pdf):
            return process_pages(pdf, pages1)
    t0 = time.time()
    doc = fitz.open(pdf)
    n = len(doc)
    found = {}
    loose = {}
    scan_to = max(12, int(n * 0.75))
    for pn in range(2, min(n, scan_to)):
        boxes, w, h = ocr_boxes(doc[pn], 90, 0.5)
        text = " ".join(b[1] for b in boxes)
        hits = classify(text)
        if len(re.findall(r"(?<!\d)\d{1,3}(?:[, ]\d{3})+(?!\d)", text)) < 10:
            continue  # sommaire, rapport, notes narratives : pas de tableau chiffré
        has_note = bool(re.search(r"\bnotes?\b", text, re.I))
        # titre d'un état : mot-clé présent ET page numérique. Les pages « chiffres clés » (sans colonne Notes) ne servent qu'en repli.
        for k, v in hits.items():
            if v and k not in found:
                if has_note:
                    found[k] = pn
                else:
                    loose.setdefault(k, pn)
        if "income" in found and "balance" in found and "equity" in found:
            break
        if "income" in found and "balance" in found and pn > max(found["income"], found["balance"]) + 4:
            break
    for k, pn in loose.items():
        found.setdefault(k, pn)
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


def process_expand(args):
    """Complète un .ocr.txt existant : OCR de toutes les pages entre le premier et le dernier état localisé (+2),
    car le localisateur peut s'arrêter sur une page « chiffres clés » et manquer le bilan voisin."""
    pdf, force = args
    meta_p = pdf[:-4] + ".ocr.json"
    meta = json.load(open(meta_p))
    if "found" not in meta or not meta["found"]:
        return pdf, "pas de pages localisées", 0
    t0 = time.time()
    lo, hi = min(meta["found"].values()), max(meta["found"].values())
    rng = [pn for pn in range(lo, min(hi + 3, lo + 9))]
    doc = fitz.open(pdf)
    pages = open(pdf[:-4] + ".ocr.txt", errors="ignore").read().split("\f")
    pages += [""] * (len(doc) - len(pages))
    done = set(meta["ocr_pages"])
    added = []
    for pn in rng:
        if pn >= len(doc) or (pn + 1) in done:
            continue
        boxes, w, h = ocr_boxes(doc[pn], 170)
        pages[pn] = layout_text(boxes, w)
        added.append(pn + 1)
    meta["ocr_pages"] = sorted(done | set(added))
    meta["expanded"] = True
    open(pdf[:-4] + ".ocr.txt", "w").write("\f".join(pages))
    json.dump(meta, open(meta_p, "w"))
    return pdf, f"expand +{added}", time.time() - t0


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
    ap.add_argument("--redo", action="store_true", help="refait l'OCR (pipeline amélioré) des pages déjà OCRisées, sans relocaliser")
    ap.add_argument("--expand", action="store_true", help="complète les .ocr.txt existants avec les pages voisines des états")
    ap.add_argument("--mixed", action="store_true", help="documents texte avec pages d'états en image (OCR des pages vides seulement)")
    a = ap.parse_args()
    only = set(a.tickers.split(",")) if a.tickers else None
    todo = []
    if a.expand:
        for jf in sorted(glob.glob(os.path.join(DOCS, "*", "*.ocr.json"))):
            t = os.path.basename(os.path.dirname(jf))
            if (only and t not in only) or (a.files and a.files not in jf):
                continue
            if "found" in json.load(open(jf)) and not json.load(open(jf)).get("expanded"):
                todo.append((jf[:-9] + ".pdf", False))
        print(f"{len(todo)} documents à compléter", flush=True)
        with Pool(a.workers) as p:
            for pdf, info, dt in p.imap_unordered(process_expand, todo):
                print(f"{os.path.basename(os.path.dirname(pdf))} {os.path.basename(pdf)[:48]} {info} {dt:.0f}s", flush=True)
        sys.exit(0)
    if a.redo:
        jobs = []
        for d in sorted(glob.glob(os.path.join(DOCS, "*"))):
            t = os.path.basename(d)
            if only and t not in only:
                continue
            for mj in sorted(glob.glob(os.path.join(d, "*.ocr.json"))):
                pdf = mj[: -len(".ocr.json")] + ".pdf"
                if a.files and a.files not in pdf:
                    continue
                try:
                    pg = json.load(open(mj)).get("ocr_pages") or []
                except Exception:
                    pg = []
                if pg and os.path.exists(pdf):
                    jobs.append((pdf, pg))
        print(f"{len(jobs)} documents à refaire", flush=True)
        with Pool(a.workers) as p:
            for pdf, info, dt in p.imap_unordered(process_redo, jobs):
                print(f"{os.path.basename(os.path.dirname(pdf))} {os.path.basename(pdf)[:48]} {info} {dt:.0f}s", flush=True)
        sys.exit(0)
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
            if image_only(pdf) or any(k in os.path.basename(pdf) for k in page_overrides()):
                todo.append((pdf, a.force))
    print(f"{len(todo)} documents image-seule", flush=True)
    with Pool(a.workers) as p:
        for pdf, info, dt in p.imap_unordered(process, todo):
            print(f"{os.path.basename(os.path.dirname(pdf))} {os.path.basename(pdf)[:48]} {info} {dt:.0f}s", flush=True)
