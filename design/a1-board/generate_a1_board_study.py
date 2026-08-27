#!/usr/bin/env python3
"""Generate the exact-scale A1 board and border-usage study."""

from __future__ import annotations

import json
import math
import random
from pathlib import Path

from PIL import Image
from pypdf import PdfReader
from reportlab.lib.colors import Color, HexColor
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[2]
MAP_PATH = ROOT / "src/assets/quiet_vale_map_v02.webp"
OUTPUT_DIR = ROOT / "output/pdf"
PDF_PATH = OUTPUT_DIR / "the-quiet-vale-a1-board-study.pdf"
MANIFEST_PATH = OUTPUT_DIR / "the-quiet-vale-a1-board-study.json"

A1_WIDTH_MM = 841.0
A1_HEIGHT_MM = 594.0
PAGE_SIZE = (A1_WIDTH_MM * mm, A1_HEIGHT_MM * mm)

# Physical map authority from src/data/map.ts. The interactive map uses a
# 30-unit radius for the approved 60 mm point-to-point flat-top tile.
HEX_RADIUS_MM = 30.0
HEX_POINT_TO_POINT_MM = 60.0
HEX_FLAT_TO_FLAT_MM = math.sqrt(3) * HEX_RADIUS_MM
MAP_FRAME = {
    "svg_x": -19.6663,
    "svg_y": -7.7617,
    "width_mm": 714.1339,
    "height_mm": 545.4286,
}

# The source image includes a broad, uniform cream margin outside the painted
# map. Crop that unused margin while retaining a modest cream reveal. The crop
# is placed at the source image's original millimetres-per-pixel, so no map
# feature or hex space is rescaled.
SOURCE_MAP_WIDTH_PX = 3200
SOURCE_MAP_HEIGHT_PX = 2444
MAP_CONTENT_BOUNDS_PX = (148, 112, 3048, 2336)
MAP_CROP_PADDING_PX = 24
MAP_CROP_PX = (124, 88, 3072, 2360)
MAP_CROP_WIDTH_PX = MAP_CROP_PX[2] - MAP_CROP_PX[0]
MAP_CROP_HEIGHT_PX = MAP_CROP_PX[3] - MAP_CROP_PX[1]
MAP_MM_PER_PX_X = MAP_FRAME["width_mm"] / SOURCE_MAP_WIDTH_PX
MAP_MM_PER_PX_Y = MAP_FRAME["height_mm"] / SOURCE_MAP_HEIGHT_PX
PLACED_MAP_WIDTH_MM = MAP_CROP_WIDTH_PX * MAP_MM_PER_PX_X
PLACED_MAP_HEIGHT_MM = MAP_CROP_HEIGHT_PX * MAP_MM_PER_PX_Y
MAP_CROP_LEFT_MM = MAP_CROP_PX[0] * MAP_MM_PER_PX_X
MAP_CROP_TOP_MM = MAP_CROP_PX[1] * MAP_MM_PER_PX_Y

MAP_X_MM = (A1_WIDTH_MM - PLACED_MAP_WIDTH_MM) / 2
MAP_Y_MM = (A1_HEIGHT_MM - PLACED_MAP_HEIGHT_MM) / 2
MAP_RIGHT_MM = MAP_X_MM + PLACED_MAP_WIDTH_MM
MAP_TOP_MM = MAP_Y_MM + PLACED_MAP_HEIGHT_MM

OUTER_SAFETY_MM = 6.0
MAP_GAP_MM = 4.0
SIDE_CLEARANCE_MM = MAP_X_MM
VERTICAL_CLEARANCE_MM = MAP_Y_MM
USABLE_SIDE_RAIL_MM = SIDE_CLEARANCE_MM - OUTER_SAFETY_MM - MAP_GAP_MM
USABLE_BAND_MM = VERTICAL_CLEARANCE_MM - OUTER_SAFETY_MM - MAP_GAP_MM

SMOKE = HexColor("#26221b")
GRAPHITE = HexColor("#34352b")
GRAPHITE_SOFT = HexColor("#4f503e")
PARCHMENT = HexColor("#e6e0c9")
PARCHMENT_SOFT = HexColor("#f0ead8")
PARCHMENT_DEEP = HexColor("#c5bc9a")
BRASS = HexColor("#a8893f")
BRASS_DARK = HexColor("#6f5d2e")
MUTED_GREEN = HexColor("#4e6748")
MUTED_GREEN_DARK = HexColor("#344531")
RIVER_BLUE = HexColor("#4b666b")
RUST = HexColor("#82503b")

RESOURCE_COLORS = {
    "WOOD": HexColor("#526d4c"),
    "STONE": HexColor("#687276"),
    "METAL": HexColor("#53626a"),
    "FOOD": HexColor("#b59a4d"),
    "HERBS": HexColor("#6f6084"),
    "GOODS": HexColor("#8a573c"),
}


def xpt(value_mm: float) -> float:
    return value_mm * mm


