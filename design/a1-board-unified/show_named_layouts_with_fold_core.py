#!/usr/bin/env python3
"""Standard and wide layouts with a six-fold-map-sized core tiles board."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from generate_unified_a1_board import (
    ALEGREYA_SANS,
    ALMENDRA,
    apply_unified_neoprene_finish,
    draw_material_text,
    draw_outer_finish,
    px,
    render_recess,
    tiled_leather,
)
from show_combined_logistics_board import build_board as build_logistics


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output/concepts/revised-warehouse-system"
PROD = ROOT / "output/pdf/modular-board-set-v1-printer-ready"
MAP_W, MAP_H = 698.5, 568.5
MOD_W, MOD_H = 568.5, 146.0
CORE_W, CORE_H = 284.25, 232.83
PPM = 5.0


def build_core() -> Image.Image:
    board = tiled_leather(px(CORE_W, PPM), px(CORE_H, PPM), PPM).convert("RGBA")
    draw_outer_finish(board, PPM)
    margin = 13.0
    render_recess(
        board,
        (px(margin, PPM), px(margin, PPM), px(CORE_W - margin, PPM), px(CORE_H - margin, PPM)),
        radius_px=px(5.5, PPM),
        depth_px=px(1.8, PPM),
        interior_brightness=0.73,
    )
    draw_material_text(
        board, "CORE TILES", (CORE_W / 2, 28), ALMENDRA, 7.0,
        (204, 191, 154), PPM, seed=98100,
    )
    labels = ("RESOURCE", "MERCHANT & CRAFTING", "SOCIAL & WELLBEING", "HOUSING", "TRAVEL")
    centres = (35, 91, 157, 210, 257)
    for i, (label, cx) in enumerate(zip(labels, centres)):
        draw_material_text(
            board, label, (cx, CORE_H - 27), ALEGREYA_SANS,
            3.0 if len(label) > 10 else 3.7,
            (178, 163, 130), PPM, seed=98120 + i * 10,
        )
    return apply_unified_neoprene_finish(board, PPM).convert("RGB")


def size(image: Image.Image, w: float, h: float, scale: float) -> Image.Image:
    return image.resize((round(w * scale), round(h * scale)), Image.Resampling.LANCZOS)


def paste(canvas: Image.Image, image: Image.Image, x: int, y: int) -> None:
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (x + 5, y + 6, x + image.width + 5, y + image.height + 6),
        radius=6, fill=(20, 15, 10, 65),
    )
    canvas.alpha_composite(shadow)
    canvas.paste(image, (x, y))


def measure(draw: ImageDraw.ImageDraw, x1: int, x2: int, y: int, text: str, font: ImageFont.FreeTypeFont) -> None:
    colour = (78, 60, 41)
    draw.line((x1, y, x2, y), fill=colour, width=2)
    draw.line((x1, y - 8, x1, y + 8), fill=colour, width=2)
    draw.line((x2, y - 8, x2, y + 8), fill=colour, width=2)
    box = draw.textbbox((0, 0), text, font=font)
    draw.text(((x1 + x2 - box[2] + box[0]) / 2, y + 8), text, font=font, fill=colour)


def standard_panel(map_src: Image.Image, enc_src: Image.Image, log_src: Image.Image, core_src: Image.Image) -> Image.Image:
    s = 1.02
    m = size(map_src, MAP_W, MAP_H, s)
    e = size(enc_src, MOD_W, MOD_H, s).rotate(90, expand=True)
    l = size(log_src, MOD_W, MOD_H, s).rotate(90, expand=True)
    c = size(core_src, CORE_W, CORE_H, s)
    panel = Image.new("RGBA", (1550, 1040), (228, 220, 201, 255))
    d = ImageDraw.Draw(panel)
    title = ImageFont.truetype(str(ALEGREYA_SANS), 30)
    text = ImageFont.truetype(str(ALEGREYA_SANS), 20)
    d.text((55, 25), "STANDARD LAYOUT", font=title, fill=(53, 42, 29))
    x, y = 55, 80
    paste(panel, e, x, y)
    mx = x + e.width
    paste(panel, m, mx, y)
    rx = mx + m.width
    paste(panel, l, rx, y)
    # The fold-matched core board remains modular; centre it below the map.
    cx = mx + (m.width - c.width) // 2
    cy = y + m.height
    paste(panel, c, cx, cy)
    base = cy + c.height + 30
    measure(d, x, rx + l.width, base, "Main row 990.5 × 568.5 mm  |  39.00 × 22.38 in", text)
    d.text(
        (55, base + 45),
        "Core Tiles 284.25 × 232.83 mm (11.19 × 9.17 in)  |  Shown footprint 990.5 × 801.33 mm (39.00 × 31.55 in)",
        font=text, fill=(78, 60, 41),
    )
    d.text(
        (55, base + 74),
        "The Core board is modular and can instead sit elsewhere without changing the 39-inch main row.",
        font=text, fill=(78, 60, 41),
    )
    return panel


def wide_panel(map_src: Image.Image, enc_src: Image.Image, log_src: Image.Image, core_src: Image.Image) -> Image.Image:
    s = 0.97
    m = size(map_src, MAP_W, MAP_H, s)
    e = size(enc_src, MOD_W, MOD_H, s)
    l = size(log_src, MOD_W, MOD_H, s)
    c = size(core_src, CORE_W, CORE_H, s)
    panel = Image.new("RGBA", (1550, 860), (228, 220, 201, 255))
    d = ImageDraw.Draw(panel)
    title = ImageFont.truetype(str(ALEGREYA_SANS), 30)
    text = ImageFont.truetype(str(ALEGREYA_SANS), 20)
    d.text((55, 25), "WIDE LAYOUT", font=title, fill=(53, 42, 29))
    x, y = 55, 80
    paste(panel, m, x, y)
    sx = x + m.width
    paste(panel, e, sx, y)
    paste(panel, l, sx, y + e.height)
    # Centre the half-width core board in the remaining space below the stack.
    cx = sx + (e.width - c.width) // 2
    remaining_y = y + e.height + l.height
    spare = m.height - e.height - l.height - c.height
    cy = remaining_y + max(0, spare // 2)
    paste(panel, c, cx, cy)
    base = y + m.height + 30
    measure(d, x, sx + e.width, base, "1267 × 568.5 mm  |  49.88 × 22.38 in", text)
    d.text(
        (55, base + 45),
        "Core board is half the sideboard length and fits within the right column without increasing the footprint",
        font=text, fill=(78, 60, 41),
    )
    return panel


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    map_src = Image.open(PROD / "map-board" / "the-quiet-vale-map-board-finished-size.png").convert("RGB")
    enc_src = Image.open(PROD / "encounter-board" / "the-quiet-vale-encounter-board-finished-size.png").convert("RGB")
    log_src = build_logistics()
    core_src = build_core()
    core_src.save(OUT / "fold-matched-core-tiles-board-284.25x232.83mm.png", quality=95)
    p1 = standard_panel(map_src, enc_src, log_src, core_src).convert("RGB")
    p2 = wide_panel(map_src, enc_src, log_src, core_src).convert("RGB")
    sheet = Image.new("RGB", (1550, 1900), (228, 220, 201))
    sheet.paste(p1, (0, 0))
    sheet.paste(p2, (0, 1040))
    sheet.save(OUT / "standard-and-wide-layouts-with-core-measured.png", quality=95)

    # Corrected standard layout: core board flush to the far-right logistics edge.
    s = 1.08
    m = size(map_src, MAP_W, MAP_H, s)
    e = size(enc_src, MOD_W, MOD_H, s).rotate(90, expand=True)
    l = size(log_src, MOD_W, MOD_H, s).rotate(90, expand=True)
    c = size(core_src, CORE_W, CORE_H, s).rotate(90, expand=True)
    total_w = MOD_H + MAP_W + MOD_H + CORE_H
    canvas = Image.new(
        "RGBA",
        (round(total_w * s) + 150, round(MAP_H * s) + 220),
        (228, 220, 201, 255),
    )
    d = ImageDraw.Draw(canvas)
    title = ImageFont.truetype(str(ALEGREYA_SANS), 31)
    text = ImageFont.truetype(str(ALEGREYA_SANS), 21)
    d.text(
        (65, 28),
        "STANDARD LAYOUT — CORE TILES TUCKED FLUSH TO LOGISTICS",
        font=title,
        fill=(53, 42, 29),
    )
    x, y = 65, 86
    paste(canvas, e, x, y)
    mx = x + e.width
    paste(canvas, m, mx, y)
    lx = mx + m.width
    paste(canvas, l, lx, y)
    cx = lx + l.width
    cy = y + (m.height - c.height) // 2
    paste(canvas, c, cx, cy)
    base = y + m.height + 38
    measure(
        d,
        x,
        cx + c.width,
        base,
        "1223.33 × 568.5 mm  |  48.16 × 22.38 in",
        text,
    )
    d.text(
        (65, base + 46),
        "Encounter 146 mm  |  Map 698.5 mm  |  Logistics 146 mm  |  Core Tiles 232.83 mm",
        font=text,
        fill=(78, 60, 41),
    )
    canvas.convert("RGB").save(
        OUT / "standard-layout-core-flush-right-measured.png",
        quality=95,
    )

    # Corrected wide layout: core board tucked into the inside corner formed by
    # the map edge and the bottom of the stacked landscape boards.
    s = 1.02
    m = size(map_src, MAP_W, MAP_H, s)
    e = size(enc_src, MOD_W, MOD_H, s)
    l = size(log_src, MOD_W, MOD_H, s)
    c = size(core_src, CORE_W, CORE_H, s)
    total_w = MAP_W + MOD_W
    wide = Image.new(
        "RGBA",
        (round(total_w * s) + 150, round(MAP_H * s) + 220),
        (228, 220, 201, 255),
    )
    wd = ImageDraw.Draw(wide)
    title = ImageFont.truetype(str(ALEGREYA_SANS), 31)
    text = ImageFont.truetype(str(ALEGREYA_SANS), 21)
    wd.text(
        (65, 28),
        "WIDE LAYOUT — CORE TILES TUCKED INTO INSIDE CORNER",
        font=title,
        fill=(53, 42, 29),
    )
    x, y = 65, 86
    paste(wide, m, x, y)
    sx = x + m.width
    paste(wide, e, sx, y)
    paste(wide, l, sx, y + e.height)
    # Flush to both the map's right edge and the logistics board's bottom edge.
    paste(wide, c, sx, y + e.height + l.height)
    base = y + m.height + 38
    measure(
        wd,
        x,
        sx + e.width,
        base,
        "1267 × 568.5 mm  |  49.88 × 22.38 in",
        text,
    )
    wd.text(
        (65, base + 46),
        "Core Tiles 284.25 × 232.83 mm  |  Remaining open area 284.25 × 276.5 mm",
        font=text,
        fill=(78, 60, 41),
    )
    wide.convert("RGB").save(
        OUT / "wide-layout-core-tucked-corner-measured.png",
        quality=95,
    )


if __name__ == "__main__":
    main()
