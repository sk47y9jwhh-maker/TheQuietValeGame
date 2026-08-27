#!/usr/bin/env python3
"""Show revised minimum-size warehouse boards with the complete modular system."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from generate_unified_a1_board import (
    ALEGREYA_SANS,
    ALMENDRA,
    apply_unified_neoprene_finish,
    draw_material_text,
    draw_outer_finish,
    draw_stitch_path,
    px,
    render_recess,
    tiled_leather,
)
from generate_modular_board_set_preview import RESOURCE_THREADS


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output/concepts/revised-warehouse-system"
PROD = ROOT / "output/pdf/modular-board-set-v1-printer-ready"

PPM = 5.0
WAREHOUSE_W = 247.65
WAREHOUSE_H = 127.0
THREAD = (145, 108, 71)


def build_warehouse_board(title: str, resources: tuple[str, str, str], seed: int) -> Image.Image:
    board = tiled_leather(px(WAREHOUSE_W, PPM), px(WAREHOUSE_H, PPM), PPM).convert("RGBA")
    draw_outer_finish(board, PPM)
    margin = 11.0
    gap = 7.0
    bay_w = (WAREHOUSE_W - 2 * margin - 2 * gap) / 3.0
    for index, resource in enumerate(resources):
        left = margin + index * (bay_w + gap)
        top = 13.0
        right = left + bay_w
        bottom = WAREHOUSE_H - 13.0
        render_recess(
            board,
            (px(left, PPM), px(top, PPM), px(right, PPM), px(bottom, PPM)),
            radius_px=px(5.0, PPM),
            depth_px=px(1.7, PPM),
            interior_brightness=0.73,
        )
        draw_material_text(
            board,
            resource,
            ((left + right) / 2.0, top + 14.0),
            ALMENDRA,
            6.0,
            (206, 192, 154),
            PPM,
            seed=seed + index * 20,
        )
        # A single short material accent replaces the old button and keeps the
        # recess itself free for three triangular token stacks.
        y = px(top + 24.0, PPM)
        x1 = px(left + 19.0, PPM)
        x2 = px(right - 19.0, PPM)
        draw_stitch_path(
            board,
            [(x1, y), (x2, y)],
            RESOURCE_THREADS[resource],
            PPM,
            seed=seed + index * 20 + 1,
        )
        # Three subtle 15 mm token footprints demonstrate available space.
        draw = ImageDraw.Draw(board, "RGBA")
        radius = px(7.5, PPM)
        centres = (
            ((left + right) / 2.0, top + 48.0),
            ((left + right) / 2.0 - 10.0, top + 65.0),
            ((left + right) / 2.0 + 10.0, top + 65.0),
        )
        for cx, cy in centres:
            x, yy = px(cx, PPM), px(cy, PPM)
            draw.ellipse(
                (x - radius, yy - radius, x + radius, yy + radius),
                outline=(188, 174, 142, 64),
                width=max(1, px(0.35, PPM)),
            )
    return apply_unified_neoprene_finish(board, PPM)


def load_finished(folder: str, filename: str) -> Image.Image:
    return Image.open(PROD / folder / filename).convert("RGB")


def label_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    path = ALEGREYA_SANS
    return ImageFont.truetype(str(path), size)


def fit_mm(image: Image.Image, width_mm: float, height_mm: float, scale: float) -> Image.Image:
    return image.resize(
        (round(width_mm * scale), round(height_mm * scale)),
        Image.Resampling.LANCZOS,
    )


def paste_board(canvas: Image.Image, image: Image.Image, x: int, y: int) -> None:
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle(
        (x + 5, y + 6, x + image.width + 5, y + image.height + 6),
        radius=5,
        fill=(21, 17, 12, 65),
    )
    canvas.alpha_composite(shadow)
    canvas.paste(image, (x, y))


def render_layout(
    title: str,
    arrangement: str,
    boards: dict[str, tuple[Image.Image, float, float]],
    width_px: int = 2100,
    height_px: int = 980,
) -> Image.Image:
    panel = Image.new("RGBA", (width_px, height_px), (226, 218, 198, 255))
    draw = ImageDraw.Draw(panel)
    draw.text((55, 30), title, font=label_font(34), fill=(53, 43, 31))
    if arrangement == "vertical":
        scale = 1.50
        x0, y0 = 65, 110
        enc = fit_mm(*boards["encounter"], scale).rotate(90, expand=True)
        map_img = fit_mm(*boards["map"], scale)
        paste_board(panel, enc, x0, y0)
        map_x = x0 + enc.width
        paste_board(panel, map_img, map_x, y0)
        right_x = map_x + map_img.width
        cursor = y0
        for key in ("warehouse_a", "warehouse_b", "core", "target"):
            img = fit_mm(*boards[key], scale)
            paste_board(panel, img, right_x, cursor)
            cursor += img.height
        draw.text(
            (55, height_px - 54),
            "Overall 1092.15 × 570.5 mm  |  43.00 × 22.46 in",
            font=label_font(27),
            fill=(65, 52, 37),
        )
    elif arrangement == "encounter_below":
        scale = 1.30
        x0, y0 = 70, 105
        map_img = fit_mm(*boards["map"], scale)
        paste_board(panel, map_img, x0, y0)
        right_x = x0 + map_img.width
        cursor = y0
        for key in ("warehouse_a", "warehouse_b", "core", "target"):
            img = fit_mm(*boards[key], scale)
            paste_board(panel, img, right_x, cursor)
            cursor += img.height
        encounter = fit_mm(*boards["encounter"], scale)
        paste_board(panel, encounter, x0, y0 + map_img.height)
        draw.text(
            (55, height_px - 54),
            "Overall 946.15 × 714.5 mm  |  37.25 × 28.13 in",
            font=label_font(27),
            fill=(65, 52, 37),
        )
    else:
        scale = 1.35
        x0, y0 = 80, 115
        map_img = fit_mm(*boards["map"], scale)
        paste_board(panel, map_img, x0, y0)
        encounter = fit_mm(*boards["encounter"], scale)
        paste_board(panel, encounter, x0, y0 + map_img.height)
        cursor_x = x0 + encounter.width
        for key in ("warehouse_a", "warehouse_b"):
            img = fit_mm(*boards[key], scale).rotate(90, expand=True)
            paste_board(panel, img, cursor_x, y0 + map_img.height)
            cursor_x += img.width
        core = fit_mm(*boards["core"], scale)
        target = fit_mm(*boards["target"], scale)
        paste_board(panel, core, x0 + map_img.width - core.width, y0 + map_img.height)
        paste_board(panel, target, x0 + map_img.width - target.width, y0 + map_img.height + core.height)
        draw.text(
            (55, height_px - 54),
            "Split arrangement: modules can move independently to suit table shape",
            font=label_font(27),
            fill=(65, 52, 37),
        )
    return panel


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    a = build_warehouse_board("WAREHOUSE A", ("STONE", "METAL", "GOODS"), 93000).convert("RGB")
    b = build_warehouse_board("WAREHOUSE B", ("WOOD", "FOOD", "HERBS"), 94000).convert("RGB")
    a.save(OUT / "warehouse-a-stone-metal-goods-preview.png", quality=95)
    b.save(OUT / "warehouse-b-wood-food-herbs-preview.png", quality=95)
    boards = {
        "map": (
            load_finished("map-board", "the-quiet-vale-map-board-finished-size.png"),
            698.5,
            568.5,
        ),
        "encounter": (
            load_finished("encounter-board", "the-quiet-vale-encounter-board-finished-size.png"),
            568.5,
            146.0,
        ),
        "core": (
            load_finished("core-tiles-board", "the-quiet-vale-core-tiles-board-finished-size.png"),
            247.65,
            189.5,
        ),
        "target": (
            load_finished("target-cards-board", "the-quiet-vale-target-cards-board-finished-size.png"),
            189.5,
            73.2,
        ),
        "warehouse_a": (a, WAREHOUSE_W, WAREHOUSE_H),
        "warehouse_b": (b, WAREHOUSE_W, WAREHOUSE_H),
    }
    panels = (
        render_layout("OPTION 1 - FULL-HEIGHT MODULAR COLUMNS", "vertical", boards),
        render_layout("OPTION 2 - ENCOUNTER BELOW MAP", "encounter_below", boards),
        render_layout("OPTION 3 - SPLIT LOGISTICS", "split", boards),
    )
    contact = Image.new("RGB", (2100, 2940), (226, 218, 198))
    for index, panel in enumerate(panels):
        contact.paste(panel.convert("RGB"), (0, index * 980))
    contact.save(OUT / "complete-system-layout-options.png", quality=95)


if __name__ == "__main__":
    main()