def set_fill_alpha(pdf: canvas.Canvas, alpha: float) -> None:
    if hasattr(pdf, "setFillAlpha"):
        pdf.setFillAlpha(alpha)


def set_stroke_alpha(pdf: canvas.Canvas, alpha: float) -> None:
    if hasattr(pdf, "setStrokeAlpha"):
        pdf.setStrokeAlpha(alpha)


def reset_alpha(pdf: canvas.Canvas) -> None:
    set_fill_alpha(pdf, 1.0)
    set_stroke_alpha(pdf, 1.0)


def centered_text(
    pdf: canvas.Canvas,
    text: str,
    center_x_mm: float,
    baseline_y_mm: float,
    font: str,
    size: float,
    color: Color,
) -> None:
    pdf.setFont(font, size)
    pdf.setFillColor(color)
    width = stringWidth(text, font, size)
    pdf.drawString(xpt(center_x_mm) - width / 2, xpt(baseline_y_mm), text)


def right_text(
    pdf: canvas.Canvas,
    text: str,
    right_x_mm: float,
    baseline_y_mm: float,
    font: str,
    size: float,
    color: Color,
) -> None:
    pdf.setFont(font, size)
    pdf.setFillColor(color)
    width = stringWidth(text, font, size)
    pdf.drawString(xpt(right_x_mm) - width, xpt(baseline_y_mm), text)


def draw_leather_field(pdf: canvas.Canvas) -> None:
    pdf.setFillColor(SMOKE)
    pdf.rect(0, 0, PAGE_SIZE[0], PAGE_SIZE[1], stroke=0, fill=1)

    rng = random.Random(841594)
    pdf.saveState()
    pdf.setStrokeColor(GRAPHITE_SOFT)
    set_stroke_alpha(pdf, 0.18)
    pdf.setLineWidth(xpt(0.16))
    for _ in range(460):
        start_x = rng.uniform(0, A1_WIDTH_MM)
        start_y = rng.uniform(0, A1_HEIGHT_MM)
        length = rng.uniform(1.2, 5.8)
        angle = rng.uniform(-0.35, 0.35)
        pdf.line(
            xpt(start_x),
            xpt(start_y),
            xpt(start_x + math.cos(angle) * length),
            xpt(start_y + math.sin(angle) * length),
        )
    pdf.restoreState()
    reset_alpha(pdf)

    pdf.setStrokeColor(Color(0.66, 0.54, 0.25, alpha=0.72))
    pdf.setLineWidth(xpt(0.45))
    pdf.roundRect(
        xpt(2.5),
        xpt(2.5),
        xpt(A1_WIDTH_MM - 5),
        xpt(A1_HEIGHT_MM - 5),
        xpt(2.5),
        stroke=1,
        fill=0,
    )
    pdf.setStrokeColor(Color(0.10, 0.09, 0.075, alpha=0.9))
    pdf.setLineWidth(xpt(1.0))
    pdf.roundRect(
        xpt(4.2),
        xpt(4.2),
        xpt(A1_WIDTH_MM - 8.4),
        xpt(A1_HEIGHT_MM - 8.4),
        xpt(2.0),
        stroke=1,
        fill=0,
    )


def draw_corner_bracket(
    pdf: canvas.Canvas,
    x_mm: float,
    y_mm: float,
    x_direction: int,
    y_direction: int,
) -> None:
    arm_length = 15.0
    arm_width = 5.0

    pdf.saveState()
    pdf.setFillColor(BRASS)
    pdf.setStrokeColor(BRASS_DARK)
    pdf.setLineWidth(xpt(0.45))

    horizontal_x = x_mm if x_direction > 0 else x_mm - arm_length
    horizontal_y = y_mm if y_direction > 0 else y_mm - arm_width
    vertical_x = x_mm if x_direction > 0 else x_mm - arm_width
    vertical_y = y_mm if y_direction > 0 else y_mm - arm_length

    pdf.roundRect(
        xpt(horizontal_x),
        xpt(horizontal_y),
        xpt(arm_length),
        xpt(arm_width),
        xpt(1.0),
        stroke=1,
        fill=1,
    )
    pdf.roundRect(
        xpt(vertical_x),
        xpt(vertical_y),
        xpt(arm_width),
        xpt(arm_length),
        xpt(1.0),
        stroke=1,
        fill=1,
    )

    rivet_x = x_mm + x_direction * 2.8
    rivet_y = y_mm + y_direction * 2.8
    pdf.setFillColor(HexColor("#c1a45a"))
    pdf.setStrokeColor(BRASS_DARK)
    pdf.circle(xpt(rivet_x), xpt(rivet_y), xpt(1.55), stroke=1, fill=1)
    pdf.setFillColor(HexColor("#ead48f"))
    pdf.circle(
        xpt(rivet_x - x_direction * 0.45),
        xpt(rivet_y - y_direction * 0.45),
        xpt(0.38),
        stroke=0,
        fill=1,
    )
    pdf.restoreState()


