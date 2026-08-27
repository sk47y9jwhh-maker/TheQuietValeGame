#!/usr/bin/env python3
"""Generate the refined handmade A1 neoprene board."""

from __future__ import annotations

import json
import random
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import (
    Image,
    ImageChops,
    ImageDraw,
    ImageEnhance,
    ImageFilter,
    ImageFont,
    ImageOps,
)
from pypdf import PdfReader
from reportlab.lib.colors import Color, HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

import generate_a1_board_study as study


ROOT = Path(__file__).resolve().parents[2]
SKIN_PATH = ROOT / "design/a1-board/assets/handmade-border-source-v2.png"
TITLELESS_REPAIR_PATH = (
    ROOT
    / "design/a1-board/assets/handmade-border-titleless-repair-v1.png"
)
BUTTON_REFERENCE_PATH = (
    ROOT
    / "design/a1-board/assets/in-context-sewn-leather-button-v2-source.png"
)
BUTTON_REFERENCE_PROMPT_PATH = (
    ROOT
    / "design/a1-board/assets/in-context-sewn-leather-button-v2-prompt.txt"
)
SHADOWLESS_CORNER_PATH = (
    ROOT / "design/a1-board/assets/shadowless-brass-corner-v1.png"
)
SHADOWLESS_CORNER_SOURCE_PATH = (
    ROOT / "design/a1-board/assets/shadowless-brass-corner-v1-source.png"
)
SHADOWLESS_CORNER_PROMPT_PATH = (
    ROOT / "design/a1-board/assets/shadowless-brass-corner-v1-prompt.txt"
)
PROMPT_PATH = (
    ROOT
    / "design/a1-board/assets/handmade-border-source-v2-prompt.txt"
)
FONT_DIR = ROOT / "src/assets/fonts"
DISPLAY_FONT_PATH = FONT_DIR / "almendra-latin-regular.woff2"
LABEL_FONT_PATH = FONT_DIR / "alegreya-sans-latin-medium.woff2"
OUTPUT_DIR = ROOT / "output/pdf"
PDF_PATH = OUTPUT_DIR / "the-quiet-vale-a1-board-handmade-neoprene.pdf"
MANIFEST_PATH = OUTPUT_DIR / "the-quiet-vale-a1-board-handmade-neoprene.json"
PRINT_INSTRUCTIONS_PATH = (
    OUTPUT_DIR
    / "the-quiet-vale-a1-board-handmade-neoprene-print-instructions.txt"
)

# Six pixels per millimetre is 152.4 ppi: a practical large-format target for
# dye-sublimated neoprene that preserves the fine leather grain and stitching
# without needlessly enlarging the commissioned map artwork.
SKIN_PX_PER_MM = 8
SKIN_WIDTH_PX = round(study.A1_WIDTH_MM * SKIN_PX_PER_MM)
SKIN_HEIGHT_PX = round(study.A1_HEIGHT_MM * SKIN_PX_PER_MM)
TEXT_RENDER_SCALE = 8
RESOURCE_TEXT_RENDER_SCALE = 14
MATERIAL_TEXT_SOFTEN_PX = 0.18
SEWN_BUTTON_SOFTEN_PX = 0.10

PARCHMENT = HexColor("#dfd3ad")
PARCHMENT_DARK = HexColor("#8f805c")
INK_SHADOW = Color(0.035, 0.030, 0.022, alpha=0.62)
BRASS = HexColor("#a47d3d")
BRASS_DARK = HexColor("#5c4523")

# Socket centres in the selected material source are retained only as twelve
# distinct texture references. The final layout is rebuilt across the exact map
# width with wider intervals between the three four-round seasons.
TRACKER_REFERENCE_SOCKET_CENTRES_PX = [
    375,
    441,
    506,
    571,
    651,
    714,
    776,
    839,
    919,
    982,
    1044,
    1108,
]
TRACKER_REFERENCE_SOCKET_Y_PX = 1013.5
TRACKER_TARGET_SOCKET_Y_PX = TRACKER_REFERENCE_SOCKET_Y_PX
TRACKER_SOURCE_PANEL_CROP = (296, 966, 1180, 1054)
TRACKER_SOCKET_CROP_RADIUS_PX = 28
TRACKER_REFERENCE_RIVET_CENTRES_PX = [(327, 1014), (1155, 1014)]
TRACKER_RIVET_CROP_RADIUS_PX = 18
TRACKER_RIVET_INSET_MM = 16.0
TRACKER_ROUND_SPACING_MM = 42.5
TRACKER_SEASON_BREAK_MM = 84.5
TRACKER_SEASON_MARKER_OFFSET_MM = 22.0

RESOURCE_LABEL_Y_PX = [125, 414, 704]
LEFT_RESOURCE_LABEL_X_PX = 83
RIGHT_RESOURCE_LABEL_X_PX = 1410
LEFT_RESOURCE_BUTTON_X_PX = 44
RIGHT_RESOURCE_BUTTON_X_PX = 1448
RESOURCE_ROW_DOWN_MM = 2.0
BUTTON_PATCH_MM = 14.2
BUTTON_VISIBLE_DIAMETER_MM = 9.5
BUTTON_REFERENCE_CROP = (170, 618, 303, 751)
BUTTON_POSITIONS = {
    "WOOD": ("left", 0),
    "STONE": ("left", 1),
    "METAL": ("left", 2),
    "FOOD": ("right", 0),
    "HERBS": ("right", 1),
    "GOODS": ("right", 2),
}
BUTTON_DYE_COLOURS = {
    "WOOD": (82, 109, 76),
    "STONE": (104, 114, 118),
    "METAL": (83, 98, 106),
    "FOOD": (181, 154, 77),
    "HERBS": (111, 96, 132),
    "GOODS": (138, 87, 60),
}

# The replacement fitting is a genuinely isolated top-down material asset:
# its alpha ends at the brass silhouette and contains no cast/contact shadow.
# The master is the top-left orientation (arms extend right and down). These
# dimensions match the physical size of the original fitting while preserving
# the new master’s native aspect ratio, keeping every rivet circular.
CORNER_FITTING_WIDTH_MM = 27.65
CORNER_FITTING_HEIGHT_MM = 30.00
CORNER_MAP_ANCHOR_X_FRACTION = 0.17
CORNER_MAP_ANCHOR_Y_FRACTION = 0.05

# Regions are measured from the handmade source artwork. The warehouse title
# plates are removed from the base skin, while the four map-corner fittings
# are extracted as independent top-layer pieces.
WAREHOUSE_PLAQUE_EDITS = [
    {
        "destination": (0, 40, 165, 116),
        "fill": (0, 45, 160, 111),
        "sample": (215, 15, 380, 75),
        "edge": "left",
    },
    {
        "destination": (1327, 40, 1492, 116),
        "fill": (1332, 45, 1492, 111),
        "sample": (1107, 15, 1272, 75),
        "edge": "right",
    },
]

TOP_WAREHOUSE_RIM_STRIPS = [
    (14, 99, 153, 130),
    (1339, 99, 1478, 130),
]

TITLE_PLATE_BACKGROUND_DESTINATION = (550, 0, 942, 82)
TITLE_PLATE_CROP = (568, 3, 926, 75)
TITLE_PLATE_CORE = (576, 7, 918, 70)
TITLE_PLATE_SCALE = 0.74
TITLE_PLATE_REFERENCE_Y_PX = 8
TITLE_PLATE_TARGET_Y_PX = 15
TITLE_BASELINE_Y_MM = 571.8
TITLE_SUBTITLE_BASELINE_Y_MM = 563.2

CORNER_HARDWARE = [
    {
        "crop": (147, 67, 212, 136),
        "parts": [(154, 75, 203, 100), (154, 75, 179, 121)],
        "rivet": (169, 89),
    },
    {
        "crop": (1281, 67, 1346, 136),
        "parts": [(1289, 75, 1338, 100), (1313, 75, 1338, 121)],
        "rivet": (1324, 89),
    },
    {
        "crop": (147, 919, 212, 986),
        "parts": [(154, 954, 203, 979), (154, 933, 179, 979)],
        "rivet": (168, 970),
    },
    {
        "crop": (1281, 919, 1346, 986),
        "parts": [(1288, 954, 1337, 979), (1312, 933, 1337, 979)],
        "rivet": (1324, 970),
    },
]

MAP_STITCH_SEGMENTS = [
    {
        "crop": (210, 69, 1282, 83),
        "axis": "horizontal",
        "minimum": 4,
        "maximum": 11,
        "xAdjustMm": 0.0,
        "yAdjustMm": 1.1,
    },
    {
        "crop": (210, 971, 1282, 983),
        "axis": "horizontal",
        "minimum": 3,
        "maximum": 9,
        "xAdjustMm": 0.0,
        "yAdjustMm": -0.9,
    },
    {
        "crop": (155, 130, 164, 920),
        "axis": "vertical",
        "minimum": 4,
        "maximum": 5,
        "xAdjustMm": 0.1,
        "yAdjustMm": 0.0,
    },
    {
        "crop": (1328, 130, 1337, 920),
        "axis": "vertical",
        "minimum": 6,
        "maximum": 7,
        "xAdjustMm": -1.2,
        "yAdjustMm": 0.0,
    },
]


def source_x_to_mm(value_px: float, source_width_px: int) -> float:
    return value_px / source_width_px * study.A1_WIDTH_MM


def source_y_to_pdf_mm(value_px: float, source_height_px: int) -> float:
    return (source_height_px - value_px) / source_height_px * study.A1_HEIGHT_MM


def title_plate_shift_mm(source_height_px: int) -> float:
    return (
        (TITLE_PLATE_TARGET_Y_PX - TITLE_PLATE_REFERENCE_Y_PX)
        / source_height_px
        * study.A1_HEIGHT_MM
    )


def round_tracker_centers_mm() -> list[float]:
    """Return three groups of four rounds centred across the map width."""

    intervals = [
        TRACKER_ROUND_SPACING_MM,
        TRACKER_ROUND_SPACING_MM,
        TRACKER_ROUND_SPACING_MM,
        TRACKER_SEASON_BREAK_MM,
        TRACKER_ROUND_SPACING_MM,
        TRACKER_ROUND_SPACING_MM,
        TRACKER_ROUND_SPACING_MM,
        TRACKER_SEASON_BREAK_MM,
        TRACKER_ROUND_SPACING_MM,
        TRACKER_ROUND_SPACING_MM,
        TRACKER_ROUND_SPACING_MM,
    ]
    occupied_width = sum(intervals)
    first_center = (
        study.MAP_X_MM
        + (study.PLACED_MAP_WIDTH_MM - occupied_width) / 2
    )
    centers = [first_center]
    for interval in intervals:
        centers.append(centers[-1] + interval)
    return centers


def reduce_title_plate(
    source: Image.Image,
    titleless_repair: Image.Image,
) -> Image.Image:
    """Replace the oversized title plate with a smaller, cleanly blended one."""

    cleaned = source.copy()
    destination = TITLE_PLATE_BACKGROUND_DESTINATION
    x0, y0, x1, y1 = destination
    patch_width = x1 - x0
    patch_height = y1 - y0
    leather_patch = titleless_repair.crop(destination)

    # A narrow feather keeps the source lighting and surface grain continuous
    # at the edit boundary. The repaired asset supplies genuine irregular
    # leather rather than a mirrored or radially stretched texture.
    feather_x = np.minimum(
        np.arange(patch_width, dtype=np.float32) + 1.0,
        np.arange(patch_width, 0, -1, dtype=np.float32),
    )
    feather_x = np.clip(feather_x / 7.0, 0.0, 1.0)
    feather_y = np.ones(patch_height, dtype=np.float32)
    feather_y[-7:] = np.linspace(1.0, 0.0, 7, dtype=np.float32)
    patch_alpha = np.minimum(
        feather_y[:, None],
        feather_x[None, :],
    )
    patch_mask = Image.fromarray(
        np.rint(patch_alpha * 255.0).astype(np.uint8),
        mode="L",
    )
    cleaned.paste(
        leather_patch,
        (x0, y0),
        patch_mask,
    )

    plate_crop = source.crop(TITLE_PLATE_CROP)
    crop_x0, crop_y0, crop_x1, crop_y1 = TITLE_PLATE_CROP
    core_x0, core_y0, core_x1, core_y1 = TITLE_PLATE_CORE
    plate_mask = Image.new("L", plate_crop.size, 0)
    ImageDraw.Draw(plate_mask).rounded_rectangle(
        (
            core_x0 - crop_x0,
            core_y0 - crop_y0,
            core_x1 - crop_x0,
            core_y1 - crop_y0,
        ),
        radius=13,
        fill=255,
    )
    plate_mask = plate_mask.filter(ImageFilter.GaussianBlur(0.65))

    target_size = (
        round(plate_crop.width * TITLE_PLATE_SCALE),
        round(plate_crop.height * TITLE_PLATE_SCALE),
    )
    plate_crop = plate_crop.resize(target_size, Image.Resampling.LANCZOS)
    plate_mask = plate_mask.resize(target_size, Image.Resampling.LANCZOS)
    target_x = round((source.width - target_size[0]) / 2)
    target_y = TITLE_PLATE_TARGET_Y_PX

    shadow_mask = plate_mask.filter(ImageFilter.GaussianBlur(3.0))
    shadow_mask = shadow_mask.point(lambda value: round(value * 0.55))
    cleaned.paste(
        (7, 6, 4),
        (
            target_x + 2,
            target_y + 3,
            target_x + 2 + target_size[0],
            target_y + 3 + target_size[1],
        ),
        shadow_mask,
    )
    cleaned.paste(
        plate_crop,
        (target_x, target_y),
        plate_mask,
    )
    return cleaned


