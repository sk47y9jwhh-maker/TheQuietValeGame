#!/usr/bin/env python3
"""Render a 39 x 27 inch leather-border layout at unchanged game scale."""

from __future__ import annotations

import json
from pathlib import Path

from generate_unified_a1_board import (
    A1_HEIGHT_MM,
    A1_WIDTH_MM,
    MAP_BOTTOM_MM,
    MAP_HEIGHT_MM,
    MAP_RIGHT_MM,
    MAP_TOP_MM,
    MAP_WIDTH_MM,
    MAP_X_MM,
    apply_unified_neoprene_finish,
    draw_map_stitching,
    draw_outer_finish,
    draw_round_tracker,
    draw_title,
    draw_warehouses,
    paste_exact_map,
    px,
    render_brass_fitting,
    tiled_leather,
)


INCH_MM = 25.4
CANVAS_WIDTH_IN = 39.0
CANVAS_HEIGHT_IN = 27.0
CANVAS_WIDTH_MM = CANVAS_WIDTH_IN * INCH_MM
CANVAS_HEIGHT_MM = CANVAS_HEIGHT_IN * INCH_MM
PIXELS_PER_MM = 4.0
OUTER_STITCH_INSET_MM = 6.5
MAP_STITCH_OUTSET_MM = 2.7
EXPANDED_WAREHOUSE_WIDTH_MM = 133.8
EXPANDED_WAREHOUSE_X_MM = (
    OUTER_STITCH_INSET_MM
    + (
        (CANVAS_WIDTH_MM - A1_WIDTH_MM) / 2.0
        + MAP_X_MM
        - MAP_STITCH_OUTSET_MM
    )
) / 2.0 - EXPANDED_WAREHOUSE_WIDTH_MM / 2.0
EXPANDED_WAREHOUSE_BAND_CENTER_MM = (
    OUTER_STITCH_INSET_MM
    + (
        (CANVAS_WIDTH_MM - A1_WIDTH_MM) / 2.0
        + MAP_X_MM
        - MAP_STITCH_OUTSET_MM
    )
) / 2.0
EXPANDED_WAREHOUSE_LABEL_SIZE_MM = 8.5
EXPANDED_TITLE_SIZE_MM = 16.0
EXPANDED_SUBTITLE_SIZE_MM = 4.4
EXPANDED_TRACKER_RADIUS_MM = 12.5
EXPANDED_TRACKER_NUMBER_SIZE_MM = 7.4
EXPANDED_SEASON_MARKER_SIZE_MM = 6.8
EXPANDED_SEASON_MARKER_OFFSET_MM = 30.0

OUTPUT_DIR = (
    Path(__file__).resolve().parents[2]
    / "output/pdf/39x27-layout"
)
PREVIEW_PATH = OUTPUT_DIR / (
    "the-quiet-vale-39x27-leather-border-preview.png"
)
MANIFEST_PATH = OUTPUT_DIR / (
    "the-quiet-vale-39x27-leather-border-preview.json"
)