def draw_map_and_mount(
    pdf: canvas.Canvas,
    map_image: ImageReader,
) -> None:
    map_x = xpt(MAP_X_MM)
    map_y = xpt(MAP_Y_MM)
    map_width = xpt(PLACED_MAP_WIDTH_MM)
    map_height = xpt(PLACED_MAP_HEIGHT_MM)

    pdf.saveState()
    pdf.setFillColor(HexColor("#12110e"))
    pdf.roundRect(
        xpt(MAP_X_MM - 3.6),
        xpt(MAP_Y_MM - 3.6),
        xpt(PLACED_MAP_WIDTH_MM + 7.2),
        xpt(PLACED_MAP_HEIGHT_MM + 7.2),
        xpt(2.0),
        stroke=0,
        fill=1,
    )
    pdf.setStrokeColor(BRASS)
    set_stroke_alpha(pdf, 0.72)
    pdf.setLineWidth(xpt(0.65))
    pdf.roundRect(
        xpt(MAP_X_MM - 2.2),
        xpt(MAP_Y_MM - 2.2),
        xpt(PLACED_MAP_WIDTH_MM + 4.4),
        xpt(PLACED_MAP_HEIGHT_MM + 4.4),
        xpt(1.2),
        stroke=1,
        fill=0,
    )
    pdf.restoreState()
    reset_alpha(pdf)

    pdf.drawImage(
        map_image,
        map_x,
        map_y,
        width=map_width,
        height=map_height,
        preserveAspectRatio=False,
        mask="auto",
    )

    pdf.setStrokeColor(GRAPHITE)
    pdf.setLineWidth(xpt(0.45))
    pdf.rect(map_x, map_y, map_width, map_height, stroke=1, fill=0)

    draw_corner_bracket(pdf, MAP_X_MM - 2.5, MAP_Y_MM - 2.5, 1, 1)
    draw_corner_bracket(pdf, MAP_RIGHT_MM + 2.5, MAP_Y_MM - 2.5, -1, 1)
    draw_corner_bracket(pdf, MAP_X_MM - 2.5, MAP_TOP_MM + 2.5, 1, -1)
    draw_corner_bracket(pdf, MAP_RIGHT_MM + 2.5, MAP_TOP_MM + 2.5, -1, -1)


def draw_panel(
    pdf: canvas.Canvas,
    x_mm: float,
    y_mm: float,
    width_mm: float,
    height_mm: float,
    border: Color = BRASS_DARK,
) -> None:
    pdf.saveState()
    pdf.setFillColor(Color(0.20, 0.205, 0.17, alpha=0.9))
    pdf.setStrokeColor(border)
    pdf.setLineWidth(xpt(0.38))
    pdf.roundRect(
        xpt(x_mm),
        xpt(y_mm),
        xpt(width_mm),
        xpt(height_mm),
        xpt(2.0),
        stroke=1,
        fill=1,
    )
    pdf.restoreState()


def draw_resource_well(
    pdf: canvas.Canvas,
    label: str,
    x_mm: float,
    y_mm: float,
    width_mm: float,
    height_mm: float,
) -> None:
    accent = RESOURCE_COLORS[label]

    pdf.saveState()
    pdf.setFillColor(Color(0.12, 0.115, 0.095, alpha=0.96))
    pdf.setStrokeColor(BRASS_DARK)
    pdf.setLineWidth(xpt(0.65))
    pdf.roundRect(
        xpt(x_mm),
        xpt(y_mm),
        xpt(width_mm),
        xpt(height_mm),
        xpt(2.4),
        stroke=1,
        fill=1,
    )
    pdf.setStrokeColor(Color(0.66, 0.54, 0.25, alpha=0.55))
    pdf.setLineWidth(xpt(0.28))
    pdf.roundRect(
        xpt(x_mm + 1.7),
        xpt(y_mm + 1.7),
        xpt(width_mm - 3.4),
        xpt(height_mm - 3.4),
        xpt(1.5),
        stroke=1,
        fill=0,
    )
    pdf.restoreState()

    header_height = 17.0
    pdf.saveState()
    pdf.setFillColor(Color(0.20, 0.205, 0.17, alpha=0.96))
    pdf.setStrokeColor(Color(0.66, 0.54, 0.25, alpha=0.45))
    pdf.setLineWidth(xpt(0.3))
    pdf.roundRect(
        xpt(x_mm + 3.5),
        xpt(y_mm + height_mm - header_height - 3.5),
        xpt(width_mm - 7.0),
        xpt(header_height),
        xpt(1.4),
        stroke=1,
        fill=1,
    )
    pdf.setFillColor(accent)
    pdf.circle(
        xpt(x_mm + 9.0),
        xpt(y_mm + height_mm - 12.0),
        xpt(2.6),
        stroke=0,
        fill=1,
    )
    pdf.restoreState()

    centered_text(
        pdf,
        label,
        x_mm + width_mm / 2 + 2.0,
        y_mm + height_mm - 13.8,
        "Helvetica-Bold",
        9.2,
        PARCHMENT,
    )

    well_x = x_mm + 4.0
    well_y = y_mm + 4.0
    well_width = width_mm - 8.0
    well_height = height_mm - 25.0
    pdf.saveState()
    pdf.setFillColor(Color(0.085, 0.08, 0.068, alpha=0.96))
    pdf.setStrokeColor(BRASS)
    pdf.setLineWidth(xpt(0.55))
    pdf.roundRect(
        xpt(well_x),
        xpt(well_y),
        xpt(well_width),
        xpt(well_height),
        xpt(1.8),
        stroke=1,
        fill=1,
    )
    pdf.setStrokeColor(Color(0.94, 0.92, 0.84, alpha=0.10))
    pdf.setLineWidth(xpt(0.25))
    pdf.roundRect(
        xpt(well_x + 1.5),
        xpt(well_y + 1.5),
        xpt(well_width - 3.0),
        xpt(well_height - 3.0),
        xpt(1.2),
        stroke=1,
        fill=0,
    )

    corner = 5.0
    pdf.setStrokeColor(BRASS_DARK)
    pdf.setLineWidth(xpt(0.8))
    for corner_x, corner_y, x_direction, y_direction in [
        (well_x, well_y, 1, 1),
        (well_x + well_width, well_y, -1, 1),
        (well_x, well_y + well_height, 1, -1),
        (well_x + well_width, well_y + well_height, -1, -1),
    ]:
        pdf.line(
            xpt(corner_x),
            xpt(corner_y),
            xpt(corner_x + x_direction * corner),
            xpt(corner_y),
        )
        pdf.line(
            xpt(corner_x),
            xpt(corner_y),
            xpt(corner_x),
            xpt(corner_y + y_direction * corner),
        )
    pdf.restoreState()


