#!/usr/bin/env python3
"""Render the selected modular board set in the locked production style."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

from generate_unified_a1_board import (
    ALEGREYA_SANS,
    ALMENDRA,
    MAP_BOTTOM_MM,
    MAP_HEIGHT_MM,
    MAP_RIGHT_MM,
    MAP_TOP_MM,
    MAP_WIDTH_MM,
    MAP_X_MM,
    apply_unified_neoprene_finish,
    draw_material_text,
    draw_outer_finish,
    draw_round_tracker,
    draw_stitch_path,
    paste_exact_map,
    px,
    render_brass_fitting,
    render_recess,
    rounded_rect_path,
    tiled_leather,
)


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "output/concepts/modular-board-set-v2-landscape"
PPM = 4.0
INCH_MM = 25.4

MAP_BOARD_W_MM = 27.5 * INCH_MM
# The brass fittings visually occupy part of the top margin, so the map needs a
# little more clear leather above it than the tracker needs below it.
MAP_TOP_CLEARANCE_MM = 18.0
# 568.5 mm preserves the balanced clearances and divides into six identical
# 94.75 mm warehouse modules without accumulated print/raster rounding.
MAP_BOARD_H_MM = 568.5
ENCOUNTER_LONG_MM = MAP_BOARD_H_MM
# Dedicated single-sided landscape board: full 120 mm tarot wells with the
# same 13 mm clear border used throughout the other modular products.
ENCOUNTER_SHORT_MM = 146.0
WAREHOUSE_W_MM = 3.25 * INCH_MM
WAREHOUSE_H_MM = MAP_BOARD_H_MM / 6.0
CORE_W_MM = WAREHOUSE_W_MM * 3.0
CORE_H_MM = WAREHOUSE_H_MM * 2.0
ROTATED_LOGISTICS_W_MM = CORE_H_MM
TARGET_BOARD_H_MM = MAP_BOARD_H_MM - 2.0 * CORE_W_MM

THREAD = (145, 108, 71)
RESOURCE_THREADS = {
    "WOOD": (91, 124, 76),
    "FOOD": (151, 141, 52),
    "STONE": (126, 135, 142),
    "HERBS": (123, 91, 137),
    "METAL": (101, 133, 151),
    "GOODS": (149, 86, 62),
}


def leather_board(width_mm: float, height_mm: float) -> Image.Image:
    board = tiled_leather(px(width_mm, PPM), px(height_mm, PPM), PPM).convert("RGBA")
    draw_outer_finish(board, PPM)
    return board


def recess(
    board: Image.Image,
    bbox_mm: tuple[float, float, float, float],
    label: str | None,
    seed: int,
    label_size_mm: float = 5.0,
) -> None:
    left, top, right, bottom = bbox_mm
    bbox = tuple(px(value, PPM) for value in bbox_mm)
    render_recess(
        board,
        bbox,
        radius_px=px(5.0, PPM),
        depth_px=max(3, px(1.8, PPM)),
        interior_brightness=0.73,
    )
    if label:
        draw_material_text(
            board,
            label,
            ((left + right) / 2.0, top + 10.0),
            ALMENDRA,
            label_size_mm,
            (206, 192, 154),
            PPM,
            seed=seed + 1000,
        )


def card_socket(
    board: Image.Image,
    left: float,
    top: float,
    width: float = 70.0,
    height: float = 120.0,
    seed: int = 1,
) -> None:
    bbox = (
        px(left, PPM),
        px(top, PPM),
        px(left + width, PPM),
        px(top + height, PPM),
    )
    render_recess(
        board,
        bbox,
        radius_px=px(4.0, PPM),
        depth_px=max(3, px(1.45, PPM)),
        interior_brightness=0.76,
        outer_cut_opacity=0.13,
    )
def build_map_board() -> Image.Image:
    board = leather_board(MAP_BOARD_W_MM, MAP_BOARD_H_MM)
    map_left = (MAP_BOARD_W_MM - MAP_WIDTH_MM) / 2.0
    map_top = MAP_TOP_CLEARANCE_MM
    offset = (map_left - MAP_X_MM, map_top - MAP_TOP_MM)
    paste_exact_map(
        board,
        PPM,
        offset,
        paper_age_strength=0.72,
        paper_age_seed=93517,
    )
    map_right = map_left + MAP_WIDTH_MM
    map_bottom = map_top + MAP_HEIGHT_MM
    for x, y, sx, sy, seed in (
        (map_left, map_top, 1, 1, 66101),
        (map_right, map_top, -1, 1, 66102),
        (map_left, map_bottom, 1, -1, 66103),
        (map_right, map_bottom, -1, -1, 66104),
    ):
        render_brass_fitting(
            board,
            (x, y),
            sx,
            sy,
            PPM,
            seed,
            patina_strength=0.78,
        )
    centers: list[float] = []
    for group_center in (MAP_BOARD_W_MM / 6, MAP_BOARD_W_MM / 2, MAP_BOARD_W_MM * 5 / 6):
        centers.extend(group_center + delta for delta in (-48.0, -16.0, 16.0, 48.0))
    draw_round_tracker(
        board,
        PPM,
        center_y_mm=map_bottom + 13.0 + 8.5,
        socket_radius_mm=8.5,
        round_number_size_mm=5.2,
        season_marker_size_mm=5.0,
        season_marker_offset_mm=18.0,
        centers_mm=centers,
    )
    return apply_unified_neoprene_finish(board, PPM)


def build_encounter_vertical() -> Image.Image:
    board = leather_board(ENCOUNTER_SHORT_MM, ENCOUNTER_LONG_MM)
    gap_x = (ENCOUNTER_SHORT_MM - 2 * 70.0) / 3.0
    left_a = gap_x
    left_b = 2 * gap_x + 70.0
    card_top = gap_x
    card_socket(board, left_a, card_top, seed=67101)
    card_socket(board, left_b, card_top, seed=67102)
    draw_material_text(board, "ENCOUNTER", (left_a + 35.0, card_top + 10.0), ALMENDRA, 4.2, (206, 192, 154), PPM, seed=67201)
    draw_material_text(board, "DISCARD", (left_b + 35.0, card_top + 10.0), ALMENDRA, 4.2, (206, 192, 154), PPM, seed=67202)
    in_play_top = card_top + 120.0 + gap_x
    recess(
        board,
        (
            gap_x,
            in_play_top,
            ENCOUNTER_SHORT_MM - gap_x,
            ENCOUNTER_LONG_MM - gap_x,
        ),
        "IN PLAY",
        67300,
        label_size_mm=5.7,
    )
    return apply_unified_neoprene_finish(board, PPM)


def build_encounter_landscape() -> Image.Image:
    board = leather_board(ENCOUNTER_LONG_MM, ENCOUNTER_SHORT_MM)
    card_top = (ENCOUNTER_SHORT_MM - 120.0) / 2.0
    edge_gap = card_top
    internal_gap = 8.0
    card_socket(board, edge_gap, card_top, seed=68101)
    card_socket(board, ENCOUNTER_LONG_MM - edge_gap - 70.0, card_top, seed=68102)
    draw_material_text(board, "ENCOUNTER", (edge_gap + 35.0, card_top + 10.0), ALMENDRA, 4.2, (206, 192, 154), PPM, seed=68201)
    draw_material_text(board, "DISCARD", (ENCOUNTER_LONG_MM - edge_gap - 35.0, card_top + 10.0), ALMENDRA, 4.2, (206, 192, 154), PPM, seed=68202)
    recess(
        board,
        (
            edge_gap + 70.0 + internal_gap,
            edge_gap,
            ENCOUNTER_LONG_MM - (edge_gap + 70.0 + internal_gap),
            ENCOUNTER_SHORT_MM - edge_gap,
        ),
        "IN PLAY",
        68300,
        label_size_mm=5.7,
    )
    return apply_unified_neoprene_finish(board, PPM)


def build_warehouse(resource: str, seed: int) -> Image.Image:
    # The warehouse modules use one stitch treatment only: category-coloured
    # thread at the outer board edge. The storage tray itself is an unstitched
    # recess, keeping the material hierarchy clean on these small pieces.
    board = tiled_leather(
        px(WAREHOUSE_W_MM, PPM),
        px(WAREHOUSE_H_MM, PPM),
        PPM,
    ).convert("RGBA")
    outer_inset = px(3.2, PPM)
    draw_stitch_path(
        board,
        rounded_rect_path(
            (
                outer_inset,
                outer_inset,
                board.width - outer_inset,
                board.height - outer_inset,
            ),
            px(3.2, PPM),
        ),
        RESOURCE_THREADS[resource],
        PPM,
        seed=seed,
    )
    tray = (
        px(7.2, PPM),
        px(7.2, PPM),
        px(WAREHOUSE_W_MM - 7.2, PPM),
        px(WAREHOUSE_H_MM - 7.2, PPM),
    )
    render_recess(
        board,
        tray,
        radius_px=px(5.0, PPM),
        depth_px=max(3, px(1.8, PPM)),
        interior_brightness=0.73,
    )
    draw_material_text(
        board,
        resource,
        (WAREHOUSE_W_MM / 2.0, 17.0),
        ALMENDRA,
        6.5,
        (206, 192, 154),
        PPM,
        seed=seed + 1000,
    )
    return apply_unified_neoprene_finish(board, PPM)


def build_core_board() -> Image.Image:
    board = leather_board(CORE_W_MM, CORE_H_MM)
    recess(
        board,
        (12.0, 12.0, CORE_W_MM - 12.0, CORE_H_MM - 12.0),
        "CORE TILES",
        70100,
        label_size_mm=7.0,
    )
    labels = (
        ("RESOURCE", 1),
        ("HOUSING", 1),
        ("TRAVEL", 3),
        ("SOCIAL + WELLBEING", 1),
        ("MERCHANT + CRAFTING", 1),
    )
    usable_left = 20.0
    usable_right = CORE_W_MM - 20.0
    unit = (usable_right - usable_left) / 7.0
    cursor = usable_left
    for index, (label, units) in enumerate(labels):
        width = unit * units
        draw_material_text(
            board,
            label,
            (cursor + width / 2.0, CORE_H_MM - 22.0),
            ALEGREYA_SANS,
            2.7,
            (188, 173, 136),
            PPM,
            seed=70200 + index,
            opacity=0.82,
        )
        cursor += width
    return apply_unified_neoprene_finish(board, PPM)


def build_target_board() -> Image.Image:
    board = leather_board(ROTATED_LOGISTICS_W_MM, TARGET_BOARD_H_MM)
    recess(
        board,
        (
            13.0,
            13.0,
            ROTATED_LOGISTICS_W_MM - 13.0,
            TARGET_BOARD_H_MM - 13.0,
        ),
        "TARGET CARDS",
        71100,
        label_size_mm=5.3,
    )
    return apply_unified_neoprene_finish(board, PPM)


def make_target_card_mock(seed: int) -> Image.Image:
    width = px(68.0, PPM)
    height = px(44.0, PPM)
    card = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(card)
    radius = px(2.2, PPM)
    draw.rounded_rectangle(
        (0, 0, width - 1, height - 1),
        radius=radius,
        fill=(197, 184, 145, 255),
        outline=(84, 66, 40, 255),
        width=max(2, px(0.65, PPM)),
    )
    inset = px(3.0, PPM)
    draw.rounded_rectangle(
        (inset, inset, width - 1 - inset, height - 1 - inset),
        radius=max(2, radius - inset // 3),
        outline=(124, 92, 51, 220),
        width=max(1, px(0.45, PPM)),
    )
    draw_material_text(
        card,
        "TARGET",
        (34.0, 22.0),
        ALMENDRA,
        4.5,
        (78, 58, 34),
        PPM,
        seed=seed,
        opacity=0.9,
    )
    return card


def target_board_with_cards(target_board: Image.Image) -> Image.Image:
    preview = target_board.convert("RGBA")
    card = make_target_card_mock(71200)
    positions_mm = ((17.0, 15.5), (19.0, 14.5), (21.0, 13.5), (100.5, 14.5))
    for index, (left_mm, top_mm) in enumerate(positions_mm):
        left = px(left_mm, PPM)
        top = px(top_mm, PPM)
        shadow = Image.new("RGBA", card.size, (0, 0, 0, 0))
        shadow_mask = card.getchannel("A").filter(
            ImageFilter.GaussianBlur(max(1, px(0.8, PPM)))
        )
        shadow.putalpha(shadow_mask.point(lambda value: round(value * 0.32)))
        preview.alpha_composite(
            shadow,
            (left + px(1.0, PPM), top + px(1.2, PPM)),
        )
        preview.alpha_composite(card, (left, top))
    return preview


def make_composite(
    map_board: Image.Image,
    encounter_vertical: Image.Image,
    warehouses: list[Image.Image],
    core_board: Image.Image,
) -> Image.Image:
    width_mm = ENCOUNTER_SHORT_MM + MAP_BOARD_W_MM
    height_mm = MAP_BOARD_H_MM + CORE_H_MM
    canvas = Image.new("RGB", (px(width_mm, PPM), px(height_mm, PPM)), (46, 40, 32))
    canvas.paste(encounter_vertical.convert("RGB"), (0, 0))
    canvas.paste(map_board.convert("RGB"), (encounter_vertical.width, 0))
    logistics_width = 3 * warehouses[0].width + core_board.width
    x0 = encounter_vertical.width + (map_board.width - logistics_width) // 2
    y0 = map_board.height
    for index, warehouse in enumerate(warehouses):
        column = index % 3
        row = index // 3
        canvas.paste(
            warehouse.convert("RGB"),
            (x0 + column * warehouse.width, y0 + row * warehouse.height),
        )
    canvas.paste(
        core_board.convert("RGB"),
        (x0 + 3 * warehouses[0].width, y0),
    )
    return canvas


def make_warehouse_sheet(warehouses: list[Image.Image]) -> Image.Image:
    gap = px(8.0, PPM)
    margin = px(12.0, PPM)
    width = margin * 2 + 3 * warehouses[0].width + 2 * gap
    height = margin * 2 + 2 * warehouses[0].height + gap
    sheet = Image.new("RGB", (width, height), (46, 40, 32))
    for index, warehouse in enumerate(warehouses):
        column = index % 3
        row = index // 3
        sheet.paste(
            warehouse.convert("RGB"),
            (
                margin + column * (warehouse.width + gap),
                margin + row * (warehouse.height + gap),
            ),
        )
    return sheet


def paste_warehouse_block(
    canvas: Image.Image,
    warehouses: list[Image.Image],
    origin: tuple[int, int],
    columns: int = 3,
) -> None:
    x0, y0 = origin
    for index, warehouse in enumerate(warehouses):
        column = index % columns
        row = index // columns
        canvas.paste(
            warehouse.convert("RGB"),
            (
                x0 + column * warehouse.width,
                y0 + row * warehouse.height,
            ),
        )


def make_landscape_below_layout(
    map_board: Image.Image,
    encounter_landscape: Image.Image,
    warehouses: list[Image.Image],
    core_board: Image.Image,
) -> Image.Image:
    logistics_width = 3 * warehouses[0].width + core_board.width
    width = max(map_board.width, encounter_landscape.width, logistics_width)
    height = map_board.height + encounter_landscape.height + core_board.height
    canvas = Image.new("RGB", (width, height), (46, 40, 32))
    canvas.paste(map_board.convert("RGB"), ((width - map_board.width) // 2, 0))
    encounter_y = map_board.height
    canvas.paste(
        encounter_landscape.convert("RGB"),
        ((width - encounter_landscape.width) // 2, encounter_y),
    )
    logistics_y = encounter_y + encounter_landscape.height
    logistics_x = (width - logistics_width) // 2
    paste_warehouse_block(canvas, warehouses, (logistics_x, logistics_y))
    canvas.paste(
        core_board.convert("RGB"),
        (logistics_x + 3 * warehouses[0].width, logistics_y),
    )
    return canvas


def make_full_height_warehouse_layout(
    map_board: Image.Image,
    encounter_landscape: Image.Image,
    warehouses: list[Image.Image],
    core_board: Image.Image,
) -> Image.Image:
    top_width = map_board.width + warehouses[0].width
    lower_width = encounter_landscape.width + core_board.width
    width = max(top_width, lower_width)
    height = map_board.height + core_board.height
    canvas = Image.new("RGB", (width, height), (46, 40, 32))
    top_x = (width - top_width) // 2
    canvas.paste(map_board.convert("RGB"), (top_x, 0))
    for index, warehouse in enumerate(warehouses):
        canvas.paste(
            warehouse.convert("RGB"),
            (top_x + map_board.width, index * warehouse.height),
        )
    lower_x = (width - lower_width) // 2
    canvas.paste(encounter_landscape.convert("RGB"), (lower_x, map_board.height))
    canvas.paste(
        core_board.convert("RGB"),
        (lower_x + encounter_landscape.width, map_board.height),
    )
    return canvas


def make_rotated_encounter_right_logistics_layout(
    map_board: Image.Image,
    encounter_landscape: Image.Image,
    warehouses: list[Image.Image],
    core_board: Image.Image,
) -> Image.Image:
    encounter_rotated = encounter_landscape.transpose(Image.Transpose.ROTATE_90)
    logistics_width = 3 * warehouses[0].width
    logistics_height = 2 * warehouses[0].height + core_board.height
    width = encounter_rotated.width + map_board.width + logistics_width
    height = map_board.height
    canvas = Image.new("RGB", (width, height), (46, 40, 32))
    canvas.paste(encounter_rotated.convert("RGB"), (0, 0))
    map_x = encounter_rotated.width
    canvas.paste(map_board.convert("RGB"), (map_x, 0))
    logistics_x = map_x + map_board.width
    logistics_y = (height - logistics_height) // 2
    paste_warehouse_block(
        canvas,
        warehouses,
        (logistics_x, logistics_y),
    )
    canvas.paste(
        core_board.convert("RGB"),
        (logistics_x, logistics_y + 2 * warehouses[0].height),
    )
    return canvas


def make_all_side_boards_rotated_layout(
    map_board: Image.Image,
    encounter_landscape: Image.Image,
    warehouses: list[Image.Image],
    core_board: Image.Image,
) -> Image.Image:
    encounter_rotated = encounter_landscape.transpose(Image.Transpose.ROTATE_90)
    warehouse_block = Image.new(
        "RGB",
        (
            3 * warehouses[0].width,
            2 * warehouses[0].height,
        ),
        (46, 40, 32),
    )
    paste_warehouse_block(warehouse_block, warehouses, (0, 0))
    rotated_warehouse_block = warehouse_block.transpose(
        Image.Transpose.ROTATE_90
    )
    rotated_core = core_board.transpose(Image.Transpose.ROTATE_90)
    logistics_width = max(rotated_warehouse_block.width, rotated_core.width)
    logistics_height = rotated_warehouse_block.height + rotated_core.height
    width = encounter_rotated.width + map_board.width + logistics_width
    height = map_board.height
    canvas = Image.new("RGB", (width, height), (46, 40, 32))
    canvas.paste(encounter_rotated.convert("RGB"), (0, 0))
    map_x = encounter_rotated.width
    canvas.paste(map_board.convert("RGB"), (map_x, 0))
    logistics_x = map_x + map_board.width
    logistics_y = (height - logistics_height) // 2
    warehouse_x = (
        logistics_x
        + (logistics_width - rotated_warehouse_block.width) // 2
    )
    canvas.paste(
        rotated_warehouse_block,
        (warehouse_x, logistics_y),
    )
    core_x = logistics_x + (logistics_width - rotated_core.width) // 2
    canvas.paste(
        rotated_core.convert("RGB"),
        (core_x, logistics_y + rotated_warehouse_block.height),
    )
    return canvas


def make_target_cards_column_layout(
    map_board: Image.Image,
    encounter_landscape: Image.Image,
    warehouses: list[Image.Image],
    core_board: Image.Image,
    target_board: Image.Image,
) -> Image.Image:
    encounter_rotated = encounter_landscape.transpose(Image.Transpose.ROTATE_90)
    warehouse_block = Image.new(
        "RGB",
        (3 * warehouses[0].width, 2 * warehouses[0].height),
        (46, 40, 32),
    )
    paste_warehouse_block(warehouse_block, warehouses, (0, 0))
    rotated_warehouse_block = warehouse_block.transpose(
        Image.Transpose.ROTATE_90
    )
    rotated_core = core_board.transpose(Image.Transpose.ROTATE_90)
    logistics_width = rotated_warehouse_block.width
    width = encounter_rotated.width + map_board.width + logistics_width
    height = map_board.height
    canvas = Image.new("RGB", (width, height), (46, 40, 32))
    canvas.paste(encounter_rotated.convert("RGB"), (0, 0))
    map_x = encounter_rotated.width
    canvas.paste(map_board.convert("RGB"), (map_x, 0))
    logistics_x = map_x + map_board.width
    canvas.paste(rotated_warehouse_block, (logistics_x, 0))
    core_y = rotated_warehouse_block.height
    canvas.paste(rotated_core.convert("RGB"), (logistics_x, core_y))
    canvas.paste(
        target_board.convert("RGB"),
        (logistics_x, core_y + rotated_core.height),
    )
    return canvas


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    map_board = build_map_board()
    encounter_landscape = build_encounter_landscape()
    resources = ("WOOD", "FOOD", "STONE", "HERBS", "METAL", "GOODS")
    warehouses = [build_warehouse(resource, 69000 + index * 100) for index, resource in enumerate(resources)]
    core_board = build_core_board()
    target_board = build_target_board()
    target_card_fit = target_board_with_cards(target_board)
    warehouse_sheet = make_warehouse_sheet(warehouses)
    landscape_below = make_landscape_below_layout(
        map_board,
        encounter_landscape,
        warehouses,
        core_board,
    )
    full_height_warehouses = make_full_height_warehouse_layout(
        map_board,
        encounter_landscape,
        warehouses,
        core_board,
    )
    rotated_encounter_right_logistics = (
        make_rotated_encounter_right_logistics_layout(
            map_board,
            encounter_landscape,
            warehouses,
            core_board,
        )
    )
    all_side_boards_rotated = make_all_side_boards_rotated_layout(
        map_board,
        encounter_landscape,
        warehouses,
        core_board,
    )
    target_cards_column = make_target_cards_column_layout(
        map_board,
        encounter_landscape,
        warehouses,
        core_board,
        target_board,
    )

    outputs = {
        "modular-map-board-preview.png": map_board,
        "encounter-board-landscape-preview.png": encounter_landscape,
        "core-tiles-board-preview.png": core_board,
        "target-cards-board-preview.png": target_board,
        "target-cards-board-with-euro-cards-preview.png": target_card_fit,
        "complete-modular-set-balanced-preview.png": landscape_below,
        "layout-landscape-below-preview.png": landscape_below,
        "layout-full-height-warehouses-preview.png": full_height_warehouses,
        "layout-rotated-encounter-left-logistics-right-preview.png": rotated_encounter_right_logistics,
        "layout-all-side-boards-rotated-preview.png": all_side_boards_rotated,
        "layout-target-cards-right-column-preview.png": target_cards_column,
        "warehouse-modules-separated-preview.png": warehouse_sheet,
    }
    for resource, image in zip(resources, warehouses):
        outputs[f"warehouse-{resource.lower()}-preview.png"] = image
    for filename, image in outputs.items():
        image.convert("RGB").save(OUTPUT_DIR / filename, format="PNG", optimize=True)
        print(OUTPUT_DIR / filename)


if __name__ == "__main__":
    main()
