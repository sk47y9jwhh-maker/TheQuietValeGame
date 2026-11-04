#!/usr/bin/env python3
"""Covers and page texture for the v6.9 rulebook, from the same leather, gold
lettering, stitching and parchment as the Steward Guides and the v4 boards.
    python3 design/rulebook-v7/make_assets.py
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "design/steward-guides"))
import make_assets as sg  # noqa: E402
from make_assets import lb, Board, FONTS  # noqa: E402

OUT = Path(__file__).resolve().parent / "assets"
W, H = 195.0, 255.0
ITALIC = FONTS / "alegreya-latin-italic.woff2"


def cover():
    b = Board(W, H, 95000)
    sg.frame_stitch(b, 8.0, 95001)
    b.label("THE QUIET VALE", W / 2, 38, 13.0, 95002)
    b.label("Seasons of Settlement", W / 2, 52, 6.4, 95003, font=ITALIC)
    sg.medallion(b, W / 2, 118, 74)
    b.label("RULEBOOK", W / 2, 184, 9.0, 95004)
    b.label("A game of stewardship and renewal", W / 2, 198, 5.0, 95005, font=ITALIC)
    b.label("1 to 5 players  ·  45 to 150 minutes  ·  Cooperative", W / 2, 232, 4.0, 95006, font=lb.SANS)
    return b.finish()


def back():
    b = Board(W, H, 96000)
    sg.frame_stitch(b, 8.0, 96001)
    b.tree(W / 2, 108, 84, opacity=0.62)
    b.label("THE QUIET VALE", W / 2, 180, 9.0, 96002)
    b.label("A shared settlement. A changing Vale. One story built together.", W / 2, 196, 4.6, 96003, font=ITALIC)
    b.label("Rulebook  ·  v6.9 review edition  ·  November 2026", W / 2, 232, 3.6, 96004, font=ITALIC)
    return b.finish()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    cover().save(OUT / "cover.jpg", quality=92, dpi=(304.8, 304.8)); print("cover")
    back().save(OUT / "back.jpg", quality=92, dpi=(304.8, 304.8)); print("back")
    sg.W_MM = W  # the parchment grain is scaled from the page width
    pw, ph = lb.P(W + 2 * lb.BLEED), lb.P(H + 2 * lb.BLEED)
    sg.parchment(pw, ph, 97000).save(OUT / "parchment.jpg", quality=88, dpi=(304.8, 304.8)); print("parchment")


if __name__ == "__main__":
    main()