def draw_resource_rail(
    pdf: canvas.Canvas,
    rail_x: float,
    labels_top_to_bottom: list[str],
) -> None:
    rail_width = USABLE_SIDE_RAIL_MM - 2.0
    centered_text(
        pdf,
        "WAREHOUSE",
        rail_x + rail_width / 2,
        558.0,
        "Helvetica-Bold",
        10.2,
        PARCHMENT,
    )
    centered_text(
        pdf,
        "shared resource pools",
        rail_x + rail_width / 2,
        552.0,
        "Helvetica",
        5.7,
        PARCHMENT_DEEP,
    )

    well_height = 156.0
    well_gap = 8.0
    total_height = well_height * 3 + well_gap * 2
    start_y = (A1_HEIGHT_MM - total_height) / 2

    for index, label in enumerate(reversed(labels_top_to_bottom)):
        draw_resource_well(
            pdf,
            label,
            rail_x,
            start_y + index * (well_height + well_gap),
            rail_width,
            well_height,
        )


def draw_scale_bar(pdf: canvas.Canvas) -> None:
    start_x = (A1_WIDTH_MM - 50.0) / 2
    end_x = start_x + 50.0
    y = 8.0
    pdf.setStrokeColor(BRASS)
    pdf.setLineWidth(xpt(0.55))
    pdf.line(xpt(start_x), xpt(y), xpt(end_x), xpt(y))
    pdf.line(xpt(start_x), xpt(y - 1.7), xpt(start_x), xpt(y + 1.7))
    pdf.line(xpt(end_x), xpt(y - 1.7), xpt(end_x), xpt(y + 1.7))
    centered_text(
        pdf,
        "50 mm calibration - print at 100%",
        (start_x + end_x) / 2,
        11.6,
        "Helvetica",
        5.4,
        PARCHMENT_DEEP,
    )


def draw_board_page(
    pdf: canvas.Canvas,
    map_image: ImageReader,
) -> None:
    draw_leather_field(pdf)
    draw_map_and_mount(pdf, map_image)
    draw_resource_rail(
        pdf,
        OUTER_SAFETY_MM + 1.0,
        ["WOOD", "STONE", "METAL"],
    )
    draw_resource_rail(
        pdf,
        MAP_RIGHT_MM + MAP_GAP_MM + 1.0,
        ["FOOD", "HERBS", "GOODS"],
    )

    centered_text(
        pdf,
        "THE QUIET VALE",
        A1_WIDTH_MM / 2,
        582.0,
        "Times-Bold",
        15.2,
        PARCHMENT_SOFT,
    )
    centered_text(
        pdf,
        "A1 BOARD STUDY - 60 MM TILE SCALE",
        A1_WIDTH_MM / 2,
        576.0,
        "Helvetica-Bold",
        6.2,
        BRASS,
    )
    centered_text(
        pdf,
        "Map artwork by Giovanni Spadaro and Daniele Nicotra - prototype layout only",
        A1_WIDTH_MM / 2,
        17.0,
        "Helvetica",
        4.9,
        PARCHMENT_DEEP,
    )
    draw_scale_bar(pdf)


