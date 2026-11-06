#!/usr/bin/env python3
"""Artwork for the Steward Guides: leather covers and the parchment page.

Uses the board generator's leather, gold foil lettering and stitching, so the
guides match the boards. Writes to design/steward-guides/assets/.
    python3 design/steward-guides/make_assets.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "design/boards-v4"))
import build_leather_boards as lb  # noqa: E402
from build_leather_boards import Board, rounded_rect_path, draw_stitch_path, GOLD_THREAD, P, FONTS  # noqa: E402

OUT = Path(__file__).resolve().parent / "assets"
W_MM, H_MM = 105.0, 148.0  # A6 trim; Board adds 3.175 mm bleed
CARD_BACK = ROOT / "design/encounter-card-templates/card-back/print/card-back-tarot-printerstudio-600dpi.png"


def medallion(b: Board, cx: float, cy: float, d_mm: float):
    """The card-back compass, full strength, set into the leather."""
    from PIL import ImageDraw
    src = Image.open(CARD_BACK).convert("RGB")
    c, r = (897, 1497), 333
    disc = src.crop((c[0] - r, c[1] - r, c[0] + r, c[1] + r))
    size = P(d_mm)
    disc = disc.resize((size, size), Image.Resampling.LANCZOS)
    k = 4
    m = Image.new("L", (size * k, size * k), 0)
    ImageDraw.Draw(m).ellipse((k, k, size * k - k, size * k - k), fill=255)
    m = m.resize((size, size), Image.Resampling.LANCZOS)
    X, Y = b.xy(cx, cy)
    pad = P(2)
    sh = Image.new("L", (size + 2 * pad, size + 2 * pad), 0)
    sh.paste(m, (pad + P(0.5), pad + P(0.7)))
    sh = sh.filter(ImageFilter.GaussianBlur(P(0.8)))
    b.img.alpha_composite(lb.rgba((0, 0, 0), sh, 0.75), (X - size // 2 - pad, Y - size // 2 - pad))
    layer = ImageEnhance.Brightness(disc).enhance(0.92).convert("RGBA")
    layer.putalpha(m)
    b.img.alpha_composite(layer, (X - size // 2, Y - size // 2))


def frame_stitch(b: Board, inset: float, seed: int):
    W, H = b.img.size
    g = lb.BLEED + inset
    draw_stitch_path(b.img, rounded_rect_path((P(g), P(g), W - P(g), H - P(g)), P(5)), GOLD_THREAD, lb.PPM, seed=seed)


def cover(seed: int) -> Image.Image:
    """One shared cover for all six guides: no Steward name, so every copy is identical."""
    b = Board(W_MM, H_MM, seed)
    frame_stitch(b, 6.0, seed + 1)
    b.label("THE QUIET VALE", W_MM / 2, 22, 7.0, seed + 2)
    b.label("Seasons of Settlement", W_MM / 2, 30, 3.8, seed + 3, font=FONTS / "alegreya-latin-italic.woff2")
    medallion(b, W_MM / 2, 64, 40)
    b.label("STEWARD", W_MM / 2, 104, 9.4, seed + 5)
    b.label("GUIDE", W_MM / 2, 116, 9.4, seed + 7)
    b.label("The six Stewards, their Powers and every Core Tile", W_MM / 2, 134, 3.2, seed + 6, font=FONTS / "alegreya-latin-italic.woff2")
    return b.finish()


def back(seed: int) -> Image.Image:
    b = Board(W_MM, H_MM, seed)
    frame_stitch(b, 6.0, seed + 1)
    b.tree(W_MM / 2, 64, 46, opacity=0.62)
    b.label("THE QUIET VALE", W_MM / 2, 106, 5.4, seed + 2)
    b.label("A shared settlement. A changing Vale. One story built together.", W_MM / 2, 120, 3.0, seed + 3, font=FONTS / "alegreya-latin-italic.woff2")
    return b.finish()


def parchment(w_px: int, h_px: int, seed: int) -> Image.Image:
    """Plain warm parchment with fine grain and a soft, even edge tone."""
    rng = np.random.default_rng(seed)

    def noise(cell):
        gw, gh = int(w_px / cell) + 3, int(h_px / cell) + 3
        small = Image.fromarray((rng.random((gh, gw)) * 255).astype(np.uint8))
        return np.asarray(small.resize((int(gw * cell), int(gh * cell)), Image.Resampling.BICUBIC), np.float32)[:h_px, :w_px] / 127.5 - 1

    px_mm = w_px / (W_MM + 6.35)
    lum = 1 + 0.018 * noise(px_mm * 30) + 0.012 * noise(px_mm * 6) + 0.014 * noise(px_mm * 0.6)
    yy, xx = np.mgrid[0:h_px, 0:w_px].astype(np.float32)
    d = np.minimum.reduce((xx, yy, w_px - 1 - xx, h_px - 1 - yy)) / px_mm  # mm from edge
    edge = np.clip(1 - d / 14, 0, 1) ** 2 * 0.06
    base = np.array((243, 235, 214), np.float32)
    rgb = base * lum[..., None] * (1 - edge[..., None]) + np.array((150, 120, 80), np.float32) * edge[..., None]
    return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    cover(91000).save(OUT / "cover.jpg", quality=92, dpi=(304.8, 304.8))
    print("cover")
    back(92000).save(OUT / "back.jpg", quality=92, dpi=(304.8, 304.8))
    pw, ph = P(W_MM + 2 * lb.BLEED), P(H_MM + 2 * lb.BLEED)
    parchment(pw, ph, 93000).save(OUT / "parchment.jpg", quality=90, dpi=(304.8, 304.8))
    print("done")


if __name__ == "__main__":
    main()
