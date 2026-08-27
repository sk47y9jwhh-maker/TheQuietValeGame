#!/usr/bin/env python3
"""Generate a print-safe, material-realistic A1 neoprene board concept."""

from __future__ import annotations

import json
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps
from pypdf import PdfReader
from reportlab.lib.colors import Color, HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

import generate_a1_board_study as study


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "output/pdf"
PDF_PATH = OUTPUT_DIR / "the-quiet-vale-a1-board-realistic-neoprene.pdf"
MANIFEST_PATH = OUTPUT_DIR / "the-quiet-vale-a1-board-realistic-neoprene.json"

# Four texture pixels per millimetre is about 102 ppi. The material texture is
# deliberately broad and low-frequency so it survives neoprene's woven surface.
TEXTURE_PX_PER_MM = 4
TEXTURE_WIDTH_PX = round(study.A1_WIDTH_MM * TEXTURE_PX_PER_MM)
TEXTURE_HEIGHT_PX = round(study.A1_HEIGHT_MM * TEXTURE_PX_PER_MM)

INK_BLACK = HexColor("#1d1e1b")
INK_BLACK_DEEP = HexColor("#10110f")
LEATHER_RAISED = HexColor("#303027")
LEATHER_EDGE = HexColor("#484536")
STONE_WELL = HexColor("#20221f")
STONE_WELL_SOFT = HexColor("#292b27")
BRASS_SHADOW = HexColor("#51401e")
BRASS_DARK = HexColor("#705727")
BRASS_MID = HexColor("#9a7934")
BRASS_LIGHT = HexColor("#c0a158")
BRASS_HIGHLIGHT = HexColor("#ddc77b")
VERDIGRIS = HexColor("#405d50")
PARCHMENT = HexColor("#e6e0c9")
PARCHMENT_MUTED = HexColor("#beb79c")
SEASON_COLORS = [
    HexColor("#53684b"),
    HexColor("#9a7a38"),
    HexColor("#7a4e3b"),
]

ROUND_TRACK_X_MM = (study.A1_WIDTH_MM - 470.0) / 2
ROUND_TRACK_Y_MM = 9.0
ROUND_TRACK_WIDTH_MM = 470.0
ROUND_TRACK_HEIGHT_MM = 27.0