def draw_arrow_head(
    pdf: canvas.Canvas,
    x_mm: float,
    y_mm: float,
    angle_radians: float,
    size_mm: float,
    color: Color,
) -> None:
    wing = math.radians(28)
    pdf.setStrokeColor(color)
    pdf.line(
        xpt(x_mm),
        xpt(y_mm),
        xpt(x_mm - math.cos(angle_radians - wing) * size_mm),
        xpt(y_mm - math.sin(angle_radians - wing) * size_mm),
    )
    pdf.line(
        xpt(x_mm),
        xpt(y_mm),
        xpt(x_mm - math.cos(angle_radians + wing) * size_mm),
        xpt(y_mm - math.sin(angle_radians + wing) * size_mm),
    )


def draw_dimension(
    pdf: canvas.Canvas,
    start: tuple[float, float],
    end: tuple[float, float],
    label: str,
    color: Color = BRASS,
    vertical_label: bool = False,
) -> None:
    x1, y1 = start
    x2, y2 = end
    angle = math.atan2(y2 - y1, x2 - x1)
    pdf.saveState()
    pdf.setStrokeColor(color)
    pdf.setLineWidth(xpt(0.65))
    pdf.line(xpt(x1), xpt(y1), xpt(x2), xpt(y2))
    draw_arrow_head(pdf, x1, y1, angle + math.pi, 2.4, color)
    draw_arrow_head(pdf, x2, y2, angle, 2.4, color)

    middle_x = (x1 + x2) / 2
    middle_y = (y1 + y2) / 2
    pdf.setFillColor(Color(0.145, 0.13, 0.105, alpha=0.9))
    if vertical_label:
        pdf.translate(xpt(middle_x), xpt(middle_y))
        pdf.rotate(90)
        text_width = stringWidth(label, "Helvetica-Bold", 7.2)
        pdf.roundRect(
            -text_width / 2 - xpt(2.2),
            -xpt(2.6),
            text_width + xpt(4.4),
            xpt(5.2),
            xpt(1.0),
            stroke=0,
            fill=1,
        )
        pdf.setFillColor(PARCHMENT_SOFT)
        pdf.setFont("Helvetica-Bold", 7.2)
        pdf.drawString(-text_width / 2, -2.3, label)
    else:
        text_width = stringWidth(label, "Helvetica-Bold", 7.2)
        pdf.roundRect(
            xpt(middle_x) - text_width / 2 - xpt(2.2),
            xpt(middle_y - 2.6),
            text_width + xpt(4.4),
            xpt(5.2),
            xpt(1.0),
            stroke=0,
            fill=1,
        )
        pdf.setFillColor(PARCHMENT_SOFT)
        pdf.setFont("Helvetica-Bold", 7.2)
        pdf.drawString(
            xpt(middle_x) - text_width / 2,
            xpt(middle_y - 0.85),
            label,
        )
    pdf.restoreState()


def draw_flat_top_hex(
    pdf: canvas.Canvas,
    center_x_mm: float,
    center_y_mm: float,
    radius_mm: float,
    color: Color,
) -> None:
    path = pdf.beginPath()
    points = []
    for index in range(6):
        angle = math.radians(index * 60)
        points.append(
            (
                center_x_mm + radius_mm * math.cos(angle),
                center_y_mm + radius_mm * math.sin(angle),
            )
        )
    path.moveTo(xpt(points[0][0]), xpt(points[0][1]))
    for point in points[1:]:
        path.lineTo(xpt(point[0]), xpt(point[1]))
    path.close()
    pdf.setStrokeColor(color)
    pdf.setLineWidth(xpt(1.0))
    pdf.drawPath(path, stroke=1, fill=0)


def draw_summary_box(pdf: canvas.Canvas) -> None:
    box_width = 276.0
    box_height = 104.0
    x = (A1_WIDTH_MM - box_width) / 2
    y = (A1_HEIGHT_MM - box_height) / 2

    pdf.saveState()
    pdf.setFillColor(Color(0.145, 0.13, 0.105, alpha=0.94))
    pdf.setStrokeColor(BRASS)
    pdf.setLineWidth(xpt(0.65))
    pdf.roundRect(
        xpt(x),
        xpt(y),
        xpt(box_width),
        xpt(box_height),
        xpt(2.4),
        stroke=1,
        fill=1,
    )
    pdf.restoreState()

    centered_text(
        pdf,
        "A1 BORDER FEASIBILITY",
        A1_WIDTH_MM / 2,
        y + box_height - 13.0,
        "Times-Bold",
        15.0,
        PARCHMENT_SOFT,
    )

    effective_dpi = MAP_CROP_WIDTH_PX / (PLACED_MAP_WIDTH_MM / 25.4)
    lines = [
        f"Cropped map at tile scale: {PLACED_MAP_WIDTH_MM:.1f} x {PLACED_MAP_HEIGHT_MM:.1f} mm",
        f"Raw clearance: {SIDE_CLEARANCE_MM:.1f} mm each side; {VERTICAL_CLEARANCE_MM:.1f} mm top and bottom",
        f"Usable after 6 mm safety + 4 mm gap: {USABLE_SIDE_RAIL_MM:.1f} mm side rails; {USABLE_BAND_MM:.1f} mm bands",
        "Fits: six large open resource wells, arranged as three fully used pools on each side",
        f"Cream reveal reduced to about {MAP_CROP_PADDING_PX * MAP_MM_PER_PX_X:.1f} mm without rescaling the map",
        f"Current map is about {effective_dpi:.0f} ppi at A1 - suitable for this study, below ideal final-production resolution",
    ]
    for index, line in enumerate(lines):
        centered_text(
            pdf,
            line,
            A1_WIDTH_MM / 2,
            y + box_height - 28.0 - index * 11.0,
            "Helvetica" if index < 3 else "Helvetica-Bold",
            8.1 if index < 3 else 7.7,
            PARCHMENT if index < 4 else HexColor("#d4a68e"),
        )