def remove_warehouse_title_plaques(source: Image.Image) -> Image.Image:
    """Replace both redundant title plates with matching black leather."""

    cleaned = source.copy()
    source_width, _ = source.size
    for edit in WAREHOUSE_PLAQUE_EDITS:
        x0, y0, x1, y1 = edit["destination"]
        patch = source.crop(edit["sample"]).resize(
            (x1 - x0, y1 - y0),
            Image.Resampling.BICUBIC,
        )

        core_mask = Image.new("L", source.size, 0)
        drawing = ImageDraw.Draw(core_mask)
        drawing.rounded_rectangle(
            edit["fill"],
            radius=14,
            fill=255,
        )
        soft_mask = core_mask.filter(ImageFilter.GaussianBlur(6.0))
        full_mask = ImageChops.lighter(
            core_mask,
            soft_mask.point(lambda value: round(value * 0.72)),
        )
        cleaned.paste(
            patch,
            (x0, y0),
            full_mask.crop(edit["destination"]),
        )

        # Restore the uninterrupted outer stitched edge using a clean section
        # from lower on the same side of the source material.
        if edit["edge"] == "left":
            strip_box = (0, 120, 13, 196)
            strip_x = 0
        else:
            strip_box = (source_width - 13, 120, source_width, 196)
            strip_x = source_width - 13
        strip = source.crop(strip_box).resize(
            (13, y1 - y0),
            Image.Resampling.BICUBIC,
        )
        cleaned.paste(strip, (strip_x, y0))

    # The leather replacement overlaps the upper rim of the first resource
    # well on each side. Restore those original stitched sections after the
    # title plates are gone so Wood and Food match the four lower wells.
    for strip_box in TOP_WAREHOUSE_RIM_STRIPS:
        cleaned.paste(source.crop(strip_box), strip_box[:2])
    return cleaned


def rebuild_round_tracker_raised_legacy(source: Image.Image) -> Image.Image:
    """Extend the real-material tracker across the map and regroup its sockets."""

    source_width, source_height = source.size
    panel_x0, panel_y0, panel_x1, panel_y1 = TRACKER_SOURCE_PANEL_CROP
    target_x0 = round(
        study.MAP_X_MM / study.A1_WIDTH_MM * source_width
    )
    target_x1 = round(
        study.MAP_RIGHT_MM / study.A1_WIDTH_MM * source_width
    )
    target_width = target_x1 - target_x0
    panel_height = panel_y1 - panel_y0

    # Stretch only the broad mounting frame. Its old holes and dividers are
    # covered with genuine warehouse leather before the undistorted sockets
    # are reinstated at their new physical centres.
    panel = source.crop(TRACKER_SOURCE_PANEL_CROP).resize(
        (target_width, panel_height),
        Image.Resampling.LANCZOS,
    )

    inner_left = 50
    inner_top = 10
    inner_right = target_width - 50
    inner_bottom = panel_height - 7
    inner_width = inner_right - inner_left
    inner_height = inner_bottom - inner_top

    leather_sample = source.crop((37, 145, 134, 355)).transpose(
        Image.Transpose.ROTATE_90
    )
    leather_sample = leather_sample.resize(
        (
            round(leather_sample.width * inner_height / leather_sample.height),
            inner_height,
        ),
        Image.Resampling.LANCZOS,
    )
    leather_fill = Image.new("RGB", (inner_width, inner_height))
    tile_x = 0
    tile_index = 0
    overlap = 16
    while tile_x < inner_width:
        tile = leather_sample
        if tile_index % 2:
            tile = ImageOps.mirror(tile)
        if tile_index % 4 >= 2:
            tile = ImageOps.flip(tile)
        if tile_x == 0:
            leather_fill.paste(tile, (tile_x, 0))
        else:
            blend_values = np.full(
                (tile.height, tile.width),
                255,
                dtype=np.uint8,
            )
            blend_values[:, :overlap] = np.linspace(
                0,
                255,
                overlap,
                dtype=np.uint8,
            )[None, :]
            blend_mask = Image.fromarray(blend_values, mode="L")
            leather_fill.paste(tile, (tile_x, 0), blend_mask)
        tile_x += tile.width - overlap
        tile_index += 1

    # A restrained vertical falloff keeps the recess consistent with the deep
    # warehouse wells and hides tile transitions beneath the later print grain.
    leather_fill = leather_fill.crop((0, 0, inner_width, inner_height))
    leather_values = np.asarray(leather_fill, dtype=np.float32)
    vertical = np.linspace(0.91, 1.02, inner_height, dtype=np.float32)
    vertical = np.minimum(vertical, vertical[::-1] + 0.035)
    leather_values *= vertical[:, None, None]
    leather_fill = Image.fromarray(
        np.rint(np.clip(leather_values, 0.0, 255.0)).astype(np.uint8),
        mode="RGB",
    )
    leather_mask = Image.new("L", leather_fill.size, 0)
    ImageDraw.Draw(leather_mask).rounded_rectangle(
        (0, 0, inner_width - 1, inner_height - 1),
        radius=5,
        fill=255,
    )
    leather_mask = leather_mask.filter(ImageFilter.GaussianBlur(1.2))
    panel.paste(
        leather_fill,
        (inner_left, inner_top),
        leather_mask,
    )

    def tiled_stitch_strip(
        crop_box: tuple[int, int, int, int],
        width: int,
    ) -> Image.Image:
        sample = source.crop(crop_box)
        strip = Image.new("RGB", (width, sample.height))
        cursor = 0
        index = 0
        while cursor < width:
            segment = sample if index % 2 == 0 else ImageOps.mirror(sample)
            strip.paste(segment, (cursor, 0))
            cursor += segment.width
            index += 1
        return strip.crop((0, 0, width, sample.height))

    stitch_width = target_width - 96
    top_stitch = tiled_stitch_strip((330, 975, 570, 986), stitch_width)
    bottom_stitch = tiled_stitch_strip((330, 1039, 570, 1050), stitch_width)
    panel.paste(top_stitch, (48, 9))
    panel.paste(bottom_stitch, (48, panel_height - 15))

    # The frame itself was widened, but its end rivets must remain circular.
    # Feather away the two stretched fittings, then restore undistorted crops
    # from the source at equal physical insets from the map edges.
    cover_width = 46
    cover_height = 36
    rivet_cover = panel.crop(
        (72, 29, 72 + cover_width, 29 + cover_height)
    )
    rivet_cover_mask = Image.new("L", (cover_width, cover_height), 0)
    ImageDraw.Draw(rivet_cover_mask).ellipse(
        (1, 1, cover_width - 2, cover_height - 2),
        fill=255,
    )
    rivet_cover_mask = rivet_cover_mask.filter(
        ImageFilter.GaussianBlur(2.0)
    )
    horizontal_scale = target_width / (panel_x1 - panel_x0)
    for reference_x, reference_y in TRACKER_REFERENCE_RIVET_CENTRES_PX:
        stretched_x = round((reference_x - panel_x0) * horizontal_scale)
        stretched_y = reference_y - panel_y0
        panel.paste(
            rivet_cover,
            (
                stretched_x - cover_width // 2,
                stretched_y - cover_height // 2,
            ),
            rivet_cover_mask,
        )

    rivet_radius = TRACKER_RIVET_CROP_RADIUS_PX
    rivet_size = rivet_radius * 2
    rivet_coordinates = np.arange(rivet_size, dtype=np.float32)
    rivet_axis = rivet_coordinates - (rivet_size - 1) / 2.0
    rivet_xx, rivet_yy = np.meshgrid(rivet_axis, rivet_axis)
    rivet_distance = np.sqrt(rivet_xx * rivet_xx + rivet_yy * rivet_yy)
    rivet_alpha = np.clip((16.5 - rivet_distance) / 2.0, 0.0, 1.0)
    rivet_alpha_image = Image.fromarray(
        np.rint(rivet_alpha * 255.0).astype(np.uint8),
        mode="L",
    )
    rivet_target_centers_mm = [
        study.MAP_X_MM + TRACKER_RIVET_INSET_MM,
        study.MAP_RIGHT_MM - TRACKER_RIVET_INSET_MM,
    ]
    for (
        (reference_x, reference_y),
        target_center_mm,
    ) in zip(
        TRACKER_REFERENCE_RIVET_CENTRES_PX,
        rivet_target_centers_mm,
    ):
        rivet = source.crop(
            (
                reference_x - rivet_radius,
                reference_y - rivet_radius,
                reference_x + rivet_radius,
                reference_y + rivet_radius,
            )
        ).convert("RGBA")
        rivet.putalpha(rivet_alpha_image)
        target_center_px = round(
            target_center_mm / study.A1_WIDTH_MM * source_width
        )
        panel.paste(
            rivet,
            (
                target_center_px - target_x0 - rivet_radius,
                reference_y - panel_y0 - rivet_radius,
            ),
            rivet,
        )

    source_socket_y = round(TRACKER_REFERENCE_SOCKET_Y_PX)
    target_socket_y = round(TRACKER_TARGET_SOCKET_Y_PX)
    crop_radius = TRACKER_SOCKET_CROP_RADIUS_PX
    sprite_size = crop_radius * 2
    coordinates = np.arange(sprite_size, dtype=np.float32)
    axis = coordinates - (sprite_size - 1) / 2.0
    xx, yy = np.meshgrid(axis, axis)
    distance = np.sqrt(xx * xx + yy * yy)
    socket_alpha = np.clip((27.0 - distance) / 2.2, 0.0, 1.0)
    socket_alpha_image = Image.fromarray(
        np.rint(socket_alpha * 255.0).astype(np.uint8),
        mode="L",
    )

    target_centers_mm = round_tracker_centers_mm()
    for reference_x, target_center_mm in zip(
        TRACKER_REFERENCE_SOCKET_CENTRES_PX,
        target_centers_mm,
    ):
        socket = source.crop(
            (
                reference_x - crop_radius,
                source_socket_y - crop_radius,
                reference_x + crop_radius,
                source_socket_y + crop_radius,
            )
        ).convert("RGBA")
        socket.putalpha(socket_alpha_image)
        target_center_px = round(
            target_center_mm / study.A1_WIDTH_MM * source_width
        )
        panel.paste(
            socket,
            (
                target_center_px - target_x0 - crop_radius,
                target_socket_y - panel_y0 - crop_radius,
            ),
            socket,
        )

    rebuilt = source.copy()
    rebuilt.paste(panel.convert("RGB"), (target_x0, panel_y0))
    return rebuilt


def build_tiled_material(
    sample: Image.Image,
    width: int,
    height: int,
    overlap: int = 14,
) -> Image.Image:
    """Tile a real material sample with mirrored, feathered joins."""

    scale = height / sample.height
    tile = sample.resize(
        (max(overlap + 2, round(sample.width * scale)), height),
        Image.Resampling.LANCZOS,
    )
    material = Image.new("RGB", (width, height))
    cursor = 0
    index = 0
    while cursor < width:
        segment = tile if index % 2 == 0 else ImageOps.mirror(tile)
        if index % 4 >= 2:
            segment = ImageOps.flip(segment)
        if cursor == 0:
            material.paste(segment, (0, 0))
        else:
            blend = np.full(
                (height, segment.width),
                255,
                dtype=np.uint8,
            )
            blend[:, :overlap] = np.linspace(
                0,
                255,
                overlap,
                dtype=np.uint8,
            )[None, :]
            material.paste(
                segment,
                (cursor, 0),
                Image.fromarray(blend, mode="L"),
            )
        cursor += segment.width - overlap
        index += 1
    return material.crop((0, 0, width, height))


