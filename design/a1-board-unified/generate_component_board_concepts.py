#!/usr/bin/env python3
"""Generate layout concepts for the compact component holding board."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from generate_unified_a1_board import (
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
OUTPUT_DIR = ROOT / "output/concepts/component-board"
PPM = 4.0
WIDTH_MM = 622.3
HEIGHT_MM = 177.8
THREAD = (145, 108, 71)


def panel(
    board: Image.Image,
    bbox_mm: tuple[float, float, float, float],
    label: str,
    seed: int,
    label_size_mm: float = 5.8,
) -> None:
    bbox = tuple(px(value, PPM) for value in bbox_mm)
    render_recess(
        board,
        bbox,
        radius_px=px(7.5, PPM),
        depth_px=max(3, px(2.1, PPM)),
        interior_brightness=0.73,
    )
    inset = px(4.2, PPM)
    stitch = rounded_rect_path(
        (
            bbox[0] + inset,
            bbox[1] + inset,
            bbox[2] - inset,
            bbox[3] - inset,
        ),
        px(5.1, PPM),
    )
    draw_stitch_path(board, stitch, THREAD, PPM, seed=seed)
    left, top, right, _ = bbox_mm
    draw_material_text(
        board,
        label,
        ((left + right) / 2.0, top + 16.5),
        ALMENDRA,
        label_size_mm,
        (206, 192, 154),
        PPM,
        seed=seed + 900,
    )


def hex_points(cx: float, cy: float, diameter_mm: float = 54.0) -> list[tuple[int, int]]:
    radius = diameter_mm / 2.0
    return [
        (
            px(cx + radius * math.cos(math.radians(60 * index - 30)), PPM),
            px(cy + radius * math.sin(math.radians(60 * index - 30)), PPM),
        )
        for index in range(6)
    ]


def fit_symbols(
    image: Image.Image,
    core_boxes: list[tuple[float, float, float, float]],
    target_box: tuple[float, float, float, float],
    token_boxes: list[tuple[float, float, float, float]],
) -> None:
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    drawing = ImageDraw.Draw(overlay)
    outline = (222, 205, 164, 125)

    stack_labels = (
        "RESOURCE 15",
        "HOUSING 11",
        "TRAVEL A 12",
        "TRAVEL B 11",
        "SOCIAL + WELL 9",
        "MERCH + CRAFT 4",
    )
    try:
        stack_font = ImageFont.truetype(
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            11,
        )
    except OSError:
        stack_font = ImageFont.load_default()

    for left, top, right, bottom in core_boxes:
        usable_left = left + 13
        usable_right = right - 13
        usable_top = top + 31
        usable_bottom = bottom - 10
        usable_width = usable_right - usable_left
        usable_height = usable_bottom - usable_top
        columns = 6 if usable_width >= 350 else 3
        rows = 1 if columns == 6 else 2
        bay_width = usable_width / columns
        bay_height = usable_height / rows
        for index, label in enumerate(stack_labels):
            row = index // columns
            column = index % columns
            bay_left = usable_left + column * bay_width
            bay_top = usable_top + row * bay_height
            cx = bay_left + bay_width / 2
            cy = bay_top + bay_height / 2 + 4
            diameter = min(48.0, bay_width - 10.0, bay_height - 17.0)
            drawing.rounded_rectangle(
                (
                    px(bay_left + 2, PPM),
                    px(bay_top + 2, PPM),
                    px(bay_left + bay_width - 2, PPM),
                    px(bay_top + bay_height - 2, PPM),
                ),
                radius=px(3.0, PPM),
                outline=(222, 205, 164, 75),
                width=px(0.35, PPM),
            )
            for layer in range(3):
                points = hex_points(
                    cx,
                    cy - layer * 1.7,
                    diameter_mm=diameter,
                )
                drawing.line(
                    points + [points[0]],
                    fill=(222, 205, 164, 75 + layer * 25),
                    width=px(0.45, PPM),
                    joint="curve",
                )
            drawing.text(
                (px(cx, PPM), px(bay_top + 8, PPM)),
                label,
                font=stack_font,
                fill=(222, 205, 164, 180),
                anchor="mm",
            )

    left, top, right, bottom = target_box
    card_w = 44.0
    card_h = 68.0
    cx = (left + right) / 2.0
    cy = top + 34 + (bottom - top - 34) / 2.0
    drawing.rounded_rectangle(
        (
            px(cx - card_w / 2, PPM),
            px(cy - card_h / 2, PPM),
            px(cx + card_w / 2, PPM),
            px(cy + card_h / 2, PPM),
        ),
        radius=px(2.0, PPM),
        outline=outline,
        width=px(0.55, PPM),
    )

    for left, top, right, bottom in token_boxes:
        usable_top = top + 34
        width = right - left
        height = bottom - usable_top
        radius = min(12.0, width / 7.0, height / 3.0)
        if radius < 5:
            continue
        columns = max(2, min(4, int(width // (radius * 2.7))))
        rows = max(1, min(2, int(height // (radius * 2.7))))
        for row in range(rows):
            for column in range(columns):
                cx = left + width * (column + 1) / (columns + 1)
                cy = usable_top + height * (row + 1) / (rows + 1)
                drawing.ellipse(
                    (
                        px(cx - radius, PPM),
                        px(cy - radius, PPM),
                        px(cx + radius, PPM),
                        px(cy + radius, PPM),
                    ),
                    outline=outline,
                    width=px(0.55, PPM),
                )
    image.alpha_composite(overlay)


def base_board(title: str | None) -> Image.Image:
    board = tiled_leather(px(WIDTH_MM, PPM), px(HEIGHT_MM, PPM), PPM).convert("RGBA")
    draw_outer_finish(board, PPM)
    if title is None:
        return board
    draw_material_text(
        board,
        "THE QUIET VALE",
        (WIDTH_MM / 2.0, 18.5),
        ALMENDRA,
        13.0,
        (215, 202, 164),
        PPM,
        seed=77100,
    )
    draw_material_text(
        board,
        title,
        (WIDTH_MM / 2.0, 38.0),
        ALMENDRA,
        6.3,
        (164, 143, 101),
        PPM,
        seed=77101,
    )
    return board


def concept_one() -> Image.Image:
    board = base_board("COMPONENT BOARD - CONCEPT A")
    target = (28.0, 64.0, 104.0, 191.0)
    core = (111.15, 55.0, 511.15, 200.0)
    tokens = (518.3, 64.0, 594.3, 191.0)
    panel(board, target, "TARGET CARDS", 78100, 4.5)
    panel(board, core, "CORE TILES", 78200, 7.0)
    panel(board, tokens, "TOKENS", 78300, 5.7)
    fit_symbols(board, [core], target, [tokens])
    return apply_unified_neoprene_finish(board, PPM)


def selected_layout() -> Image.Image:
    board = base_board(None)
    target = (28.0, 25.4, 104.0, 152.4)
    core = (111.15, 16.4, 511.15, 161.4)
    tokens = (518.3, 25.4, 594.3, 152.4)
    panel(board, target, "TARGET CARDS", 81100, 4.5)
    panel(board, core, "CORE TILES", 81200, 7.0)
    panel(board, tokens, "TOKENS", 81300, 5.7)

    overlay = Image.new("RGBA", board.size, (0, 0, 0, 0))
    drawing = ImageDraw.Draw(overlay)
    labels = (
        ("RESOURCE", 1),
        ("HOUSING", 1),
        ("TRAVEL", 3),
        ("SOCIAL + WELLBEING", 1),
        ("MERCHANT + CRAFTING", 1),
    )
    total_units = sum(units for _, units in labels)
    content_left = core[0] + 12.0
    content_right = core[2] - 12.0
    content_top = core[1] + 34.0
    content_bottom = core[3] - 11.0
    unit_width = (content_right - content_left) / total_units
    try:
        category_font = ImageFont.truetype(
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            max(1, px(2.5, PPM)),
        )
    except OSError:
        category_font = ImageFont.load_default()

    cursor = content_left
    for index, (label, units) in enumerate(labels):
        region_width = unit_width * units
        drawing.text(
            (
                px(cursor + region_width / 2.0, PPM),
                px(content_bottom - 5.0, PPM),
            ),
            label,
            font=category_font,
            fill=(212, 196, 158, 180),
            anchor="mm",
        )
        cursor += region_width

    board.alpha_composite(overlay)
    return apply_unified_neoprene_finish(board, PPM)


def concept_two() -> Image.Image:
    board = base_board("COMPONENT BOARD - CONCEPT B")
    core = (26.0, 55.0, 438.0, 204.0)
    target = (451.0, 55.0, 596.0, 126.0)
    tokens = (451.0, 133.0, 596.0, 204.0)
    panel(board, core, "CORE TILES", 79100, 7.0)
    panel(board, target, "TARGET CARDS", 79200, 4.5)
    panel(board, tokens, "TOKENS", 79300, 5.7)
    fit_symbols(board, [core], target, [tokens])
    return apply_unified_neoprene_finish(board, PPM)


def concept_three() -> Image.Image:
    board = base_board("COMPONENT BOARD - CONCEPT C")
    core = (26.0, 55.0, 336.0, 200.0)
    target = (343.0, 64.0, 431.0, 191.0)
    tokens = (438.0, 55.0, 596.0, 200.0)
    panel(board, core, "CORE TILES", 80100, 7.0)
    panel(board, target, "TARGET CARDS", 80200, 4.5)
    panel(board, tokens, "TOKENS", 80300, 5.7)
    fit_symbols(board, [core], target, [tokens])
    return apply_unified_neoprene_finish(board, PPM)


def comparison(concepts: list[tuple[str, Image.Image]]) -> Image.Image:
    gap = 70
    margin = 55
    label_h = 55
    width = concepts[0][1].width + 2 * margin
    height = (
        2 * margin
        + len(concepts) * concepts[0][1].height
        + (len(concepts) - 1) * gap
        + len(concepts) * label_h
    )
    sheet = Image.new("RGB", (width, height), (22, 23, 23))
    drawing = ImageDraw.Draw(sheet)
    try:
        label_font = ImageFont.truetype(
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            31,
        )
    except OSError:
        label_font = ImageFont.load_default()
    y = margin
    for label, image in concepts:
        drawing.text((margin, y), label, font=label_font, fill=(232, 219, 190))
        y += label_h
        sheet.paste(image.convert("RGB"), (margin, y))
        y += image.height + gap
    return sheet


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    concepts = [
        ("A - BALANCED: central tile field with matching side wells", concept_one()),
        ("B - TILE PRIORITY: maximum tile space with stacked accessory wells", concept_two()),
        ("C - THREE ZONES: straightforward left-to-right workflow", concept_three()),
    ]
    for letter, (_, image) in zip(("a", "b", "c"), concepts):
        image.convert("RGB").save(
            OUTPUT_DIR / f"component-board-concept-{letter}.png",
            format="PNG",
            optimize=True,
        )
    comparison(concepts).save(
        OUTPUT_DIR / "component-board-layout-concepts.png",
        format="PNG",
        optimize=True,
    )
    selected_layout().convert("RGB").save(
        OUTPUT_DIR / "component-board-selected-layout-v1.png",
        format="PNG",
        optimize=True,
    )
    print(OUTPUT_DIR / "component-board-layout-concepts.png")
    print(OUTPUT_DIR / "component-board-selected-layout-v1.png")


if __name__ == "__main__":
    main()
