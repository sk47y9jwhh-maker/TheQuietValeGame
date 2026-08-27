#!/usr/bin/env python3
"""Prepare the locked production board for BoardGamesMaker upload."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw
from pypdf import PdfReader
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "output/pdf/production-board-v1"
SOURCE_PATH = SOURCE_DIR / "the-quiet-vale-production-board-v1-full-resolution.png"
OUTPUT_DIR = ROOT / "output/pdf/production-board-v1-printer-ready"

FINISHED_WIDTH_IN = 34.5
FINISHED_HEIGHT_IN = 24.5
INCH_MM = 25.4
FINISHED_WIDTH_MM = FINISHED_WIDTH_IN * INCH_MM
FINISHED_HEIGHT_MM = FINISHED_HEIGHT_IN * INCH_MM
BLEED_MM = 3.175
SAFE_MARGIN_MM = 3.175
FOLD_SAFETY_MM = 6.0
PIXELS_PER_MM = 12.0
PPI = PIXELS_PER_MM * INCH_MM

VERTICAL_FOLDS_MM = (
    FINISHED_WIDTH_MM / 3.0,
    2.0 * FINISHED_WIDTH_MM / 3.0,
)
HORIZONTAL_FOLDS_MM = (FINISHED_HEIGHT_MM / 2.0,)

FINISHED_PATH = OUTPUT_DIR / "the-quiet-vale-production-board-v1-finished-size.png"
UPLOAD_PATH = OUTPUT_DIR / "the-quiet-vale-production-board-v1-upload-with-bleed.png"
PDF_PATH = OUTPUT_DIR / "the-quiet-vale-production-board-v1-upload-with-bleed.pdf"
PREVIEW_PATH = OUTPUT_DIR / "the-quiet-vale-production-board-v1-printer-preview.png"
PROOF_PATH = OUTPUT_DIR / "the-quiet-vale-production-board-v1-production-proof.png"
MANIFEST_PATH = OUTPUT_DIR / "the-quiet-vale-production-board-v1-printer-manifest.json"
INSTRUCTIONS_PATH = OUTPUT_DIR / "PRINT-INSTRUCTIONS.txt"
LOCK_PATH = OUTPUT_DIR / "PRINTER-READY-LOCK.txt"


def px(value_mm: float) -> int:
    return int(round(value_mm * PIXELS_PER_MM))


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def add_bleed(source: Image.Image) -> Image.Image:
    """Extend only the existing outer leather edge beyond finished trim."""
    source = source.convert("RGB")
    bleed_px = px(BLEED_MM)
    output = Image.new(
        "RGB",
        (source.width + 2 * bleed_px, source.height + 2 * bleed_px),
    )
    output.paste(source, (bleed_px, bleed_px))

    left = source.crop((0, 0, bleed_px, source.height)).transpose(
        Image.Transpose.FLIP_LEFT_RIGHT,
    )
    right = source.crop(
        (source.width - bleed_px, 0, source.width, source.height),
    ).transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    top = source.crop((0, 0, source.width, bleed_px)).transpose(
        Image.Transpose.FLIP_TOP_BOTTOM,
    )
    bottom = source.crop(
        (0, source.height - bleed_px, source.width, source.height),
    ).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    output.paste(left, (0, bleed_px))
    output.paste(right, (bleed_px + source.width, bleed_px))
    output.paste(top, (bleed_px, 0))
    output.paste(bottom, (bleed_px, bleed_px + source.height))

    top_left = source.crop((0, 0, bleed_px, bleed_px)).transpose(
        Image.Transpose.ROTATE_180,
    )
    top_right = source.crop(
        (source.width - bleed_px, 0, source.width, bleed_px),
    ).transpose(Image.Transpose.ROTATE_180)
    bottom_left = source.crop(
        (0, source.height - bleed_px, bleed_px, source.height),
    ).transpose(Image.Transpose.ROTATE_180)
    bottom_right = source.crop(
        (
            source.width - bleed_px,
            source.height - bleed_px,
            source.width,
            source.height,
        ),
    ).transpose(Image.Transpose.ROTATE_180)
    output.paste(top_left, (0, 0))
    output.paste(top_right, (bleed_px + source.width, 0))
    output.paste(bottom_left, (0, bleed_px + source.height))
    output.paste(
        bottom_right,
        (bleed_px + source.width, bleed_px + source.height),
    )
    return output


def dashed_line(
    drawing: ImageDraw.ImageDraw,
    start: tuple[int, int],
    end: tuple[int, int],
    fill: tuple[int, int, int, int],
    width: int,
    dash: int,
) -> None:
    x1, y1 = start
    x2, y2 = end
    length = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
    if length <= 0:
        return
    position = 0.0
    while position < length:
        segment_end = min(length, position + dash)
        drawing.line(
            (
                x1 + (x2 - x1) * position / length,
                y1 + (y2 - y1) * position / length,
                x1 + (x2 - x1) * segment_end / length,
                y1 + (y2 - y1) * segment_end / length,
            ),
            fill=fill,
            width=width,
        )
        position += 2.0 * dash


def build_proof(upload: Image.Image) -> Image.Image:
    proof = upload.convert("RGBA")
    overlay = Image.new("RGBA", proof.size, (0, 0, 0, 0))
    drawing = ImageDraw.Draw(overlay)
    offset = BLEED_MM
    trim = (
        px(offset),
        px(offset),
        px(offset + FINISHED_WIDTH_MM),
        px(offset + FINISHED_HEIGHT_MM),
    )
    safe = (
        px(offset + SAFE_MARGIN_MM),
        px(offset + SAFE_MARGIN_MM),
        px(offset + FINISHED_WIDTH_MM - SAFE_MARGIN_MM),
        px(offset + FINISHED_HEIGHT_MM - SAFE_MARGIN_MM),
    )
    drawing.rectangle(trim, outline=(228, 77, 77, 230), width=px(0.45))
    drawing.rectangle(safe, outline=(88, 211, 139, 220), width=px(0.35))

    fold_colour = (80, 170, 255, 225)
    safety_colour = (255, 190, 70, 170)
    dash = px(2.5)
    for x_mm in VERTICAL_FOLDS_MM:
        x = px(offset + x_mm)
        dashed_line(drawing, (x, px(offset)), (x, px(offset + FINISHED_HEIGHT_MM)), fold_colour, px(0.45), dash)
        for safety_x in (x_mm - FOLD_SAFETY_MM, x_mm + FOLD_SAFETY_MM):
            sx = px(offset + safety_x)
            dashed_line(drawing, (sx, px(offset)), (sx, px(offset + FINISHED_HEIGHT_MM)), safety_colour, px(0.25), px(2.0))
    for y_mm in HORIZONTAL_FOLDS_MM:
        y = px(offset + y_mm)
        dashed_line(drawing, (px(offset), y), (px(offset + FINISHED_WIDTH_MM), y), fold_colour, px(0.45), dash)
        for safety_y in (y_mm - FOLD_SAFETY_MM, y_mm + FOLD_SAFETY_MM):
            sy = px(offset + safety_y)
            dashed_line(drawing, (px(offset), sy), (px(offset + FINISHED_WIDTH_MM), sy), safety_colour, px(0.25), px(2.0))
    proof.alpha_composite(overlay)
    return proof.convert("RGB")


def write_pdf(upload: Image.Image) -> None:
    width_mm = FINISHED_WIDTH_MM + 2.0 * BLEED_MM
    height_mm = FINISHED_HEIGHT_MM + 2.0 * BLEED_MM
    pdf = canvas.Canvas(
        str(PDF_PATH),
        pagesize=(width_mm * mm, height_mm * mm),
        pageCompression=1,
    )
    pdf.setTitle("The Quiet Vale - Production Board V1 Printer Ready")
    pdf.setAuthor("The Quiet Vale project")
    pdf.setSubject("Six-fold production board with bleed; unchanged 60 mm hex geometry")
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


def validate(source: Image.Image, finished: Image.Image, upload: Image.Image) -> None:
    if source.size != (10516, 7468):
        raise RuntimeError(f"Unexpected locked source dimensions: {source.size}")
    if finished.tobytes() != source.convert("RGB").tobytes():
        raise RuntimeError("Finished-size printer artwork differs from locked source")
    expected_upload = (
        source.width + 2 * px(BLEED_MM),
        source.height + 2 * px(BLEED_MM),
    )
    if upload.size != expected_upload:
        raise RuntimeError(f"Unexpected upload dimensions: {upload.size}")
    reader = PdfReader(str(PDF_PATH))
    if len(reader.pages) != 1:
        raise RuntimeError("Expected a one-page upload PDF")
    page = reader.pages[0]
    width_mm = float(page.mediabox.width) / 72.0 * INCH_MM
    height_mm = float(page.mediabox.height) / 72.0 * INCH_MM
    expected_width = FINISHED_WIDTH_MM + 2.0 * BLEED_MM
    expected_height = FINISHED_HEIGHT_MM + 2.0 * BLEED_MM
    if abs(width_mm - expected_width) > 0.02:
        raise RuntimeError(f"Incorrect PDF width: {width_mm:.4f} mm")
    if abs(height_mm - expected_height) > 0.02:
        raise RuntimeError(f"Incorrect PDF height: {height_mm:.4f} mm")


def write_support_files(source_hash: str, upload: Image.Image) -> None:
    manifest = {
        "status": "printer-ready; final manufacturer upload preview still required",
        "source": {
            "lockedPackage": "production-board-v1",
            "sourceFile": SOURCE_PATH.name,
            "sha256": source_hash,
            "finishedArtworkAltered": False,
        },
        "finishedSize": {
            "widthIn": FINISHED_WIDTH_IN,
            "heightIn": FINISHED_HEIGHT_IN,
            "widthMm": FINISHED_WIDTH_MM,
            "heightMm": FINISHED_HEIGHT_MM,
        },
        "uploadSize": {
            "widthIn": FINISHED_WIDTH_IN + 0.25,
            "heightIn": FINISHED_HEIGHT_IN + 0.25,
            "bleedMmEachSide": BLEED_MM,
        },
        "raster": {
            "pixelsPerMm": PIXELS_PER_MM,
            "effectivePpi": PPI,
            "pixelWidth": upload.width,
            "pixelHeight": upload.height,
            "colourMode": "RGB",
        },
        "folding": {
            "type": "six-fold",
            "panelGrid": "3 columns x 2 rows",
            "verticalFoldLinesMm": list(VERTICAL_FOLDS_MM),
            "horizontalFoldLinesMm": list(HORIZONTAL_FOLDS_MM),
            "recommendedConstruction": "creaseless / lay-flat",
            "foldGuidesPrinted": False,
        },
        "geometry": {
            "mapArtworkResized": False,
            "hexPointToPointMm": 60.0,
        },
        "proof": {
            "safeMarginMmInsideTrim": SAFE_MARGIN_MM,
            "foldSafetyMmEachSide": FOLD_SAFETY_MM,
            "notForUpload": True,
        },
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    INSTRUCTIONS_PATH.write_text(
        """THE QUIET VALE - MAIN PRODUCTION BOARD - PRINT INSTRUCTIONS

