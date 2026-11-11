#!/usr/bin/env python3
"""Télécharge les logos officiels des sociétés NGX (sites web de l'annuaire)
et les enregistre en 64×64 WebP dans public/logos/ngx/.

Les fichiers statiques et lib/ngx/logo-manifest.ts suffisent ; on n'écrit pas companies.logo_url.
"""

from __future__ import annotations

import json
import re
import ssl
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
from io import BytesIO
from pathlib import Path
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

from PIL import Image, ImageOps, UnidentifiedImageError

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "public" / "logos" / "ngx"
RAW_DIR = Path("/tmp/ngx-logo-raw")
MANIFEST_TS = ROOT / "lib" / "ngx" / "logo-manifest.ts"
REPORT = Path("/tmp/ngx-logo-report.json")
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
CTX = ssl.create_default_context()
CTX_INSECURE = ssl._create_unverified_context()
TIMEOUT = 15
SIZE = 64

EXTRA_SITES = {
    "MTNN": "https://www.mtn.ng",
    "GTCO": "https://www.gtcoplc.com",
    "AIRTELAFRI": "https://www.airtel.africa",
    "BUACEMENT": "https://www.buacement.com",
    "DANGSUGAR": "https://www.dangotesugar.com",
    "NASCON": "https://www.nasconplc.com",
    "NEM": "https://www.nem-insurance.com",
    "TRANSCOHOT": "https://www.transcorphotels.com",
    "UPDCREIT": "https://www.updcreit.com",
    "TANTALIZER": "https://www.tantalizersrestaurants.com",
    "DAARCOMM": "https://www.daarcommunications.com",
    "GUINEAINS": "https://www.guineainsurance.com",
    "CHAMPION": "https://www.championbreweries.com",
    "ZENITHBANK": "https://www.zenithbank.com",
    "NNFM": "https://www.nnfmplc.com",
    "GOLDBREW": "https://www.goldenguineaplc.com",
    "IMG": "https://www.imgnigeria.com",
    "AUSTINLAZ": "https://www.austinlaz.com",
    "MULTITREX": "https://www.multitrexng.com",
    "CMFC": "https://www.crownflour.com",
    "CHAMS": "https://www.chamsholdco.com",
    "FIRSTHOLDCO": "https://www.firstbanknigeria.com",
    "WEMABANK": "https://www.wemabank.com",
    "SEPLAT": "https://www.seplatenergy.com",
    "TRANSCORP": "https://www.transcorpgroup.com",
    "CHELLARAM": "https://www.chellaramsplc.com",
    "ABCTRANS": "https://www.abctransport.com",
    "JOHNHOLT": "https://www.jhplc.com",
    "INTENEGINS": "https://www.ieiplcng.com",
    "PRESTIGE": "https://www.prestigeassuranceplc.com",
    "MBENEFIT": "https://www.mutualng.com",
    "TOTAL": "https://totalenergies.ng",
    "AIICO": "https://www.aiicoplc.com",
    "HBMNG": "https://www.holcim.com",
    "UPDCREIT": "https://www.updcplc.com",
    "DANGSUGAR": "https://www.dangote.com",
    "NESTLE": "https://www.nestle-cwa.com",
    "VERITASKAP": "https://www.veritaskapital.com",
    "LEGENDINT": "https://www.legend.ng",
    "LINKASSURE": "https://www.linkageassurance.com",
}

WELL_KNOWN = [
    "/apple-touch-icon.png",
    "/apple-touch-icon-precomposed.png",
    "/apple-touch-icon-180x180.png",
    "/favicon-192x192.png",
    "/favicon-32x32.png",
    "/favicon.png",
    "/favicon.ico",
    "/logo.png",
    "/logo.webp",
    "/logo.svg",
    "/images/logo.png",
    "/images/logo.svg",
    "/img/logo.png",
    "/assets/logo.png",
    "/assets/images/logo.png",
]


def normalize_website(raw: str) -> str | None:
    if not raw:
        return None
    s = str(raw).split("|")[0].strip()
    s = re.sub(r"\s+", "", s)
    if not s or " " in s:
        return None
    if not re.match(r"^https?://", s, re.I):
        s = "https://" + s.lstrip("/")
    parsed = urlparse(s)
    if not parsed.netloc or "." not in parsed.netloc:
        return None
    return s


def load_websites() -> dict[str, str]:
    path = Path("/tmp/ngx-websites-all.json")
    data = json.loads(path.read_text()) if path.exists() else {}
    out: dict[str, str] = {}
    for ticker, raw in {**data, **EXTRA_SITES}.items():
        url = normalize_website(raw)
        if url:
            out[ticker.upper()] = url
    # extras win when directory entry was dirty
    for t, raw in EXTRA_SITES.items():
        url = normalize_website(raw)
        if url:
            out[t] = url
    return out


