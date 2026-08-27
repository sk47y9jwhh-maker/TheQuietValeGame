#!/usr/bin/env python3
"""Focused scale layout: two revised warehouse boards vertically beside the map."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from generate_unified_a1_board import ALEGREYA_SANS
from show_revised_warehouse_system import (
    OUT,
    PROD,
    WAREHOUSE_H,
    WAREHOUSE_W,
    build_warehouse_board,
)


SCALE = 2.0
MAP_W = 698.5
MAP_H = 568.5
TOTAL_W = MAP_W + WAREHOUSE_H


def mm(value: float) -> int:
    return round(value * SCALE)


def board_shadow(canvas: Image.Image, image: Image.Image, x: int, y: int) -> None:
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    draw.rounded_rectangle(
        (x + 7, y + 8, x + image.width + 7, y + image.height + 8),
        radius=8,
        fill=(25, 20, 14, 75),
    )
    canvas.alpha_composite(shadow)
    canvas.paste(image, (x, y))


def dimension(draw: ImageDraw.ImageDraw, start: tuple[int, int], end: tuple[int, int], text: str, font: ImageFont.FreeTypeFont) -> None:
    colour = (85, 67, 45)
    draw.line((start, end), fill=colour, width=2)
    if start[1] == end[1]:
        draw.line((start[0], start[1] - 8, start[0], start[1] + 8), fill=colour, width=2)
        draw.line((end[0], end[1] - 8, end[0], end[1] + 8), fill=colour, width=2)
        box = draw.textbbox((0, 0), text, font=font)
        draw.text(((start[0] + end[0] - (box[2] - box[0])) / 2, start[1] + 10), text, font=font, fill=colour)
    else:
        draw.line((start[0] - 8, start[1], start[0] + 8, start[1]), fill=colour, width=2)
        draw.line((end[0] - 8, end[1], end[0] + 8, end[1]), fill=colour, width=2)
        label = Image.new("RGBA", (260, 50), (0, 0, 0, 0))
        ImageDraw.Draw(label).text((0, 0), text, font=font, fill=colour)
        label = label.rotate(90, expand=True)
        draw._image.alpha_composite(label, (start[0] - 55, round((start[1] + end[1] - label.height) / 2)))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    map_image = Image.open(
        PROD / "map-board" / "the-quiet-vale-map-board-finished-size.png"
    ).convert("RGB").resize((mm(MAP_W), mm(MAP_H)), Image.Resampling.LANCZOS)
    warehouse_a = build_warehouse_board(
        "WAREHOUSE A", ("STONE", "METAL", "GOODS"), 93000
    ).convert("RGB").resize(
        (mm(WAREHOUSE_W), mm(WAREHOUSE_H)), Image.Resampling.LANCZOS
    ).rotate(90, expand=True)
    warehouse_b = build_warehouse_board(
        "WAREHOUSE B", ("WOOD", "FOOD", "HERBS"), 94000
    ).convert("RGB").resize(
        (mm(WAREHOUSE_W), mm(WAREHOUSE_H)), Image.Resampling.LANCZOS
    ).rotate(90, expand=True)

    margin_x, margin_top, margin_bottom = 110, 105, 120
    canvas = Image.new(
        "RGBA",
        (mm(TOTAL_W) + margin_x * 2, mm(MAP_H) + margin_top + margin_bottom),
        (228, 220, 201, 255),
    )
    draw = ImageDraw.Draw(canvas)
    title_font = ImageFont.truetype(str(ALEGREYA_SANS), 36)
    label_font = ImageFont.truetype(str(ALEGREYA_SANS), 25)
    draw.text(
        (margin_x, 36),
        "WAREHOUSE BOARDS ROTATED BESIDE MAP — TO SCALE",
        font=title_font,
        fill=(55, 43, 30),
    )

    map_x, map_y = margin_x, margin_top
    side_x = map_x + map_image.width
    unused = map_image.height - warehouse_a.height - warehouse_b.height
    gap = unused // 3
    a_y = map_y + gap
    b_y = a_y + warehouse_a.height + gap
    board_shadow(canvas, map_image, map_x, map_y)
    board_shadow(canvas, warehouse_a, side_x, a_y)
    board_shadow(canvas, warehouse_b, side_x, b_y)

    dimension(
        draw,
        (map_x, map_y + map_image.height + 42),
        (side_x + warehouse_a.width, map_y + map_image.height + 42),
        f"{TOTAL_W:.1f} mm / {TOTAL_W / 25.4:.2f} in",
        label_font,
    )
    dimension(
        draw,
        (map_x - 35, map_y),
        (map_x - 35, map_y + map_image.height),
        f"{MAP_H:.1f} mm / {MAP_H / 25.4:.2f} in",
        label_font,
    )
    draw.text(
        (side_x + 10, map_y + map_image.height + 70),
        "Each warehouse: 247.65 × 127 mm",
        font=label_font,
        fill=(85, 67, 45),
    )
    canvas.convert("RGB").save(
        OUT / "warehouses-rotated-vertical-beside-map.png", quality=95
    )


if __name__ == "__main__":
    main()
