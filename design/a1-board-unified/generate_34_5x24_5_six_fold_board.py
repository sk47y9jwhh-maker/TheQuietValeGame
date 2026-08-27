#!/usr/bin/env python3
"""Render the 34.5 x 24.5 inch six-fold board without altering the map."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image
from pypdf import PdfReader
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from generate_unified_a1_board import (
    A1_HEIGHT_MM,
    A1_WIDTH_MM,
    MAP_BOTTOM_MM,
    MAP_HEIGHT_MM,
    MAP_RIGHT_MM,
    MAP_TOP_MM,
    MAP_WIDTH_MM,
    MAP_X_MM,
    apply_unified_neoprene_finish,
    draw_map_stitching,
    draw_outer_finish,
    draw_round_tracker,
    draw_title,
    draw_warehouses,
    paste_exact_map,
    px,
    render_brass_fitting,
    tiled_leather,
)


ROOT = Path(__file__).resolve().parents[2]
INCH_MM = 25.4
CANVAS_WIDTH_IN = 34.5
CANVAS_HEIGHT_IN = 24.5
CANVAS_WIDTH_MM = CANVAS_WIDTH_IN * INCH_MM
CANVAS_HEIGHT_MM = CANVAS_HEIGHT_IN * INCH_MM
OUTER_STITCH_INSET_MM = 6.5
MAP_STITCH_OUTSET_MM = 2.7

WAREHOUSE_WIDTH_MM = 76.0
WAREHOUSE_HEIGHT_MM = 127.0
WAREHOUSE_GAP_MM = 18.5
WAREHOUSE_STACK_HEIGHT_MM = (
    3.0 * WAREHOUSE_HEIGHT_MM + 2.0 * WAREHOUSE_GAP_MM
)
WAREHOUSE_TOP_MM = (
    CANVAS_HEIGHT_MM - WAREHOUSE_STACK_HEIGHT_MM
) / 2.0

MAP_OFFSET_X_MM = (CANVAS_WIDTH_MM - A1_WIDTH_MM) / 2.0
MAP_OFFSET_Y_MM = (CANVAS_HEIGHT_MM - A1_HEIGHT_MM) / 2.0
MAP_LEFT_MM = MAP_X_MM + MAP_OFFSET_X_MM
MAP_RIGHT_PLACED_MM = MAP_RIGHT_MM + MAP_OFFSET_X_MM
MAP_TOP_PLACED_MM = MAP_TOP_MM + MAP_OFFSET_Y_MM
MAP_BOTTOM_PLACED_MM = MAP_BOTTOM_MM + MAP_OFFSET_Y_MM

WAREHOUSE_BAND_CENTER_MM = (
    OUTER_STITCH_INSET_MM
    + MAP_LEFT_MM
    - MAP_STITCH_OUTSET_MM
) / 2.0
WAREHOUSE_X_MM = WAREHOUSE_BAND_CENTER_MM - WAREHOUSE_WIDTH_MM / 2.0

TITLE_MAIN_SIZE_MM = 16.0
TITLE_SUBTITLE_SIZE_MM = 4.4
TRACKER_RADIUS_MM = 12.5
TRACKER_NUMBER_SIZE_MM = 7.4
SEASON_MARKER_SIZE_MM = 6.8
SEASON_MARKER_OFFSET_MM = 30.0

UPPER_MAP_STITCH_Y_MM = MAP_TOP_PLACED_MM - MAP_STITCH_OUTSET_MM
LOWER_MAP_STITCH_Y_MM = MAP_BOTTOM_PLACED_MM + MAP_STITCH_OUTSET_MM
UPPER_FIELD_CENTER_Y_MM = (
    OUTER_STITCH_INSET_MM + UPPER_MAP_STITCH_Y_MM
) / 2.0
LOWER_FIELD_CENTER_Y_MM = (
    LOWER_MAP_STITCH_Y_MM
    + CANVAS_HEIGHT_MM
    - OUTER_STITCH_INSET_MM
) / 2.0

FOLD_X_MM = (CANVAS_WIDTH_MM / 3.0, 2.0 * CANVAS_WIDTH_MM / 3.0)
FOLD_Y_MM = (CANVAS_HEIGHT_MM / 2.0,)
PANEL_WIDTH_MM = CANVAS_WIDTH_MM / 3.0
PANEL_HEIGHT_MM = CANVAS_HEIGHT_MM / 2.0


def tracker_centres() -> list[float]:
    """Place one four-round season centrally within each fold panel."""
    within_panel = (-63.75, -21.25, 21.25, 63.75)
    centres: list[float] = []
    for panel_index in range(3):
        panel_center = (panel_index + 0.5) * PANEL_WIDTH_MM
        centres.extend(panel_center + delta for delta in within_panel)
    return centres


OUTPUT_DIR = ROOT / "output/pdf/34_5x24_5-six-fold"
PREVIEW_PATH = OUTPUT_DIR / "the-quiet-vale-34_5x24_5-six-fold-preview.png"
FULL_PATH = OUTPUT_DIR / "the-quiet-vale-34_5x24_5-six-fold-full-resolution.png"
PDF_PATH = OUTPUT_DIR / "the-quiet-vale-34_5x24_5-six-fold.pdf"
MANIFEST_PATH = OUTPUT_DIR / "the-quiet-vale-34_5x24_5-six-fold.json"
PRINT_NOTES_PATH = OUTPUT_DIR / "the-quiet-vale-34_5x24_5-six-fold-print-notes.txt"


def build_board(pixels_per_mm: float) -> Image.Image:
    width = px(CANVAS_WIDTH_MM, pixels_per_mm)
    height = px(CANVAS_HEIGHT_MM, pixels_per_mm)
    board = tiled_leather(width, height, pixels_per_mm).convert("RGBA")
    draw_outer_finish(board, pixels_per_mm)
    draw_warehouses(
        board,
        pixels_per_mm,
        layout_width_mm=CANVAS_WIDTH_MM,
        warehouse_x_mm=WAREHOUSE_X_MM,
        warehouse_width_mm=WAREHOUSE_WIDTH_MM,
        warehouse_top_mm=WAREHOUSE_TOP_MM,
        warehouse_height_mm=WAREHOUSE_HEIGHT_MM,
        warehouse_gap_mm=WAREHOUSE_GAP_MM,
        warehouse_label_size_mm=8.5,
    )
    draw_title(
        board,
        pixels_per_mm,
        center_x_mm=CANVAS_WIDTH_MM / 2.0,
        main_y_mm=UPPER_FIELD_CENTER_Y_MM - 5.5,
        subtitle_y_mm=UPPER_FIELD_CENTER_Y_MM + 10.0,
        main_size_mm=TITLE_MAIN_SIZE_MM,
        subtitle_size_mm=TITLE_SUBTITLE_SIZE_MM,
    )
    draw_round_tracker(
        board,
        pixels_per_mm,
        center_y_mm=LOWER_FIELD_CENTER_Y_MM,
        socket_radius_mm=TRACKER_RADIUS_MM,
        round_number_size_mm=TRACKER_NUMBER_SIZE_MM,
        season_marker_size_mm=SEASON_MARKER_SIZE_MM,
        season_marker_offset_mm=SEASON_MARKER_OFFSET_MM,
        centers_mm=tracker_centres(),
    )
    offset_mm = (MAP_OFFSET_X_MM, MAP_OFFSET_Y_MM)
    draw_map_stitching(board, pixels_per_mm, offset_mm)
    paste_exact_map(
        board,
        pixels_per_mm,
        offset_mm,
        paper_age_strength=0.72,
        paper_age_seed=93517,
    )
    render_brass_fitting(
        board,
        (MAP_LEFT_MM, MAP_TOP_PLACED_MM),
        1,
        1,
        pixels_per_mm,
        8601,
        patina_strength=0.78,
    )
    render_brass_fitting(
        board,
        (MAP_RIGHT_PLACED_MM, MAP_TOP_PLACED_MM),
        -1,
        1,
        pixels_per_mm,
        8602,
        patina_strength=0.78,
    )
    render_brass_fitting(
        board,
        (MAP_LEFT_MM, MAP_BOTTOM_PLACED_MM),
        1,
        -1,
        pixels_per_mm,
        8603,
        patina_strength=0.78,
    )
    render_brass_fitting(
        board,
        (MAP_RIGHT_PLACED_MM, MAP_BOTTOM_PLACED_MM),
        -1,
        -1,
        pixels_per_mm,
        8604,
        patina_strength=0.78,
    )
    return apply_unified_neoprene_finish(board, pixels_per_mm)


def write_pdf(board: Image.Image) -> None:
    pdf = canvas.Canvas(
        str(PDF_PATH),
        pagesize=(CANVAS_WIDTH_MM * mm, CANVAS_HEIGHT_MM * mm),
        pageCompression=1,
    )
    pdf.setTitle("The Quiet Vale - 34.5 x 24.5 inch six-fold board")
    pdf.setAuthor("The Quiet Vale project")
    pdf.setSubject("Six-fold board with unchanged 60 mm map hex geometry")
    pdf.drawImage(
        ImageReader(board),
        0,
        0,
        width=CANVAS_WIDTH_MM * mm,
        height=CANVAS_HEIGHT_MM * mm,
        preserveAspectRatio=False,
        mask="auto",
    )
    pdf.showPage()
    pdf.save()


def write_manifest(pixels_per_mm: float, board: Image.Image) -> None:
    centres = tracker_centres()
    manifest = {
        "status": "production-size layout pending manufacturer dieline confirmation",
        "finishedSize": {
            "widthIn": CANVAS_WIDTH_IN,
            "heightIn": CANVAS_HEIGHT_IN,
            "widthMm": CANVAS_WIDTH_MM,
            "heightMm": CANVAS_HEIGHT_MM,
        },
        "folding": {
            "type": "six-fold",
            "panelGrid": "3 columns x 2 rows",
            "nominalFoldedWidthIn": CANVAS_WIDTH_IN / 3.0,
            "nominalFoldedHeightIn": CANVAS_HEIGHT_IN / 2.0,
            "verticalFoldLinesMm": list(FOLD_X_MM),
            "horizontalFoldLinesMm": list(FOLD_Y_MM),
            "foldGuidesPrinted": False,
        },
        "map": {
            "physicalWidthMm": MAP_WIDTH_MM,
            "physicalHeightMm": MAP_HEIGHT_MM,
            "hexPointToPointMm": 60.0,
            "resized": False,
            "repositionedRelativeToBoardCentre": False,
            "croppedFurther": False,
            "artworkAdjustedForFolds": False,
            "exposedPaperAgeing": (
                "subtle warm edge patina restricted to pale unmarked paper"
            ),
            "terrainAndInkProtectedFromAgeing": True,
        },
        "warehouses": {
            "count": 6,
            "widthMm": WAREHOUSE_WIDTH_MM,
            "heightMm": WAREHOUSE_HEIGHT_MM,
            "verticalGapMm": WAREHOUSE_GAP_MM,
            "topMm": WAREHOUSE_TOP_MM,
            "horizontalBandCenterMm": WAREHOUSE_BAND_CENTER_MM,
            "centredBetweenStitchLines": True,
        },
        "titleAndTracker": {
            "equalFieldHeightMm": (
                UPPER_MAP_STITCH_Y_MM - OUTER_STITCH_INSET_MM
            ),
            "titleFieldCenterYmm": UPPER_FIELD_CENTER_Y_MM,
            "trackerFieldCenterYmm": LOWER_FIELD_CENTER_Y_MM,
            "trackerCentresMm": centres,
            "trackerClearOfVerticalFolds": all(
                abs(center - fold) > TRACKER_RADIUS_MM
                for center in centres
                for fold in FOLD_X_MM
            ),
        },
        "raster": {
            "pixelsPerMm": pixels_per_mm,
            "effectivePpi": pixels_per_mm * INCH_MM,
            "pixelWidth": board.width,
            "pixelHeight": board.height,
        },
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n")


def write_print_notes() -> None:
    PRINT_NOTES_PATH.write_text(
        """THE QUIET VALE - 34.5 X 24.5 INCH SIX-FOLD BOARD