def draw_measurement_page(
    pdf: canvas.Canvas,
    map_image: ImageReader,
) -> None:
    draw_leather_field(pdf)
    pdf.drawImage(
        map_image,
        xpt(MAP_X_MM),
        xpt(MAP_Y_MM),
        width=xpt(PLACED_MAP_WIDTH_MM),
        height=xpt(PLACED_MAP_HEIGHT_MM),
        preserveAspectRatio=False,
        mask="auto",
    )

    pdf.saveState()
    pdf.setFillColor(SMOKE)
    set_fill_alpha(pdf, 0.53)
    pdf.rect(
        xpt(MAP_X_MM),
        xpt(MAP_Y_MM),
        xpt(PLACED_MAP_WIDTH_MM),
        xpt(PLACED_MAP_HEIGHT_MM),
        stroke=0,
        fill=1,
    )
    pdf.restoreState()
    reset_alpha(pdf)

    pdf.saveState()
    pdf.setFillColor(Color(0.30, 0.44, 0.27, alpha=0.42))
    left_rail_x = OUTER_SAFETY_MM
    right_rail_x = MAP_RIGHT_MM + MAP_GAP_MM
    pdf.rect(
        xpt(left_rail_x),
        xpt(MAP_Y_MM),
        xpt(USABLE_SIDE_RAIL_MM),
        xpt(PLACED_MAP_HEIGHT_MM),
        stroke=0,
        fill=1,
    )
    pdf.rect(
        xpt(right_rail_x),
        xpt(MAP_Y_MM),
        xpt(USABLE_SIDE_RAIL_MM),
        xpt(PLACED_MAP_HEIGHT_MM),
        stroke=0,
        fill=1,
    )
    pdf.setFillColor(Color(0.66, 0.54, 0.25, alpha=0.35))
    pdf.rect(
        xpt(MAP_X_MM),
        xpt(OUTER_SAFETY_MM),
        xpt(PLACED_MAP_WIDTH_MM),
        xpt(USABLE_BAND_MM),
        stroke=0,
        fill=1,
    )
    pdf.rect(
        xpt(MAP_X_MM),
        xpt(MAP_TOP_MM + MAP_GAP_MM),
        xpt(PLACED_MAP_WIDTH_MM),
        xpt(USABLE_BAND_MM),
        stroke=0,
        fill=1,
    )
    pdf.restoreState()
    reset_alpha(pdf)

    pdf.setStrokeColor(PARCHMENT_SOFT)
    pdf.setLineWidth(xpt(0.45))
    pdf.rect(
        xpt(MAP_X_MM),
        xpt(MAP_Y_MM),
        xpt(PLACED_MAP_WIDTH_MM),
        xpt(PLACED_MAP_HEIGHT_MM),
        stroke=1,
        fill=0,
    )
    pdf.setStrokeColor(RUST)
    pdf.setDash(xpt(1.6), xpt(1.2))
    pdf.rect(
        xpt(OUTER_SAFETY_MM),
        xpt(OUTER_SAFETY_MM),
        xpt(A1_WIDTH_MM - OUTER_SAFETY_MM * 2),
        xpt(A1_HEIGHT_MM - OUTER_SAFETY_MM * 2),
        stroke=1,
        fill=0,
    )
    pdf.setDash()

    centered_text(
        pdf,
        "A1 EXACT-SCALE CLEARANCE STUDY",
        A1_WIDTH_MM / 2,
        584.0,
        "Times-Bold",
        14.0,
        PARCHMENT_SOFT,
    )
    centered_text(
        pdf,
        "outer trim 841 x 594 mm - dashed line is 6 mm safety",
        A1_WIDTH_MM / 2,
        577.5,
        "Helvetica",
        6.0,
        PARCHMENT_DEEP,
    )

    draw_dimension(
        pdf,
        (MAP_X_MM, 571.8),
        (MAP_RIGHT_MM, 571.8),
        f"MAP {PLACED_MAP_WIDTH_MM:.1f} mm",
    )
    draw_dimension(
        pdf,
        (3.0, 17.0),
        (MAP_X_MM, 17.0),
        f"{SIDE_CLEARANCE_MM:.1f} mm",
        MUTED_GREEN,
    )
    draw_dimension(
        pdf,
        (MAP_RIGHT_MM, 17.0),
        (A1_WIDTH_MM - 3.0, 17.0),
        f"{SIDE_CLEARANCE_MM:.1f} mm",
        MUTED_GREEN,
    )
    draw_dimension(
        pdf,
        (MAP_RIGHT_MM + 7.0, MAP_Y_MM),
        (MAP_RIGHT_MM + 7.0, MAP_TOP_MM),
        f"MAP {PLACED_MAP_HEIGHT_MM:.1f} mm",
        BRASS,
        True,
    )
    draw_dimension(
        pdf,
        (MAP_X_MM - 7.0, 1.8),
        (MAP_X_MM - 7.0, MAP_Y_MM),
        f"{VERTICAL_CLEARANCE_MM:.1f} mm",
        MUTED_GREEN,
        True,
    )
    draw_dimension(
        pdf,
        (MAP_X_MM - 7.0, MAP_TOP_MM),
        (MAP_X_MM - 7.0, A1_HEIGHT_MM - 1.8),
        f"{VERTICAL_CLEARANCE_MM:.1f} mm",
        MUTED_GREEN,
        True,
    )

    # K2 is used only as a scale witness. Convert its SVG center into the
    # physical image placement, accounting for the artwork frame's bleed.
    column_index = 10
    row_index = 1
    svg_center_x = (
        HEX_RADIUS_MM + column_index * HEX_RADIUS_MM * 1.5 + 14.0
    )
    svg_center_y = (
        HEX_FLAT_TO_FLAT_MM / 2
        + row_index * HEX_FLAT_TO_FLAT_MM
        + (HEX_FLAT_TO_FLAT_MM / 2 if column_index % 2 else 0)
        + 18.0
    )
    witness_x = (
        MAP_X_MM
        + (svg_center_x - MAP_FRAME["svg_x"])
        - MAP_CROP_LEFT_MM
    )
    witness_y = (
        MAP_Y_MM
        + PLACED_MAP_HEIGHT_MM
        - ((svg_center_y - MAP_FRAME["svg_y"]) - MAP_CROP_TOP_MM)
    )
    draw_flat_top_hex(pdf, witness_x, witness_y, HEX_RADIUS_MM, RUST)
    draw_dimension(
        pdf,
        (witness_x - HEX_RADIUS_MM, witness_y),
        (witness_x + HEX_RADIUS_MM, witness_y),
        "60.0 mm TILE",
        RUST,
    )

    draw_summary_box(pdf)

    centered_text(
        pdf,
        f"GREEN: usable side rails {USABLE_SIDE_RAIL_MM:.1f} mm wide",
        OUTER_SAFETY_MM + USABLE_SIDE_RAIL_MM / 2,
        43.0,
        "Helvetica-Bold",
        5.9,
        PARCHMENT_SOFT,
    )
    centered_text(
        pdf,
        f"GOLD: usable top/bottom bands {USABLE_BAND_MM:.1f} mm deep",
        A1_WIDTH_MM / 2,
        8.6,
        "Helvetica-Bold",
        5.9,
        PARCHMENT_SOFT,
    )


