#!/usr/bin/env python3
"""Place the approved leather case design on BGM's standard box dieline."""

from __future__ import annotations

from pathlib import Path

from PIL import Image
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from generate_unified_a1_board import (
    ALMENDRA,
    apply_unified_neoprene_finish,
    draw_material_text,
    px,
    tiled_leather,
)


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output/pdf/game-box-standard-v1-printer-ready"
TMP = ROOT / "tmp/pdfs/game-box-template"
TEMPLATE = OUT / "source-template/BGM-12_5x10_5x3-template.pdf"
TEMPLATE_RENDER = TMP / "template-1.png"

PPI = 300.0
PPM = PPI / 25.4
PAGE_W_PT = 1656.0
PAGE_H_PT = 3173.36

# Measured directly from the official 72 dpi template render. Coordinates use
# top-left origin here; reportlab conversion happens only at placement time.
LID = (115.0, 145.0, 1430.0, 1300.0)
BASE = (115.0, 1525.0, 1430.0, 1518.0)


def pt_to_mm(value: float) -> float:
    return value / 72.0 * 25.4


def make_leather_wrap(width_pt: float, height_pt: float, lid: bool) -> Image.Image:
    width_mm = pt_to_mm(width_pt)
    height_mm = pt_to_mm(height_pt)
    art = tiled_leather(px(width_mm, PPM), px(height_mm, PPM), PPM).convert("RGBA")
    art = apply_unified_neoprene_finish(art, PPM).convert("RGBA")
    if lid:
        draw_material_text(
            art,
            "THE QUIET VALE",
            (width_mm / 2.0, height_mm / 2.0 - 7.0),
            ALMENDRA,
            17.0,
            (178, 150, 94),
            PPM,
            seed=91001,
            opacity=0.94,
        )
        draw_material_text(
            art,
            "SEASONS OF SETTLEMENT",
            (width_mm / 2.0, height_mm / 2.0 + 15.0),
            ALMENDRA,
            5.2,
            (174, 151, 108),
            PPM,
            seed=91002,
            opacity=0.91,
        )
    return art.convert("RGB")


def write_production_pdf(lid_path: Path, base_path: Path) -> Path:
    path = OUT / "the-quiet-vale-seasons-of-settlement-box-12_5x10_5x3-upload.pdf"
    pdf = canvas.Canvas(str(path), pagesize=(PAGE_W_PT, PAGE_H_PT), pageCompression=1)
    pdf.setTitle("The Quiet Vale - Seasons of Settlement - Box Artwork")
    pdf.setAuthor("The Quiet Vale project")
    pdf.setSubject("BoardGamesMaker 12.5 x 10.5 x 3 inch standard box artwork")
    for art_path, (left, top, width, height) in ((lid_path, LID), (base_path, BASE)):
        pdf.drawImage(
            ImageReader(str(art_path)),
            left,
            PAGE_H_PT - top - height,
            width=width,
            height=height,
            preserveAspectRatio=False,
            mask="auto",
        )
    pdf.showPage()
    pdf.save()
    return path


def make_proof(production_render: Path) -> Path:
    art = Image.open(production_render).convert("RGBA")
    template = Image.open(TEMPLATE_RENDER).convert("RGBA")
    if template.size != art.size:
        template = template.resize(art.size, Image.Resampling.LANCZOS)
    pixels = template.load()
    alpha = template.getchannel("A")
    alpha_pixels = alpha.load()
    for y in range(template.height):
        for x in range(template.width):
            r, g, b, _ = pixels[x, y]
            whiteness = min(r, g, b)
            if whiteness > 248:
                alpha_pixels[x, y] = 0
            elif r > 190 and g > 220 and b > 215:
                alpha_pixels[x, y] = 38
            else:
                alpha_pixels[x, y] = 185
    template.putalpha(alpha)
    art.alpha_composite(template)
    path = OUT / "the-quiet-vale-seasons-of-settlement-box-production-proof.png"
    art.convert("RGB").save(path, quality=95)
    return path


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)
    if not TEMPLATE.exists() or not TEMPLATE_RENDER.exists():
        raise FileNotFoundError("Official template PDF and its 72 dpi render are required.")
    lid = make_leather_wrap(LID[2], LID[3], True)
    base = make_leather_wrap(BASE[2], BASE[3], False)
    lid_path = OUT / "box-lid-wrap-300ppi.jpg"
    base_path = OUT / "box-base-wrap-300ppi.jpg"
    lid.save(lid_path, quality=95, subsampling=0, optimize=True)
    base.save(base_path, quality=95, subsampling=0, optimize=True)
    production_pdf = write_production_pdf(lid_path, base_path)
    # This render command is run by the calling production workflow.
    print(production_pdf)


if __name__ == "__main__":
    main()
