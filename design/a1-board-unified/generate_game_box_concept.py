#!/usr/bin/env python3
"""Create the first production-minded box and insert concept."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

from generate_unified_a1_board import (
    ALMENDRA,
    apply_unified_neoprene_finish,
    draw_material_text,
    draw_outer_finish,
    px,
    tiled_leather,
)


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output/concepts/game-box-v1"
PPM = 4.0

# BoardGamesMaker standard 12.5 × 10.5 × 3 inch rectangular game box.
INNER_W_MM = 309.1
INNER_H_MM = 258.3
INNER_D_MM = 72.9
OUTER_W_MM = 317.5
OUTER_H_MM = 266.7
OUTER_D_MM = 76.2


def leather_panel(width_mm: float, height_mm: float) -> Image.Image:
    panel = tiled_leather(px(width_mm, PPM), px(height_mm, PPM), PPM).convert("RGBA")
    draw_outer_finish(panel, PPM)
    return apply_unified_neoprene_finish(panel, PPM).convert("RGBA")


def lid_art() -> Image.Image:
    lid = tiled_leather(
        px(OUTER_W_MM, PPM),
        px(OUTER_H_MM, PPM),
        PPM,
    ).convert("RGBA")
    lid = apply_unified_neoprene_finish(lid, PPM).convert("RGBA")
    draw_material_text(
        lid,
        "THE QUIET VALE",
        (OUTER_W_MM / 2, OUTER_H_MM / 2 - 7),
        ALMENDRA,
        17.0,
        (178, 150, 94),
        PPM,
        seed=91001,
        opacity=0.94,
    )
    draw_material_text(
        lid,
        "SEASONS OF SETTLEMENT",
        (OUTER_W_MM / 2, OUTER_H_MM / 2 + 15),
        ALMENDRA,
        5.2,
        (174, 151, 108),
        PPM,
        seed=91002,
        opacity=0.91,
    )
    return lid


def packing_plan() -> Image.Image:
    scale = 3.2
    margin = 90
    w = int(INNER_W_MM * scale) + margin * 2
    h = int(INNER_H_MM * scale) + 250
    img = Image.new("RGB", (w, h), (225, 217, 195))
    draw = ImageDraw.Draw(img)
    ox, oy = margin, 100
    box = (ox, oy, ox + int(INNER_W_MM * scale), oy + int(INNER_H_MM * scale))
    draw.rounded_rectangle(box, radius=24, fill=(31, 31, 29), outline=(119, 91, 55), width=5)

    # Soft-storage layer above the manuals and folded boards.
    gap = 8
    content_left = ox + gap
    content_top = oy + gap
    content_right = box[2] - gap
    content_bottom = box[3] - gap
    left_width = int((content_right - content_left) * 0.58)
    tile_bag = (content_left, content_top, content_left + left_width, content_bottom)
    right_left = tile_bag[2] + gap
    right_width = content_right - right_left
    card_bag = (right_left, content_top, content_right, content_top + int((content_bottom - content_top) * 0.63))
    token_bag = (right_left, card_bag[3] + gap, content_right, content_bottom)
    for rect, label, sublabel in (
        (tile_bag, "TILE BAG", "93 tiles / flexible stacking"),
        (card_bag, "CARD-TIN BAG", "card tins protected together"),
        (token_bag, "TOKEN BAG", "small drawstring bag"),
    ):
        draw.rounded_rectangle(rect, radius=34, fill=(31, 29, 25), outline=(135, 108, 68), width=4)
        cx = (rect[0] + rect[2]) // 2
        draw.arc((cx - 58, rect[1] - 12, cx + 58, rect[1] + 46), 5, 175, fill=(178, 147, 96), width=4)
        draw.text((rect[0] + 20, rect[1] + 28), label, fill=(205, 184, 140))
        draw.text((rect[0] + 20, rect[1] + 55), sublabel, fill=(147, 132, 103))

    # Board/manual base layer shown as a translucent footprint beneath the bags.
    board_w = int(284.25 * scale)
    board_h = int(232.83 * scale)
    bx = ox + (int(INNER_W_MM * scale) - board_w) // 2
    by = oy + (int(INNER_H_MM * scale) - board_h) // 2
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rounded_rectangle(
        (bx, by, bx + board_w, by + board_h),
        radius=18,
        fill=(201, 189, 152, 24),
        outline=(239, 218, 158, 230),
        width=5,
    )
    od.text((bx + 18, by + board_h - 38), "MANUALS + FOLDED BOARDS BELOW 284.25 × 232.83 mm", fill=(244, 224, 171, 255))
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(img)
    draw.text((margin, 28), "THE QUIET VALE — PROPOSED INTERNAL PACKING", fill=(54, 43, 31))
    draw.text((margin, box[3] + 35), "BGM STANDARD BOX — INTERNAL 309.1 × 258.3 × 72.9 mm   |   EXTERNAL 317.5 × 266.7 × 76.2 mm", fill=(54, 43, 31))
    draw.text((margin, box[3] + 68), "Bags lift out first; manuals and the complete folded-board stack form the flat base.", fill=(85, 68, 48))
    return img


def mockup(lid: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (1500, 1100), (221, 214, 194, 255))
    face = lid.resize((1100, 910), Image.Resampling.LANCZOS)
    shadow = Image.new("RGBA", face.size, (0, 0, 0, 0))
    shadow.putalpha(Image.new("L", face.size, 135).filter(ImageFilter.GaussianBlur(25)))
    canvas.alpha_composite(shadow, (230, 120))
    canvas.alpha_composite(face, (190, 80))
    d = ImageDraw.Draw(canvas)
    d.polygon(((190, 990), (1290, 990), (1360, 930), (1360, 970), (1290, 1040), (190, 1040)), fill=(38, 36, 32, 255))
    d.text((190, 1055), "BGM STANDARD EXTERIOR: 317.5 × 266.7 × 76.2 mm  (12.5 × 10.5 × 3 in)", fill=(70, 58, 43, 255))
    return canvas.convert("RGB")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    lid = lid_art()
    lid.convert("RGB").save(OUT / "the-quiet-vale-box-lid-concept-v1.png", quality=95)
    packing_plan().save(OUT / "the-quiet-vale-box-packing-plan-v1.png", quality=95)
    mockup(lid).save(OUT / "the-quiet-vale-box-mockup-v1.png", quality=95)


if __name__ == "__main__":
    main()
