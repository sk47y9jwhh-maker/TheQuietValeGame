#!/usr/bin/env python3
"""Measured layouts for a full-width core tiles board."""

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
PPM = 4.0
MAP_W, MAP_H = 698.5, 568.5
SIDE_W, SIDE_H = 568.5, 146.0
CORE_W, CORE_H = 568.5, 276.5


def build_core() -> Image.Image:
    board = tiled_leather(px(CORE_W, PPM), px(CORE_H, PPM), PPM).convert("RGBA")
    draw_outer_finish(board, PPM)
    margin = 13.0
    render_recess(
        board,
        (px(margin, PPM), px(margin, PPM), px(CORE_W - margin, PPM), px(CORE_H - margin, PPM)),
        radius_px=px(6.0, PPM),
        depth_px=px(1.8, PPM),
        interior_brightness=0.73,
    )
    draw_material_text(
        board,
        "CORE TILES",
        (CORE_W / 2, 28.0),
        ALMENDRA,
        8.0,
        (204, 191, 154),
        PPM,
        seed=97200,
    )
    labels = ("RESOURCE", "MERCHANT & CRAFTING", "SOCIAL & WELLBEING", "HOUSING", "TRAVEL")
    centres = (65.0, 172.0, 305.0, 410.0, 505.0)
    for index, (label, cx) in enumerate(zip(labels, centres)):
        draw_material_text(
            board,
            label,
            (cx, CORE_H - 29.0),
            ALEGREYA_SANS,
            4.2 if len(label) > 10 else 4.8,
            (177, 162, 129),
            PPM,
            seed=97220 + index * 10,
        )
    return apply_unified_neoprene_finish(board, PPM).convert("RGB")


def resize_mm(image: Image.Image, w: float, h: float, scale: float) -> Image.Image:
    return image.resize((round(w * scale), round(h * scale)), Image.Resampling.LANCZOS)


def paste(canvas: Image.Image, image: Image.Image, x: int, y: int) -> None:
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (x + 6, y + 7, x + image.width + 6, y + image.height + 7),
        radius=7,
        fill=(21, 16, 11, 65),
    )
    canvas.alpha_composite(shadow)
    canvas.paste(image, (x, y))


def add_measurement(draw: ImageDraw.ImageDraw, x1: int, x2: int, y: int, text: str, font: ImageFont.FreeTypeFont) -> None:
    colour = (78, 60, 41)
    draw.line((x1, y, x2, y), fill=colour, width=2)
    draw.line((x1, y - 8, x1, y + 8), fill=colour, width=2)
    draw.line((x2, y - 8, x2, y + 8), fill=colour, width=2)
    box = draw.textbbox((0, 0), text, font=font)
    draw.text(((x1 + x2 - (box[2] - box[0])) / 2, y + 9), text, font=font, fill=colour)


def panel_exact(map_img: Image.Image, encounter: Image.Image, logistics: Image.Image, core: Image.Image) -> Image.Image:
    scale = 1.14
    m = resize_mm(map_img, MAP_W, MAP_H, scale)
    e = resize_mm(encounter, SIDE_W, SIDE_H, scale)
    l = resize_mm(logistics, SIDE_W, SIDE_H, scale)
    c = resize_mm(core, CORE_W, CORE_H, scale)
    panel = Image.new("RGBA", (1650, 850), (228, 220, 201, 255))
    d = ImageDraw.Draw(panel)
    title = ImageFont.truetype(str(ALEGREYA_SANS), 30)
    label = ImageFont.truetype(str(ALEGREYA_SANS), 21)
    d.text((55, 25), "OPTION 1 — TOP-ALIGNED RECTANGULAR LAYOUT", font=title, fill=(53, 42, 29))
    x, y = 55, 82
    paste(panel, m, x, y)
    sx = x + m.width
    paste(panel, e, sx, y)
    paste(panel, l, sx, y + e.height)
    paste(panel, c, sx, y + e.height + l.height)
    base = y + m.height + 35
    add_measurement(d, x, sx + e.width, base, "1267 × 568.5 mm  |  49.88 × 22.38 in", label)
    d.text((x, base + 48), "Map 698.5 × 568.5 mm", font=label, fill=(78, 60, 41))
    d.text((sx + 8, base + 48), "Right column 568.5 × 568.5 mm", font=label, fill=(78, 60, 41))
    return panel


def panel_narrow(map_img: Image.Image, encounter: Image.Image, logistics: Image.Image, core: Image.Image) -> Image.Image:
    scale = 0.94
    m = resize_mm(map_img, MAP_W, MAP_H, scale)
    e = resize_mm(encounter, SIDE_W, SIDE_H, scale)
    l = resize_mm(logistics, SIDE_W, SIDE_H, scale)
    # Rotate the core board beside the map; place both slim boards below.
    c = resize_mm(core, CORE_W, CORE_H, scale).rotate(90, expand=True)
    panel = Image.new("RGBA", (1650, 850), (228, 220, 201, 255))
    d = ImageDraw.Draw(panel)
    title = ImageFont.truetype(str(ALEGREYA_SANS), 30)
    label = ImageFont.truetype(str(ALEGREYA_SANS), 21)
    d.text((55, 25), "OPTION 2 — NARROWER BEST-FIT TABLE LAYOUT", font=title, fill=(53, 42, 29))
    x, y = 55, 82
    paste(panel, m, x, y)
    paste(panel, c, x + m.width, y)
    below_y = y + m.height
    paste(panel, e, x, below_y)
    paste(panel, l, x + e.width, below_y)
    total_w = 2 * SIDE_W
    total_h = MAP_H + SIDE_H
    base = below_y + e.height + 35
    add_measurement(d, x, x + e.width + l.width, base, "1137 × 714.5 mm  |  44.76 × 28.13 in", label)
    d.text((x, base + 48), "Core board rotated beside map; Encounter and Logistics below", font=label, fill=(78, 60, 41))
    return panel


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    map_img = Image.open(PROD / "map-board" / "the-quiet-vale-map-board-finished-size.png").convert("RGB")
    encounter = Image.open(PROD / "encounter-board" / "the-quiet-vale-encounter-board-finished-size.png").convert("RGB")
    logistics = build_logistics()
    core = build_core()
    core.save(OUT / "proposed-core-tiles-board-568.5x276.5mm.png", quality=95)
    top = panel_exact(map_img, encounter, logistics, core).convert("RGB")
    bottom = panel_narrow(map_img, encounter, logistics, core).convert("RGB")
    sheet = Image.new("RGB", (1650, 1700), (228, 220, 201))
    sheet.paste(top, (0, 0))
    sheet.paste(bottom, (0, 850))
    sheet.save(OUT / "core-board-layout-options-measured.png", quality=95)


if __name__ == "__main__":
    main()
