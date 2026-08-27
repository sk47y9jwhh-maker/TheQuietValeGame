#!/usr/bin/env python3
"""Concept for one encounter-sized warehouse, target-card and token board."""

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
BOARD_W = 568.5
BOARD_H = 146.0
MAP_W = 698.5
MAP_H = 568.5
RESOURCES = ("STONE", "METAL", "GOODS", "WOOD", "FOOD", "HERBS")


def build_board(show_capacity_guides: bool = True) -> Image.Image:
    board = tiled_leather(px(BOARD_W, PPM), px(BOARD_H, PPM), PPM).convert("RGBA")
    draw_outer_finish(board, PPM)
    # Mirror the Encounter board's exact landscape grid: 13 mm outer margins,
    # 70 mm end wells and 8 mm transitions into the shared centre field.
    margin_y = 13.0
    end_w = 70.0
    transition_gap = 8.0
    warehouse_gap = 5.5
    centre_left = margin_y + end_w + transition_gap
    centre_right = BOARD_W - centre_left
    resource_w = (centre_right - centre_left - 5 * warehouse_gap) / 6
    labels = ("TARGET CARDS", *RESOURCES, "TOKENS")
    widths = (end_w, *([resource_w] * 6), end_w)
    x = margin_y
    for index, (label, well_w) in enumerate(zip(labels, widths)):
        render_recess(
            board,
            (px(x, PPM), px(margin_y, PPM), px(x + well_w, PPM), px(BOARD_H - margin_y, PPM)),
            radius_px=px(4.5, PPM),
            depth_px=px(1.6, PPM),
            interior_brightness=0.73,
        )
        text_size = 4.5 if label == "TARGET CARDS" else 5.2
        draw_material_text(
            board,
            label,
            (x + well_w / 2, margin_y + 14.0),
            ALMENDRA,
            text_size,
            (202, 188, 151),
            PPM,
            seed=96000 + index * 20,
        )
        if label in RESOURCES:
            # Five complete, individually set stitches.  The previous continuous
            # path could begin a sixth stitch at the right edge, leaving a small
            # clipped fragment in some resource colours.
            stitch_length = 3.9
            stitch_gap = 2.45
            marker_width = 5 * stitch_length + 4 * stitch_gap
            marker_left = x + (well_w - marker_width) / 2.0
            marker_y = margin_y + 24.0
            for stitch_index in range(5):
                stitch_left = marker_left + stitch_index * (
                    stitch_length + stitch_gap
                )
                draw_stitch_path(
                    board,
                    [
                        (px(stitch_left, PPM), px(marker_y, PPM)),
                        (
                            px(stitch_left + stitch_length, PPM),
                            px(marker_y, PPM),
                        ),
                    ],
                    RESOURCE_THREADS[label],
                    PPM,
                    seed=96001 + index * 20 + stitch_index,
                )
            if show_capacity_guides:
                # Concept-only footprints for three 15 mm stacks.
                overlay = ImageDraw.Draw(board, "RGBA")
                r = px(7.5, PPM)
                centres = (
                    (x + well_w / 2, margin_y + 50.0),
                    (x + well_w / 2 - 9.0, margin_y + 67.0),
                    (x + well_w / 2 + 9.0, margin_y + 67.0),
                )
                for cx, cy in centres:
                    overlay.ellipse(
                        (px(cx, PPM) - r, px(cy, PPM) - r, px(cx, PPM) + r, px(cy, PPM) + r),
                        outline=(188, 174, 142, 62),
                        width=max(1, px(0.35, PPM)),
                    )
        elif label == "TARGET CARDS" and show_capacity_guides:
            overlay = ImageDraw.Draw(board, "RGBA")
            cx, cy = x + well_w / 2, margin_y + 69.0
            overlay.rounded_rectangle(
                (px(cx - 22, PPM), px(cy - 34, PPM), px(cx + 22, PPM), px(cy + 34, PPM)),
                radius=px(2.5, PPM),
                outline=(188, 174, 142, 70),
                width=max(1, px(0.35, PPM)),
            )
        if label == "TARGET CARDS" or label == "HERBS":
            x += well_w + transition_gap
        else:
            x += well_w + warehouse_gap
    return apply_unified_neoprene_finish(board, PPM).convert("RGB")


