#!/usr/bin/env python3
"""Télécharge les logos officiels des sociétés BRVM (sites web, Wikimedia)
et les enregistre en 64×64 WebP dans public/logos/brvm/.

Les fichiers statiques et lib/brvm/logo-manifest.ts suffisent ; on n'écrit
pas companies.logo_url.
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
from urllib.error import HTTPError
from urllib.parse import quote, urljoin, urlparse
from urllib.request import Request, urlopen

from PIL import Image, UnidentifiedImageError

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "public" / "logos" / "brvm"
RAW_DIR = Path("/tmp/brvm-logo-raw")
MANIFEST_TS = ROOT / "lib" / "brvm" / "logo-manifest.ts"
REPORT = Path("/tmp/brvm-logo-report.json")
UA = (
    "OuestBourseLogoBot/1.0 (https://brwm-app.vercel.app; "
    "listed-company identification logos; contact ouestbourse)"
)
CTX = ssl.create_default_context()
CTX_INSECURE = ssl._create_unverified_context()
TIMEOUT = 18
SIZE = 64

# ticker, name, official website, optional wikipedia/commons search terms
COMPANIES: list[tuple[str, str, str, list[str]]] = [
    ("SNTS", "Sonatel", "https://sonatel.sn", ["Sonatel", "Sonatel logo"]),
    ("ORAC", "Orange Côte d'Ivoire", "https://www.orange.ci", ["Orange logo", "Orange Côte d'Ivoire"]),
    ("ONTBF", "ONATEL Burkina Faso", "https://moov-africa.bf", ["Moov Africa", "Onatel Burkina"]),
    ("CBIBF", "Coris Bank", "https://burkina.coris.bank", ["Coris Bank", "Coris Bank logo"]),
    ("BOAB", "Bank of Africa Bénin", "https://www.boabenin.com", ["Bank of Africa", "Banque of Africa"]),
    ("LNBB", "Loterie Nationale du Bénin", "https://www.lnb.bj", ["Loterie nationale du Bénin"]),
    ("BICB", "BIIC Bénin", "https://www.biic-bank.com", ["BIIC", "Banque internationale pour l'Industrie et le Commerce"]),
    ("SGBC", "Société Générale Côte d'Ivoire", "https://societegenerale.ci", ["Société Générale", "Societe Generale logo"]),
    ("NSBC", "NSIA Banque CI", "https://www.nsiabanque.ci", ["NSIA Banque", "NSIA"]),
    ("ECOC", "Ecobank Côte d'Ivoire", "https://www.ecobank.com", ["Ecobank", "Ecobank logo"]),
    ("STBC", "SITAB CI", "https://www.sitab.ci", ["SITAB", "Société ivoirienne des tabacs"]),
    ("SLBC", "Solibra", "https://www.solibra.ci", ["Solibra", "Solibra logo"]),
    ("BOABF", "Bank of Africa Burkina", "https://www.boaburkinafaso.com", ["Bank of Africa"]),
    ("SDCC", "SODECI", "https://sodeci.ci", ["SODECI", "Société de distribution d'eau de Côte d'Ivoire"]),
    ("SDSC", "Africa Global Logistics", "https://www.africagloballogistics.com", ["Africa Global Logistics", "Bolloré Transport & Logistics"]),
    ("PALC", "Palm-CI", "https://palmci.ci", ["Palm CI", "Palm-CI", "SIFCA"]),
    ("BOAN", "Bank of Africa Niger", "https://www.boaniger.com", ["Bank of Africa"]),
    ("TTLS", "TotalEnergies Sénégal", "https://totalenergies.sn", ["TotalEnergies", "TotalEnergies logo"]),
    ("NTLC", "Nestlé CI", "https://www.nestle.ci", ["Nestlé", "Nestle logo"]),
    ("BOAS", "Bank of Africa Sénégal", "https://www.boasenegal.com", ["Bank of Africa"]),
    ("ABJC", "Servair Abidjan", "https://www.servair.fr", ["Servair", "Servair logo"]),
    ("BBGCI", "Bridge Bank Group CI", "https://www.bridgebankgroup.com", ["Bridge Bank Group"]),
    ("BICC", "BICICI", "https://www.bicici.com", ["BICICI", "Banque internationale pour le commerce et l'industrie de la Côte d'Ivoire"]),
    ("BNBC", "Bernabé CI", "https://bernabeafrique.com", ["Bernabé Afrique", "Bernabe"]),
    ("BOAC", "Bank of Africa Côte d'Ivoire", "https://boacoteivoire.com", ["Bank of Africa"]),
    ("BOAM", "Bank of Africa Mali", "https://www.boamali.com", ["Bank of Africa"]),
    ("CABC", "Sicable CI", "https://www.sicable.ci", ["Sicable", "SICABLE"]),
    ("CFAC", "CFAO Motors CI", "https://www.cfaomotors-cotedivoire.com", ["CFAO", "CFAO Motors", "CFAO Group"]),
    ("CIEC", "CIE CI", "https://www.cie.ci", ["Compagnie ivoirienne d'électricité", "CIE Côte d'Ivoire"]),
    ("ETIT", "Ecobank Transnational", "https://ecobank.com", ["Ecobank", "Ecobank logo"]),
    ("FTSC", "Filtisac", "https://filtisac.com", ["Filtisac"]),
    ("NEIC", "NEI-CEDA", "https://www.nei-ceda.com", ["NEI-CEDA", "NEI CEDA"]),
    ("ORGT", "Oragroup", "https://www.oragroup.net", ["Oragroup", "Orabank"]),
    ("PRSC", "Tractafric Motors CI", "https://www.tractafricmotors.com", ["Tractafric", "Tractafric Motors"]),
    ("SAFC", "Alios Finance / SAFCA", "https://www.alios-finance.com", ["Alios Finance", "SAFCA"]),
    ("SCRC", "Sucrivoire", "https://www.sucrivoire.ci", ["Sucrivoire"]),
    ("SEMC", "Eviosys Packaging", "https://www.eviosys.com", ["Eviosys", "Crown Holdings"]),
    ("SHEC", "Vivo Energy CI", "https://www.vivoenergy.com", ["Vivo Energy", "Vivo Energy logo"]),
    ("SIBC", "Société Ivoirienne de Banque", "https://sib.ci", ["Société Ivoirienne de Banque", "SIB Côte d'Ivoire"]),
    ("SICC", "Sicor CI", "https://www.sicor.ci", ["SICOR Côte d'Ivoire"]),
    ("SIVC", "Erium (ex Air Liquide CI)", "https://erium.com", ["Erium", "Air Liquide"]),
    ("SMBC", "SMB CI", "https://smb.ci", ["Société Multinationale de Bitumes", "SMB Côte d'Ivoire"]),
    ("SOGC", "SOGB", "https://sogbci.com", ["SOGB", "Société des Caoutchoucs de Grand-Béréby"]),
    ("SPHC", "SAPH", "https://www.saph.ci", ["SAPH", "Société Africaine de Plantations d'Hévéas"]),
    ("STAC", "Setao CI", "https://www.setao.ci", ["SETAO", "Setao"]),
    ("TTLC", "TotalEnergies Marketing CI", "https://totalenergies.ci", ["TotalEnergies", "TotalEnergies logo"]),
    ("UNLC", "Unilever CI", "https://www.unilever.ci", ["Unilever", "Unilever logo"]),
    ("UNXC", "Uniwax CI", "https://www.uniwax.ci", ["Uniwax", "Uniwax Côte d'Ivoire"]),
]

# Direct official / Wikimedia URLs tried first (highest quality).
DIRECT_LOGOS: dict[str, list[str]] = {
    "ORAC": [
        "https://upload.wikimedia.org/wikipedia/commons/c/c8/Orange_logo.svg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Orange_logo.svg/256px-Orange_logo.svg.png",
    ],
    "TTLC": [
        "https://upload.wikimedia.org/wikipedia/fr/6/60/TotalEnergies_logo.svg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/TotalEnergies_logo.svg/256px-TotalEnergies_logo.svg.png",
    ],
    "TTLS": [
        "https://upload.wikimedia.org/wikipedia/fr/6/60/TotalEnergies_logo.svg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/TotalEnergies_logo.svg/256px-TotalEnergies_logo.svg.png",
    ],
    "NTLC": [
        "https://upload.wikimedia.org/wikipedia/en/d/d8/Nestl%C3%A9.svg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Nestl%C3%A9.svg/256px-Nestl%C3%A9.svg.png",
    ],
    "UNLC": [
        "https://upload.wikimedia.org/wikipedia/en/e/e4/Unilever.svg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Unilever.svg/256px-Unilever.svg.png",
    ],
    "SGBC": [
        "https://upload.wikimedia.org/wikipedia/en/4/41/Soci%C3%A9t%C3%A9_G%C3%A9n%C3%A9rale.svg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Soci%C3%A9t%C3%A9_G%C3%A9n%C3%A9rale_logo.svg/256px-Soci%C3%A9t%C3%A9_G%C3%A9n%C3%A9rale_logo.svg.png",
    ],
    "ETIT": [
        "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Ecobank_logo.svg/256px-Ecobank_logo.svg.png",
        "https://upload.wikimedia.org/wikipedia/en/thumb/2/2f/Ecobank_Logo.svg/320px-Ecobank_Logo.svg.png",
    ],
    "ECOC": [
        "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Ecobank_logo.svg/256px-Ecobank_logo.svg.png",
        "https://upload.wikimedia.org/wikipedia/en/thumb/2/2f/Ecobank_Logo.svg/320px-Ecobank_Logo.svg.png",
    ],
    "SIVC": [
        "https://upload.wikimedia.org/wikipedia/en/e/e3/Air_Liquide.svg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Air_Liquide_logo.svg/256px-Air_Liquide_logo.svg.png",
    ],
    "SHEC": [
        "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Vivo_Energy_logo.svg/256px-Vivo_Energy_logo.svg.png",
    ],
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


def fetch(url: str, *, insecure: bool = False, accept: str = "*/*") -> tuple[int, bytes, str, str]:
    req = Request(url, headers={"User-Agent": UA, "Accept": accept, "Accept-Language": "fr,en;q=0.8"})
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
        self.icons: list[tuple[int, str]] = []

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
                if "png" in typ or href.lower().endswith((".png", ".webp")):
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
        if tag == "img":
            src = (a.get("src") or a.get("data-src") or "").strip()
            alt = a.get("alt", "").lower()
            cls = a.get("class", "").lower()
            if src and ("logo" in alt or "logo" in cls or re.search(r"/logo", src, re.I)):
                self.icons.append((45, urljoin(self.base, src)))


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
        for href, rel in re.findall(
            r'<link[^>]+href=["\']([^"\']+)["\'][^>]+rel=["\']([^"\']+)["\']', text, re.I
        ) + re.findall(
            r'<link[^>]+rel=["\']([^"\']+)["\'][^>]+href=["\']([^"\']+)["\']', text, re.I
        ):
            if href.lower() in {"icon", "shortcut icon", "apple-touch-icon"} or "icon" in href.lower():
                href, rel = rel, href
            if "icon" in rel.lower():
                urls.append((50, urljoin(base, href)))
    origin = f"{urlparse(base).scheme}://{urlparse(base).netloc}"
    for path in WELL_KNOWN:
        score = 35 if "apple" in path or "192" in path else 20
        urls.append((score, origin + path))
    best: dict[str, int] = {}
    for score, url in urls:
        url = url.strip()
        if not url or url.startswith("data:"):
            continue
        if score > best.get(url, -1):
            best[url] = score
    return [u for u, _ in sorted(best.items(), key=lambda kv: -kv[1])]


def wikimedia_candidates(terms: list[str]) -> list[str]:
    out: list[str] = []
    for term in terms:
        api = (
            "https://commons.wikimedia.org/w/api.php?action=query&list=search"
            f"&srnamespace=6&srlimit=6&format=json&srsearch={quote(term + ' logo')}"
        )
        try:
            status, body, _, _ = fetch(api, accept="application/json")
            if status != 200:
                continue
            data = json.loads(body.decode("utf-8", "replace"))
            titles = [h.get("title") for h in data.get("query", {}).get("search", []) if h.get("title")]
            if not titles:
                continue
            joined = "|".join(titles[:6])
            info = (
                "https://commons.wikimedia.org/w/api.php?action=query&format=json"
                f"&prop=imageinfo&iiprop=url&iiurlwidth=256&titles={quote(joined)}"
            )
            status, body, _, _ = fetch(info, accept="application/json")
            if status != 200:
                continue
            pages = json.loads(body.decode("utf-8", "replace")).get("query", {}).get("pages", {})
            for page in pages.values():
                infos = page.get("imageinfo") or []
                for ii in infos:
                    thumb = ii.get("thumburl") or ii.get("url")
                    if thumb:
                        out.append(thumb)
        except Exception:
            continue
        # Wikipedia page image (fr then en)
        for wiki in ("fr", "en"):
            try:
                api = (
                    f"https://{wiki}.wikipedia.org/w/api.php?action=query&format=json"
                    f"&prop=pageimages&piprop=thumbnail|name&pithumbsize=256&pilicense=any"
                    f"&redirects=1&titles={quote(term)}"
                )
                status, body, _, _ = fetch(api, accept="application/json")
                if status != 200:
                    continue
                pages = json.loads(body.decode("utf-8", "replace")).get("query", {}).get("pages", {})
                for page in pages.values():
                    thumb = (page.get("thumbnail") or {}).get("source")
                    if thumb:
                        out.append(thumb)
            except Exception:
                continue
    # unique
    seen: set[str] = set()
    uniq = []
    for u in out:
        if u not in seen:
            seen.add(u)
            uniq.append(u)
    return uniq


def rasterize(blob: bytes, ctype: str, url: str) -> Image.Image | None:
    if "svg" in (ctype or "").lower() or url.lower().split("?")[0].endswith(".svg"):
        try:
            import cairosvg

            blob = cairosvg.svg2png(bytestring=blob, output_width=256, output_height=256)
            ctype = "image/png"
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
    if max(w / h, h / w) > 3.2:
        return None
    return img


def score_image(img: Image.Image, src_score: int, url: str) -> float:
    w, h = img.size
    area = w * h
    aspect = min(w / h, h / w)
    s = src_score + min(area, 256 * 256) ** 0.5 + aspect * 20
    if url.lower().split("?")[0].endswith((".png", ".webp", ".svg")):
        s += 15
    if url.lower().split("?")[0].endswith(".ico"):
        s -= 10
    if "wikimedia" in url or "wikipedia" in url:
        s += 25
    if w >= 64 and h >= 64:
        s += 20
    elif w >= 32 and h >= 32:
        s += 8
    return s


def fit_square(img: Image.Image, size: int = SIZE) -> Image.Image:
    img = img.convert("RGBA")
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    # small inner padding so the mark stays legible at 20px
    inner = int(size * 0.88)
    img.thumbnail((inner, inner), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - img.width) // 2
    y = (size - img.height) // 2
    canvas.paste(img, (x, y), img)
    return canvas


def process_ticker(ticker: str, name: str, website: str, terms: list[str]) -> dict:
    result = {"ticker": ticker, "name": name, "website": website, "ok": False, "src": None, "error": None, "bytes": 0}
    candidates: list[tuple[int, str]] = []
    for i, url in enumerate(DIRECT_LOGOS.get(ticker, [])):
        candidates.append((200 - i, url))
    if website:
        try:
            for i, url in enumerate(discover(website)):
                candidates.append((120 - i, url))
        except Exception as e:  # noqa: BLE001
            result["discover_error"] = str(e)
    try:
        for i, url in enumerate(wikimedia_candidates(terms)):
            candidates.append((90 - i, url))
    except Exception as e:  # noqa: BLE001
        result["wiki_error"] = str(e)

    best: tuple[float, Image.Image, str] | None = None
    errors = []
    seen_urls: set[str] = set()
    for src_score, url in candidates:
        if url in seen_urls:
            continue
        seen_urls.add(url)
        try:
            if re.search(
                r"gettyimages|unsplash|shutterstock|istockphoto|vite\.svg|wsimg\.com/isteam/getty"
                r"|\.pdf(/|$|\?)|/page\d+-.*\.pdf",
                url,
                re.I,
            ):
                continue
            status, blob, ctype, final = fetch(url)
            if status != 200 or not blob or len(blob) < 80:
                continue
            if "html" in (ctype or "").lower() and not url.lower().split("?")[0].endswith(
                (".png", ".ico", ".webp", ".jpg", ".jpeg", ".svg")
            ):
                continue
            img = rasterize(blob, ctype, final)
            if img is None:
                continue
            # stash raw for manual review
            ext = Path(urlparse(final).path).suffix or ".bin"
            (RAW_DIR / f"{ticker}{ext}").write_bytes(blob[: 2_000_000])
            sc = score_image(img, src_score, final)
            if best is None or sc > best[0]:
                best = (sc, img, final)
                if img.size[0] >= 64 and img.size[1] >= 64 and sc > 220 and (
                    "wikimedia" in final or final.lower().split("?")[0].endswith((".png", ".webp", ".svg"))
                ):
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
    out.save(dest, "WEBP", quality=85, method=6)
    result.update(ok=True, src=src, bytes=dest.stat().st_size)
    return result


def write_manifest(ok_tickers: Iterable[str]) -> None:
    tickers = sorted(ok_tickers)
    items = ",\n  ".join(json.dumps(t) for t in tickers)
    body = (
        "// Logos locaux des sociétés BRVM (public/logos/brvm/{TICKER}.webp).\n"
        "// Généré par scripts/brvm/fetch-logos.py — ne pas éditer à la main.\n"
        "export const BRVM_LOGO_TICKERS: ReadonlySet<string> = new Set([\n"
        f"  {items},\n"
        "]);\n\n"
        "export function brvmLogoSrc(ticker: string | null | undefined): string | null {\n"
        "  if (!ticker) return null;\n"
        "  const t = ticker.trim().toUpperCase();\n"
        "  return BRVM_LOGO_TICKERS.has(t) ? `/logos/brvm/${t}.webp` : null;\n"
        "}\n"
    )
    if not tickers:
        body = body.replace("[\n  ,\n]", "[]")
        body = (
            "// Logos locaux des sociétés BRVM (public/logos/brvm/{TICKER}.webp).\n"
            "// Généré par scripts/brvm/fetch-logos.py — ne pas éditer à la main.\n"
            "export const BRVM_LOGO_TICKERS: ReadonlySet<string> = new Set([]);\n\n"
            "export function brvmLogoSrc(ticker: string | null | undefined): string | null {\n"
            "  if (!ticker) return null;\n"
            "  const t = ticker.trim().toUpperCase();\n"
            "  return BRVM_LOGO_TICKERS.has(t) ? `/logos/brvm/${t}.webp` : null;\n"
            "}\n"
        )
    MANIFEST_TS.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_TS.write_text(body)


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    only = {t.upper() for t in sys.argv[1:]} if len(sys.argv) > 1 else None
    companies = [c for c in COMPANIES if only is None or c[0] in only]
    print(f"companies: {len(companies)}", flush=True)
    results = []
    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = {ex.submit(process_ticker, *c): c[0] for c in companies}
        done = 0
        for fut in as_completed(futs):
            r = fut.result()
            results.append(r)
            done += 1
            flag = "OK" if r["ok"] else "NO"
            print(f"[{done}/{len(companies)}] {flag} {r['ticker']}: {r.get('src') or r.get('error')}", flush=True)
    # Keep previously successful logos if this run is partial
    existing = {p.stem for p in OUT_DIR.glob("*.webp")}
    ok = sorted({r["ticker"] for r in results if r["ok"]} | existing)
    if only:
        # don't drop other tickers from the manifest
        ok = sorted(existing)
    write_manifest(ok)
    # merge reports if partial
    REPORT.write_text(json.dumps({"ok": ok, "count": len(ok), "results": results}, indent=2, ensure_ascii=False))
    print(f"DONE {len([r for r in results if r['ok']])}/{len(companies)} this run, manifest {len(ok)} -> {OUT_DIR}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