Manufacturer setup
- BoardGamesMaker.com custom size game board
- Finished size: 34.5 x 24.5 inches (876.3 x 622.3 mm)
- Fold: Six-fold, 3 columns x 2 rows
- Construction: Creaseless / lay-flat recommended
- Printing: Single-sided
- Recommended finish: Matte laminated, smooth finish

Upload this file
- the-quiet-vale-production-board-v1-upload-with-bleed.png

Upload artwork specification
- Art size including bleed: 34.75 x 24.75 inches
- Bleed: 0.125 inch / 3.175 mm on every side
- Finished trim: 34.5 x 24.5 inches
- Resolution: 305 PPI
- Colour mode: RGB
- No trim, safe-area, or fold guides are printed in the upload artwork
- The locked map and 60 mm hex geometry have not been changed

Proof file - DO NOT UPLOAD
- the-quiet-vale-production-board-v1-production-proof.png
  Red = finished trim
  Green = internal safe margin
  Blue = nominal six-fold centres
  Amber = conservative fold safety bands

Final approval gate
- Inspect BoardGamesMaker's online preview at 100% before ordering.
- Confirm the artwork fills the bleed boundary without automatic scaling.
- Confirm the finished-size crop is 34.5 x 24.5 inches.
- Confirm the fold orientation is 3 columns x 2 rows.
- Confirm the creaseless / lay-flat construction is selected.
- Print at 100% / Actual Size; never Fit or Scale.
- Order one physical proof before a production quantity.
""",
        encoding="utf-8",
    )


def write_lock(source_hash: str) -> None:
    paths = (
        FINISHED_PATH,
        UPLOAD_PATH,
        PDF_PATH,
        PREVIEW_PATH,
        PROOF_PATH,
        MANIFEST_PATH,
        INSTRUCTIONS_PATH,
    )
    lines = [
        "THE QUIET VALE - MAIN BOARD PRINTER-READY PACKAGE",
        "",
        f"Locked source SHA-256: {source_hash}",
        "Finished artwork altered: no",
        "",
        "SHA-256",
    ]
    lines.extend(f"{file_hash(path)}  {path.name}" for path in paths)
    LOCK_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    source_hash = file_hash(SOURCE_PATH)
    source = Image.open(SOURCE_PATH).convert("RGB")
    source.save(FINISHED_PATH, format="PNG", optimize=True, dpi=(PPI, PPI))
    finished = Image.open(FINISHED_PATH).convert("RGB")
    upload = add_bleed(finished)
    upload.save(UPLOAD_PATH, format="PNG", optimize=True, dpi=(PPI, PPI))
    preview = upload.resize(
        (int(round(upload.width / 3.0)), int(round(upload.height / 3.0))),
        Image.Resampling.LANCZOS,
    )
    preview.save(PREVIEW_PATH, format="PNG", optimize=True)
    build_proof(upload).save(PROOF_PATH, format="PNG", optimize=True)
    write_pdf(upload)
    validate(source, finished, upload)
    write_support_files(source_hash, upload)
    write_lock(source_hash)
    for path in (
        FINISHED_PATH,
        UPLOAD_PATH,
        PDF_PATH,
        PREVIEW_PATH,
        PROOF_PATH,
        MANIFEST_PATH,
        INSTRUCTIONS_PATH,
        LOCK_PATH,
    ):
        print(f"Wrote {path}")


if __name__ == "__main__":
    main()