def fetch(url: str, *, insecure: bool = False, accept: str = "*/*") -> tuple[int, bytes, str, str]:
    req = Request(url, headers={"User-Agent": UA, "Accept": accept, "Accept-Language": "en,fr;q=0.8"})
    ctx = CTX_INSECURE if insecure else CTX
    try:
        with urlopen(req, timeout=TIMEOUT, context=ctx) as res:
            final = res.geturl()
            ctype = res.headers.get("Content-Type", "")
            return res.status, res.read(), ctype, final
    except HTTPError as e:
        body = e.read() if e.fp else b""
        return e.code, body, e.headers.get("Content-Type", "") if e.headers else "", url
    except Exception as e:  # noqa: BLE001
        if not insecure and ("CERTIFICATE" in str(e).upper() or "SSL" in str(e).upper()):
            return fetch(url, insecure=True, accept=accept)
        raise


class IconParser(HTMLParser):
    def __init__(self, base: str) -> None:
        super().__init__()
        self.base = base
        self.icons: list[tuple[int, str]] = []  # score, url

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = {k.lower(): (v or "") for k, v in attrs}
        if tag == "link":
            rel = a.get("rel", "").lower()
            href = a.get("href", "").strip()
            typ = a.get("type", "").lower()
            sizes = a.get("sizes", "").lower()
            if href and any(k in rel for k in ("icon", "apple-touch-icon", "shortcut")):
                score = 40
                if "apple-touch" in rel:
                    score += 30
                if "svg" in typ or href.lower().endswith(".svg"):
                    score += 10
                if "png" in typ or href.lower().endswith(".png") or href.lower().endswith(".webp"):
                    score += 20
                m = re.findall(r"(\d+)", sizes)
                if m:
                    score += min(max(int(x) for x in m), 256) // 2
                self.icons.append((score, urljoin(self.base, href)))
        if tag == "meta":
            prop = (a.get("property") or a.get("name") or "").lower()
            content = a.get("content", "").strip()
            if content and prop in {"og:image", "og:image:url", "twitter:image"}:
                self.icons.append((25, urljoin(self.base, content)))


def discover(homepage: str) -> list[str]:
    urls: list[tuple[int, str]] = []
    try:
        status, body, ctype, final = fetch(homepage, accept="text/html,application/xhtml+xml")
    except Exception:
        status, body, ctype, final = 0, b"", "", homepage
    base = final or homepage
    if status and body and "html" in (ctype or "html").lower():
        try:
            text = body.decode("utf-8", "replace")
        except Exception:
            text = body.decode("latin-1", "replace")
        parser = IconParser(base)
        try:
            parser.feed(text)
        except Exception:
            parser.icons = []
        urls.extend(parser.icons)
        # crude regex fallback
        for href, rel in re.findall(
            r'<link[^>]+href=["\']([^"\']+)["\'][^>]+rel=["\']([^"\']+)["\']', text, re.I
        ) + re.findall(
            r'<link[^>]+rel=["\']([^"\']+)["\'][^>]+href=["\']([^"\']+)["\']', text, re.I
        ):
            # handle swapped groups
            if href.lower() in {"icon", "shortcut icon", "apple-touch-icon"} or "icon" in href.lower():
                href, rel = rel, href
            if "icon" in rel.lower():
                urls.append((50, urljoin(base, href)))
    origin = f"{urlparse(base).scheme}://{urlparse(base).netloc}"
    for path in WELL_KNOWN:
        score = 35 if "apple" in path or "192" in path else 20
        urls.append((score, origin + path))
    # unique preserve best score
    best: dict[str, int] = {}
    for score, url in urls:
        url = url.strip()
        if not url or url.startswith("data:"):
            continue
        if score > best.get(url, -1):
            best[url] = score
    return [u for u, _ in sorted(best.items(), key=lambda kv: -kv[1])]


def rasterize(blob: bytes, ctype: str, url: str) -> Image.Image | None:
    # SVG: try cairosvg if present, else skip
    if "svg" in (ctype or "").lower() or url.lower().split("?")[0].endswith(".svg"):
        try:
            import cairosvg  # type: ignore

            blob = cairosvg.svg2png(bytestring=blob, output_width=128, output_height=128)
        except Exception:
            return None
    try:
        img = Image.open(BytesIO(blob))
        img.load()
    except (UnidentifiedImageError, OSError, ValueError):
        return None
    if img.mode not in {"RGB", "RGBA"}:
        if img.mode == "P" and "transparency" in img.info:
            img = img.convert("RGBA")
        else:
            img = img.convert("RGBA") if "A" in img.getbands() or img.mode == "LA" else img.convert("RGB")
    else:
        img = img.convert("RGBA") if img.mode != "RGBA" else img
    w, h = img.size
    if w < 16 or h < 16:
        return None
    if w / h > 3 or h / w > 3:
        # banners / og photos that aren't square logos
        if w * h < 80 * 80:
            return None
        if max(w / h, h / w) > 3.2:
            return None
    return img