def build_preview():
    width = px(CANVAS_WIDTH_MM, PIXELS_PER_MM)
    height = px(CANVAS_HEIGHT_MM, PIXELS_PER_MM)
    offset_x_mm = (CANVAS_WIDTH_MM - A1_WIDTH_MM) / 2.0
    offset_y_mm = (CANVAS_HEIGHT_MM - A1_HEIGHT_MM) / 2.0
    offset_mm = (offset_x_mm, offset_y_mm)

    board = tiled_leather(
        width,
        height,
        PIXELS_PER_MM,
    ).convert("RGBA")
    draw_outer_finish(board, PIXELS_PER_MM)
    draw_warehouses(
        board,
        PIXELS_PER_MM,
        offset_mm=(0.0, offset_y_mm),
        layout_width_mm=CANVAS_WIDTH_MM,
        warehouse_x_mm=EXPANDED_WAREHOUSE_X_MM,
        warehouse_width_mm=EXPANDED_WAREHOUSE_WIDTH_MM,
        warehouse_label_size_mm=EXPANDED_WAREHOUSE_LABEL_SIZE_MM,
    )

    map_top_mm = MAP_TOP_MM + offset_y_mm
    map_bottom_mm = MAP_BOTTOM_MM + offset_y_mm
    upper_stitch_y_mm = 6.5
    lower_stitch_y_mm = CANVAS_HEIGHT_MM - 6.5

    # Re-centre the title group in the enlarged upper leather field.
    title_group_center_y_mm = (
        upper_stitch_y_mm + map_top_mm
    ) / 2.0
    draw_title(
        board,
        PIXELS_PER_MM,
        center_x_mm=CANVAS_WIDTH_MM / 2.0,
        main_y_mm=title_group_center_y_mm - 5.5,
        subtitle_y_mm=title_group_center_y_mm + 10.0,
        main_size_mm=EXPANDED_TITLE_SIZE_MM,
        subtitle_size_mm=EXPANDED_SUBTITLE_SIZE_MM,
    )

    # Re-centre the unchanged round sockets in the enlarged lower field.
    tracker_center_y_mm = (
        map_bottom_mm + lower_stitch_y_mm
    ) / 2.0
    draw_round_tracker(
        board,
        PIXELS_PER_MM,
        offset_x_mm=offset_x_mm,
        center_y_mm=tracker_center_y_mm,
        socket_radius_mm=EXPANDED_TRACKER_RADIUS_MM,
        round_number_size_mm=EXPANDED_TRACKER_NUMBER_SIZE_MM,
        season_marker_size_mm=EXPANDED_SEASON_MARKER_SIZE_MM,
        season_marker_offset_mm=EXPANDED_SEASON_MARKER_OFFSET_MM,
    )
    draw_map_stitching(board, PIXELS_PER_MM, offset_mm)
    paste_exact_map(board, PIXELS_PER_MM, offset_mm)

    map_left_mm = MAP_X_MM + offset_x_mm
    map_right_mm = MAP_RIGHT_MM + offset_x_mm
    render_brass_fitting(
        board,
        (map_left_mm, map_top_mm),
        1,
        1,
        PIXELS_PER_MM,
        7601,
    )
    render_brass_fitting(
        board,
        (map_right_mm, map_top_mm),
        -1,
        1,
        PIXELS_PER_MM,
        7602,
    )
    render_brass_fitting(
        board,
        (map_left_mm, map_bottom_mm),
        1,
        -1,
        PIXELS_PER_MM,
        7603,
    )
    render_brass_fitting(
        board,
        (map_right_mm, map_bottom_mm),
        -1,
        -1,
        PIXELS_PER_MM,
        7604,
    )
    return (
        apply_unified_neoprene_finish(board, PIXELS_PER_MM),
        offset_x_mm,
        offset_y_mm,
        tracker_center_y_mm,
    )


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    board, offset_x_mm, offset_y_mm, tracker_center_y_mm = build_preview()
    board.save(PREVIEW_PATH, format="PNG", optimize=True)
    manifest = {
        "status": "layout preview; not a production print package",
        "finishedSize": {
            "widthIn": CANVAS_WIDTH_IN,
            "heightIn": CANVAS_HEIGHT_IN,
            "widthMm": CANVAS_WIDTH_MM,
            "heightMm": CANVAS_HEIGHT_MM,
        },
        "preview": {
            "pixelsPerMm": PIXELS_PER_MM,
            "effectivePpi": PIXELS_PER_MM * INCH_MM,
            "pixelWidth": board.width,
            "pixelHeight": board.height,
        },
        "map": {
            "physicalWidthMm": MAP_WIDTH_MM,
            "physicalHeightMm": MAP_HEIGHT_MM,
            "hexPointToPointMm": 60.0,
            "resized": False,
            "croppedFurther": False,
        },
        "centredA1LayoutOffset": {
            "xMm": offset_x_mm,
            "yMm": offset_y_mm,
        },
        "tracker": {
            "socketRadiusMm": EXPANDED_TRACKER_RADIUS_MM,
            "centerYmm": tracker_center_y_mm,
            "roundNumberSizeMm": EXPANDED_TRACKER_NUMBER_SIZE_MM,
            "seasonMarkerSizeMm": EXPANDED_SEASON_MARKER_SIZE_MM,
        },
        "warehouses": {
            "outerInsetMm": EXPANDED_WAREHOUSE_X_MM,
            "widthMm": EXPANDED_WAREHOUSE_WIDTH_MM,
            "bandCenterMm": EXPANDED_WAREHOUSE_BAND_CENTER_MM,
            "centredBetweenStitchLines": True,
            "labelSizeMm": EXPANDED_WAREHOUSE_LABEL_SIZE_MM,
        },
        "title": {
            "mainSizeMm": EXPANDED_TITLE_SIZE_MM,
            "subtitleSizeMm": EXPANDED_SUBTITLE_SIZE_MM,
        },
    }
    MANIFEST_PATH.write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {PREVIEW_PATH}")
    print(f"Wrote {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