def make_print_leather_texture() -> Image.Image:
    """Create deterministic, lifted-black leather suitable for fabric print."""

    width = TEXTURE_WIDTH_PX
    height = TEXTURE_HEIGHT_PX
    rng = random.Random(20260724)

    fine_noise = Image.frombytes("L", (width, height), rng.randbytes(width * height))
    fine_noise = fine_noise.filter(ImageFilter.GaussianBlur(0.75))

    coarse_width = max(1, width // 20)
    coarse_height = max(1, height // 20)
    coarse_noise = Image.frombytes(
        "L",
        (coarse_width, coarse_height),
        rng.randbytes(coarse_width * coarse_height),
    )
    coarse_noise = coarse_noise.resize((width, height), Image.Resampling.BICUBIC)
    coarse_noise = coarse_noise.filter(ImageFilter.GaussianBlur(7.0))

    fine_color = ImageOps.colorize(
        fine_noise,
        black=(18, 19, 17),
        white=(52, 49, 39),
    )
    coarse_color = ImageOps.colorize(
        coarse_noise,
        black=(20, 20, 18),
        white=(47, 43, 34),
    )
    leather = Image.blend(fine_color, coarse_color, 0.38)
    leather = ImageEnhance.Contrast(leather).enhance(0.82)

    # Uneven stains and rubbed areas create age at a scale that will remain
    # visible on fabric rather than becoming anonymous digital noise.
    age = Image.new("RGBA", leather.size, (0, 0, 0, 0))
    age_draw = ImageDraw.Draw(age, "RGBA")
    stain_colors = [
        (71, 50, 27),
        (45, 51, 38),
        (13, 15, 13),
        (91, 70, 38),
    ]
    for _ in range(74):
        center_x = rng.randrange(width)
        center_y = rng.randrange(height)
        radius_x = rng.randrange(24, 250)
        radius_y = rng.randrange(12, 130)
        red, green, blue = rng.choice(stain_colors)
        age_draw.ellipse(
            (
                center_x - radius_x,
                center_y - radius_y,
                center_x + radius_x,
                center_y + radius_y,
            ),
            fill=(red, green, blue, rng.randrange(9, 29)),
        )
    age = age.filter(ImageFilter.GaussianBlur(24.0))
    leather = Image.alpha_composite(leather.convert("RGBA"), age)

    grain = Image.new("RGBA", leather.size, (0, 0, 0, 0))
    grain_draw = ImageDraw.Draw(grain, "RGBA")

    # Long, broken fibres remain visible after the image is transferred to
    # neoprene; extremely fine photographic pores would simply turn muddy.
    for _ in range(620):
        start_x = rng.randrange(width)
        start_y = rng.randrange(height)
        length = rng.randrange(18, 110)
        drift = rng.randrange(-7, 8)
        points = [
            (start_x, start_y),
            (start_x + length // 3, start_y + drift // 2),
            (start_x + length * 2 // 3, start_y - drift // 3),
            (start_x + length, start_y + drift),
        ]
        if rng.random() < 0.54:
            color = (210, 190, 130, rng.randrange(8, 18))
        else:
            color = (0, 0, 0, rng.randrange(12, 27))
        grain_draw.line(points, fill=color, width=rng.choice((1, 1, 2)))

    for _ in range(2100):
        center_x = rng.randrange(width)
        center_y = rng.randrange(height)
        radius_x = rng.choice((1, 1, 2, 3))
        radius_y = rng.choice((1, 2, 2, 3))
        grain_draw.ellipse(
            (
                center_x - radius_x,
                center_y - radius_y,
                center_x + radius_x,
                center_y + radius_y,
            ),
            fill=(0, 0, 0, rng.randrange(8, 25)),
        )

    # Fine cracks have a dark cut and a faint rubbed shoulder. Both are broad
    # enough to survive the slight softness of a neoprene print.
    for _ in range(175):
        start_x = rng.randrange(width)
        start_y = rng.randrange(height)
        length = rng.randrange(35, 210)
        segments = rng.randrange(3, 7)
        points = [(start_x, start_y)]
        for segment in range(1, segments + 1):
            points.append(
                (
                    start_x + round(length * segment / segments),
                    start_y + rng.randrange(-10, 11),
                )
            )
        grain_draw.line(
            [(x + 2, y + 2) for x, y in points],
            fill=(189, 161, 104, rng.randrange(8, 18)),
            width=rng.choice((1, 2, 2, 3)),
        )
        grain_draw.line(
            points,
            fill=(0, 0, 0, rng.randrange(25, 58)),
            width=rng.choice((1, 1, 2)),
        )

    leather = Image.alpha_composite(leather, grain)

    # A broad vignette gives the printed mount depth without depending on
    # fragile near-black detail.
    vignette = Image.new("RGBA", leather.size, (0, 0, 0, 0))
    vignette_draw = ImageDraw.Draw(vignette, "RGBA")
    ring_count = 48
    for ring in range(ring_count):
        alpha = round(4.2 * (1 - ring / ring_count))
        inset = ring * 4
        vignette_draw.rectangle(
            (inset, inset, width - inset - 1, height - inset - 1),
            outline=(0, 0, 0, alpha),
            width=4,
        )
    leather = Image.alpha_composite(leather, vignette)
    return leather.convert("RGB")


def load_cropped_map() -> ImageReader:
    with Image.open(study.MAP_PATH) as source:
        cropped = source.convert("RGB").crop(study.MAP_CROP_PX)
    return ImageReader(cropped)


def draw_print_background(
    pdf: canvas.Canvas,
    texture: ImageReader,
) -> None:
    pdf.drawImage(
        texture,
        0,
        0,
        width=study.PAGE_SIZE[0],
        height=study.PAGE_SIZE[1],
        preserveAspectRatio=False,
        mask="auto",
    )

    # Full-bleed dark field. The stitched seam is inside the 6 mm safety and
    # uses a coarse dash that remains legible on fabric.
    pdf.saveState()
    pdf.setStrokeColor(Color(0.04, 0.045, 0.04, alpha=0.88))
    pdf.setLineWidth(study.xpt(1.6))
    pdf.roundRect(
        study.xpt(4.0),
        study.xpt(4.0),
        study.xpt(study.A1_WIDTH_MM - 8.0),
        study.xpt(study.A1_HEIGHT_MM - 8.0),
        study.xpt(3.0),
        stroke=1,
        fill=0,
    )
    pdf.setStrokeColor(Color(0.58, 0.48, 0.28, alpha=0.72))
    pdf.setLineWidth(study.xpt(0.62))
    pdf.setDash(study.xpt(2.5), study.xpt(2.2))
    pdf.roundRect(
        study.xpt(7.2),
        study.xpt(7.2),
        study.xpt(study.A1_WIDTH_MM - 14.4),
        study.xpt(study.A1_HEIGHT_MM - 14.4),
        study.xpt(2.0),
        stroke=1,
        fill=0,
    )
    pdf.setDash()
    pdf.restoreState()


def draw_brass_gradient(
    pdf: canvas.Canvas,
    x_mm: float,
    y_mm: float,
    width_mm: float,
    height_mm: float,
    vertical: bool = True,
) -> None:
    pdf.saveState()
    path = pdf.beginPath()
    path.rect(
        study.xpt(x_mm),
        study.xpt(y_mm),
        study.xpt(width_mm),
        study.xpt(height_mm),
    )
    pdf.clipPath(path, stroke=0, fill=0)
    if vertical:
        start = (study.xpt(x_mm), study.xpt(y_mm))
        end = (study.xpt(x_mm), study.xpt(y_mm + height_mm))
    else:
        start = (study.xpt(x_mm), study.xpt(y_mm))
        end = (study.xpt(x_mm + width_mm), study.xpt(y_mm))
    pdf.linearGradient(
        start[0],
        start[1],
        end[0],
        end[1],
        [BRASS_SHADOW, BRASS_MID, BRASS_LIGHT, BRASS_DARK],
        positions=[0.0, 0.34, 0.68, 1.0],
        extend=True,
    )

    # Tarnish, small scratches, and verdigris keep the fittings from reading
    # as freshly rendered flat gradients.
    seed = round(x_mm * 131 + y_mm * 79 + width_mm * 43 + height_mm * 17)
    rng = random.Random(seed)
    for index in range(max(3, round((width_mm + height_mm) / 5.0))):
        mark_x = rng.uniform(x_mm + 0.5, x_mm + width_mm - 0.5)
        mark_y = rng.uniform(y_mm + 0.5, y_mm + height_mm - 0.5)
        if index % 4 == 0:
            pdf.setFillColor(Color(0.19, 0.31, 0.26, alpha=0.30))
            pdf.circle(
                study.xpt(mark_x),
                study.xpt(mark_y),
                study.xpt(rng.uniform(0.18, 0.5)),
                stroke=0,
                fill=1,
            )
        else:
            pdf.setStrokeColor(Color(0.19, 0.14, 0.07, alpha=0.32))
            pdf.setLineWidth(study.xpt(rng.uniform(0.15, 0.32)))
            pdf.line(
                study.xpt(mark_x),
                study.xpt(mark_y),
                study.xpt(mark_x + rng.uniform(0.8, 3.2)),
                study.xpt(mark_y + rng.uniform(-0.35, 0.35)),
            )
    pdf.restoreState()


def draw_rivet(
    pdf: canvas.Canvas,
    x_mm: float,
    y_mm: float,
    radius_mm: float = 1.8,
) -> None:
    pdf.saveState()
    pdf.setFillColor(Color(0, 0, 0, alpha=0.46))
    pdf.circle(
        study.xpt(x_mm + 0.45),
        study.xpt(y_mm - 0.45),
        study.xpt(radius_mm + 0.25),
        stroke=0,
        fill=1,
    )
    pdf.setFillColor(BRASS_SHADOW)
    pdf.circle(
        study.xpt(x_mm),
        study.xpt(y_mm),
        study.xpt(radius_mm),
        stroke=0,
        fill=1,
    )
    pdf.setFillColor(BRASS_MID)
    pdf.circle(
        study.xpt(x_mm),
        study.xpt(y_mm),
        study.xpt(radius_mm * 0.76),
        stroke=0,
        fill=1,
    )
    pdf.setFillColor(BRASS_LIGHT)
    pdf.circle(
        study.xpt(x_mm - radius_mm * 0.19),
        study.xpt(y_mm + radius_mm * 0.19),
        study.xpt(radius_mm * 0.42),
        stroke=0,
        fill=1,
    )
    pdf.setFillColor(BRASS_HIGHLIGHT)
    pdf.circle(
        study.xpt(x_mm - radius_mm * 0.34),
        study.xpt(y_mm + radius_mm * 0.35),
        study.xpt(radius_mm * 0.13),
        stroke=0,
        fill=1,
    )
    pdf.setFillColor(Color(0.19, 0.16, 0.09, alpha=0.55))
    pdf.circle(
        study.xpt(x_mm + radius_mm * 0.22),
        study.xpt(y_mm - radius_mm * 0.18),
        study.xpt(radius_mm * 0.12),
        stroke=0,
        fill=1,
    )
    pdf.setStrokeColor(Color(0.18, 0.35, 0.29, alpha=0.62))
    pdf.setLineWidth(study.xpt(max(0.18, radius_mm * 0.16)))
    pdf.arc(
        study.xpt(x_mm - radius_mm * 0.82),
        study.xpt(y_mm - radius_mm * 0.82),
        study.xpt(x_mm + radius_mm * 0.82),
        study.xpt(y_mm + radius_mm * 0.82),
        startAng=198,
        extent=82,
    )
    pdf.restoreState()


def draw_leather_scuffs(
    pdf: canvas.Canvas,
    x_mm: float,
    y_mm: float,
    width_mm: float,
    height_mm: float,
    seed: int,
    count: int = 18,
) -> None:
    rng = random.Random(seed)
    pdf.saveState()
    clip = pdf.beginPath()
    clip.rect(
        study.xpt(x_mm),
        study.xpt(y_mm),
        study.xpt(width_mm),
        study.xpt(height_mm),
    )
    pdf.clipPath(clip, stroke=0, fill=0)
    for index in range(count):
        start_x = rng.uniform(x_mm + 1.0, x_mm + width_mm - 1.0)
        start_y = rng.uniform(y_mm + 1.0, y_mm + height_mm - 1.0)
        length = rng.uniform(2.5, min(18.0, width_mm / 2))
        pdf.setLineWidth(study.xpt(rng.uniform(0.22, 0.55)))
        if index % 3:
            pdf.setStrokeColor(Color(0.70, 0.62, 0.43, alpha=0.075))
        else:
            pdf.setStrokeColor(Color(0.015, 0.018, 0.015, alpha=0.26))
        pdf.line(
            study.xpt(start_x),
            study.xpt(start_y),
            study.xpt(start_x + length),
            study.xpt(start_y + rng.uniform(-0.9, 0.9)),
        )
    pdf.restoreState()


def draw_corner_strap(
    pdf: canvas.Canvas,
    x_mm: float,
    y_mm: float,
    x_direction: int,
    y_direction: int,
) -> None:
    arm_length = 17.0
    arm_width = 6.2
    horizontal_x = x_mm if x_direction > 0 else x_mm - arm_length
    horizontal_y = y_mm if y_direction > 0 else y_mm - arm_width
    vertical_x = x_mm if x_direction > 0 else x_mm - arm_width
    vertical_y = y_mm if y_direction > 0 else y_mm - arm_length

    pdf.saveState()
    pdf.setFillColor(Color(0, 0, 0, alpha=0.52))
    pdf.roundRect(
        study.xpt(horizontal_x + 0.8),
        study.xpt(horizontal_y - 0.8),
        study.xpt(arm_length),
        study.xpt(arm_width),
        study.xpt(1.3),
        stroke=0,
        fill=1,
    )
    pdf.roundRect(
        study.xpt(vertical_x + 0.8),
        study.xpt(vertical_y - 0.8),
        study.xpt(arm_width),
        study.xpt(arm_length),
        study.xpt(1.3),
        stroke=0,
        fill=1,
    )
    pdf.setFillColor(BRASS_DARK)
    pdf.setStrokeColor(BRASS_SHADOW)
    pdf.setLineWidth(study.xpt(0.55))
    pdf.roundRect(
        study.xpt(horizontal_x),
        study.xpt(horizontal_y),
        study.xpt(arm_length),
        study.xpt(arm_width),
        study.xpt(1.3),
        stroke=1,
        fill=1,
    )
    pdf.roundRect(
        study.xpt(vertical_x),
        study.xpt(vertical_y),
        study.xpt(arm_width),
        study.xpt(arm_length),
        study.xpt(1.3),
        stroke=1,
        fill=1,
    )
    pdf.restoreState()

    draw_brass_gradient(
        pdf,
        horizontal_x + 0.6,
        horizontal_y + 0.6,
        arm_length - 1.2,
        arm_width - 1.2,
    )
    draw_brass_gradient(
        pdf,
        vertical_x + 0.6,
        vertical_y + 0.6,
        arm_width - 1.2,
        arm_length - 1.2,
        vertical=False,
    )
    draw_rivet(
        pdf,
        x_mm + x_direction * 3.2,
        y_mm + y_direction * 3.2,
        1.7,
    )


def draw_realistic_map_mount(
    pdf: canvas.Canvas,
    map_image: ImageReader,
) -> None:
    outer_x = study.MAP_X_MM - 4.6
    outer_y = study.MAP_Y_MM - 4.6
    outer_width = study.PLACED_MAP_WIDTH_MM + 9.2
    outer_height = study.PLACED_MAP_HEIGHT_MM + 9.2

    pdf.saveState()
    for offset, alpha in ((3.0, 0.12), (2.0, 0.20), (1.0, 0.28)):
        pdf.setFillColor(Color(0, 0, 0, alpha=alpha))
        pdf.roundRect(
            study.xpt(outer_x + offset),
            study.xpt(outer_y - offset),
            study.xpt(outer_width),
            study.xpt(outer_height),
            study.xpt(2.6),
            stroke=0,
            fill=1,
        )

    pdf.setFillColor(INK_BLACK_DEEP)
    pdf.setStrokeColor(HexColor("#080907"))
    pdf.setLineWidth(study.xpt(1.0))
    pdf.roundRect(
        study.xpt(outer_x),
        study.xpt(outer_y),
        study.xpt(outer_width),
        study.xpt(outer_height),
        study.xpt(2.6),
        stroke=1,
        fill=1,
    )
    pdf.setStrokeColor(BRASS_SHADOW)
    pdf.setLineWidth(study.xpt(1.15))
    pdf.roundRect(
        study.xpt(study.MAP_X_MM - 2.6),
        study.xpt(study.MAP_Y_MM - 2.6),
        study.xpt(study.PLACED_MAP_WIDTH_MM + 5.2),
        study.xpt(study.PLACED_MAP_HEIGHT_MM + 5.2),
        study.xpt(1.7),
        stroke=1,
        fill=0,
    )
    pdf.setStrokeColor(BRASS_LIGHT)
    pdf.setLineWidth(study.xpt(0.34))
    pdf.roundRect(
        study.xpt(study.MAP_X_MM - 2.0),
        study.xpt(study.MAP_Y_MM - 2.0),
        study.xpt(study.PLACED_MAP_WIDTH_MM + 4.0),
        study.xpt(study.PLACED_MAP_HEIGHT_MM + 4.0),
        study.xpt(1.2),
        stroke=1,
        fill=0,
    )
    pdf.restoreState()

    pdf.drawImage(
        map_image,
        study.xpt(study.MAP_X_MM),
        study.xpt(study.MAP_Y_MM),
        width=study.xpt(study.PLACED_MAP_WIDTH_MM),
        height=study.xpt(study.PLACED_MAP_HEIGHT_MM),
        preserveAspectRatio=False,
        mask="auto",
    )
    pdf.setStrokeColor(HexColor("#171814"))
    pdf.setLineWidth(study.xpt(0.8))
    pdf.rect(
        study.xpt(study.MAP_X_MM),
        study.xpt(study.MAP_Y_MM),
        study.xpt(study.PLACED_MAP_WIDTH_MM),
        study.xpt(study.PLACED_MAP_HEIGHT_MM),
        stroke=1,
        fill=0,
    )

    draw_corner_strap(
        pdf,
        study.MAP_X_MM - 2.8,
        study.MAP_Y_MM - 2.8,
        1,
        1,
    )
    draw_corner_strap(
        pdf,
        study.MAP_RIGHT_MM + 2.8,
        study.MAP_Y_MM - 2.8,
        -1,
        1,
    )
    draw_corner_strap(
        pdf,
        study.MAP_X_MM - 2.8,
        study.MAP_TOP_MM + 2.8,
        1,
        -1,
    )
    draw_corner_strap(
        pdf,
        study.MAP_RIGHT_MM + 2.8,
        study.MAP_TOP_MM + 2.8,
        -1,
        -1,
    )


def draw_well_grain(
    pdf: canvas.Canvas,
    x_mm: float,
    y_mm: float,
    width_mm: float,
    height_mm: float,
    seed: int,
) -> None:
    rng = random.Random(seed)
    pdf.saveState()
    clip = pdf.beginPath()
    clip.rect(
        study.xpt(x_mm),
        study.xpt(y_mm),
        study.xpt(width_mm),
        study.xpt(height_mm),
    )
    pdf.clipPath(clip, stroke=0, fill=0)
    pdf.setLineWidth(study.xpt(0.34))
    for index in range(32):
        start_x = rng.uniform(x_mm + 2.0, x_mm + width_mm - 2.0)
        start_y = rng.uniform(y_mm + 2.0, y_mm + height_mm - 2.0)
        length = rng.uniform(4.0, 18.0)
        rise = rng.uniform(-1.4, 1.4)
        if index % 3:
            pdf.setStrokeColor(Color(0.52, 0.50, 0.43, alpha=0.055))
        else:
            pdf.setStrokeColor(Color(0.02, 0.02, 0.018, alpha=0.17))
        pdf.line(
            study.xpt(start_x),
            study.xpt(start_y),
            study.xpt(start_x + length),
            study.xpt(start_y + rise),
        )
    pdf.restoreState()


def draw_realistic_resource_well(
    pdf: canvas.Canvas,
    label: str,
    x_mm: float,
    y_mm: float,
    width_mm: float,
    height_mm: float,
    seed: int,
) -> None:
    accent = study.RESOURCE_COLORS[label]

    pdf.saveState()
    pdf.setFillColor(Color(0, 0, 0, alpha=0.50))
    pdf.roundRect(
        study.xpt(x_mm + 1.5),
        study.xpt(y_mm - 1.7),
        study.xpt(width_mm),
        study.xpt(height_mm),
        study.xpt(3.0),
        stroke=0,
        fill=1,
    )
    pdf.setFillColor(LEATHER_RAISED)
    pdf.setStrokeColor(INK_BLACK_DEEP)
    pdf.setLineWidth(study.xpt(1.0))
    pdf.roundRect(
        study.xpt(x_mm),
        study.xpt(y_mm),
        study.xpt(width_mm),
        study.xpt(height_mm),
        study.xpt(3.0),
        stroke=1,
        fill=1,
    )
    pdf.setStrokeColor(LEATHER_EDGE)
    pdf.setLineWidth(study.xpt(0.55))
    pdf.roundRect(
        study.xpt(x_mm + 1.4),
        study.xpt(y_mm + 1.4),
        study.xpt(width_mm - 2.8),
        study.xpt(height_mm - 2.8),
        study.xpt(2.1),
        stroke=1,
        fill=0,
    )
    pdf.setStrokeColor(BRASS_DARK)
    pdf.setLineWidth(study.xpt(0.85))
    pdf.roundRect(
        study.xpt(x_mm + 2.5),
        study.xpt(y_mm + 2.5),
        study.xpt(width_mm - 5.0),
        study.xpt(height_mm - 5.0),
        study.xpt(1.7),
        stroke=1,
        fill=0,
    )
    pdf.restoreState()
    draw_leather_scuffs(
        pdf,
        x_mm + 1.2,
        y_mm + 1.2,
        width_mm - 2.4,
        height_mm - 2.4,
        seed + 500,
        count=26,
    )

    # Recessed counter pool. The lifted charcoal interior retains separation
    # from its dark bevel when dye-sublimated onto neoprene.
    well_x = x_mm + 4.0
    well_y = y_mm + 4.0
    well_width = width_mm - 8.0
    well_height = height_mm - 25.0
    pdf.saveState()
    pdf.setFillColor(HexColor("#090a09"))
    pdf.roundRect(
        study.xpt(well_x - 1.1),
        study.xpt(well_y - 1.1),
        study.xpt(well_width + 2.2),
        study.xpt(well_height + 2.2),
        study.xpt(2.3),
        stroke=0,
        fill=1,
    )
    pdf.setFillColor(STONE_WELL)
    pdf.setStrokeColor(BRASS_SHADOW)
    pdf.setLineWidth(study.xpt(0.9))
    pdf.roundRect(
        study.xpt(well_x),
        study.xpt(well_y),
        study.xpt(well_width),
        study.xpt(well_height),
        study.xpt(2.0),
        stroke=1,
        fill=1,
    )
    pdf.setStrokeColor(Color(0.72, 0.62, 0.38, alpha=0.42))
    pdf.setLineWidth(study.xpt(0.48))
    pdf.line(
        study.xpt(well_x + 1.3),
        study.xpt(well_y + well_height - 1.4),
        study.xpt(well_x + well_width - 1.3),
        study.xpt(well_y + well_height - 1.4),
    )
    pdf.line(
        study.xpt(well_x + 1.3),
        study.xpt(well_y + 1.3),
        study.xpt(well_x + 1.3),
        study.xpt(well_y + well_height - 1.4),
    )
    pdf.setStrokeColor(Color(0, 0, 0, alpha=0.66))
    pdf.line(
        study.xpt(well_x + 1.3),
        study.xpt(well_y + 1.3),
        study.xpt(well_x + well_width - 1.3),
        study.xpt(well_y + 1.3),
    )
    pdf.line(
        study.xpt(well_x + well_width - 1.3),
        study.xpt(well_y + 1.3),
        study.xpt(well_x + well_width - 1.3),
        study.xpt(well_y + well_height - 1.4),
    )
    pdf.restoreState()
    draw_well_grain(
        pdf,
        well_x + 1.7,
        well_y + 1.7,
        well_width - 3.4,
        well_height - 3.4,
        seed,
    )

    header_x = x_mm + 4.0
    header_y = y_mm + height_mm - 20.7
    header_width = width_mm - 8.0
    header_height = 16.2
    pdf.saveState()
    pdf.setFillColor(HexColor("#25261f"))
    pdf.setStrokeColor(BRASS_SHADOW)
    pdf.setLineWidth(study.xpt(0.72))
    pdf.roundRect(
        study.xpt(header_x),
        study.xpt(header_y),
        study.xpt(header_width),
        study.xpt(header_height),
        study.xpt(1.6),
        stroke=1,
        fill=1,
    )
    pdf.setStrokeColor(Color(0.77, 0.66, 0.40, alpha=0.35))
    pdf.setLineWidth(study.xpt(0.34))
    pdf.line(
        study.xpt(header_x + 1.5),
        study.xpt(header_y + header_height - 1.4),
        study.xpt(header_x + header_width - 1.5),
        study.xpt(header_y + header_height - 1.4),
    )
    pdf.setFillColor(accent)
    pdf.setStrokeColor(Color(0.03, 0.03, 0.025, alpha=0.8))
    pdf.setLineWidth(study.xpt(0.45))
    pdf.circle(
        study.xpt(header_x + 8.0),
        study.xpt(header_y + header_height / 2),
        study.xpt(3.2),
        stroke=1,
        fill=1,
    )
    pdf.restoreState()
    draw_rivet(pdf, header_x + 8.0, header_y + header_height / 2, 1.25)

    study.centered_text(
        pdf,
        label,
        header_x + header_width / 2 + 3.0,
        header_y + 5.7,
        "Helvetica-Bold",
        9.6,
        PARCHMENT,
    )


def draw_warehouse_plaque(
    pdf: canvas.Canvas,
    x_mm: float,
    width_mm: float,
) -> None:
    plaque_x = x_mm + 3.0
    plaque_y = 548.0
    plaque_width = width_mm - 6.0
    plaque_height = 17.0

    pdf.saveState()
    pdf.setFillColor(Color(0, 0, 0, alpha=0.44))
    pdf.roundRect(
        study.xpt(plaque_x + 0.8),
        study.xpt(plaque_y - 0.8),
        study.xpt(plaque_width),
        study.xpt(plaque_height),
        study.xpt(2.0),
        stroke=0,
        fill=1,
    )
    pdf.setFillColor(INK_BLACK)
    pdf.setStrokeColor(BRASS_DARK)
    pdf.setLineWidth(study.xpt(0.8))
    pdf.roundRect(
        study.xpt(plaque_x),
        study.xpt(plaque_y),
        study.xpt(plaque_width),
        study.xpt(plaque_height),
        study.xpt(2.0),
        stroke=1,
        fill=1,
    )
    pdf.setStrokeColor(Color(0.80, 0.69, 0.42, alpha=0.34))
    pdf.setLineWidth(study.xpt(0.3))
    pdf.roundRect(
        study.xpt(plaque_x + 1.2),
        study.xpt(plaque_y + 1.2),
        study.xpt(plaque_width - 2.4),
        study.xpt(plaque_height - 2.4),
        study.xpt(1.3),
        stroke=1,
        fill=0,
    )
    pdf.restoreState()
    draw_rivet(pdf, plaque_x + 4.3, plaque_y + plaque_height / 2, 1.3)
    draw_rivet(
        pdf,
        plaque_x + plaque_width - 4.3,
        plaque_y + plaque_height / 2,
        1.3,
    )
    study.centered_text(
        pdf,
        "WAREHOUSE",
        plaque_x + plaque_width / 2,
        plaque_y + 8.8,
        "Helvetica-Bold",
        9.4,
        PARCHMENT,
    )
    study.centered_text(
        pdf,
        "SHARED RESOURCE POOLS",
        plaque_x + plaque_width / 2,
        plaque_y + 4.7,
        "Helvetica",
        4.5,
        PARCHMENT_MUTED,
    )


def draw_resource_rail(
    pdf: canvas.Canvas,
    rail_x: float,
    labels_top_to_bottom: list[str],
    seed_offset: int,
) -> None:
    rail_width = study.USABLE_SIDE_RAIL_MM - 2.0
    well_height = 156.0
    well_gap = 8.0
    total_height = well_height * 3 + well_gap * 2
    start_y = (study.A1_HEIGHT_MM - total_height) / 2

    draw_warehouse_plaque(pdf, rail_x, rail_width)
    for index, label in enumerate(reversed(labels_top_to_bottom)):
        draw_realistic_resource_well(
            pdf,
            label,
            rail_x,
            start_y + index * (well_height + well_gap),
            rail_width,
            well_height,
            seed_offset + index,
        )


def draw_title_plaque(pdf: canvas.Canvas) -> None:
    width = 184.0
    height = 20.0
    x = (study.A1_WIDTH_MM - width) / 2
    y = 567.2

    pdf.saveState()
    pdf.setFillColor(Color(0, 0, 0, alpha=0.44))
    pdf.roundRect(
        study.xpt(x + 1.1),
        study.xpt(y - 1.1),
        study.xpt(width),
        study.xpt(height),
        study.xpt(2.3),
        stroke=0,
        fill=1,
    )
    pdf.setFillColor(INK_BLACK)
    pdf.setStrokeColor(BRASS_DARK)
    pdf.setLineWidth(study.xpt(0.9))
    pdf.roundRect(
        study.xpt(x),
        study.xpt(y),
        study.xpt(width),
        study.xpt(height),
        study.xpt(2.3),
        stroke=1,
        fill=1,
    )
    pdf.setStrokeColor(Color(0.82, 0.70, 0.43, alpha=0.42))
    pdf.setLineWidth(study.xpt(0.3))
    pdf.roundRect(
        study.xpt(x + 1.4),
        study.xpt(y + 1.4),
        study.xpt(width - 2.8),
        study.xpt(height - 2.8),
        study.xpt(1.6),
        stroke=1,
        fill=0,
    )
    pdf.restoreState()
    draw_rivet(pdf, x + 5.2, y + height / 2, 1.45)
    draw_rivet(pdf, x + width - 5.2, y + height / 2, 1.45)
    study.centered_text(
        pdf,
        "THE QUIET VALE",
        study.A1_WIDTH_MM / 2,
        y + 10.1,
        "Times-Bold",
        14.6,
        PARCHMENT,
    )
    study.centered_text(
        pdf,
        "A1 NEOPRENE BOARD - 60 MM TILE SCALE",
        study.A1_WIDTH_MM / 2,
        y + 5.0,
        "Helvetica-Bold",
        5.4,
        BRASS_LIGHT,
    )


def draw_round_socket(
    pdf: canvas.Canvas,
    center_x_mm: float,
    center_y_mm: float,
    number: int,
    accent: Color,
) -> None:
    radius = 6.6
    pdf.saveState()
    pdf.setFillColor(Color(0, 0, 0, alpha=0.58))
    pdf.circle(
        study.xpt(center_x_mm + 0.8),
        study.xpt(center_y_mm - 0.8),
        study.xpt(radius + 0.7),
        stroke=0,
        fill=1,
    )
    pdf.setFillColor(BRASS_SHADOW)
    pdf.setStrokeColor(HexColor("#302610"))
    pdf.setLineWidth(study.xpt(0.6))
    pdf.circle(
        study.xpt(center_x_mm),
        study.xpt(center_y_mm),
        study.xpt(radius),
        stroke=1,
        fill=1,
    )
    pdf.setFillColor(STONE_WELL_SOFT)
    pdf.setStrokeColor(accent)
    pdf.setLineWidth(study.xpt(0.72))
    pdf.circle(
        study.xpt(center_x_mm),
        study.xpt(center_y_mm),
        study.xpt(radius - 1.15),
        stroke=1,
        fill=1,
    )
    pdf.setStrokeColor(Color(0.76, 0.67, 0.44, alpha=0.35))
    pdf.setLineWidth(study.xpt(0.28))
    pdf.arc(
        study.xpt(center_x_mm - radius + 1.8),
        study.xpt(center_y_mm - radius + 1.8),
        study.xpt(center_x_mm + radius - 1.8),
        study.xpt(center_y_mm + radius - 1.8),
        startAng=42,
        extent=104,
    )
    pdf.restoreState()
    study.centered_text(
        pdf,
        str(number),
        center_x_mm,
        center_y_mm - 1.6,
        "Helvetica-Bold",
        8.6,
        PARCHMENT,
    )


def draw_round_tracker(pdf: canvas.Canvas) -> None:
    x = ROUND_TRACK_X_MM
    y = ROUND_TRACK_Y_MM
    width = ROUND_TRACK_WIDTH_MM
    height = ROUND_TRACK_HEIGHT_MM

    pdf.saveState()
    pdf.setFillColor(Color(0, 0, 0, alpha=0.58))
    pdf.roundRect(
        study.xpt(x + 1.7),
        study.xpt(y - 1.5),
        study.xpt(width),
        study.xpt(height),
        study.xpt(3.0),
        stroke=0,
        fill=1,
    )
    pdf.setFillColor(LEATHER_RAISED)
    pdf.setStrokeColor(INK_BLACK_DEEP)
    pdf.setLineWidth(study.xpt(1.15))
    pdf.roundRect(
        study.xpt(x),
        study.xpt(y),
        study.xpt(width),
        study.xpt(height),
        study.xpt(3.0),
        stroke=1,
        fill=1,
    )
    pdf.setStrokeColor(BRASS_DARK)
    pdf.setLineWidth(study.xpt(0.9))
    pdf.roundRect(
        study.xpt(x + 1.5),
        study.xpt(y + 1.5),
        study.xpt(width - 3.0),
        study.xpt(height - 3.0),
        study.xpt(2.1),
        stroke=1,
        fill=0,
    )
    pdf.setStrokeColor(Color(0.83, 0.72, 0.46, alpha=0.31))
    pdf.setLineWidth(study.xpt(0.3))
    pdf.roundRect(
        study.xpt(x + 2.2),
        study.xpt(y + 2.2),
        study.xpt(width - 4.4),
        study.xpt(height - 4.4),
        study.xpt(1.7),
        stroke=1,
        fill=0,
    )
    pdf.restoreState()
    draw_leather_scuffs(pdf, x + 2.0, y + 2.0, width - 4.0, height - 4.0, 7400, 68)

    inner_padding = 6.0
    season_gap = 7.0
    season_width = (width - inner_padding * 2 - season_gap * 2) / 3
    panel_y = y + 2.2
    panel_height = height - 4.4
    marker_y = y + 10.6

    for season_index in range(3):
        season = season_index + 1
        season_x = x + inner_padding + season_index * (season_width + season_gap)
        accent = SEASON_COLORS[season_index]
        first_round = season_index * 4 + 1
        last_round = first_round + 3

        pdf.saveState()
        pdf.setFillColor(Color(
            accent.red,
            accent.green,
            accent.blue,
            alpha=0.13,
        ))
        pdf.setStrokeColor(Color(
            accent.red,
            accent.green,
            accent.blue,
            alpha=0.68,
        ))
        pdf.setLineWidth(study.xpt(0.55))
        pdf.roundRect(
            study.xpt(season_x),
            study.xpt(panel_y),
            study.xpt(season_width),
            study.xpt(panel_height),
            study.xpt(1.8),
            stroke=1,
            fill=1,
        )
        pdf.restoreState()

        study.centered_text(
            pdf,
            f"SEASON {['I', 'II', 'III'][season_index]} - ROUNDS {first_round}-{last_round}",
            season_x + season_width / 2,
            y + 21.4,
            "Helvetica-Bold",
            5.8,
            PARCHMENT_MUTED,
        )

        first_center = season_x + 19.0
        last_center = season_x + season_width - 19.0
        spacing = (last_center - first_center) / 3
        pdf.setStrokeColor(Color(
            accent.red,
            accent.green,
            accent.blue,
            alpha=0.58,
        ))
        pdf.setLineWidth(study.xpt(1.1))
        pdf.line(
            study.xpt(first_center),
            study.xpt(marker_y),
            study.xpt(last_center),
            study.xpt(marker_y),
        )
        for local_round in range(4):
            round_number = first_round + local_round
            draw_round_socket(
                pdf,
                first_center + local_round * spacing,
                marker_y,
                round_number,
                accent,
            )

    draw_rivet(pdf, x + 4.1, y + height / 2, 1.35)
    draw_rivet(pdf, x + width - 4.1, y + height / 2, 1.35)


def draw_artist_credit(pdf: canvas.Canvas) -> None:
    study.centered_text(
        pdf,
        "Map artwork by Giovanni Spadaro and Daniele Nicotra - prototype layout only",
        study.A1_WIDTH_MM / 2,
        37.5,
        "Helvetica",
        4.6,
        PARCHMENT_MUTED,
    )


def draw_board_page(
    pdf: canvas.Canvas,
    texture: ImageReader,
    map_image: ImageReader,
) -> None:
    draw_print_background(pdf, texture)
    draw_realistic_map_mount(pdf, map_image)
    draw_resource_rail(
        pdf,
        study.OUTER_SAFETY_MM + 1.0,
        ["WOOD", "STONE", "METAL"],
        1100,
    )
    draw_resource_rail(
        pdf,
        study.MAP_RIGHT_MM + study.MAP_GAP_MM + 1.0,
        ["FOOD", "HERBS", "GOODS"],
        2200,
    )
    draw_title_plaque(pdf)
    draw_round_tracker(pdf)
    draw_artist_credit(pdf)


def validate_and_write_manifest() -> None:
    reader = PdfReader(str(PDF_PATH))
    if len(reader.pages) != 1:
        raise RuntimeError(f"Expected 1 page, found {len(reader.pages)}")
    page = reader.pages[0]
    width_mm = float(page.mediabox.width) / 72.0 * 25.4
    height_mm = float(page.mediabox.height) / 72.0 * 25.4
    if abs(width_mm - study.A1_WIDTH_MM) > 0.02:
        raise RuntimeError(f"Wrong page width: {width_mm:.4f} mm")
    if abs(height_mm - study.A1_HEIGHT_MM) > 0.02:
        raise RuntimeError(f"Wrong page height: {height_mm:.4f} mm")

    manifest = {
        "title": "The Quiet Vale A1 realistic neoprene board",
        "pdf": str(PDF_PATH.relative_to(ROOT)),
        "pageCount": 1,
        "finishedSize": {
            "standard": "ISO A1 landscape",
            "widthMm": study.A1_WIDTH_MM,
            "heightMm": study.A1_HEIGHT_MM,
            "verifiedWidthMm": round(width_mm, 4),
            "verifiedHeightMm": round(height_mm, 4),
        },
        "neoprenePrintProfile": {
            "fullBleedBackgroundToTrim": True,
            "importantArtworkSafetyMm": study.OUTER_SAFETY_MM,
            "liftedBlackForShadowSeparation": True,
            "coarseMaterialTexture": True,
            "texturePixels": {
                "width": TEXTURE_WIDTH_PX,
                "height": TEXTURE_HEIGHT_PX,
                "effectivePpi": round(TEXTURE_PX_PER_MM * 25.4, 1),
            },
            "printerBleedExtensionMm": 0.0,
            "printCheckBarIncluded": False,
            "note": "A1 is the finished size; add vendor-specific bleed only after receiving the printer template.",
        },
        "tileAuthority": {
            "pointToPointMm": study.HEX_POINT_TO_POINT_MM,
            "flatToFlatMm": round(study.HEX_FLAT_TO_FLAT_MM, 4),
            "mapRescaledAfterCrop": False,
        },
        "map": {
            "source": str(study.MAP_PATH.relative_to(ROOT)),
            "placedWidthMm": round(study.PLACED_MAP_WIDTH_MM, 4),
            "placedHeightMm": round(study.PLACED_MAP_HEIGHT_MM, 4),
            "cropPixels": {
                "left": study.MAP_CROP_PX[0],
                "top": study.MAP_CROP_PX[1],
                "right": study.MAP_CROP_PX[2],
                "bottom": study.MAP_CROP_PX[3],
            },
        },
        "resourceWells": {
            "count": 6,
            "leftTopToBottom": ["WOOD", "STONE", "METAL"],
            "rightTopToBottom": ["FOOD", "HERBS", "GOODS"],
            "outerWidthMm": round(study.USABLE_SIDE_RAIL_MM - 2.0, 4),
            "outerHeightMm": 156.0,
            "openAreaWidthMm": round(study.USABLE_SIDE_RAIL_MM - 10.0, 4),
            "openAreaHeightMm": 131.0,
            "numberedPositions": False,
        },
        "roundTracker": {
            "position": "bottom",
            "rounds": 12,
            "markerSocketDiameterMm": 13.2,
            "seasons": [
                {"season": 1, "rounds": [1, 2, 3, 4]},
                {"season": 2, "rounds": [5, 6, 7, 8]},
                {"season": 3, "rounds": [9, 10, 11, 12]},
            ],
        },
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    texture = ImageReader(make_print_leather_texture())
    map_image = load_cropped_map()

    pdf = canvas.Canvas(str(PDF_PATH), pagesize=study.PAGE_SIZE, pageCompression=1)
    pdf.setTitle("The Quiet Vale - realistic A1 neoprene board")
    pdf.setAuthor("The Quiet Vale project")
    pdf.setSubject("Exact-scale A1 neoprene board at 60 mm tile scale")
    pdf.setCreator("design/a1-board/generate_a1_board_realistic.py")
    draw_board_page(pdf, texture, map_image)
    pdf.showPage()
    pdf.save()

    validate_and_write_manifest()
    print(f"Wrote {PDF_PATH}")
    print(f"Wrote {MANIFEST_PATH}")
    print(
        "Neoprene layout: "
        f"{study.USABLE_SIDE_RAIL_MM:.3f} mm usable rails; "
        f"{study.HEX_POINT_TO_POINT_MM:.1f} mm tiles"
    )


if __name__ == "__main__":
    main()
