#!/usr/bin/env python3
"""Trim transparent / near-white borders on BRVM and NGX logo assets.

Re-pads to ~8% and writes a square 128px WebP. Also used as a coverage check:
the bbox of non-background pixels must cover at least 60% of the width or height.

Usage:
  python3 scripts/trim-logo-assets.py           # rewrite the files
  python3 scripts/trim-logo-assets.py --check   # verify coverage only
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
LOGO_DIRS = [
    ROOT / "public" / "logos" / "brvm",
    ROOT / "public" / "logos" / "ngx",
]

OUT_SIZE = 128
PAD_FRAC = 0.08
ALPHA_THR = 8
WHITE_THR = 250
MIN_COVERAGE = 0.60


def is_near_white(r: int, g: int, b: int, a: int, white_thr: int = WHITE_THR) -> bool:
    return a > ALPHA_THR and r >= white_thr and g >= white_thr and b >= white_thr


def bboxes(im: Image.Image) -> tuple[tuple[int, int, int, int] | None, tuple[int, int, int, int] | None]:
    """Return (alpha_bbox, color_bbox) as (left, top, right, bottom) exclusive."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    a_minx = a_miny = c_minx = c_miny = w
    a_maxx = a_maxy = c_maxx = c_maxy = -1
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a <= ALPHA_THR:
                continue
            if x < a_minx:
                a_minx = x
            if y < a_miny:
                a_miny = y
            if x > a_maxx:
                a_maxx = x
            if y > a_maxy:
                a_maxy = y
            if r >= WHITE_THR and g >= WHITE_THR and b >= WHITE_THR:
                continue
            if x < c_minx:
                c_minx = x
            if y < c_miny:
                c_miny = y
            if x > c_maxx:
                c_maxx = x
            if y > c_maxy:
                c_maxy = y
    alpha = (a_minx, a_miny, a_maxx + 1, a_maxy + 1) if a_maxx >= 0 else None
    color = (c_minx, c_miny, c_maxx + 1, c_maxy + 1) if c_maxx >= 0 else None
    return alpha, color


def choose_bbox(alpha, color) -> tuple[int, int, int, int] | None:
    """Prefer the non-white bbox; fall back to alpha if the mark is white-on-transparent."""
    if color is None:
        return alpha
    if alpha is None:
        return color
    aw, ah = alpha[2] - alpha[0], alpha[3] - alpha[1]
    cw, ch = color[2] - color[0], color[3] - color[1]
    # If knocking out white would discard most of a light mark, keep the alpha box.
    if aw * ah > 0 and (cw * ch) / (aw * ah) < 0.25 and (cw / aw < 0.40 and ch / ah < 0.40):
        return alpha
    return color


def coverage(im: Image.Image) -> tuple[float, float, tuple[int, int, int, int] | None]:
    alpha, color = bboxes(im)
    box = choose_bbox(alpha, color)
    if not box:
        return 0.0, 0.0, None
    w, h = im.size
    return (box[2] - box[0]) / w, (box[3] - box[1]) / h, box


def trim_and_pad(im: Image.Image, size: int = OUT_SIZE, pad_frac: float = PAD_FRAC) -> Image.Image:
    im = im.convert("RGBA")
    alpha, color = bboxes(im)
    box = choose_bbox(alpha, color)
    if not box:
        # Empty: keep a transparent square rather than inventing pixels.
        return Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cropped = im.crop(box)
    pad = max(1, round(size * pad_frac))
    inner = max(1, size - 2 * pad)
    cw, ch = cropped.size
    scale = min(inner / cw, inner / ch)
    nw, nh = max(1, round(cw * scale)), max(1, round(ch * scale))
    fitted = cropped.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(fitted, ((size - nw) // 2, (size - nh) // 2), fitted)
    return canvas


def iter_logos() -> list[Path]:
    files: list[Path] = []
    for d in LOGO_DIRS:
        files.extend(sorted(d.glob("*.webp")))
    return files


def check(paths: list[Path]) -> int:
    failed: list[str] = []
    for p in paths:
        im = Image.open(p)
        cov_w, cov_h, box = coverage(im)
        ok = cov_w >= MIN_COVERAGE or cov_h >= MIN_COVERAGE
        if not ok:
            failed.append(
                f"{p.relative_to(ROOT)}  cover={cov_w:.1%} x {cov_h:.1%}  bbox={box}  canvas={im.size[0]}x{im.size[1]}"
            )
    if failed:
        print(f"FAIL: {len(failed)}/{len(paths)} logos cover < {MIN_COVERAGE:.0%} of width and height:")
        for line in failed:
            print("  ", line)
        return 1
    print(f"OK: {len(paths)} logos fill at least {MIN_COVERAGE:.0%} of one side.")
    return 0


def rewrite(paths: list[Path]) -> None:
    for p in paths:
        src = Image.open(p)
        out = trim_and_pad(src)
        out.save(p, "WEBP", quality=90, method=6)
        cov_w, cov_h, _ = coverage(out)
        flag = "OK" if cov_w >= MIN_COVERAGE or cov_h >= MIN_COVERAGE else "TINY"
        print(f"  {flag} {p.parent.name}/{p.name}  {src.size[0]}x{src.size[1]} -> {out.size[0]}x{out.size[1]}  cover={cov_w:.1%} x {cov_h:.1%}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="verify coverage only, do not rewrite")
    args = parser.parse_args()
    paths = iter_logos()
    if not paths:
        print("No logo files found.", file=sys.stderr)
        return 2
    if args.check:
        return check(paths)
    print(f"Trimming {len(paths)} logos to {OUT_SIZE}px with {PAD_FRAC:.0%} padding…")
    rewrite(paths)
    return check(paths)


if __name__ == "__main__":
    sys.exit(main())
