#!/usr/bin/env python3
"""Prepare the selected component board as printer-ready artwork."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw
from pypdf import PdfReader
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

import generate_component_board_concepts as component


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "output/pdf/component-board-v1-printer-ready"
INCH_MM = 25.4
WIDTH_IN = 24.5
HEIGHT_IN = 7.0
WIDTH_MM = WIDTH_IN * INCH_MM
HEIGHT_MM = HEIGHT_IN * INCH_MM
BLEED_MM = 3.175
PIXELS_PER_MM = 12.0
PPI = PIXELS_PER_MM * INCH_MM

FINISHED_PATH = OUTPUT_DIR / "the-quiet-vale-component-board-v1-finished-size.png"
UPLOAD_PATH = OUTPUT_DIR / "the-quiet-vale-component-board-v1-upload-with-bleed.png"
PDF_PATH = OUTPUT_DIR / "the-quiet-vale-component-board-v1-upload-with-bleed.pdf"
PREVIEW_PATH = OUTPUT_DIR / "the-quiet-vale-component-board-v1-preview.png"
PROOF_PATH = OUTPUT_DIR / "the-quiet-vale-component-board-v1-production-proof.png"
MANIFEST_PATH = OUTPUT_DIR / "the-quiet-vale-component-board-v1.json"
INSTRUCTIONS_PATH = OUTPUT_DIR / "PRINT-INSTRUCTIONS.txt"


def px(value_mm: float) -> int:
    return int(round(value_mm * PIXELS_PER_MM))


def add_bleed(source: Image.Image) -> Image.Image:
    bleed = px(BLEED_MM)
    result = Image.new(
        "RGB",
        (source.width + 2 * bleed, source.height + 2 * bleed),
    )
    result.paste(source, (bleed, bleed))
    result.paste(
        source.crop((0, 0, bleed, source.height)).transpose(Image.Transpose.FLIP_LEFT_RIGHT),
        (0, bleed),
    )
    result.paste(
        source.crop((source.width - bleed, 0, source.width, source.height)).transpose(
            Image.Transpose.FLIP_LEFT_RIGHT
        ),
        (bleed + source.width, bleed),
    )
    result.paste(
        source.crop((0, 0, source.width, bleed)).transpose(Image.Transpose.FLIP_TOP_BOTTOM),
        (bleed, 0),
    )
    result.paste(
        source.crop((0, source.height - bleed, source.width, source.height)).transpose(
            Image.Transpose.FLIP_TOP_BOTTOM
        ),
        (bleed, bleed + source.height),
    )
    for x, y, colour in (
        (0, 0, source.getpixel((0, 0))),
        (bleed + source.width, 0, source.getpixel((source.width - 1, 0))),
        (0, bleed + source.height, source.getpixel((0, source.height - 1))),
        (
            bleed + source.width,
            bleed + source.height,
            source.getpixel((source.width - 1, source.height - 1)),
        ),
    ):
        ImageDraw.Draw(result).rectangle((x, y, x + bleed, y + bleed), fill=colour)
    return result


def write_pdf(upload: Image.Image) -> None:
    width_mm = WIDTH_MM + 2 * BLEED_MM
    height_mm = HEIGHT_MM + 2 * BLEED_MM
    pdf = canvas.Canvas(str(PDF_PATH), pagesize=(width_mm * mm, height_mm * mm))
    pdf.setTitle("The Quiet Vale - Component Board V1 Printer Ready")
    pdf.setAuthor("The Quiet Vale project")
    pdf.setSubject("Core tiles, target cards, and tokens component board")
    pdf.drawImage(
        ImageReader(upload),
        0,
        0,
        width=width_mm * mm,
        height=height_mm * mm,
        preserveAspectRatio=False,
        mask="auto",
    )
    pdf.showPage()
    pdf.save()


def production_proof(upload: Image.Image) -> Image.Image:
    preview_width = 1900
    preview_height = round(upload.height * preview_width / upload.width)
    proof = upload.resize((preview_width, preview_height), Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(proof)
    bleed = round(BLEED_MM / (WIDTH_MM + 2 * BLEED_MM) * preview_width)
    draw.rectangle(
        (bleed, bleed, proof.width - bleed - 1, proof.height - bleed - 1),
        outline=(225, 62, 62),
        width=2,
    )
    return proof


def validate(board: Image.Image, upload: Image.Image) -> None:
    expected = (px(WIDTH_MM), px(HEIGHT_MM))
    if board.size != expected:
        raise RuntimeError(f"Incorrect finished raster size: {board.size}, expected {expected}")
    bleed = px(BLEED_MM)
    if upload.size != (expected[0] + 2 * bleed, expected[1] + 2 * bleed):
        raise RuntimeError("Incorrect bleed raster size")
    reader = PdfReader(str(PDF_PATH))
    if len(reader.pages) != 1:
        raise RuntimeError("Expected a one-page PDF")
    page = reader.pages[0]
    width_mm = float(page.mediabox.width) / 72.0 * INCH_MM
    height_mm = float(page.mediabox.height) / 72.0 * INCH_MM
    if abs(width_mm - (WIDTH_MM + 2 * BLEED_MM)) > 0.02:
        raise RuntimeError("Incorrect PDF width")
    if abs(height_mm - (HEIGHT_MM + 2 * BLEED_MM)) > 0.02:
        raise RuntimeError("Incorrect PDF height")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    component.PPM = PIXELS_PER_MM
    board = component.selected_layout().convert("RGB")
    board.save(FINISHED_PATH, format="PNG", optimize=True, dpi=(PPI, PPI))
    upload = add_bleed(board)
    upload.save(UPLOAD_PATH, format="PNG", optimize=True, dpi=(PPI, PPI))
    write_pdf(upload)
    board.resize(
        (round(board.width / 3), round(board.height / 3)),
        Image.Resampling.LANCZOS,
    ).save(PREVIEW_PATH, format="PNG", optimize=True)
    production_proof(upload).save(PROOF_PATH, format="PNG", optimize=True)
    validate(board, upload)

    manifest = {
        "status": "printer-ready; manufacturer upload preview approval required",
        "finishedSize": {
            "widthIn": WIDTH_IN,
            "heightIn": HEIGHT_IN,
            "widthMm": WIDTH_MM,
            "heightMm": HEIGHT_MM,
        },
        "bleedMmEachSide": BLEED_MM,
        "effectivePpi": PPI,
        "layout": {
            "targetCards": "plain narrow recess",
            "tokens": "plain narrow recess",
            "coreTiles": "open central recess with non-prescriptive category labels",
            "categoryWidthUnits": {
                "resource": 1,
                "housing": 1,
                "travel": 3,
                "socialAndWellbeing": 1,
                "merchantAndCrafting": 1,
            },
            "travelNote": "Triple-width open area accommodates connected multi-hex travel tiles.",
        },
        "uploadIncludesGuides": False,
        "productionProofIsNotForUpload": True,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n")
    INSTRUCTIONS_PATH.write_text(
        "THE QUIET VALE COMPONENT BOARD V1\n\n"
        "Finished size: 24.5 x 7 inches\n"
        "Artwork size with bleed: 24.75 x 7.25 inches\n"
        "Bleed: 0.125 inch / 3.175 mm on every side\n"
        f"Resolution: {PPI:.1f} PPI\n"
        "Upload: the-quiet-vale-component-board-v1-upload-with-bleed.png\n"
        "Alternative: the-quiet-vale-component-board-v1-upload-with-bleed.pdf\n\n"
        "Do not upload the production proof; its red line shows finished trim only.\n"
        "Disable automatic scaling and verify the manufacturer preview at 100% size.\n"
    )
    print(FINISHED_PATH)
    print(UPLOAD_PATH)
    print(PDF_PATH)
    print(PREVIEW_PATH)
    print(PROOF_PATH)


if __name__ == "__main__":
    main()