- Finished open size: exactly 34.5 x 24.5 inches (876.3 x 622.3 mm).
- Nominal folded size: 11.5 x 12.25 inches (292.1 x 311.15 mm).
- Fold grid: three columns by two rows.
- The hand-drawn map is unchanged, uncropped, and unscaled.
- Playable hex geometry is exactly 60 mm point-to-point.
- Fold guides are metadata only and are not printed in the artwork.
- Confirm all hinge positions against BoardGamesMaker's generated dieline
  before submission. Do not move or scale the map to accommodate hinges.
- Print at 100% / Actual Size. Do not Fit or Scale.
- Extend only the outer leather when applying the manufacturer's bleed.
""",
        encoding="utf-8",
    )


def validate_pdf() -> None:
    reader = PdfReader(str(PDF_PATH))
    if len(reader.pages) != 1:
        raise RuntimeError("Expected a single-page board PDF")
    page = reader.pages[0]
    width_mm = float(page.mediabox.width) / 72.0 * INCH_MM
    height_mm = float(page.mediabox.height) / 72.0 * INCH_MM
    if abs(width_mm - CANVAS_WIDTH_MM) > 0.02:
        raise RuntimeError(f"Incorrect PDF width: {width_mm:.4f} mm")
    if abs(height_mm - CANVAS_HEIGHT_MM) > 0.02:
        raise RuntimeError(f"Incorrect PDF height: {height_mm:.4f} mm")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--pixels-per-mm",
        type=float,
        default=4.0,
        choices=(4.0, 8.0, 12.0),
    )
    args = parser.parse_args()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    board = build_board(args.pixels_per_mm)
    if args.pixels_per_mm == 4.0:
        board.save(PREVIEW_PATH, format="PNG", optimize=True)
        write_manifest(args.pixels_per_mm, board)
        print(f"Wrote {PREVIEW_PATH}")
        print(f"Wrote {MANIFEST_PATH}")
        return

    board.save(FULL_PATH, format="PNG", optimize=True)
    preview = board.resize(
        (px(CANVAS_WIDTH_MM, 4.0), px(CANVAS_HEIGHT_MM, 4.0)),
        Image.Resampling.LANCZOS,
    )
    preview.save(PREVIEW_PATH, format="PNG", optimize=True)
    write_pdf(board)
    write_manifest(args.pixels_per_mm, board)
    write_print_notes()
    validate_pdf()
    print(f"Wrote {FULL_PATH}")
    print(f"Wrote {PREVIEW_PATH}")
    print(f"Wrote {PDF_PATH}")
    print(f"Wrote {MANIFEST_PATH}")
    print(f"Wrote {PRINT_NOTES_PATH}")


if __name__ == "__main__":
    main()