def score_image(img: Image.Image, src_score: int, url: str) -> float:
    w, h = img.size
    area = w * h
    aspect = min(w / h, h / w)
    s = src_score + min(area, 256 * 256) ** 0.5 + aspect * 20
    if url.lower().endswith((".png", ".webp")):
        s += 15
    if url.lower().endswith(".ico"):
        s -= 10
    if w >= 64 and h >= 64:
        s += 20
    elif w >= 32 and h >= 32:
        s += 8
    return s


def fit_square(img: Image.Image, size: int = SIZE) -> Image.Image:
    # contain into square with transparency
    img = img.convert("RGBA")
    # trim obvious uniform padding a little
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    img.thumbnail((size, size), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - img.width) // 2
    y = (size - img.height) // 2
    canvas.paste(img, (x, y), img)
    return canvas


def process_ticker(ticker: str, website: str) -> dict:
    result = {"ticker": ticker, "website": website, "ok": False, "src": None, "error": None, "bytes": 0}
    try:
        candidates = discover(website)
    except Exception as e:  # noqa: BLE001
        result["error"] = f"discover: {e}"
        return result
    best: tuple[float, Image.Image, str] | None = None
    errors = []
    for i, url in enumerate(candidates[:18]):
        try:
            if re.search(
                r"gettyimages|unsplash|shutterstock|istockphoto|vite\.svg|wsimg\.com/isteam/getty",
                url,
                re.I,
            ):
                continue
            status, blob, ctype, final = fetch(url)
            if status != 200 or not blob or len(blob) < 80:
                continue
            # skip html error pages
            if "html" in (ctype or "").lower() and not url.lower().endswith((".png", ".ico", ".webp", ".jpg", ".jpeg", ".svg")):
                continue
            img = rasterize(blob, ctype, final)
            if img is None:
                continue
            sc = score_image(img, 100 - i, final)
            if best is None or sc > best[0]:
                best = (sc, img, final)
                # good enough early exit
                if img.size[0] >= 64 and img.size[1] >= 64 and sc > 160 and final.lower().endswith((".png", ".webp")):
                    break
        except Exception as e:  # noqa: BLE001
            errors.append(f"{url}: {e}")
            continue
    if not best:
        result["error"] = "no icon" + (f" ({errors[0]})" if errors else "")
        return result
    _, img, src = best
    out = fit_square(img)
    dest = OUT_DIR / f"{ticker}.webp"
    dest.parent.mkdir(parents=True, exist_ok=True)
    out.save(dest, "WEBP", quality=82, method=6)
    result.update(ok=True, src=src, bytes=dest.stat().st_size)
    return result


def write_manifest(ok_tickers: Iterable[str]) -> None:
    tickers = sorted(ok_tickers)
    body = (
        "// Logos locaux des sociétés NGX (public/logos/ngx/{TICKER}.webp).\n"
        "// Généré par scripts/ngx/fetch-logos.py — ne pas éditer à la main.\n"
        "export const NGX_LOGO_TICKERS: ReadonlySet<string> = new Set(\n  "
        + (json.dumps(tickers, ensure_ascii=False) if tickers else "[]")
        + "\n);\n\n"
        "export function ngxLogoSrc(ticker: string | null | undefined): string | null {\n"
        "  if (!ticker) return null;\n"
        "  const t = ticker.trim().toUpperCase();\n"
        "  return NGX_LOGO_TICKERS.has(t) ? `/logos/ngx/${t}.webp` : null;\n"
        "}\n"
    )
    # prettier set formatting
    if tickers:
        items = ",\n  ".join(json.dumps(t) for t in tickers)
        body = (
            "// Logos locaux des sociétés NGX (public/logos/ngx/{TICKER}.webp).\n"
            "// Généré par scripts/ngx/fetch-logos.py — ne pas éditer à la main.\n"
            "export const NGX_LOGO_TICKERS: ReadonlySet<string> = new Set([\n"
            f"  {items},\n"
            "]);\n\n"
            "export function ngxLogoSrc(ticker: string | null | undefined): string | null {\n"
            "  if (!ticker) return null;\n"
            "  const t = ticker.trim().toUpperCase();\n"
            "  return NGX_LOGO_TICKERS.has(t) ? `/logos/ngx/${t}.webp` : null;\n"
            "}\n"
        )
    MANIFEST_TS.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_TS.write_text(body)


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    sites = load_websites()
    print(f"sites: {len(sites)}", flush=True)
    results = []
    # modest parallelism to be polite
    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = {ex.submit(process_ticker, t, u): t for t, u in sorted(sites.items())}
        done = 0
        for fut in as_completed(futs):
            r = fut.result()
            results.append(r)
            done += 1
            flag = "OK" if r["ok"] else "NO"
            print(f"[{done}/{len(sites)}] {flag} {r['ticker']}: {r.get('src') or r.get('error')}", flush=True)
    ok = sorted(r["ticker"] for r in results if r["ok"])
    write_manifest(ok)
    REPORT.write_text(json.dumps({"ok": ok, "count": len(ok), "results": results}, indent=2))
    print(f"DONE {len(ok)}/{len(sites)} logos -> {OUT_DIR}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
