#!/usr/bin/env python3
"""Render The Quiet Vale steward card board in the unified leather style."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw
from pypdf import PdfReader
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from generate_unified_a1_board import (
    ALEGREYA_SANS,
    ALMENDRA,
    apply_unified_neoprene_finish,
    draw_material_text,
    draw_outer_finish,
    draw_stitch_path,
    px,
    render_recess,
    rounded_rect_path,
    tiled_leather,
)


ROOT = Path(__file__).resolve().parents[2]
INCH_MM = 25.4
CANVAS_WIDTH_IN = 24.5
CANVAS_HEIGHT_IN = 7.0
CANVAS_WIDTH_MM = CANVAS_WIDTH_IN * INCH_MM
CANVAS_HEIGHT_MM = CANVAS_HEIGHT_IN * INCH_MM
BLEED_MM = 3.175
SAFE_MARGIN_MM = 3.175
FOLD_SAFETY_MM = 6.0
FOLD_X_MM = CANVAS_WIDTH_MM / 2.0

TAROT_WIDTH_MM = 70.0
TAROT_HEIGHT_MM = 120.0
CARD_COLUMN_GAP_MM = 6.0
CARD_GRID_WIDTH_MM = 5.0 * TAROT_WIDTH_MM + 4.0 * CARD_COLUMN_GAP_MM
CARD_GRID_HEIGHT_MM = TAROT_HEIGHT_MM

IN_PLAY_WIDTH_MM = 400.0
IN_PLAY_HEIGHT_MM = 145.0
IN_PLAY_X_MM = (CANVAS_WIDTH_MM - IN_PLAY_WIDTH_MM) / 2.0
IN_PLAY_Y_MM = 16.4

DECK_WIDTH_MM = 76.0
DECK_HEIGHT_MM = 127.0
DECK_Y_MM = IN_PLAY_Y_MM + (IN_PLAY_HEIGHT_MM - DECK_HEIGHT_MM) / 2.0
OUTER_STITCH_INSET_MM = 6.5
MAIN_STITCH_OUTSET_MM = 2.7
STANDARD_THREAD_COLOUR = (145, 108, 71)
DECK_BAND_CENTER_MM = (
    OUTER_STITCH_INSET_MM
    + IN_PLAY_X_MM
    - MAIN_STITCH_OUTSET_MM
) / 2.0
LEFT_DECK_X_MM = DECK_BAND_CENTER_MM - DECK_WIDTH_MM / 2.0
RIGHT_DECK_X_MM = CANVAS_WIDTH_MM - LEFT_DECK_X_MM - DECK_WIDTH_MM

OUTPUT_DIR = ROOT / "output/pdf/stewards-board-compact-v3-printer-ready"
PREVIEW_PATH = OUTPUT_DIR / "the-quiet-vale-stewards-board-compact-v3-preview.png"
FIT_PROOF_PATH = OUTPUT_DIR / "the-quiet-vale-stewards-board-compact-v3-card-fit-proof.png"
FULL_PATH = OUTPUT_DIR / "the-quiet-vale-stewards-board-compact-v3-finished-size.png"
UPLOAD_PATH = OUTPUT_DIR / "the-quiet-vale-stewards-board-compact-v3-upload-with-bleed.png"
PDF_PATH = OUTPUT_DIR / "the-quiet-vale-stewards-board-compact-v3-upload-with-bleed.pdf"
PRODUCTION_PROOF_PATH = OUTPUT_DIR / "the-quiet-vale-stewards-board-compact-v3-production-proof.png"
MANIFEST_PATH = OUTPUT_DIR / "the-quiet-vale-stewards-board-compact-v3.json"


def draw_recess_panel(
    board: Image.Image,
    pixels_per_mm: float,
    bbox_mm: tuple[float, float, float, float],
    label: str,
    thread_colour: tuple[int, int, int],
    seed: int,
    label_size_mm: float,
    label_x_mm: float | None = None,
) -> None:
    left, top, right, bottom = bbox_mm
    bbox = tuple(px(value, pixels_per_mm) for value in bbox_mm)
    render_recess(
        board,
        bbox,
        radius_px=px(7.5, pixels_per_mm),
        depth_px=max(3, px(2.1, pixels_per_mm)),
        interior_brightness=0.73,
    )
    stitch_inset = px(4.2, pixels_per_mm)
    stitch_path = rounded_rect_path(
        (
            bbox[0] + stitch_inset,
            bbox[1] + stitch_inset,
            bbox[2] - stitch_inset,
            bbox[3] - stitch_inset,
        ),
        px(5.1, pixels_per_mm),
    )
    draw_stitch_path(
        board,
        stitch_path,
        thread_colour,
        pixels_per_mm,
        seed=seed,
    )
    draw_material_text(
        board,
        label,
        (
            label_x_mm if label_x_mm is not None else (left + right) / 2.0,
            top + 17.5,
        ),
        ALMENDRA,
        label_size_mm,
        (206, 192, 154),
        pixels_per_mm,
        seed=seed + 1000,
    )


def card_grid_origins() -> list[tuple[float, float]]:
    grid_left = IN_PLAY_X_MM + (
        IN_PLAY_WIDTH_MM - CARD_GRID_WIDTH_MM
    ) / 2.0
    grid_top = IN_PLAY_Y_MM + (
        IN_PLAY_HEIGHT_MM - CARD_GRID_HEIGHT_MM
    ) / 2.0
    origins: list[tuple[float, float]] = []
    for row in range(1):
        for column in range(5):
            origins.append(
                (
                    grid_left
                    + column * (TAROT_WIDTH_MM + CARD_COLUMN_GAP_MM),
                    grid_top,
                )
            )
    return origins


def build_board(pixels_per_mm: float) -> Image.Image:
    board = tiled_leather(
        px(CANVAS_WIDTH_MM, pixels_per_mm),
        px(CANVAS_HEIGHT_MM, pixels_per_mm),
        pixels_per_mm,
    ).convert("RGBA")
    draw_outer_finish(board, pixels_per_mm)

    draw_recess_panel(
        board,
        pixels_per_mm,
        (
            IN_PLAY_X_MM,
            IN_PLAY_Y_MM,
            IN_PLAY_X_MM + IN_PLAY_WIDTH_MM,
            IN_PLAY_Y_MM + IN_PLAY_HEIGHT_MM,
        ),
        "IN PLAY",
        STANDARD_THREAD_COLOUR,
        16100,
        8.5,
    )
    draw_recess_panel(
        board,
        pixels_per_mm,
        (
            LEFT_DECK_X_MM,
            DECK_Y_MM,
            LEFT_DECK_X_MM + DECK_WIDTH_MM,
            DECK_Y_MM + DECK_HEIGHT_MM,
        ),
        "ENCOUNTER",
        STANDARD_THREAD_COLOUR,
        16200,
        5.9,
    )
    draw_recess_panel(
        board,
        pixels_per_mm,
        (
            RIGHT_DECK_X_MM,
            DECK_Y_MM,
            RIGHT_DECK_X_MM + DECK_WIDTH_MM,
            DECK_Y_MM + DECK_HEIGHT_MM,
        ),
        "DISCARD",
        STANDARD_THREAD_COLOUR,
        16300,
        5.9,
    )
    return apply_unified_neoprene_finish(board, pixels_per_mm)


def add_bleed(board: Image.Image, pixels_per_mm: float) -> Image.Image:
    """Extend the unified leather naturally beyond the finished trim edge."""
    bleed_px = px(BLEED_MM, pixels_per_mm)
    source = board.convert("RGB")
    output = Image.new(
        "RGB",
        (source.width + 2 * bleed_px, source.height + 2 * bleed_px),
    )
    output.paste(source, (bleed_px, bleed_px))

    left = source.crop((0, 0, 1, source.height)).resize(
        (bleed_px, source.height),
        Image.Resampling.BICUBIC,
    )
    right = source.crop((source.width - 1, 0, source.width, source.height)).resize(
        (bleed_px, source.height),
        Image.Resampling.BICUBIC,
    )
    top = source.crop((0, 0, source.width, 1)).resize(
        (source.width, bleed_px),
        Image.Resampling.BICUBIC,
    )
    bottom = source.crop((0, source.height - 1, source.width, source.height)).resize(
        (source.width, bleed_px),
        Image.Resampling.BICUBIC,
    )
    output.paste(left, (0, bleed_px))
    output.paste(right, (bleed_px + source.width, bleed_px))
    output.paste(top, (bleed_px, 0))
    output.paste(bottom, (bleed_px, bleed_px + source.height))

    corners = (
        ((0, 0), source.getpixel((0, 0))),
        ((bleed_px + source.width, 0), source.getpixel((source.width - 1, 0))),
        ((0, bleed_px + source.height), source.getpixel((0, source.height - 1))),
        (
            (bleed_px + source.width, bleed_px + source.height),
            source.getpixel((source.width - 1, source.height - 1)),
        ),
    )
    drawing = ImageDraw.Draw(output)
    for (left_px, top_px), colour in corners:
        drawing.rectangle(
            (
                left_px,
                top_px,
                left_px + bleed_px - 1,
                top_px + bleed_px - 1,
            ),
            fill=colour,
        )
    return output


def build_production_proof(upload: Image.Image, pixels_per_mm: float) -> Image.Image:
    proof = upload.convert("RGBA")
    overlay = Image.new("RGBA", proof.size, (0, 0, 0, 0))
    drawing = ImageDraw.Draw(overlay)
    offset = BLEED_MM

    def mm_line(points, fill, width_mm, dash_mm=None):
        converted = [
            (px(x + offset, pixels_per_mm), px(y + offset, pixels_per_mm))
            for x, y in points
        ]
        if dash_mm is None:
            drawing.line(converted, fill=fill, width=max(1, px(width_mm, pixels_per_mm)))
            return
        (x1, y1), (x2, y2) = converted
        length = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
        if length <= 0:
            return
        dash_px = px(dash_mm, pixels_per_mm)
        gap_px = dash_px
        position = 0.0
        while position < length:
            end = min(length, position + dash_px)
            drawing.line(
                (
                    x1 + (x2 - x1) * position / length,
                    y1 + (y2 - y1) * position / length,
                    x1 + (x2 - x1) * end / length,
                    y1 + (y2 - y1) * end / length,
                ),
                fill=fill,
                width=max(1, px(width_mm, pixels_per_mm)),
            )
            position += dash_px + gap_px

    trim = (
        px(offset, pixels_per_mm),
        px(offset, pixels_per_mm),
        px(offset + CANVAS_WIDTH_MM, pixels_per_mm),
        px(offset + CANVAS_HEIGHT_MM, pixels_per_mm),
    )
    safe = (
        px(offset + SAFE_MARGIN_MM, pixels_per_mm),
        px(offset + SAFE_MARGIN_MM, pixels_per_mm),
        px(offset + CANVAS_WIDTH_MM - SAFE_MARGIN_MM, pixels_per_mm),
        px(offset + CANVAS_HEIGHT_MM - SAFE_MARGIN_MM, pixels_per_mm),
    )
    drawing.rectangle(trim, outline=(228, 77, 77, 230), width=max(1, px(0.45, pixels_per_mm)))
    drawing.rectangle(safe, outline=(88, 211, 139, 220), width=max(1, px(0.35, pixels_per_mm)))
    mm_line(
        [(FOLD_X_MM, 0), (FOLD_X_MM, CANVAS_HEIGHT_MM)],
        (80, 170, 255, 225),
        0.45,
        2.5,
    )
    for x in (FOLD_X_MM - FOLD_SAFETY_MM, FOLD_X_MM + FOLD_SAFETY_MM):
        mm_line([(x, 0), (x, CANVAS_HEIGHT_MM)], (255, 190, 70, 170), 0.25, 2.0)
    proof.alpha_composite(overlay)
    return proof.convert("RGB")


def build_fit_proof(preview: Image.Image, pixels_per_mm: float) -> Image.Image:
    proof = preview.convert("RGBA")
    overlay = Image.new("RGBA", proof.size, (0, 0, 0, 0))
    drawing = ImageDraw.Draw(overlay)
    for index, (left, top) in enumerate(card_grid_origins(), start=1):
        bbox = (
            px(left, pixels_per_mm),
            px(top, pixels_per_mm),
            px(left + TAROT_WIDTH_MM, pixels_per_mm),
            px(top + TAROT_HEIGHT_MM, pixels_per_mm),
        )
        drawing.rounded_rectangle(
            bbox,
            radius=px(3.0, pixels_per_mm),
            fill=(215, 202, 164, 34),
            outline=(215, 202, 164, 150),
            width=max(1, px(0.55, pixels_per_mm)),
        )
        drawing.text(
            (
                (bbox[0] + bbox[2]) / 2.0,
                (bbox[1] + bbox[3]) / 2.0,
            ),
            str(index),
            fill=(215, 202, 164, 190),
            anchor="mm",
        )
    for left, top, colour in (
        (
            LEFT_DECK_X_MM + (DECK_WIDTH_MM - TAROT_WIDTH_MM) / 2.0,
            DECK_Y_MM + (DECK_HEIGHT_MM - TAROT_HEIGHT_MM) / 2.0,
            (193, 143, 84),
        ),
        (
            RIGHT_DECK_X_MM + (DECK_WIDTH_MM - TAROT_WIDTH_MM) / 2.0,
            DECK_Y_MM + (DECK_HEIGHT_MM - TAROT_HEIGHT_MM) / 2.0,
            (153, 96, 84),
        ),
    ):
        drawing.rounded_rectangle(
            (
                px(left, pixels_per_mm),
                px(top, pixels_per_mm),
                px(left + TAROT_WIDTH_MM, pixels_per_mm),
                px(top + TAROT_HEIGHT_MM, pixels_per_mm),
            ),
            radius=px(3.0, pixels_per_mm),
            fill=(*colour, 34),
            outline=(*colour, 170),
            width=max(1, px(0.55, pixels_per_mm)),
        )
    proof.alpha_composite(overlay)
    return proof.convert("RGB")


def write_pdf(board: Image.Image) -> None:
    upload_width_mm = CANVAS_WIDTH_MM + 2.0 * BLEED_MM
    upload_height_mm = CANVAS_HEIGHT_MM + 2.0 * BLEED_MM
    pdf = canvas.Canvas(
        str(PDF_PATH),
        pagesize=(upload_width_mm * mm, upload_height_mm * mm),
        pageCompression=1,
    )
    pdf.setTitle("The Quiet Vale - Compact Stewards Board Printer Ready V3")
    pdf.setAuthor("The Quiet Vale project")
    pdf.setSubject("Steward tarot-card play area")
    pdf.drawImage(
        ImageReader(board),
        0,
        0,
        width=upload_width_mm * mm,
        height=upload_height_mm * mm,
        preserveAspectRatio=False,
        mask="auto",
    )
    pdf.showPage()
    pdf.save()


def write_manifest(pixels_per_mm: float, board: Image.Image) -> None:
    manifest = {
        "status": "printer-preparation pass - awaiting manufacturer upload preview approval",
        "finishedSize": {
            "widthIn": CANVAS_WIDTH_IN,
            "heightIn": CANVAS_HEIGHT_IN,
            "widthMm": CANVAS_WIDTH_MM,
            "heightMm": CANVAS_HEIGHT_MM,
        },
        "cardStandard": {
            "widthMm": TAROT_WIDTH_MM,
            "heightMm": TAROT_HEIGHT_MM,
        },
        "inPlay": {
            "capacity": 5,
            "rows": 1,
            "columns": 5,
            "recessWidthMm": IN_PLAY_WIDTH_MM,
            "recessHeightMm": IN_PLAY_HEIGHT_MM,
            "cardColumnGapMm": CARD_COLUMN_GAP_MM,
            "individualCardOutlinesPrinted": False,
        },
        "decks": {
            "encounter": "76 x 127 mm warehouse-style recess",
            "discard": "76 x 127 mm warehouse-style recess",
        },
        "tokens": None,
        "targetCards": None,
        "stitching": {
            "standardisedToOuterBorder": True,
            "rgb": list(STANDARD_THREAD_COLOUR),
            "categoryColoursUsed": False,
        },
        "raster": {
            "pixelsPerMm": pixels_per_mm,
            "effectivePpi": pixels_per_mm * INCH_MM,
            "pixelWidth": board.width,
            "pixelHeight": board.height,
        },
        "printPreparation": {
            "manufacturer": "BoardGamesMaker.com",
            "fold": "bi-fold (single vertical hinge)",
            "bleedMmEachSide": BLEED_MM,
            "safeMarginMmInsideTrim": SAFE_MARGIN_MM,
            "foldCentreMm": [FOLD_X_MM],
            "proofFoldSafetyMmEachSide": FOLD_SAFETY_MM,
            "centredTextOverVerticalHingeIntentional": True,
            "hingeConstruction": "creaseless / lay-flat option requested",
            "uploadIncludesGuides": False,
            "productionProofIsNotForUpload": True,
        },
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n")


def validate_pdf() -> None:
    reader = PdfReader(str(PDF_PATH))
    if len(reader.pages) != 1:
        raise RuntimeError("Expected a one-page steward board PDF")
    page = reader.pages[0]
    width_mm = float(page.mediabox.width) / 72.0 * INCH_MM
    height_mm = float(page.mediabox.height) / 72.0 * INCH_MM
    expected_width_mm = CANVAS_WIDTH_MM + 2.0 * BLEED_MM
    expected_height_mm = CANVAS_HEIGHT_MM + 2.0 * BLEED_MM
    if abs(width_mm - expected_width_mm) > 0.02:
        raise RuntimeError(f"Incorrect PDF width: {width_mm:.4f} mm")
    if abs(height_mm - expected_height_mm) > 0.02:
        raise RuntimeError(f"Incorrect PDF height: {height_mm:.4f} mm")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--pixels-per-mm",
        type=float,
        default=4.0,
        choices=(4.0, 12.0),
    )
    args = parser.parse_args()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    board = build_board(args.pixels_per_mm)
    if args.pixels_per_mm == 4.0:
        board.save(PREVIEW_PATH, format="PNG", optimize=True)
        build_fit_proof(board, args.pixels_per_mm).save(
            FIT_PROOF_PATH,
            format="PNG",
            optimize=True,
        )
        write_manifest(args.pixels_per_mm, board)
        print(f"Wrote {PREVIEW_PATH}")
        print(f"Wrote {FIT_PROOF_PATH}")
        print(f"Wrote {MANIFEST_PATH}")
        return

    production_dpi = args.pixels_per_mm * INCH_MM
    board.save(
        FULL_PATH,
        format="PNG",
        optimize=True,
        dpi=(production_dpi, production_dpi),
    )
    upload = add_bleed(board, args.pixels_per_mm)
    upload.save(
        UPLOAD_PATH,
        format="PNG",
        optimize=True,
        dpi=(production_dpi, production_dpi),
    )
    preview = board.resize(
        (
            px(CANVAS_WIDTH_MM, 4.0),
            px(CANVAS_HEIGHT_MM, 4.0),
        ),
        Image.Resampling.LANCZOS,
    )
    preview.save(PREVIEW_PATH, format="PNG", optimize=True)
    build_fit_proof(preview, 4.0).save(
        FIT_PROOF_PATH,
        format="PNG",
        optimize=True,
    )
    build_production_proof(upload, args.pixels_per_mm).save(
        PRODUCTION_PROOF_PATH,
        format="PNG",
        optimize=True,
    )
    write_pdf(upload)
    write_manifest(args.pixels_per_mm, upload)
    validate_pdf()
    print(f"Wrote {FULL_PATH}")
    print(f"Wrote {UPLOAD_PATH}")
    print(f"Wrote {PREVIEW_PATH}")
    print(f"Wrote {FIT_PROOF_PATH}")
    print(f"Wrote {PDF_PATH}")
    print(f"Wrote {PRODUCTION_PROOF_PATH}")
    print(f"Wrote {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