def shadow_paste(canvas: Image.Image, image: Image.Image, x: int, y: int) -> None:
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle(
        (x + 7, y + 8, x + image.width + 7, y + image.height + 8),
        radius=7,
        fill=(20, 16, 11, 70),
    )
    canvas.alpha_composite(layer)
    canvas.paste(image, (x, y))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    board = build_board()
    board.save(OUT / "combined-logistics-board-568.5x146mm.png", quality=95)

    # Direct alignment proof: both boards share the same outer and separator grid.
    encounter_native = Image.open(
        PROD / "encounter-board" / "the-quiet-vale-encounter-board-finished-size.png"
    ).convert("RGB")
    proof_scale = 2.35
    encounter_proof = encounter_native.resize(
        (round(BOARD_W * proof_scale), round(BOARD_H * proof_scale)),
        Image.Resampling.LANCZOS,
    )
    logistics_proof = board.resize(
        (round(BOARD_W * proof_scale), round(BOARD_H * proof_scale)),
        Image.Resampling.LANCZOS,
    )
    proof = Image.new(
        "RGBA",
        (encounter_proof.width + 150, encounter_proof.height * 2 + 235),
        (228, 220, 201, 255),
    )
    pd = ImageDraw.Draw(proof)
    proof_title = ImageFont.truetype(str(ALEGREYA_SANS), 32)
    proof_text = ImageFont.truetype(str(ALEGREYA_SANS), 21)
    pd.text(
        (70, 30),
        "REVISED LOGISTICS GRID ALIGNED TO ENCOUNTER BOARD",
        font=proof_title,
        fill=(55, 43, 30),
    )
    px0, py0 = 70, 90
    shadow_paste(proof, encounter_proof, px0, py0)
    shadow_paste(proof, logistics_proof, px0, py0 + encounter_proof.height)
    pd.text(
        (70, py0 + encounter_proof.height * 2 + 38),
        "Both boards: 568.5 × 146 mm  |  End wells: 70 × 120 mm  |  Centre field: 386.5 × 120 mm",
        font=proof_text,
        fill=(75, 58, 40),
    )
    pd.text(
        (70, py0 + encounter_proof.height * 2 + 70),
        "TARGET CARDS ↕ ENCOUNTER     SIX WAREHOUSES ↕ IN PLAY     TOKENS ↕ DISCARD",
        font=proof_text,
        fill=(75, 58, 40),
    )
    proof.convert("RGB").save(
        OUT / "revised-logistics-aligned-under-encounter.png",
        quality=95,
    )

    scale = 1.75
    map_image = Image.open(
        PROD / "map-board" / "the-quiet-vale-map-board-finished-size.png"
    ).convert("RGB").resize(
        (round(MAP_W * scale), round(MAP_H * scale)), Image.Resampling.LANCZOS
    )
    side = board.resize(
        (round(BOARD_W * scale), round(BOARD_H * scale)), Image.Resampling.LANCZOS
    ).rotate(90, expand=True)
    canvas = Image.new(
        "RGBA",
        (map_image.width + side.width + 180, map_image.height + 230),
        (228, 220, 201, 255),
    )
    draw = ImageDraw.Draw(canvas)
    title_font = ImageFont.truetype(str(ALEGREYA_SANS), 34)
    label_font = ImageFont.truetype(str(ALEGREYA_SANS), 24)
    draw.text(
        (80, 35),
        "ENCOUNTER-SIZED COMBINED LOGISTICS BOARD — ROTATED BESIDE MAP",
        font=title_font,
        fill=(55, 43, 30),
    )
    x, y = 80, 100
    shadow_paste(canvas, map_image, x, y)
    side_x = x + map_image.width
    side_y = y
    shadow_paste(canvas, side, side_x, side_y)
    total_w = MAP_W + BOARD_H
    draw.text(
        (80, y + map_image.height + 42),
        f"Combined footprint: {total_w:.1f} × {MAP_H:.1f} mm  |  {total_w/25.4:.2f} × {MAP_H/25.4:.2f} in",
        font=label_font,
        fill=(75, 58, 40),
    )
    draw.text(
        (side_x + 12, y + map_image.height + 42),
        "Logistics board: 568.5 × 146 mm",
        font=label_font,
        fill=(75, 58, 40),
    )
    canvas.convert("RGB").save(
        OUT / "combined-logistics-board-rotated-beside-map.png", quality=95
    )

    encounter = Image.open(
        PROD / "encounter-board" / "the-quiet-vale-encounter-board-finished-size.png"
    ).convert("RGB").resize(
        (round(BOARD_W * scale), round(BOARD_H * scale)), Image.Resampling.LANCZOS
    ).rotate(90, expand=True)
    full_total_w = MAP_W + 2 * BOARD_H
    full = Image.new(
        "RGBA",
        (encounter.width + map_image.width + side.width + 210, map_image.height + 260),
        (228, 220, 201, 255),
    )
    fd = ImageDraw.Draw(full)
    fd.text(
        (90, 35),
        "MAP WITH ENCOUNTER AND COMBINED LOGISTICS BOARDS — TO SCALE",
        font=title_font,
        fill=(55, 43, 30),
    )
    left_x, top_y = 90, 105
    map_x = left_x + encounter.width
    right_x = map_x + map_image.width
    shadow_paste(full, encounter, left_x, top_y)
    shadow_paste(full, map_image, map_x, top_y)
    shadow_paste(full, side, right_x, top_y)

    line_colour = (82, 63, 43)
    base_y = top_y + map_image.height + 45
    fd.line((left_x, base_y, right_x + side.width, base_y), fill=line_colour, width=2)
    fd.line((left_x, base_y - 9, left_x, base_y + 9), fill=line_colour, width=2)
    fd.line((right_x + side.width, base_y - 9, right_x + side.width, base_y + 9), fill=line_colour, width=2)
    total_text = (
        f"TOTAL {full_total_w:.1f} × {MAP_H:.1f} mm  |  "
        f"{full_total_w/25.4:.2f} × {MAP_H/25.4:.2f} in"
    )
    total_box = fd.textbbox((0, 0), total_text, font=label_font)
    fd.text(
        ((left_x + right_x + side.width - (total_box[2] - total_box[0])) / 2, base_y + 12),
        total_text,
        font=label_font,
        fill=line_colour,
    )
    fd.text(
        (left_x, base_y + 60),
        "ENCOUNTER\n146 × 568.5 mm",
        font=label_font,
        fill=line_colour,
        spacing=4,
    )
    map_label = "MAP 698.5 × 568.5 mm"
    map_box = fd.textbbox((0, 0), map_label, font=label_font)
    fd.text(
        (map_x + (map_image.width - (map_box[2] - map_box[0])) / 2, base_y + 60),
        map_label,
        font=label_font,
        fill=line_colour,
    )
    fd.text(
        (right_x + 10, base_y + 60),
        "LOGISTICS\n146 × 568.5 mm",
        font=label_font,
        fill=line_colour,
        spacing=4,
    )
    full.convert("RGB").save(
        OUT / "map-encounter-and-combined-logistics-measured.png", quality=95
    )

    # Alternative: both modular boards landscape, stacked beside the map.
    encounter_landscape = Image.open(
        PROD / "encounter-board" / "the-quiet-vale-encounter-board-finished-size.png"
    ).convert("RGB").resize(
        (round(BOARD_W * scale), round(BOARD_H * scale)), Image.Resampling.LANCZOS
    )
    logistics_landscape = board.resize(
        (round(BOARD_W * scale), round(BOARD_H * scale)), Image.Resampling.LANCZOS
    )
    landscape_total_w = MAP_W + BOARD_W
    stacked_h = 2 * BOARD_H
    landscape = Image.new(
        "RGBA",
        (
            map_image.width + encounter_landscape.width + 210,
            map_image.height + 260,
        ),
        (228, 220, 201, 255),
    )
    ld = ImageDraw.Draw(landscape)
    ld.text(
        (90, 35),
        "LANDSCAPE ENCOUNTER AND LOGISTICS BOARDS BESIDE MAP — TO SCALE",
        font=title_font,
        fill=(55, 43, 30),
    )
    lx, ly = 90, 105
    stack_x = lx + map_image.width
    stack_y = ly + round((MAP_H - stacked_h) * scale / 2)
    shadow_paste(landscape, map_image, lx, ly)
    shadow_paste(landscape, encounter_landscape, stack_x, stack_y)
    shadow_paste(
        landscape,
        logistics_landscape,
        stack_x,
        stack_y + encounter_landscape.height,
    )

    landscape_base_y = ly + map_image.height + 45
    end_x = stack_x + encounter_landscape.width
    ld.line((lx, landscape_base_y, end_x, landscape_base_y), fill=line_colour, width=2)
    ld.line((lx, landscape_base_y - 9, lx, landscape_base_y + 9), fill=line_colour, width=2)
    ld.line((end_x, landscape_base_y - 9, end_x, landscape_base_y + 9), fill=line_colour, width=2)
    landscape_total_text = (
        f"TOTAL {landscape_total_w:.1f} × {MAP_H:.1f} mm  |  "
        f"{landscape_total_w/25.4:.2f} × {MAP_H/25.4:.2f} in"
    )
    ltb = ld.textbbox((0, 0), landscape_total_text, font=label_font)
    ld.text(
        ((lx + end_x - (ltb[2] - ltb[0])) / 2, landscape_base_y + 12),
        landscape_total_text,
        font=label_font,
        fill=line_colour,
    )
    ld.text(
        (lx, landscape_base_y + 60),
        "MAP 698.5 × 568.5 mm",
        font=label_font,
        fill=line_colour,
    )
    ld.text(
        (stack_x + 10, landscape_base_y + 60),
        "ENCOUNTER + LOGISTICS STACK 568.5 × 292 mm",
        font=label_font,
        fill=line_colour,
    )
    landscape.convert("RGB").save(
        OUT / "map-with-landscape-encounter-over-logistics-measured.png",
        quality=95,
    )


if __name__ == "__main__":
    main()