def validate_and_write_manifest(image_width: int, image_height: int) -> None:
    reader = PdfReader(str(PDF_PATH))
    if len(reader.pages) != 2:
        raise RuntimeError(f"Expected 2 pages, found {len(reader.pages)}")

    page_sizes = []
    for page in reader.pages:
        width_mm = float(page.mediabox.width) / 72.0 * 25.4
        height_mm = float(page.mediabox.height) / 72.0 * 25.4
        if abs(width_mm - A1_WIDTH_MM) > 0.02:
            raise RuntimeError(f"Wrong page width: {width_mm:.4f} mm")
        if abs(height_mm - A1_HEIGHT_MM) > 0.02:
            raise RuntimeError(f"Wrong page height: {height_mm:.4f} mm")
        page_sizes.append(
            {
                "widthMm": round(width_mm, 4),
                "heightMm": round(height_mm, 4),
            }
        )

    horizontal_dpi = MAP_CROP_WIDTH_PX / (PLACED_MAP_WIDTH_MM / 25.4)
    vertical_dpi = MAP_CROP_HEIGHT_PX / (PLACED_MAP_HEIGHT_MM / 25.4)
    manifest = {
        "title": "The Quiet Vale A1 board study",
        "pdf": str(PDF_PATH.relative_to(ROOT)),
        "pageCount": len(reader.pages),
        "pages": [
            "Playable board concept with side trackers",
            "Exact-scale clearance study",
        ],
        "pageSize": {
            "standard": "ISO A1 landscape",
            "widthMm": A1_WIDTH_MM,
            "heightMm": A1_HEIGHT_MM,
            "verifiedPages": page_sizes,
        },
        "tileAuthority": {
            "pointToPointMm": HEX_POINT_TO_POINT_MM,
            "flatToFlatMm": round(HEX_FLAT_TO_FLAT_MM, 4),
            "source": "design/tile-set/manifest.json",
        },
        "map": {
            "source": str(MAP_PATH.relative_to(ROOT)),
            "sourcePixels": {
                "width": image_width,
                "height": image_height,
            },
            "originalFrameWidthMm": MAP_FRAME["width_mm"],
            "originalFrameHeightMm": MAP_FRAME["height_mm"],
            "cropPixels": {
                "left": MAP_CROP_PX[0],
                "top": MAP_CROP_PX[1],
                "right": MAP_CROP_PX[2],
                "bottom": MAP_CROP_PX[3],
                "width": MAP_CROP_WIDTH_PX,
                "height": MAP_CROP_HEIGHT_PX,
                "contentPaddingPx": MAP_CROP_PADDING_PX,
            },
            "placedWidthMm": round(PLACED_MAP_WIDTH_MM, 4),
            "placedHeightMm": round(PLACED_MAP_HEIGHT_MM, 4),
            "cropRetainsOriginalPixelScale": True,
            "effectiveDpi": {
                "horizontal": round(horizontal_dpi, 2),
                "vertical": round(vertical_dpi, 2),
            },
            "sourceAlignment": "src/data/map.ts mapArtworkLayers",
        },
        "clearances": {
            "leftMm": round(SIDE_CLEARANCE_MM, 4),
            "rightMm": round(SIDE_CLEARANCE_MM, 4),
            "topMm": round(VERTICAL_CLEARANCE_MM, 4),
            "bottomMm": round(VERTICAL_CLEARANCE_MM, 4),
            "outerSafetyMm": OUTER_SAFETY_MM,
            "mapGapMm": MAP_GAP_MM,
            "usableSideRailMm": round(USABLE_SIDE_RAIL_MM, 4),
            "usableTopBottomBandMm": round(USABLE_BAND_MM, 4),
        },
        "prototypeControls": {
            "resourceWells": {
                "count": 6,
                "leftTopToBottom": ["WOOD", "STONE", "METAL"],
                "rightTopToBottom": ["FOOD", "HERBS", "GOODS"],
                "numberedPositions": False,
                "outerWidthMm": round(USABLE_SIDE_RAIL_MM - 2.0, 4),
                "outerHeightMm": 156.0,
                "openAreaWidthMm": round(USABLE_SIDE_RAIL_MM - 10.0, 4),
                "openAreaHeightMm": 131.0,
            }
        },
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    if not MAP_PATH.exists():
        raise FileNotFoundError(MAP_PATH)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with Image.open(MAP_PATH) as source_image:
        image_width, image_height = source_image.size
        source_ratio = image_width / image_height
        if (image_width, image_height) != (
            SOURCE_MAP_WIDTH_PX,
            SOURCE_MAP_HEIGHT_PX,
        ):
            raise RuntimeError(
                "Map source size changed: "
                f"expected {SOURCE_MAP_WIDTH_PX} x {SOURCE_MAP_HEIGHT_PX}, "
                f"found {image_width} x {image_height}"
            )
        cropped_map = source_image.convert("RGB").crop(MAP_CROP_PX)
        map_image = ImageReader(cropped_map)
    frame_ratio = MAP_FRAME["width_mm"] / MAP_FRAME["height_mm"]
    if abs(source_ratio - frame_ratio) > 0.0001:
        raise RuntimeError(
            f"Map aspect mismatch: source={source_ratio:.6f}, frame={frame_ratio:.6f}"
        )

    pdf = canvas.Canvas(str(PDF_PATH), pagesize=PAGE_SIZE, pageCompression=1)
    pdf.setTitle("The Quiet Vale - A1 board and border study")
    pdf.setAuthor("The Quiet Vale project")
    pdf.setSubject("Exact-scale A1 board study at 60 mm tile scale")
    pdf.setCreator("design/a1-board/generate_a1_board_study.py")

    draw_board_page(pdf, map_image)
    pdf.showPage()
    draw_measurement_page(pdf, map_image)
    pdf.showPage()
    pdf.save()

    validate_and_write_manifest(image_width, image_height)
    print(f"Wrote {PDF_PATH}")
    print(f"Wrote {MANIFEST_PATH}")
    print(
        "A1 clearances: "
        f"{SIDE_CLEARANCE_MM:.3f} mm sides, "
        f"{VERTICAL_CLEARANCE_MM:.3f} mm top/bottom"
    )
    print(
        "Usable after safety and gap: "
        f"{USABLE_SIDE_RAIL_MM:.3f} mm sides, "
        f"{USABLE_BAND_MM:.3f} mm top/bottom"
    )


if __name__ == "__main__":
    main()