def rebuild_round_tracker(source: Image.Image) -> Image.Image:
    """Cut one warehouse-style tracker recess into the base leather."""

    source_width, source_height = source.size
    _, panel_y0, _, panel_y1 = TRACKER_SOURCE_PANEL_CROP
    target_x0 = round(
        study.MAP_X_MM / study.A1_WIDTH_MM * source_width
    )
    target_x1 = round(
        study.MAP_RIGHT_MM / study.A1_WIDTH_MM * source_width
    )
    target_width = target_x1 - target_x0
    panel_height = panel_y1 - panel_y0

    # Remove the inherited raised tracker plate completely. This sample is
    # continuous outer-border leather from below the left warehouse; tiling it
    # restores a single base surface, including the board's lower edge grain.
    base_sample = source.crop((19, panel_y0, 143, panel_y1))
    base_patch = build_tiled_material(
        base_sample,
        target_width,
        panel_height,
        overlap=18,
    )
    edge_mask_values = np.full(
        (panel_height, target_width),
        255,
        dtype=np.uint8,
    )
    feather = 9
    edge_mask_values[:, :feather] = np.minimum(
        edge_mask_values[:, :feather],
        np.linspace(0, 255, feather, dtype=np.uint8)[None, :],
    )
    edge_mask_values[:, -feather:] = np.minimum(
        edge_mask_values[:, -feather:],
        np.linspace(255, 0, feather, dtype=np.uint8)[None, :],
    )
    edge_mask_values[:feather, :] = np.minimum(
        edge_mask_values[:feather, :],
        np.linspace(0, 255, feather, dtype=np.uint8)[:, None],
    )
    rebuilt = source.copy()
    rebuilt.paste(
        base_patch,
        (target_x0, panel_y0),
        Image.fromarray(edge_mask_values, mode="L"),
    )

    # The tracker is a depression in that continuous leather, not a second
    # mounted strip. Its dimensions leave the source outer-edge stitching clear.
    recess_x0 = target_x0 + 12
    recess_x1 = target_x1 - 12
    recess_y0 = panel_y0 + 9
    recess_y1 = panel_y1 - 13
    recess_width = recess_x1 - recess_x0
    recess_height = recess_y1 - recess_y0
    well_sample = source.crop((37, 145, 134, 355)).transpose(
        Image.Transpose.ROTATE_90
    )
    well_fill = build_tiled_material(
        well_sample,
        recess_width,
        recess_height,
        overlap=16,
    )
    well_values = np.asarray(well_fill, dtype=np.float32)
    vertical = np.linspace(
        0.91,
        1.00,
        recess_height,
        dtype=np.float32,
    )
    vertical = np.minimum(vertical, vertical[::-1] + 0.025)
    well_values *= vertical[:, None, None]
    well_fill = Image.fromarray(
        np.rint(np.clip(well_values, 0.0, 255.0)).astype(np.uint8),
        mode="RGB",
    )

    recess_mask = Image.new("L", (recess_width, recess_height), 0)
    ImageDraw.Draw(recess_mask).rounded_rectangle(
        (0, 0, recess_width - 1, recess_height - 1),
        radius=14,
        fill=255,
    )
    recess_mask = recess_mask.filter(ImageFilter.GaussianBlur(0.75))
    rebuilt.paste(
        well_fill,
        (recess_x0, recess_y0),
        recess_mask,
    )

    # A bevel is drawn inside the cut edge only. Nothing projects beyond the
    # base surface, so there is no plate shadow beneath the tracker.
    bevel = Image.new("RGBA", source.size, (0, 0, 0, 0))
    bevel_draw = ImageDraw.Draw(bevel)
    bevel_draw.rounded_rectangle(
        (recess_x0, recess_y0, recess_x1 - 1, recess_y1 - 1),
        radius=14,
        outline=(13, 12, 10, 175),
        width=1,
    )
    bevel_draw.rounded_rectangle(
        (
            recess_x0 + 3,
            recess_y0 + 3,
            recess_x1 - 4,
            recess_y1 - 4,
        ),
        radius=11,
        outline=(68, 60, 49, 95),
        width=1,
    )

    # Match the warehouse wells with waxed-linen stitching seated inside the
    # recess lip. Small deterministic variation avoids a digital dash pattern.
    stitch_rng = random.Random(91173)
    stitch_colour = (171, 119, 73, 220)
    stitch_highlight = (214, 159, 99, 120)
    inset = 7
    dash = 7
    gap = 6
    for y_position in (
        recess_y0 + inset,
        recess_y1 - inset - 1,
    ):
        cursor = recess_x0 + 17
        while cursor < recess_x1 - 17:
            length = dash + stitch_rng.randint(-1, 1)
            wobble = stitch_rng.choice((-1, 0, 0, 0, 1))
            bevel_draw.line(
                (
                    cursor,
                    y_position + wobble,
                    min(cursor + length, recess_x1 - 17),
                    y_position + wobble,
                ),
                fill=stitch_colour,
                width=2,
            )
            bevel_draw.line(
                (
                    cursor,
                    y_position + wobble - 1,
                    min(cursor + length, recess_x1 - 17),
                    y_position + wobble - 1,
                ),
                fill=stitch_highlight,
                width=1,
            )
            cursor += length + gap + stitch_rng.randint(-1, 1)
    for x_position in (
        recess_x0 + inset,
        recess_x1 - inset - 1,
    ):
        cursor = recess_y0 + 16
        while cursor < recess_y1 - 16:
            length = 6 + stitch_rng.randint(-1, 1)
            wobble = stitch_rng.choice((-1, 0, 0, 1))
            bevel_draw.line(
                (
                    x_position + wobble,
                    cursor,
                    x_position + wobble,
                    min(cursor + length, recess_y1 - 16),
                ),
                fill=stitch_colour,
                width=2,
            )
            cursor += length + 6
    rebuilt = Image.alpha_composite(
        rebuilt.convert("RGBA"),
        bevel,
    ).convert("RGB")

    # Reuse only the twelve physical sockets from the source. End rivets and
    # every part of the old mounting plate are deliberately omitted.
    source_socket_y = round(TRACKER_REFERENCE_SOCKET_Y_PX)
    target_socket_y = round(TRACKER_TARGET_SOCKET_Y_PX)
    crop_radius = TRACKER_SOCKET_CROP_RADIUS_PX
    sprite_size = crop_radius * 2
    coordinates = np.arange(sprite_size, dtype=np.float32)
    axis = coordinates - (sprite_size - 1) / 2.0
    xx, yy = np.meshgrid(axis, axis)
    distance = np.sqrt(xx * xx + yy * yy)
    socket_alpha = np.clip((27.0 - distance) / 2.2, 0.0, 1.0)
    socket_alpha_image = Image.fromarray(
        np.rint(socket_alpha * 255.0).astype(np.uint8),
        mode="L",
    )
    for reference_x, target_center_mm in zip(
        TRACKER_REFERENCE_SOCKET_CENTRES_PX,
        round_tracker_centers_mm(),
    ):
        socket = source.crop(
            (
                reference_x - crop_radius,
                source_socket_y - crop_radius,
                reference_x + crop_radius,
                source_socket_y + crop_radius,
            )
        ).convert("RGBA")
        socket.putalpha(socket_alpha_image)
        target_center_px = round(
            target_center_mm / study.A1_WIDTH_MM * source_width
        )
        rebuilt.paste(
            socket,
            (
                target_center_px - crop_radius,
                target_socket_y - crop_radius,
            ),
            socket,
        )
    return rebuilt


def build_corner_hardware_overlays(
    source: Image.Image,
) -> list[tuple[Image.Image, float, float, float, float]]:
    """Build four aspect-correct, shadowless map-retaining fittings."""

    del source
    with Image.open(SHADOWLESS_CORNER_PATH) as corner_source:
        master = corner_source.convert("RGBA")

    alpha_box = master.getchannel("A").getbbox()
    if alpha_box is None:
        raise RuntimeError("Shadowless corner fitting has no visible pixels")
    padding = 4
    alpha_box = (
        max(0, alpha_box[0] - padding),
        max(0, alpha_box[1] - padding),
        min(master.width, alpha_box[2] + padding),
        min(master.height, alpha_box[3] + padding),
    )
    master = master.crop(alpha_box)

    # Bring the generated brass into the same restrained, satin palette as the
    # board hardware. The alpha remains untouched: there is no outside shadow.
    alpha = master.getchannel("A")
    brass = master.convert("RGB")
    brass = ImageEnhance.Color(brass).enhance(0.58)
    brass = ImageEnhance.Brightness(brass).enhance(0.84)
    brass = ImageEnhance.Contrast(brass).enhance(0.96)
    master = brass.convert("RGBA")
    master.putalpha(alpha)

    output_size = (
        round(CORNER_FITTING_WIDTH_MM * SKIN_PX_PER_MM),
        round(CORNER_FITTING_HEIGHT_MM * SKIN_PX_PER_MM),
    )
    master = master.resize(output_size, Image.Resampling.LANCZOS)
    master = master.filter(ImageFilter.GaussianBlur(0.12))

    orientations = (
        (
            master,
            study.MAP_X_MM,
            study.MAP_TOP_MM,
            CORNER_MAP_ANCHOR_X_FRACTION,
            CORNER_MAP_ANCHOR_Y_FRACTION,
        ),
        (
            ImageOps.mirror(master),
            study.MAP_RIGHT_MM,
            study.MAP_TOP_MM,
            1.0 - CORNER_MAP_ANCHOR_X_FRACTION,
            CORNER_MAP_ANCHOR_Y_FRACTION,
        ),
        (
            ImageOps.flip(master),
            study.MAP_X_MM,
            study.MAP_Y_MM,
            CORNER_MAP_ANCHOR_X_FRACTION,
            1.0 - CORNER_MAP_ANCHOR_Y_FRACTION,
        ),
        (
            ImageOps.flip(ImageOps.mirror(master)),
            study.MAP_RIGHT_MM,
            study.MAP_Y_MM,
            1.0 - CORNER_MAP_ANCHOR_X_FRACTION,
            1.0 - CORNER_MAP_ANCHOR_Y_FRACTION,
        ),
    )

    overlays = []
    for fitting, map_x, map_y, anchor_x, anchor_y_from_top in orientations:
        x_mm = map_x - anchor_x * CORNER_FITTING_WIDTH_MM
        y_mm = (
            map_y
            - (1.0 - anchor_y_from_top) * CORNER_FITTING_HEIGHT_MM
        )
        overlays.append(
            (
                fitting,
                x_mm,
                y_mm,
                CORNER_FITTING_WIDTH_MM,
                CORNER_FITTING_HEIGHT_MM,
            )
        )
    return overlays


def build_map_stitch_overlays(
    source: Image.Image,
) -> list[tuple[Image.Image, float, float, float, float]]:
    """Lift the source's irregular threadwork above the exact map artwork."""

    source_width, source_height = source.size
    scale_x = SKIN_WIDTH_PX / source_width
    scale_y = SKIN_HEIGHT_PX / source_height
    overlays = []

    for definition in MAP_STITCH_SEGMENTS:
        x0, y0, x1, y1 = definition["crop"]
        crop = source.crop((x0, y0, x1, y1))
        pixels = np.asarray(crop, dtype=np.int16)
        red = pixels[:, :, 0]
        green = pixels[:, :, 1]
        blue = pixels[:, :, 2]
        warm_thread = (
            (red > 58)
            & ((red - green) > 2)
            & ((green - blue) > 2)
            & ((red - blue) > 14)
        )

        if definition["axis"] == "horizontal":
            rows = np.arange(crop.height)[:, None]
            warm_thread &= (
                (rows >= definition["minimum"])
                & (rows <= definition["maximum"])
            )
        else:
            columns = np.arange(crop.width)[None, :]
            warm_thread &= (
                (columns >= definition["minimum"])
                & (columns <= definition["maximum"])
            )

        mask = Image.fromarray(
            (warm_thread * 255).astype(np.uint8),
            mode="L",
        )
        mask = mask.filter(ImageFilter.GaussianBlur(0.30))
        mask = mask.point(lambda value: round(value * 0.78))

        sprite = Image.new("RGBA", crop.size, (0, 0, 0, 0))
        shadow_mask = mask.filter(ImageFilter.GaussianBlur(0.75))
        shadow_layer = Image.new("RGBA", crop.size, (6, 5, 3, 0))
        shadow_layer.putalpha(
            shadow_mask.point(lambda value: round(value * 0.20))
        )
        sprite.alpha_composite(shadow_layer)
        thread_layer = crop.convert("RGBA")
        thread_layer.putalpha(mask)
        sprite.alpha_composite(thread_layer)

        output_size = (
            max(1, round(crop.width * scale_x)),
            max(1, round(crop.height * scale_y)),
        )
        sprite = sprite.resize(output_size, Image.Resampling.LANCZOS)

        overlays.append(
            (
                sprite,
                source_x_to_mm(x0, source_width)
                + definition["xAdjustMm"],
                source_y_to_pdf_mm(y1, source_height)
                + definition["yAdjustMm"],
                (x1 - x0) / source_width * study.A1_WIDTH_MM,
                (y1 - y0) / source_height * study.A1_HEIGHT_MM,
            )
        )
    return overlays


def build_print_skin() -> tuple[
    Image.Image,
    tuple[int, int],
    list[tuple[Image.Image, float, float, float, float]],
    list[tuple[Image.Image, float, float, float, float]],
]:
    """Upscale the material pass and restore print-scale surface grain."""

    with Image.open(SKIN_PATH) as source:
        source_width, source_height = source.size
        original = source.convert("RGB")
        corner_overlays = build_corner_hardware_overlays(original)
        stitch_overlays = build_map_stitch_overlays(original)
        with Image.open(TITLELESS_REPAIR_PATH) as repair_source:
            titleless_repair = repair_source.convert("RGB")
        if titleless_repair.size != original.size:
            raise ValueError(
                "Titleless leather repair must match the handmade source size"
            )
        reduced_title = reduce_title_plate(
            original,
            titleless_repair,
        )
        cleaned = remove_warehouse_title_plaques(reduced_title)
        cleaned = rebuild_round_tracker(cleaned)
        skin = cleaned.resize(
            (SKIN_WIDTH_PX, SKIN_HEIGHT_PX),
            Image.Resampling.LANCZOS,
        )

    skin = skin.filter(
        ImageFilter.UnsharpMask(radius=1.25, percent=72, threshold=3)
    )
    skin = ImageEnhance.Contrast(skin).enhance(1.025)
    skin = composite_border_details_into_skin(
        skin,
        (source_width, source_height),
    )

    # The image-generated material establishes the large-scale physical form.
    # A restrained, deterministic high-resolution grain prevents the upscaled
    # dark leather from appearing plasticky at A1.
    rng = random.Random(402719)
    grain = Image.frombytes(
        "L",
        skin.size,
        rng.randbytes(SKIN_WIDTH_PX * SKIN_HEIGHT_PX),
    )
    grain = grain.filter(ImageFilter.GaussianBlur(0.45))
    grain = ImageEnhance.Contrast(grain).enhance(0.46)
    grain_rgb = ImageOps.colorize(
        grain,
        black=(101, 98, 89),
        white=(154, 148, 131),
    )
    textured = ImageChops.soft_light(skin, grain_rgb)
    skin = Image.blend(skin, textured, 0.13)
    return (
        skin,
        (source_width, source_height),
        corner_overlays,
        stitch_overlays,
    )


def blend_map_surround(cropped: Image.Image) -> Image.Image:
    """Blend only the connected cream surround into the map's terrain palette.

    The map artwork and its 60 mm hex geometry stay untouched. The mask begins
    at the crop edge and can only travel through pixels close to the original
    cream paper colour, so pale rivers and interior terrain are protected.
    """

    source = np.asarray(cropped, dtype=np.uint8)
    source_float = source.astype(np.float32)
    edge_pixels = np.concatenate(
        (
            source[:24].reshape(-1, 3),
            source[-24:].reshape(-1, 3),
            source[:, :24].reshape(-1, 3),
            source[:, -24:].reshape(-1, 3),
        )
    )
    original_cream = np.median(edge_pixels, axis=0)
    colour_distance = np.linalg.norm(
        source_float - original_cream,
        axis=2,
    )
    chroma = source.max(axis=2) - source.min(axis=2)
    cream_candidate = (colour_distance < 18.0) & (chroma < 45)

    candidate_image = Image.fromarray(
        (cream_candidate * 255).astype(np.uint8),
        mode="L",
    ).copy()
    ImageDraw.floodfill(
        candidate_image,
        (0, 0),
        128,
        thresh=0,
    )
    connected_cream = np.asarray(candidate_image) == 128
    feathered_mask = Image.fromarray(
        (connected_cream * 255).astype(np.uint8),
        mode="L",
    ).filter(ImageFilter.GaussianBlur(7.0))

    # The replacement tone comes from the dominant parchment-like ground in
    # the illustrated map, with very restrained low-frequency variation so the
    # large surround does not print as a flat digital fill on neoprene.
    height, width = source.shape[:2]
    rng = np.random.default_rng(740021)
    coarse_noise = rng.normal(
        128.0,
        26.0,
        (max(40, height // 20), max(52, width // 20)),
    )
    coarse_image = Image.fromarray(
        np.clip(coarse_noise, 0, 255).astype(np.uint8),
        mode="L",
    ).resize((width, height), Image.Resampling.BICUBIC)
    coarse_image = coarse_image.filter(ImageFilter.GaussianBlur(4.0))
    tone = (np.asarray(coarse_image, dtype=np.float32) - 128.0) * 0.18

    parchment = np.empty_like(source_float)
    parchment[:, :, 0] = 204.0 + tone
    parchment[:, :, 1] = 197.0 + tone * 0.84
    parchment[:, :, 2] = 166.0 + tone * 0.52
    parchment = np.clip(parchment, 0, 255).astype(np.uint8)
    parchment_image = Image.fromarray(parchment, mode="RGB")

    return Image.composite(parchment_image, cropped, feathered_mask)


def apply_painted_linen_finish(map_image: Image.Image) -> Image.Image:
    """Give the commissioned artwork one restrained physical linen surface.

    The pass changes neither pixel dimensions nor geometry. It adds only a
    matte tonal grade, sub-visible woven fibre and a shallow compressed edge
    where the cloth panel meets the leather mounting.
    """

    graded = ImageEnhance.Color(map_image).enhance(0.965)
    graded = ImageEnhance.Contrast(graded).enhance(0.985)
    values = np.asarray(graded, dtype=np.float32)
    height, width = values.shape[:2]
    rng = np.random.default_rng(883041)

    column_fibres = rng.normal(0.0, 0.58, width)
    column_fibres = (
        np.roll(column_fibres, -1)
        + column_fibres * 2.0
        + np.roll(column_fibres, 1)
    ) / 4.0
    row_fibres = rng.normal(0.0, 0.58, height)
    row_fibres = (
        np.roll(row_fibres, -1)
        + row_fibres * 2.0
        + np.roll(row_fibres, 1)
    ) / 4.0
    fibre_values = (
        column_fibres[None, :]
        + row_fibres[:, None]
    )
    coordinates_x = np.arange(width, dtype=np.float32)[None, :]
    coordinates_y = np.arange(height, dtype=np.float32)[:, None]
    woven_crossing = (
        np.sin(coordinates_x * (2.0 * np.pi / 6.1))
        + np.sin(coordinates_y * (2.0 * np.pi / 6.7))
    ) * 0.19
    fine_fibre = rng.normal(0.0, 0.24, (height, width))
    weave = fibre_values + woven_crossing + fine_fibre

    luminance = (
        values[:, :, 0] * 0.2126
        + values[:, :, 1] * 0.7152
        + values[:, :, 2] * 0.0722
    )
    weave_visibility = 0.34 + luminance / 255.0 * 0.66
    values += weave[:, :, None] * weave_visibility[:, :, None]

    # A quiet warm matte grade reduces the sense that the map is a separate
    # bright digital panel while preserving every painted colour and ink line.
    values = (values - 128.0) * 0.992 + 128.0
    values += np.array([1.2, 0.35, -1.15], dtype=np.float32)

    edge_width = max(8, round(min(width, height) * 0.006))
    edge_distance = np.minimum.reduce(
        (
            np.broadcast_to(
                np.arange(width, dtype=np.float32)[None, :],
                (height, width),
            ),
            np.broadcast_to(
                np.arange(width - 1, -1, -1, dtype=np.float32)[None, :],
                (height, width),
            ),
            np.broadcast_to(
                np.arange(height, dtype=np.float32)[:, None],
                (height, width),
            ),
            np.broadcast_to(
                np.arange(height - 1, -1, -1, dtype=np.float32)[:, None],
                (height, width),
            ),
        )
    )
    edge_compression = np.clip(
        (edge_width - edge_distance) / edge_width,
        0.0,
        1.0,
    ) ** 2
    values *= (1.0 - edge_compression * 0.032)[:, :, None]

    return Image.fromarray(
        np.rint(np.clip(values, 0.0, 255.0)).astype(np.uint8),
        mode="RGB",
    )


def load_exact_map() -> ImageReader:
    with Image.open(study.MAP_PATH) as source:
        cropped = source.convert("RGB").crop(study.MAP_CROP_PX)
    blended = blend_map_surround(cropped)
    return ImageReader(apply_painted_linen_finish(blended))


@lru_cache(maxsize=64)
def load_art_font(path: str, size_px: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size_px)


def colour_as_rgba(colour: Color, opacity: float = 1.0) -> tuple[int, ...]:
    alpha = getattr(colour, "alpha", 1.0) * opacity
    return (
        round(colour.red * 255),
        round(colour.green * 255),
        round(colour.blue * 255),
        round(alpha * 255),
    )


def build_text_sprite(
    text: str,
    font_path: Path,
    size: float,
    colour: Color,
    tracking_pt: float,
) -> tuple[Image.Image, float, tuple[int, int, int, int]]:
    scale = TEXT_RENDER_SCALE
    size_px = max(1, round(size * scale))
    font = load_art_font(str(font_path), size_px)
    tracking_px = tracking_pt * scale

    if tracking_px > 0 and len(text) > 1:
        placements: list[tuple[str, float]] = []
        cursor = 0.0
        bounds = []
        for character in text:
            placements.append((character, cursor))
            box = font.getbbox(character, anchor="ls")
            bounds.append(
                (
                    cursor + box[0],
                    box[1],
                    cursor + box[2],
                    box[3],
                )
            )
            cursor += font.getlength(character) + tracking_px
        min_x = min(box[0] for box in bounds)
        min_y = min(box[1] for box in bounds)
        max_x = max(box[2] for box in bounds)
        max_y = max(box[3] for box in bounds)
    else:
        placements = [(text, 0.0)]
        min_x, min_y, max_x, max_y = font.getbbox(text, anchor="ls")

    padding = round(1.6 * scale)
    width_px = max(1, round(max_x - min_x + padding * 2))
    height_px = max(1, round(max_y - min_y + padding * 2))
    baseline_px = padding - min_y
    origin_x = padding - min_x

    def paint(mask: Image.Image, offset_x: float, offset_y: float) -> None:
        drawing = ImageDraw.Draw(mask)
        for characters, character_x in placements:
            drawing.text(
                (
                    origin_x + character_x + offset_x,
                    baseline_px + offset_y,
                ),
                characters,
                font=font,
                anchor="ls",
                fill=255,
            )

    sprite = Image.new("RGBA", (width_px, height_px), (0, 0, 0, 0))

    shadow_mask = Image.new("L", sprite.size, 0)
    paint(shadow_mask, 0.34 * scale, 0.38 * scale)
    shadow_mask = shadow_mask.filter(ImageFilter.GaussianBlur(0.16 * scale))
    shadow_layer = Image.new(
        "RGBA",
        sprite.size,
        colour_as_rgba(INK_SHADOW),
    )
    shadow_layer.putalpha(
        shadow_mask.point(
            lambda value: round(value * getattr(INK_SHADOW, "alpha", 1.0))
        )
    )
    sprite.alpha_composite(shadow_layer)

    # A minute upper-left highlight and a clean face suggest ink pressed into
    # leather or metal without the faux-handwriting distortion of the earlier
    # proof.
    highlight_mask = Image.new("L", sprite.size, 0)
    paint(highlight_mask, -0.10 * scale, -0.10 * scale)
    highlight_layer = Image.new(
        "RGBA",
        sprite.size,
        (235, 221, 177, 36),
    )
    highlight_layer.putalpha(highlight_mask.point(lambda value: value * 36 // 255))
    sprite.alpha_composite(highlight_layer)

    face_mask = Image.new("L", sprite.size, 0)
    paint(face_mask, 0.0, 0.0)
    face_layer = Image.new("RGBA", sprite.size, colour_as_rgba(colour))
    face_layer.putalpha(
        face_mask.point(
            lambda value: round(
                value * getattr(colour, "alpha", 1.0)
            )
        )
    )
    sprite.alpha_composite(face_layer)
    face_bounds = face_mask.getbbox()
    if face_bounds is None:
        raise ValueError(f"Text produced no visible glyphs: {text!r}")
    return sprite, baseline_px / scale, face_bounds


@lru_cache(maxsize=16)
def build_material_label_sprite(
    text: str,
    size: float,
    tracking_pt: float = 0.0,
    font_path: Path = DISPLAY_FONT_PATH,
) -> tuple[Image.Image, float, tuple[int, int, int, int]]:
    """Render legible type as worn gold pigment pressed into the leather."""

    scale = RESOURCE_TEXT_RENDER_SCALE
    size_px = max(1, round(size * scale))
    font = load_art_font(str(font_path), size_px)
    tracking_px = tracking_pt * scale

    placements: list[tuple[str, float]] = []
    cursor = 0.0
    bounds = []
    for character in text:
        placements.append((character, cursor))
        box = font.getbbox(character, anchor="ls")
        bounds.append(
            (
                cursor + box[0],
                box[1],
                cursor + box[2],
                box[3],
            )
        )
        cursor += font.getlength(character) + tracking_px
    min_x = min(box[0] for box in bounds)
    min_y = min(box[1] for box in bounds)
    max_x = max(box[2] for box in bounds)
    max_y = max(box[3] for box in bounds)

    padding = round(2.7 * scale)
    width_px = max(1, round(max_x - min_x + padding * 2))
    height_px = max(1, round(max_y - min_y + padding * 2))
    baseline_px = padding - min_y
    origin_x = padding - min_x

    face_mask = Image.new("L", (width_px, height_px), 0)
    drawing = ImageDraw.Draw(face_mask)
    for character, character_x in placements:
        drawing.text(
            (origin_x + character_x, baseline_px),
            character,
            font=font,
            anchor="ls",
            fill=255,
        )

    sprite = Image.new("RGBA", face_mask.size, (0, 0, 0, 0))

    # The shallow dark trough makes the mark feel pressed into the hide. It is
    # deliberately narrow: at print size it reads as compressed leather, not
    # as a computer-generated outline or drop shadow.
    groove_kernel = max(3, round(0.52 * scale) | 1)
    expanded = face_mask.filter(ImageFilter.MaxFilter(groove_kernel))
    groove_mask = ImageChops.subtract(
        expanded,
        face_mask.filter(ImageFilter.GaussianBlur(0.035 * scale)),
    ).filter(ImageFilter.GaussianBlur(0.055 * scale))
    groove_layer = Image.new("RGBA", sprite.size, (3, 3, 2, 0))
    groove_layer.putalpha(
        groove_mask.point(lambda value: round(value * 0.72))
    )
    sprite.alpha_composite(groove_layer)

    # A minute lower-right lip is consistent with a recessed stamp under the
    # board's upper-left light. It is kept beneath the pigment texture.
    bevel_shift = max(1, round(0.12 * scale))
    shifted_mask = Image.new("L", face_mask.size, 0)
    shifted_mask.paste(face_mask, (bevel_shift, bevel_shift))
    bevel_mask = ImageChops.subtract(shifted_mask, face_mask)
    bevel_layer = Image.new("RGBA", sprite.size, (218, 188, 120, 0))
    bevel_layer.putalpha(
        bevel_mask.point(lambda value: round(value * 0.30))
    )
    sprite.alpha_composite(bevel_layer)

    # Deterministic coarse and fine variation mimics hand-applied metallic
    # pigment: warm leaf, darker handling wear, pinholes and tiny flakes.
    seed = 91273 + sum(
        (index + 1) * ord(character)
        for index, character in enumerate(text)
    )
    rng = np.random.default_rng(seed)
    coarse_shape = (
        max(3, height_px // 30),
        max(5, width_px // 30),
    )
    coarse = rng.normal(128.0, 34.0, coarse_shape)
    coarse_image = Image.fromarray(
        np.clip(coarse, 0, 255).astype(np.uint8),
        mode="L",
    ).resize((width_px, height_px), Image.Resampling.BICUBIC)
    coarse_image = coarse_image.filter(
        ImageFilter.GaussianBlur(0.12 * scale)
    )
    coarse_values = (
        np.asarray(coarse_image, dtype=np.float32) - 128.0
    ) / 128.0
    fine_values = rng.normal(0.0, 1.0, (height_px, width_px))
    horizontal = np.arange(width_px, dtype=np.float32)[None, :]
    vertical = np.arange(height_px, dtype=np.float32)[:, None]
    burnish_wave = np.sin(
        horizontal / (5.7 * scale) + vertical / (8.3 * scale)
    )
    wear = (
        coarse_values * 48.0
        + fine_values * 7.0
        + burnish_wave * 5.5
    )

    base_gold = np.array([181.0, 147.0, 82.0], dtype=np.float32)
    pigment = base_gold[None, None, :] + wear[:, :, None] * np.array(
        [1.00, 0.78, 0.43],
        dtype=np.float32,
    )
    pigment = np.clip(pigment, 48.0, 232.0).astype(np.uint8)

    mask_values = np.asarray(face_mask, dtype=np.float32) / 255.0
    opacity_variation = np.clip(
        0.79 + coarse_values * 0.28 + fine_values * 0.026,
        0.43,
        0.97,
    )
    flakes = rng.random((height_px, width_px)) > 0.9992
    flake_mask = Image.fromarray(
        (flakes * 255).astype(np.uint8),
        mode="L",
    ).filter(ImageFilter.MaxFilter(5))
    flake_values = np.asarray(flake_mask, dtype=np.float32) / 255.0
    opacity_variation *= 1.0 - flake_values * 0.88

    # Most loss occurs on the raised perimeter of an old stamp. Coarse wear
    # selectively breaks that edge without making the underlying font wobbly.
    eroded = face_mask.filter(ImageFilter.MinFilter(5))
    edge_values = (
        np.asarray(
            ImageChops.subtract(face_mask, eroded),
            dtype=np.float32,
        )
        / 255.0
    )
    edge_wear = edge_values * (coarse_values < -0.08)
    opacity_variation *= 1.0 - edge_wear * 0.47
    pigment_alpha = np.rint(
        mask_values * opacity_variation * 255.0
    ).astype(np.uint8)

    pigment_layer = Image.fromarray(pigment, mode="RGB").convert("RGBA")
    pigment_layer.putalpha(Image.fromarray(pigment_alpha, mode="L"))
    sprite.alpha_composite(pigment_layer)

    # Sparse darker scars remain within the glyph rather than deforming the
    # letterform, preserving accurate spelling and excellent print legibility.
    scar_mask = Image.new("L", face_mask.size, 0)
    scar_drawing = ImageDraw.Draw(scar_mask)
    face_y, face_x = np.where(np.asarray(face_mask) > 224)
    for _ in range(max(4, len(text))):
        selected = int(rng.integers(0, len(face_x)))
        start_x = int(face_x[selected])
        start_y = int(face_y[selected])
        length = int(rng.integers(max(3, scale // 2), max(5, scale * 2)))
        rise = int(rng.integers(-max(1, scale // 5), max(2, scale // 5 + 1)))
        scar_drawing.line(
            (start_x, start_y, start_x + length, start_y + rise),
            fill=118,
            width=max(1, scale // 12),
        )
    scar_mask = ImageChops.multiply(scar_mask, face_mask)
    scar_layer = Image.new("RGBA", sprite.size, (58, 43, 24, 0))
    scar_layer.putalpha(scar_mask)
    sprite.alpha_composite(scar_layer)

    # Fine opposing inner edges complete the deboss. These use the actual
    # glyph mask, not a generic drop shadow, so the letters remain seated in
    # the leather when enlarged.
    inner_shift = max(1, round(0.13 * scale))
    shifted_down_right = Image.new("L", face_mask.size, 0)
    shifted_down_right.paste(face_mask, (inner_shift, inner_shift))
    dark_inner = ImageChops.subtract(face_mask, shifted_down_right)
    dark_inner_layer = Image.new("RGBA", sprite.size, (42, 29, 15, 0))
    dark_inner_layer.putalpha(
        dark_inner.point(lambda value: round(value * 0.54))
    )
    sprite.alpha_composite(dark_inner_layer)

    shifted_up_left = Image.new("L", face_mask.size, 0)
    shifted_up_left.paste(face_mask, (-inner_shift, -inner_shift))
    light_inner = ImageChops.subtract(face_mask, shifted_up_left)
    light_inner_layer = Image.new("RGBA", sprite.size, (231, 205, 142, 0))
    light_inner_layer.putalpha(
        light_inner.point(lambda value: round(value * 0.32))
    )
    sprite.alpha_composite(light_inner_layer)

    face_bounds = face_mask.getbbox()
    if face_bounds is None:
        raise ValueError(f"Text produced no visible glyphs: {text!r}")
    return sprite, baseline_px / scale, face_bounds


def draw_material_label(
    pdf: canvas.Canvas,
    text: str,
    center_x_mm: float,
    baseline_y_mm: float,
    size: float,
    tracking_pt: float = 0.0,
) -> None:
    sprite, baseline_from_top_pt, _ = build_material_label_sprite(
        text,
        size,
        tracking_pt,
    )
    width_pt = sprite.width / RESOURCE_TEXT_RENDER_SCALE
    height_pt = sprite.height / RESOURCE_TEXT_RENDER_SCALE
    baseline_from_bottom_pt = height_pt - baseline_from_top_pt
    pdf.drawImage(
        ImageReader(sprite),
        study.xpt(center_x_mm) - width_pt / 2,
        study.xpt(baseline_y_mm) - baseline_from_bottom_pt,
        width=width_pt,
        height=height_pt,
        preserveAspectRatio=False,
        mask="auto",
    )


def draw_material_text_centered(
    pdf: canvas.Canvas,
    text: str,
    center_x_mm: float,
    center_y_mm: float,
    font_path: Path,
    size: float,
    tracking_pt: float = 0.0,
) -> None:
    """Centre a worn, shallow-debossed material mark by visible glyph bounds."""

    sprite, _, face_bounds = build_material_label_sprite(
        text,
        size,
        tracking_pt,
        font_path,
    )
    width_pt = sprite.width / RESOURCE_TEXT_RENDER_SCALE
    height_pt = sprite.height / RESOURCE_TEXT_RENDER_SCALE
    face_center_x_pt = (
        (face_bounds[0] + face_bounds[2])
        / 2
        / RESOURCE_TEXT_RENDER_SCALE
    )
    face_center_from_top_pt = (
        (face_bounds[1] + face_bounds[3])
        / 2
        / RESOURCE_TEXT_RENDER_SCALE
    )
    face_center_from_bottom_pt = height_pt - face_center_from_top_pt
    pdf.drawImage(
        ImageReader(sprite),
        study.xpt(center_x_mm) - face_center_x_pt,
        study.xpt(center_y_mm) - face_center_from_bottom_pt,
        width=width_pt,
        height=height_pt,
        preserveAspectRatio=False,
        mask="auto",
    )


def draw_refined_text(
    pdf: canvas.Canvas,
    text: str,
    center_x_mm: float,
    baseline_y_mm: float,
    font_path: Path,
    size: float,
    colour: Color,
    tracking_pt: float = 0.0,
) -> None:
    sprite, baseline_from_top_pt, _ = build_text_sprite(
        text,
        font_path,
        size,
        colour,
        tracking_pt,
    )
    width_pt = sprite.width / TEXT_RENDER_SCALE
    height_pt = sprite.height / TEXT_RENDER_SCALE
    baseline_from_bottom_pt = height_pt - baseline_from_top_pt
    pdf.drawImage(
        ImageReader(sprite),
        study.xpt(center_x_mm) - width_pt / 2,
        study.xpt(baseline_y_mm) - baseline_from_bottom_pt,
        width=width_pt,
        height=height_pt,
        preserveAspectRatio=False,
        mask="auto",
    )


def draw_refined_text_centered(
    pdf: canvas.Canvas,
    text: str,
    center_x_mm: float,
    center_y_mm: float,
    font_path: Path,
    size: float,
    colour: Color,
    tracking_pt: float = 0.0,
) -> None:
    """Centre the visible glyph face in both axes, independent of baseline."""

    sprite, _, face_bounds = build_text_sprite(
        text,
        font_path,
        size,
        colour,
        tracking_pt,
    )
    width_pt = sprite.width / TEXT_RENDER_SCALE
    height_pt = sprite.height / TEXT_RENDER_SCALE
    face_center_x_pt = (
        (face_bounds[0] + face_bounds[2]) / 2 / TEXT_RENDER_SCALE
    )
    face_center_from_top_pt = (
        (face_bounds[1] + face_bounds[3]) / 2 / TEXT_RENDER_SCALE
    )
    face_center_from_bottom_pt = height_pt - face_center_from_top_pt
    pdf.drawImage(
        ImageReader(sprite),
        study.xpt(center_x_mm) - face_center_x_pt,
        study.xpt(center_y_mm) - face_center_from_bottom_pt,
        width=width_pt,
        height=height_pt,
        preserveAspectRatio=False,
        mask="auto",
    )


@lru_cache(maxsize=1)
def build_sewn_button_sprites() -> dict[str, Image.Image]:
    """Dye one matte leather appliqué while preserving its linen thread."""

    with Image.open(BUTTON_REFERENCE_PATH) as reference_source:
        reference = reference_source.convert("RGBA").crop(
            BUTTON_REFERENCE_CROP
        )

    source_values = np.asarray(reference, dtype=np.float32)
    source_rgb = source_values[:, :, :3]
    source_alpha = source_values[:, :, 3] / 255.0
    red = source_rgb[:, :, 0]
    green = source_rgb[:, :, 1]
    blue = source_rgb[:, :, 2]
    luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722

    coordinates_x = np.arange(reference.width, dtype=np.float32)
    coordinates_y = np.arange(reference.height, dtype=np.float32)
    xx, yy = np.meshgrid(
        coordinates_x - (reference.width - 1) / 2.0,
        coordinates_y - (reference.height - 1) / 2.0,
    )

    # Protect the physical thread from the resource dye. The neutral master
    # uses a compact X approximately 160 pixels across within this crop.
    def distance_to_segment(
        start_x: float,
        start_y: float,
        end_x: float,
        end_y: float,
    ) -> np.ndarray:
        segment_x = end_x - start_x
        segment_y = end_y - start_y
        progress = np.clip(
            (
                (xx - start_x) * segment_x
                + (yy - start_y) * segment_y
            )
            / (segment_x * segment_x + segment_y * segment_y),
            0.0,
            1.0,
        )
        nearest_x = start_x + progress * segment_x
        nearest_y = start_y + progress * segment_y
        return np.sqrt(
            (xx - nearest_x) ** 2 + (yy - nearest_y) ** 2
        )

    stitch_distance = np.minimum(
        distance_to_segment(-82.0, -78.0, 79.0, 82.0),
        distance_to_segment(79.0, -78.0, -82.0, 82.0),
    )
    stitch_corridor = np.clip(
        (25.0 - stitch_distance) / 8.0,
        0.0,
        1.0,
    )
    warm_linen = np.clip(
        ((red - blue) - 5.0) / 40.0,
        0.0,
        1.0,
    )
    thread_strength = stitch_corridor * np.clip(
        0.74 + warm_linen * 0.32,
        0.0,
        1.0,
    )
    thread_strength *= np.clip(
        (luminance - 55.0) / 42.0,
        0.0,
        1.0,
    )
    thread_strength *= source_alpha

    sprites = {}
    grey = np.clip(luminance / 255.0, 0.0, 1.0)
    neutral_texture = source_rgb - luminance[:, :, None]
    for resource, dye_colour in BUTTON_DYE_COLOURS.items():
        dye = np.asarray(dye_colour, dtype=np.float32)
        tonal_factor = 0.55 + grey * 0.95
        tinted_leather = (
            dye[None, None, :] * tonal_factor[:, :, None]
            + neutral_texture * 0.26
        )
        tinted_leather = np.clip(tinted_leather, 0.0, 255.0)

        # Preserve the linen and drilled holes while allowing the original
        # leather fibres and restrained wear to remain visible through the dye.
        leather_strength = np.clip(
            (luminance - 28.0) / 52.0,
            0.0,
            1.0,
        )
        leather_strength *= 1.0 - thread_strength
        leather_strength *= source_alpha
        mix_amount = leather_strength[:, :, None] * 0.88
        mixed = (
            source_rgb * (1.0 - mix_amount)
            + tinted_leather * mix_amount
        )
        face = Image.fromarray(
            np.rint(np.clip(mixed, 0.0, 255.0)).astype(np.uint8),
            mode="RGB",
        ).convert("RGBA")
        face.putalpha(
            Image.fromarray(
                np.rint(source_alpha * 255.0).astype(np.uint8),
                mode="L",
            )
        )
        face = face.filter(
            ImageFilter.UnsharpMask(radius=0.55, percent=10, threshold=3)
        )
        sprites[resource] = face
    return sprites


@lru_cache(maxsize=1)
def build_in_context_button_sprites() -> dict[str, Image.Image]:
    """Colour the in-context physical button without flattening its texture."""

    with Image.open(BUTTON_REFERENCE_PATH) as source:
        reference = source.convert("RGB").crop(BUTTON_REFERENCE_CROP)

    values = np.asarray(reference, dtype=np.float32)
    luminance = (
        values[:, :, 0] * 0.2126
        + values[:, :, 1] * 0.7152
        + values[:, :, 2] * 0.0722
    )
    coordinates = np.arange(reference.width, dtype=np.float32)
    centre_x = 66.5
    centre_y = 67.0
    xx, yy = np.meshgrid(
        coordinates - centre_x,
        coordinates - centre_y,
    )
    distance = np.sqrt(xx * xx + yy * yy)
    alpha_values = np.clip(
        (43.7 - distance) / 0.85,
        0.0,
        1.0,
    )

    central = distance < 19.0
    warm_thread = (
        (values[:, :, 0] > values[:, :, 1] * 1.13)
        & (values[:, :, 0] > values[:, :, 2] * 1.42)
        & (luminance > 66.0)
        & central
    )
    thread_mask = Image.fromarray(
        (warm_thread.astype(np.uint8) * 255),
        mode="L",
    ).filter(
        ImageFilter.MaxFilter(5)
    ).filter(
        ImageFilter.GaussianBlur(0.65)
    )
    thread_strength = (
        np.asarray(thread_mask, dtype=np.float32) / 255.0
    ) * alpha_values

    sprites: dict[str, Image.Image] = {}
    source_green = np.asarray((57, 69, 48), dtype=np.float32)
    for resource, dye_colour in BUTTON_DYE_COLOURS.items():
        if resource == "WOOD":
            tinted = values.copy()
        else:
            dye = np.asarray(dye_colour, dtype=np.float32) * 0.67
            source_factor = np.clip(
                luminance / 61.0,
                0.38,
                1.72,
            )
            local_colour_detail = (
                values
                - source_green[None, None, :]
                * np.clip(
                    luminance[:, :, None] / 61.0,
                    0.0,
                    2.0,
                )
            )
            tinted = (
                dye[None, None, :]
                * source_factor[:, :, None]
                + local_colour_detail * 0.12
            )

        # Keep the raised linen exactly as generated; the dye affects only hide.
        tinted = (
            tinted * (1.0 - thread_strength[:, :, None])
            + values * thread_strength[:, :, None]
        )
        sprite = Image.fromarray(
            np.rint(np.clip(tinted, 0.0, 255.0)).astype(np.uint8),
            mode="RGB",
        ).convert("RGBA")
        sprite.putalpha(
            Image.fromarray(
                np.rint(alpha_values * 255.0).astype(np.uint8),
                mode="L",
            )
        )
        sprites[resource] = sprite
    return sprites


def draw_sewn_button(
    pdf: canvas.Canvas,
    center_x_mm: float,
    center_y_mm: float,
    resource: str,
) -> None:
    sprite = build_in_context_button_sprites()[resource]
    pdf.drawImage(
        ImageReader(sprite),
        study.xpt(center_x_mm - BUTTON_PATCH_MM / 2),
        study.xpt(center_y_mm - BUTTON_PATCH_MM / 2),
        width=study.xpt(BUTTON_PATCH_MM),
        height=study.xpt(BUTTON_PATCH_MM),
        preserveAspectRatio=False,
        mask="auto",
    )


def resize_detail_for_skin(
    sprite: Image.Image,
    render_scale: float,
    soften_radius: float,
) -> tuple[Image.Image, float]:
    """Resolve an overlay at the same physical pixel density as the leather."""

    raw_to_skin = (
        25.4
        / 72.0
        * SKIN_PX_PER_MM
        / render_scale
    )
    target_size = (
        max(1, round(sprite.width * raw_to_skin)),
        max(1, round(sprite.height * raw_to_skin)),
    )
    resolved = sprite.resize(target_size, Image.Resampling.LANCZOS)
    if soften_radius > 0:
        resolved = resolved.filter(
            ImageFilter.GaussianBlur(soften_radius)
        )
    return resolved, raw_to_skin


def composite_baseline_detail(
    surface: Image.Image,
    sprite: Image.Image,
    baseline_from_top_pt: float,
    render_scale: float,
    center_x_mm: float,
    baseline_y_mm: float,
    soften_radius: float = MATERIAL_TEXT_SOFTEN_PX,
) -> None:
    resolved, _ = resize_detail_for_skin(
        sprite,
        render_scale,
        soften_radius,
    )
    pixels_per_point = 25.4 / 72.0 * SKIN_PX_PER_MM
    target_baseline_y = (
        study.A1_HEIGHT_MM - baseline_y_mm
    ) * SKIN_PX_PER_MM
    target_x = round(
        center_x_mm * SKIN_PX_PER_MM - resolved.width / 2
    )
    target_y = round(
        target_baseline_y
        - baseline_from_top_pt * pixels_per_point
    )
    surface.alpha_composite(resolved, (target_x, target_y))


def composite_centered_detail(
    surface: Image.Image,
    sprite: Image.Image,
    face_bounds: tuple[int, int, int, int],
    render_scale: float,
    center_x_mm: float,
    center_y_mm: float,
    soften_radius: float = MATERIAL_TEXT_SOFTEN_PX,
) -> None:
    resolved, raw_to_skin = resize_detail_for_skin(
        sprite,
        render_scale,
        soften_radius,
    )
    face_center_x = (
        (face_bounds[0] + face_bounds[2]) / 2.0 * raw_to_skin
    )
    face_center_y = (
        (face_bounds[1] + face_bounds[3]) / 2.0 * raw_to_skin
    )
    target_x = round(
        center_x_mm * SKIN_PX_PER_MM - face_center_x
    )
    target_y = round(
        (study.A1_HEIGHT_MM - center_y_mm) * SKIN_PX_PER_MM
        - face_center_y
    )
    surface.alpha_composite(resolved, (target_x, target_y))


def composite_sewn_button_detail(
    surface: Image.Image,
    center_x_mm: float,
    center_y_mm: float,
    resource: str,
) -> None:
    target_size = max(
        1,
        round(BUTTON_PATCH_MM * SKIN_PX_PER_MM),
    )
    target_x = round(
        (center_x_mm - BUTTON_PATCH_MM / 2.0)
        * SKIN_PX_PER_MM
    )
    target_y = round(
        (
            study.A1_HEIGHT_MM
            - center_y_mm
            - BUTTON_PATCH_MM / 2.0
        )
        * SKIN_PX_PER_MM
    )

    # Use only the physical leather face from the in-context reference. Its
    # alpha is contracted inside the original cast shadow, and no replacement
    # shadow is generated.
    sprite = build_in_context_button_sprites()[resource]
    resolved = sprite.resize(
        (target_size, target_size),
        Image.Resampling.LANCZOS,
    )
    if SEWN_BUTTON_SOFTEN_PX > 0:
        resolved = resolved.filter(
            ImageFilter.GaussianBlur(SEWN_BUTTON_SOFTEN_PX)
        )
    surface.alpha_composite(resolved, (target_x, target_y))
    return

    # Rebuild the marker as a dyed inlay made from the exact leather beneath
    # it. The host pixels continue through the marker, so its grain, focus and
    # lighting cannot read as a separate pasted image.
    render_scale = 4
    rendered_size = target_size * render_scale
    host = surface.crop(
        (
            target_x,
            target_y,
            target_x + target_size,
            target_y + target_size,
        )
    ).convert("RGB").resize(
        (rendered_size, rendered_size),
        Image.Resampling.BICUBIC,
    )
    host_values = np.asarray(host, dtype=np.float32)
    host_luminance = (
        host_values[:, :, 0] * 0.2126
        + host_values[:, :, 1] * 0.7152
        + host_values[:, :, 2] * 0.0722
    )
    broad = np.asarray(
        Image.fromarray(
            np.rint(host_luminance).astype(np.uint8),
            mode="L",
        ).filter(
            ImageFilter.GaussianBlur(3.0 * render_scale)
        ),
        dtype=np.float32,
    )
    fibre = np.clip(host_luminance - broad, -20.0, 20.0)
    coordinates = np.arange(rendered_size, dtype=np.float32)
    centre = (rendered_size - 1) / 2.0
    xx, yy = np.meshgrid(coordinates - centre, coordinates - centre)
    distance = np.sqrt(xx * xx + yy * yy)
    angle = np.arctan2(yy, xx)
    radius = (
        BUTTON_VISIBLE_DIAMETER_MM
        * SKIN_PX_PER_MM
        * render_scale
        / 2.0
    )
    seed = sum(
        (index + 1) * ord(character)
        for index, character in enumerate(resource)
    )
    phase = (seed % 41) / 41.0 * np.pi * 2.0
    edge_radius = radius + render_scale * (
        0.11 * np.sin(angle * 11.0 + phase)
        + 0.06 * np.sin(angle * 19.0 - phase * 0.4)
    )
    inlay_mask = np.clip(
        (edge_radius - distance + render_scale * 0.30)
        / (render_scale * 0.60),
        0.0,
        1.0,
    )
    dye = np.asarray(BUTTON_DYE_COLOURS[resource], dtype=np.float32)
    dye *= 0.68
    tonal_factor = (
        0.91
        + fibre / 62.0
        + np.clip(
            broad - float(np.mean(broad)),
            -18.0,
            18.0,
        ) / 260.0
    )
    local_chroma = (
        host_values - host_luminance[:, :, None]
    ) * 0.15
    dyed = (
        dye[None, None, :] * tonal_factor[:, :, None]
        + local_chroma
    )

    # The only depth cue is a narrow cut groove inside the coloured leather.
    # No pixel outside the inlay is darkened, so there is no shadow beneath it.
    inner_groove = (
        np.clip(
            (
                distance
                - (edge_radius - 1.35 * render_scale)
            )
            / (1.35 * render_scale),
            0.0,
            1.0,
        )
        * inlay_mask
    )
    dyed *= 1.0 - inner_groove[:, :, None] * 0.24
    composed = (
        host_values * (1.0 - inlay_mask[:, :, None])
        + np.clip(dyed, 0.0, 255.0) * inlay_mask[:, :, None]
    )
    inlay = Image.fromarray(
        np.rint(np.clip(composed, 0.0, 255.0)).astype(np.uint8),
        mode="RGB",
    ).convert("RGBA")

    stitch_layer = Image.new("RGBA", inlay.size, (0, 0, 0, 0))
    stitch_draw = ImageDraw.Draw(stitch_layer)
    hole_offset = 5.0 * render_scale
    outer_hole_radius = 1.65 * render_scale
    inner_hole_radius = 1.02 * render_scale
    hole_centres = [
        (centre - hole_offset, centre - hole_offset),
        (centre + hole_offset, centre - hole_offset),
        (centre - hole_offset, centre + hole_offset),
        (centre + hole_offset, centre + hole_offset),
    ]
    for hole_x, hole_y in hole_centres:
        stitch_draw.ellipse(
            (
                hole_x - outer_hole_radius,
                hole_y - outer_hole_radius,
                hole_x + outer_hole_radius,
                hole_y + outer_hole_radius,
            ),
            fill=(46, 34, 24, 235),
        )
        stitch_draw.ellipse(
            (
                hole_x - inner_hole_radius,
                hole_y - inner_hole_radius,
                hole_x + inner_hole_radius,
                hole_y + inner_hole_radius,
            ),
            fill=(15, 13, 11, 245),
        )
    thread_width = max(2, round(1.75 * render_scale))
    for start, end in (
        (hole_centres[0], hole_centres[3]),
        (hole_centres[1], hole_centres[2]),
    ):
        stitch_draw.line(
            (start, end),
            fill=(171, 119, 73, 255),
            width=thread_width,
        )
        stitch_draw.line(
            (
                (start[0] - 0.20 * render_scale, start[1] - 0.20 * render_scale),
                (end[0] - 0.20 * render_scale, end[1] - 0.20 * render_scale),
            ),
            fill=(221, 169, 107, 150),
            width=max(1, round(0.42 * render_scale)),
        )
    inlay.alpha_composite(stitch_layer)
    resolved = inlay.resize(
        (target_size, target_size),
        Image.Resampling.LANCZOS,
    )
    surface.alpha_composite(resolved, (target_x, target_y))
    return

    # Build the marker from the leather directly beneath it. This makes its
    # fibre scale, focus, noise and lighting belong to the same photographed
    # surface instead of reading as a separate circular illustration.
    render_scale = 4
    rendered_size = target_size * render_scale
    leather_crop = surface.crop(
        (
            target_x,
            target_y,
            target_x + target_size,
            target_y + target_size,
        )
    ).convert("RGB")
    leather_crop = leather_crop.resize(
        (rendered_size, rendered_size),
        Image.Resampling.BICUBIC,
    )
    leather_values = np.asarray(leather_crop, dtype=np.float32)
    leather_luminance = (
        leather_values[:, :, 0] * 0.2126
        + leather_values[:, :, 1] * 0.7152
        + leather_values[:, :, 2] * 0.0722
    )
    broad_luminance = np.asarray(
        Image.fromarray(
            np.rint(leather_luminance).astype(np.uint8),
            mode="L",
        ).filter(
            ImageFilter.GaussianBlur(3.2 * render_scale)
        ),
        dtype=np.float32,
    )
    fibre_detail = np.clip(
        leather_luminance - broad_luminance,
        -22.0,
        22.0,
    )
    broad_variation = np.clip(
        broad_luminance - float(np.mean(broad_luminance)),
        -18.0,
        18.0,
    )

    coordinates = np.arange(rendered_size, dtype=np.float32)
    centre = (rendered_size - 1) / 2.0
    xx, yy = np.meshgrid(coordinates - centre, coordinates - centre)
    distance = np.sqrt(xx * xx + yy * yy)
    angle = np.arctan2(yy, xx)
    radius = (
        BUTTON_VISIBLE_DIAMETER_MM
        * SKIN_PX_PER_MM
        * render_scale
        / 2.0
    )
    seed = sum((index + 1) * ord(character) for index, character in enumerate(resource))
    phase = (seed % 37) / 37.0 * np.pi * 2.0
    irregularity = render_scale * (
        0.10 * np.sin(angle * 5.0 + phase)
        + 0.12 * np.sin(angle * 11.0 - phase * 0.63)
        + 0.07 * np.sin(angle * 19.0 + phase * 0.31)
    )
    edge_radius = radius + irregularity
    mask = np.clip(
        (edge_radius - distance + render_scale * 0.34)
        / (render_scale * 0.68),
        0.0,
        1.0,
    )

    dye = np.asarray(BUTTON_DYE_COLOURS[resource], dtype=np.float32)
    local_chroma = (
        leather_values - leather_luminance[:, :, None]
    ) * 0.16
    tone = (
        0.76
        + fibre_detail / 58.0
        + broad_variation / 260.0
    )
    direction = np.clip(
        (-xx - yy) / (radius * np.sqrt(2.0)),
        -1.0,
        1.0,
    )
    radial = np.clip(distance / radius, 0.0, 1.0)
    shallow_form = (
        1.0
        + direction * 0.062
        + (1.0 - radial * radial) * 0.035
    )
    dyed_leather = (
        dye[None, None, :] * tone[:, :, None] * shallow_form[:, :, None]
        + local_chroma
    )

    # A narrow, fibrous cut edge gives the patch physical thickness without
    # introducing the detached drop shadow that caused the earlier mismatch.
    edge_band = (
        np.clip(
            (distance - (edge_radius - 1.75 * render_scale))
            / (1.75 * render_scale),
            0.0,
            1.0,
        )
        * mask
    )
    cut_edge_tone = np.clip(0.60 + direction * 0.11, 0.50, 0.72)
    dyed_leather *= (
        1.0
        - edge_band[:, :, None]
        * (1.0 - cut_edge_tone[:, :, None])
    )
    top_rim = (
        edge_band
        * np.clip((direction + 0.12) / 0.90, 0.0, 1.0)
        * 0.15
    )
    dyed_leather *= 1.0 + top_rim[:, :, None]

    # A minute, correctly aligned contact shadow is generated from this exact
    # silhouette. It is limited to the lower-right edge rather than inherited
    # from the discarded source button artwork.
    shadow_offset_x = 0.70 * render_scale
    shadow_offset_y = 0.90 * render_scale
    shifted_distance = np.sqrt(
        (xx - shadow_offset_x) ** 2
        + (yy - shadow_offset_y) ** 2
    )
    shifted_mask = np.clip(
        (radius - shifted_distance + render_scale * 0.45)
        / (render_scale * 0.90),
        0.0,
        1.0,
    )
    contact_shadow = (
        shifted_mask
        * (1.0 - mask)
        * 0.22
    )

    # Compress the immediate seam into the host leather.
    seam = np.clip(
        1.0
        - np.abs(distance - edge_radius) / (0.66 * render_scale),
        0.0,
        1.0,
    )
    host = leather_values * (
        1.0
        - seam[:, :, None] * 0.065
        - contact_shadow[:, :, None]
    )
    composed = (
        host * (1.0 - mask[:, :, None])
        + np.clip(dyed_leather, 0.0, 255.0) * mask[:, :, None]
    )
    marker = Image.fromarray(
        np.rint(np.clip(composed, 0.0, 255.0)).astype(np.uint8),
        mode="RGB",
    ).convert("RGBA")

    # Four punched holes and two waxed-linen passes are drawn at 4x resolution
    # so their bevels and rounded fibres survive the neoprene print raster.
    hole_layer = Image.new("RGBA", marker.size, (0, 0, 0, 0))
    holes = ImageDraw.Draw(hole_layer)
    hole_offset = 4.85 * render_scale
    outer_radius = 1.82 * render_scale
    inner_radius = 1.12 * render_scale
    hole_centres = [
        (centre - hole_offset, centre - hole_offset),
        (centre + hole_offset, centre - hole_offset),
        (centre - hole_offset, centre + hole_offset),
        (centre + hole_offset, centre + hole_offset),
    ]
    for hole_x, hole_y in hole_centres:
        holes.ellipse(
            (
                hole_x - outer_radius,
                hole_y - outer_radius,
                hole_x + outer_radius,
                hole_y + outer_radius,
            ),
            fill=(47, 35, 24, 225),
        )
        holes.ellipse(
            (
                hole_x - inner_radius - 0.35 * render_scale,
                hole_y - inner_radius - 0.35 * render_scale,
                hole_x + inner_radius - 0.35 * render_scale,
                hole_y + inner_radius - 0.35 * render_scale,
            ),
            fill=(18, 15, 12, 245),
        )
        holes.arc(
            (
                hole_x - outer_radius,
                hole_y - outer_radius,
                hole_x + outer_radius,
                hole_y + outer_radius,
            ),
            205,
            330,
            fill=(150, 120, 74, 165),
            width=max(1, round(0.42 * render_scale)),
        )
    marker.alpha_composite(hole_layer)

    thread_layer = Image.new("RGBA", marker.size, (0, 0, 0, 0))
    thread = ImageDraw.Draw(thread_layer)
    thread_width = max(2, round(1.86 * render_scale))
    thread_shadow_width = thread_width + max(1, round(0.55 * render_scale))
    top_left, top_right, bottom_left, bottom_right = hole_centres
    for start, end in (
        (top_left, bottom_right),
        (top_right, bottom_left),
    ):
        shadow_start = (
            start[0] + 0.42 * render_scale,
            start[1] + 0.50 * render_scale,
        )
        shadow_end = (
            end[0] + 0.42 * render_scale,
            end[1] + 0.50 * render_scale,
        )
        thread.line(
            (shadow_start, shadow_end),
            fill=(38, 27, 18, 190),
            width=thread_shadow_width,
        )
        thread.line(
            (start, end),
            fill=(185, 137, 82, 255),
            width=thread_width,
        )
        highlight_start = (
            start[0] - 0.22 * render_scale,
            start[1] - 0.22 * render_scale,
        )
        highlight_end = (
            end[0] - 0.22 * render_scale,
            end[1] - 0.22 * render_scale,
        )
        thread.line(
            (highlight_start, highlight_end),
            fill=(231, 190, 126, 155),
            width=max(1, round(0.43 * render_scale)),
        )
    marker.alpha_composite(thread_layer)
    resolved = marker.resize(
        (target_size, target_size),
        Image.Resampling.LANCZOS,
    )
    if SEWN_BUTTON_SOFTEN_PX > 0:
        resolved = resolved.filter(
            ImageFilter.GaussianBlur(SEWN_BUTTON_SOFTEN_PX)
        )
    surface.alpha_composite(resolved, (target_x, target_y))


def composite_border_details_into_skin(
    skin: Image.Image,
    source_size: tuple[int, int],
) -> Image.Image:
    """Seat all border typography and shell buttons in one print surface."""

    source_width, source_height = source_size
    surface = skin.convert("RGBA")
    plate_shift_mm = title_plate_shift_mm(source_height)

    title_sprite, title_baseline, _ = build_text_sprite(
        "THE QUIET VALE",
        DISPLAY_FONT_PATH,
        24.0,
        PARCHMENT,
        0.0,
    )
    composite_baseline_detail(
        surface,
        title_sprite,
        title_baseline,
        TEXT_RENDER_SCALE,
        study.A1_WIDTH_MM / 2,
        TITLE_BASELINE_Y_MM - plate_shift_mm,
    )

    subtitle_sprite, subtitle_baseline, _ = build_text_sprite(
        "SEASONS OF SETTLEMENT",
        LABEL_FONT_PATH,
        8.2,
        BRASS,
        0.76,
    )
    composite_baseline_detail(
        surface,
        subtitle_sprite,
        subtitle_baseline,
        TEXT_RENDER_SCALE,
        study.A1_WIDTH_MM / 2,
        TITLE_SUBTITLE_BASELINE_Y_MM - plate_shift_mm,
    )

    left_labels = ["WOOD", "STONE", "METAL"]
    right_labels = ["FOOD", "HERBS", "GOODS"]
    for index, source_y in enumerate(RESOURCE_LABEL_Y_PX):
        baseline_y = source_y_to_pdf_mm(source_y, source_height)
        row_baseline_y = baseline_y - RESOURCE_ROW_DOWN_MM
        left_resource = left_labels[index]
        right_resource = right_labels[index]

        composite_sewn_button_detail(
            surface,
            source_x_to_mm(LEFT_RESOURCE_BUTTON_X_PX, source_width),
            row_baseline_y + 1.2,
            left_resource,
        )
        left_sprite, left_baseline, _ = build_material_label_sprite(
            left_resource,
            16.6,
            0.08,
        )
        composite_baseline_detail(
            surface,
            left_sprite,
            left_baseline,
            RESOURCE_TEXT_RENDER_SCALE,
            source_x_to_mm(LEFT_RESOURCE_LABEL_X_PX, source_width)
            + 4.2,
            row_baseline_y - 0.5,
        )

        composite_sewn_button_detail(
            surface,
            source_x_to_mm(RIGHT_RESOURCE_BUTTON_X_PX, source_width),
            row_baseline_y + 1.2,
            right_resource,
        )
        right_sprite, right_baseline, _ = build_material_label_sprite(
            right_resource,
            16.6,
            0.08,
        )
        composite_baseline_detail(
            surface,
            right_sprite,
            right_baseline,
            RESOURCE_TEXT_RENDER_SCALE,
            source_x_to_mm(RIGHT_RESOURCE_LABEL_X_PX, source_width)
            - 4.2,
            row_baseline_y - 0.5,
        )

    socket_y_mm = source_y_to_pdf_mm(
        TRACKER_TARGET_SOCKET_Y_PX,
        source_height,
    )
    centers_mm = round_tracker_centers_mm()
    for index, center_x_mm in enumerate(centers_mm):
        number_sprite, _, number_bounds = build_material_label_sprite(
            str(index + 1),
            14.2,
            0.0,
            LABEL_FONT_PATH,
        )
        composite_centered_detail(
            surface,
            number_sprite,
            number_bounds,
            RESOURCE_TEXT_RENDER_SCALE,
            center_x_mm,
            socket_y_mm,
        )

    for start_index, marker in zip(
        (0, 4, 8),
        ("I", "II", "III"),
    ):
        marker_sprite, _, marker_bounds = build_material_label_sprite(
            marker,
            12.0,
            0.08,
            DISPLAY_FONT_PATH,
        )
        composite_centered_detail(
            surface,
            marker_sprite,
            marker_bounds,
            RESOURCE_TEXT_RENDER_SCALE,
            centers_mm[start_index] - TRACKER_SEASON_MARKER_OFFSET_MM,
            socket_y_mm,
        )

    return surface.convert("RGB")


def draw_exact_map(
    pdf: canvas.Canvas,
    map_image: ImageReader,
) -> None:
    pdf.drawImage(
        map_image,
        study.xpt(study.MAP_X_MM),
        study.xpt(study.MAP_Y_MM),
        width=study.xpt(study.PLACED_MAP_WIDTH_MM),
        height=study.xpt(study.PLACED_MAP_HEIGHT_MM),
        preserveAspectRatio=False,
        mask="auto",
    )

    # A single dark, subtly wavering mounting seam supports the lifted source
    # stitching. The former second brass line made the edge read as a doubled
    # digital outline instead of a stitched material join.
    pdf.saveState()
    for offset, width, color in (
        (0.42, 0.82, Color(0.035, 0.032, 0.025, alpha=0.90)),
    ):
        rng = random.Random(9294)
        pdf.setStrokeColor(color)
        pdf.setLineWidth(study.xpt(width))

        edges = [
            (
                (study.MAP_X_MM - offset, study.MAP_Y_MM - offset),
                (study.MAP_RIGHT_MM + offset, study.MAP_Y_MM - offset),
                "horizontal",
            ),
            (
                (study.MAP_X_MM - offset, study.MAP_TOP_MM + offset),
                (study.MAP_RIGHT_MM + offset, study.MAP_TOP_MM + offset),
                "horizontal",
            ),
            (
                (study.MAP_X_MM - offset, study.MAP_Y_MM - offset),
                (study.MAP_X_MM - offset, study.MAP_TOP_MM + offset),
                "vertical",
            ),
            (
                (study.MAP_RIGHT_MM + offset, study.MAP_Y_MM - offset),
                (study.MAP_RIGHT_MM + offset, study.MAP_TOP_MM + offset),
                "vertical",
            ),
        ]
        for start, end, orientation in edges:
            path = pdf.beginPath()
            path.moveTo(study.xpt(start[0]), study.xpt(start[1]))
            length = (
                end[0] - start[0]
                if orientation == "horizontal"
                else end[1] - start[1]
            )
            segment_count = max(2, round(length / 18.0))
            for segment in range(1, segment_count):
                progress = segment / segment_count
                if orientation == "horizontal":
                    point_x = start[0] + length * progress
                    point_y = start[1] + rng.uniform(-0.20, 0.20)
                else:
                    point_x = start[0] + rng.uniform(-0.20, 0.20)
                    point_y = start[1] + length * progress
                path.lineTo(study.xpt(point_x), study.xpt(point_y))
            path.lineTo(study.xpt(end[0]), study.xpt(end[1]))
            pdf.drawPath(path, stroke=1, fill=0)
    pdf.restoreState()


def draw_border_lettering(
    pdf: canvas.Canvas,
    source_size: tuple[int, int],
) -> None:
    source_width, source_height = source_size
    plate_shift_mm = title_plate_shift_mm(source_height)

    draw_refined_text(
        pdf,
        "THE QUIET VALE",
        study.A1_WIDTH_MM / 2,
        TITLE_BASELINE_Y_MM - plate_shift_mm,
        DISPLAY_FONT_PATH,
        24.0,
        PARCHMENT,
    )
    draw_refined_text(
        pdf,
        "SEASONS OF SETTLEMENT",
        study.A1_WIDTH_MM / 2,
        TITLE_SUBTITLE_BASELINE_Y_MM - plate_shift_mm,
        LABEL_FONT_PATH,
        8.2,
        BRASS,
        0.76,
    )

    left_labels = ["WOOD", "STONE", "METAL"]
    right_labels = ["FOOD", "HERBS", "GOODS"]
    for index, source_y in enumerate(RESOURCE_LABEL_Y_PX):
        baseline_y = source_y_to_pdf_mm(source_y, source_height)
        row_baseline_y = baseline_y - RESOURCE_ROW_DOWN_MM

        left_center_x = source_x_to_mm(
            LEFT_RESOURCE_LABEL_X_PX,
            source_width,
        )
        draw_sewn_button(
            pdf,
            source_x_to_mm(LEFT_RESOURCE_BUTTON_X_PX, source_width),
            row_baseline_y + 1.2,
            left_labels[index],
        )
        draw_material_label(
            pdf,
            left_labels[index],
            left_center_x + 4.2,
            row_baseline_y - 0.5,
            16.6,
            0.08,
        )

        right_center_x = source_x_to_mm(
            RIGHT_RESOURCE_LABEL_X_PX,
            source_width,
        )
        draw_sewn_button(
            pdf,
            source_x_to_mm(RIGHT_RESOURCE_BUTTON_X_PX, source_width),
            row_baseline_y + 1.2,
            right_labels[index],
        )
        draw_material_label(
            pdf,
            right_labels[index],
            right_center_x - 4.2,
            row_baseline_y - 0.5,
            16.6,
            0.08,
        )


def draw_round_tracker_lettering(
    pdf: canvas.Canvas,
    source_size: tuple[int, int],
) -> None:
    _, source_height = source_size
    centers_mm = round_tracker_centers_mm()
    socket_y_mm = source_y_to_pdf_mm(
        TRACKER_TARGET_SOCKET_Y_PX,
        source_height,
    )

    for index, center_x in enumerate(centers_mm):
        draw_material_text_centered(
            pdf,
            str(index + 1),
            center_x,
            socket_y_mm,
            LABEL_FONT_PATH,
            14.2,
        )

    for start_index, marker in zip(
        (0, 4, 8),
        ("I", "II", "III"),
    ):
        draw_material_text_centered(
            pdf,
            marker,
            centers_mm[start_index] - TRACKER_SEASON_MARKER_OFFSET_MM,
            socket_y_mm,
            DISPLAY_FONT_PATH,
            12.0,
            0.08,
        )


def validate_and_write_manifest(
    source_size: tuple[int, int],
) -> None:
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

    source_width, source_height = source_size
    skin_source_ppi = source_width / (study.A1_WIDTH_MM / 25.4)
    map_ppi = study.MAP_CROP_WIDTH_PX / (
        study.PLACED_MAP_WIDTH_MM / 25.4
    )
    manifest = {
        "title": "The Quiet Vale refined handmade A1 neoprene board",
        "pdf": str(PDF_PATH.relative_to(ROOT)),
        "pageCount": 1,
        "finishedSize": {
            "standard": "ISO A1 landscape",
            "widthMm": study.A1_WIDTH_MM,
            "heightMm": study.A1_HEIGHT_MM,
            "verifiedWidthMm": round(width_mm, 4),
            "verifiedHeightMm": round(height_mm, 4),
        },
        "materialSkin": {
            "source": str(SKIN_PATH.relative_to(ROOT)),
            "generationPrompt": str(PROMPT_PATH.relative_to(ROOT)),
            "titlelessLeatherRepair": str(
                TITLELESS_REPAIR_PATH.relative_to(ROOT)
            ),
            "titlelessLeatherRepairPrompt": str(
                TITLELESS_REPAIR_PATH.with_name(
                    "handmade-border-titleless-repair-v1-prompt.txt"
                ).relative_to(ROOT)
            ),
            "sewnButtonReference": str(
                BUTTON_REFERENCE_PATH.relative_to(ROOT)
            ),
            "sewnButtonReferencePrompt": str(
                BUTTON_REFERENCE_PROMPT_PATH.relative_to(ROOT)
            ),
            "shadowlessCornerFitting": str(
                SHADOWLESS_CORNER_PATH.relative_to(ROOT)
            ),
            "shadowlessCornerFittingSource": str(
                SHADOWLESS_CORNER_SOURCE_PATH.relative_to(ROOT)
            ),
            "shadowlessCornerFittingPrompt": str(
                SHADOWLESS_CORNER_PROMPT_PATH.relative_to(ROOT)
            ),
            "sourcePixels": {
                "width": source_width,
                "height": source_height,
            },
            "sourceEffectivePpi": round(skin_source_ppi, 2),
            "embeddedPixels": {
                "width": SKIN_WIDTH_PX,
                "height": SKIN_HEIGHT_PX,
            },
            "embeddedEffectivePpi": round(SKIN_PX_PER_MM * 25.4, 1),
            "highResolutionGrainAddedAfterUpscale": True,
            "generationMode": (
                "OpenAI built-in ImageGen material generation "
                "plus deterministic print assembly"
            ),
            "style": "refined handmade leather and satin aged brass",
            "borderDetailsCompositedBeforeFinalGrain": True,
            "sharedMaterialPixelDensity": True,
            "warehouseTitlePlaquesRemoved": True,
            "topWarehouseStitchingRestored": True,
            "titlePlateScalePercent": round(TITLE_PLATE_SCALE * 100),
            "titlePlateVerticalShiftMm": round(
                title_plate_shift_mm(source_height),
                2,
            ),
            "titlePlatePlacement": (
                "optically centred between outer and map-edge stitching"
            ),
        },
        "map": {
            "source": str(study.MAP_PATH.relative_to(ROOT)),
            "placedWidthMm": round(study.PLACED_MAP_WIDTH_MM, 4),
            "placedHeightMm": round(study.PLACED_MAP_HEIGHT_MM, 4),
            "effectivePpi": round(map_ppi, 2),
            "cropRetainsOriginalPixelScale": True,
            "creamSurroundBlendedToTerrainPalette": True,
            "illustratedMapInteriorProtected": True,
            "paintedLinenFinish": True,
            "wovenSurfaceGrain": (
                "restrained deterministic cross-fibre texture"
            ),
            "matteTonalGrade": True,
            "compressedMountingEdge": True,
            "geometryUnchangedByMaterialFinish": True,
            "tilePointToPointMm": study.HEX_POINT_TO_POINT_MM,
            "brassCornerFittingsLayer": "above map artwork",
            "cornerFittingSilhouettes": (
                "isolated aged-brass material assets with transparent edges, "
                "no rectangular source halo, and preserved physical aspect ratio"
            ),
            "cornerFittingContact": (
                "no external cast or contact shadow"
            ),
            "stitchingLayer": "source-material threadwork above map seam",
        },
        "typography": {
            "display": "Almendra",
            "supportingSubtitle": "Alegreya Sans Medium",
            "matchesCardAndTileDesignSystem": True,
            "perCharacterWobbleRemoved": True,
            "resourceLabels": (
                "Almendra capitals in mottled aged-gold pigment, "
                "shallow-debossed into leather"
            ),
            "trackerMarkersAndNumbers": (
                "Almendra Roman season markers and clear Alegreya numerals in the "
                "same mottled aged-gold debossed material"
            ),
            "materialIntegration": (
                "all border lettering is composited into the leather and "
                "brass raster before the shared print-grain pass"
            ),
        },
        "warehouses": {
            "count": 6,
            "leftTopToBottom": ["WOOD", "STONE", "METAL"],
            "rightTopToBottom": ["FOOD", "HERBS", "GOODS"],
            "openAreas": True,
            "resourceLabelPointSize": 16.6,
            "resourceMarkerApproxDiameterMm": BUTTON_VISIBLE_DIAMETER_MM,
            "resourceMarkerStyle": (
                "in-context hand-cut vegetable-tanned leather buttons with "
                "four punched holes and raised waxed-linen thread"
            ),
            "resourceMarkerIntegration": (
                "generated against the actual warehouse leather, resolved at "
                "the shared leather pixel density, and seated flush with no "
                "external cast or contact shadow"
            ),
            "resourceMarkerSourceIsNeutralMaster": False,
            "resourceMarkerMaterial": "dyed vegetable-tanned leather",
            "resourceMarkerFaceHasNoPrintedIcon": True,
            "resourceMarkerPaletteSource": (
                "design/a1-board/generate_a1_board_study.py RESOURCE_COLORS"
            ),
            "resourceMarkerPlacement": (
                "mirrored upper outer corners with consistent stitched-edge inset"
            ),
            "resourceMarkerColours": {
                resource: "#"
                + "".join(f"{channel:02x}" for channel in colour)
                for resource, colour in BUTTON_DYE_COLOURS.items()
            },
        },
        "roundTracker": {
            "position": "bottom",
            "rounds": 12,
            "style": (
                "single warehouse-style stitched recess cut directly into "
                "the continuous base leather, with hand-punched sockets"
            ),
            "widthMm": round(study.PLACED_MAP_WIDTH_MM, 4),
            "alignedToMapEdges": True,
            "withinSeasonCenterSpacingMm": TRACKER_ROUND_SPACING_MM,
            "betweenSeasonCenterSpacingMm": TRACKER_SEASON_BREAK_MM,
            "numberAlignment": "visible glyph bounds centred in each socket",
            "letteringIntegration": (
                "composited into the tracker leather before final print grain"
            ),
            "seasonMarkers": (
                "I, II and III aligned with the socket row, "
                f"{TRACKER_SEASON_MARKER_OFFSET_MM:.1f} mm left of rounds 1, 5 and 9"
            ),
            "seasonLabelsAboveSocketsRemoved": True,
            "endRivets": "removed; no raised mounting plate remains",
            "seasons": [
                {"season": 1, "rounds": [1, 2, 3, 4]},
                {"season": 2, "rounds": [5, 6, 7, 8]},
                {"season": 3, "rounds": [9, 10, 11, 12]},
            ],
        },
        "neoprenePrintProfile": {
            "preferredProductionFile": str(PDF_PATH.relative_to(ROOT)),
            "preferredInputFormat": "PDF",
            "productionScalePercent": 100,
            "documentColourSpace": "RGB",
            "materialLayerEffectivePpi": round(
                SKIN_PX_PER_MM * 25.4,
                1,
            ),
            "mapLayerEffectivePpi": round(map_ppi, 2),
            "visibleTextRendering": (
                "high-resolution raster material lettering; "
                "no printer font substitution required"
            ),
            "fullBleedBackgroundToTrim": True,
            "importantArtworkSafetyMm": study.OUTER_SAFETY_MM,
            "printerBleedExtensionMm": 0.0,
            "note": "A1 is the finished size; add vendor-specific bleed after receiving the printer template.",
        },
    }
    MANIFEST_PATH.write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )


def write_neoprene_print_instructions() -> None:
    instructions = """THE QUIET VALE - A1 NEOPRENE BOARD

PRODUCTION FILE

- File: the-quiet-vale-a1-board-handmade-neoprene.pdf
- Finished size: 841.000 x 594.000 mm, ISO A1 landscape
- Print scale: 100% / Actual size
- Playable hex size: 60.000 mm point-to-point
- Preferred input: PDF
- Colour space: RGB, intended for the printer's dye-sublimation RIP profile

IMPORTANT SCALE SETTINGS

- Do not use Fit, Shrink, Scale to printable area, Oversize, or automatic
  page scaling.
- Do not enlarge the artwork to create bleed. Enlarging would change the
  playable hex geometry.
- The PDF is the physical-size authority. The PNG files are visual proofs.

BLEED AND TRIM

- A1 is the finished trim size.
- The black leather background already runs to all four trim edges.
- No external printer-specific bleed has been added.
- If the manufacturer requires bleed, extend only the outer black leather
  beyond the A1 trim using their template. Keep the A1 artwork at 100%.
- Game-critical artwork is kept inside a 6 mm safety area. The outermost
  decorative stitching is intentionally nearer the trim.

NEOPRENE PRODUCTION

- Recommended process: dye sublimation onto a white polyester fabric face
  bonded to a black neoprene/rubber base.
- A 2-3 mm base is suitable for a rollable game board; confirm the chosen
  thickness and edge finish with the manufacturer.
- Disable automatic contrast, sharpening, colour enhancement, and background
  removal. Let the vendor apply only its calibrated material profile.
- All leather, brass, rivets, buttons, sockets, and stitching are printed
  artwork. They are not instructions for physical hardware or sewn details.

FINAL VENDOR CHECK

1. Confirm the finished piece will be exactly 841 x 594 mm.
2. Confirm the supplied PDF will be placed at 100% with no rescaling.
3. Confirm any required bleed is made by edge extension, not enlargement.
4. Request a colour proof or photographed material sample before the full run.
5. On the proof, check the six warehouse labels and buttons, the title plate,
   the 12 round sockets, and the I/II/III season markers for legibility.
"""
    PRINT_INSTRUCTIONS_PATH.write_text(instructions, encoding="utf-8")


def main() -> None:
    for image_path in (
        SKIN_PATH,
        TITLELESS_REPAIR_PATH,
        BUTTON_REFERENCE_PATH,
        SHADOWLESS_CORNER_PATH,
    ):
        if not image_path.exists():
            raise FileNotFoundError(image_path)
    for font_path in (
        DISPLAY_FONT_PATH,
        LABEL_FONT_PATH,
    ):
        if not font_path.exists():
            raise FileNotFoundError(font_path)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    (
        skin,
        source_size,
        corner_overlays,
        stitch_overlays,
    ) = build_print_skin()
    skin_reader = ImageReader(skin)
    map_reader = load_exact_map()

    pdf = canvas.Canvas(str(PDF_PATH), pagesize=study.PAGE_SIZE, pageCompression=1)
    pdf.setTitle("The Quiet Vale - refined handmade A1 neoprene board")
    pdf.setAuthor("The Quiet Vale project")
    pdf.setSubject("Exact-scale handmade A1 board at 60 mm tile scale")
    pdf.setCreator("design/a1-board/generate_a1_board_handmade.py")

    pdf.drawImage(
        skin_reader,
        0,
        0,
        width=study.PAGE_SIZE[0],
        height=study.PAGE_SIZE[1],
        preserveAspectRatio=False,
        mask="auto",
    )
    draw_exact_map(pdf, map_reader)
    for stitching, x_mm, y_mm, width_mm, height_mm in stitch_overlays:
        pdf.drawImage(
            ImageReader(stitching),
            study.xpt(x_mm),
            study.xpt(y_mm),
            width=study.xpt(width_mm),
            height=study.xpt(height_mm),
            preserveAspectRatio=False,
            mask="auto",
        )
    for fitting, x_mm, y_mm, width_mm, height_mm in corner_overlays:
        pdf.drawImage(
            ImageReader(fitting),
            study.xpt(x_mm),
            study.xpt(y_mm),
            width=study.xpt(width_mm),
            height=study.xpt(height_mm),
            preserveAspectRatio=False,
            mask="auto",
        )
    pdf.showPage()
    pdf.save()

    validate_and_write_manifest(source_size)
    write_neoprene_print_instructions()
    print(f"Wrote {PDF_PATH}")
    print(f"Wrote {MANIFEST_PATH}")
    print(f"Wrote {PRINT_INSTRUCTIONS_PATH}")
    print(
        "Handmade layout: exact A1, "
        f"{study.HEX_POINT_TO_POINT_MM:.1f} mm tiles, "
        "12-round tracker"
    )


if __name__ == "__main__":
    main()
