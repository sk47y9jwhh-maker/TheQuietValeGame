#!/usr/bin/env python3
"""Render The Quiet Vale A1 board as one continuous physical material object.

Only the hand-drawn map artwork and the approved project fonts are retained.
The leather, recesses, stitching, title treatment, brass fittings, punched
round sockets, lighting, and print grain are generated together from scratch.
"""

from __future__ import annotations

import argparse
import json
import math
import random
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
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[2]
ASSET_DIR = ROOT / "design/a1-board-unified/assets"
OUTPUT_DIR = ROOT / "output/pdf/a1-unified-v1"

LEATHER_SOURCE = ASSET_DIR / "unified-charcoal-leather-source-v1.png"
LEATHER_PROMPT = ASSET_DIR / (
    "unified-charcoal-leather-source-v1-prompt.txt"
)
BRASS_SOURCE = ASSET_DIR / "photographic-aged-brass-source-v1.png"
BRASS_PROMPT = ASSET_DIR / "photographic-aged-brass-source-v1-prompt.txt"
THREAD_SOURCE = ASSET_DIR / "photographic-waxed-linen-thread-source-v1.png"
THREAD_PROMPT = ASSET_DIR / (
    "photographic-waxed-linen-thread-source-v1-prompt.txt"
)
MAP_SOURCE = ROOT / "src/assets/quiet_vale_map_v02.webp"
ALMENDRA = ROOT / "src/assets/fonts/almendra-latin-regular.woff2"
ALEGREYA_SANS = (
    ROOT / "src/assets/fonts/alegreya-sans-latin-medium.woff2"
)

PREVIEW_PATH = OUTPUT_DIR / "the-quiet-vale-a1-unified-v1-preview.png"
FULL_PATH = OUTPUT_DIR / "the-quiet-vale-a1-unified-v1-full-resolution.png"
PDF_PATH = OUTPUT_DIR / "the-quiet-vale-a1-unified-v1.pdf"
MANIFEST_PATH = OUTPUT_DIR / "the-quiet-vale-a1-unified-v1.json"
PRINT_NOTES_PATH = OUTPUT_DIR / (
    "the-quiet-vale-a1-unified-v1-print-instructions.txt"
)

A1_WIDTH_MM = 841.0
A1_HEIGHT_MM = 594.0
MAP_SOURCE_WIDTH_PX = 3200
MAP_SOURCE_HEIGHT_PX = 2444
MAP_FRAME_WIDTH_MM = 714.1339
MAP_FRAME_HEIGHT_MM = 545.4286
MAP_CROP_PX = (124, 88, 3072, 2360)
MAP_CROP_WIDTH_PX = MAP_CROP_PX[2] - MAP_CROP_PX[0]
MAP_CROP_HEIGHT_PX = MAP_CROP_PX[3] - MAP_CROP_PX[1]
MAP_MM_PER_PX_X = MAP_FRAME_WIDTH_MM / MAP_SOURCE_WIDTH_PX
MAP_MM_PER_PX_Y = MAP_FRAME_HEIGHT_MM / MAP_SOURCE_HEIGHT_PX
MAP_WIDTH_MM = MAP_CROP_WIDTH_PX * MAP_MM_PER_PX_X
MAP_HEIGHT_MM = MAP_CROP_HEIGHT_PX * MAP_MM_PER_PX_Y
MAP_X_MM = (A1_WIDTH_MM - MAP_WIDTH_MM) / 2.0
MAP_TOP_MM = (A1_HEIGHT_MM - MAP_HEIGHT_MM) / 2.0
MAP_RIGHT_MM = MAP_X_MM + MAP_WIDTH_MM
MAP_BOTTOM_MM = MAP_TOP_MM + MAP_HEIGHT_MM
HEX_POINT_TO_POINT_MM = 60.0

RESOURCE_ROWS = (
    ("WOOD", "left", 0, (112, 139, 85)),
    ("STONE", "left", 1, (132, 145, 147)),
    ("METAL", "left", 2, (100, 127, 142)),
    ("FOOD", "right", 0, (190, 151, 67)),
    ("HERBS", "right", 1, (132, 105, 151)),
    ("GOODS", "right", 2, (159, 91, 61)),
)

WAREHOUSE_X_MM = 10.0
WAREHOUSE_WIDTH_MM = 71.0
WAREHOUSE_TOP_MM = 49.0
WAREHOUSE_HEIGHT_MM = 151.0
WAREHOUSE_GAP_MM = 18.5

TRACKER_ROUND_SPACING_MM = 42.5
TRACKER_SEASON_BREAK_MM = 84.5
TRACKER_SEASON_MARKER_OFFSET_MM = 22.0
TRACKER_SOCKET_RADIUS_MM = 7.6
# Centre the complete tracker row between the lower map edge and the outer
# saddle-stitch line. This is the visual centre of the usable lower leather,
# rather than the centre of the remaining sheet including its trim margin.
TRACKER_CENTER_TOP_MM = (
    MAP_BOTTOM_MM + (A1_HEIGHT_MM - 6.5)
) / 2.0

LIGHT_VECTOR = np.asarray((-0.46, -0.56, 0.69), dtype=np.float32)
LIGHT_VECTOR /= np.linalg.norm(LIGHT_VECTOR)


def px(value_mm: float, pixels_per_mm: float) -> int:
    return round(value_mm * pixels_per_mm)


def load_font(path: Path, size_mm: float, pixels_per_mm: float) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), max(1, px(size_mm, pixels_per_mm)))


def tiled_leather(
    width: int,
    height: int,
    pixels_per_mm: float,
) -> Image.Image:
    """Create one continuous leather field without visible tile seams."""

    with Image.open(LEATHER_SOURCE) as source_file:
        source = source_file.convert("RGB")

    tile_size = max(320, px(158.0, pixels_per_mm))
    tile = ImageOps.fit(
        source,
        (tile_size, tile_size),
        method=Image.Resampling.LANCZOS,
    )
    micro = Image.new("RGB", (width, height))
    row = 0
    for y in range(0, height, tile_size):
        column = 0
        for x in range(0, width, tile_size):
            segment = tile
            if column % 2:
                segment = ImageOps.mirror(segment)
            if row % 2:
                segment = ImageOps.flip(segment)
            micro.paste(segment, (x, y))
            column += 1
        row += 1

    macro = ImageOps.fit(
        source,
        (width, height),
        method=Image.Resampling.BICUBIC,
    ).filter(ImageFilter.GaussianBlur(max(1.0, pixels_per_mm * 0.7)))
    leather = Image.blend(micro, macro, 0.22)
    leather = ImageEnhance.Color(leather).enhance(0.78)
    leather = ImageEnhance.Brightness(leather).enhance(0.93)
    leather = ImageEnhance.Contrast(leather).enhance(0.96)

    # Fine dye-sublimation-safe variation breaks residual repetition while
    # keeping all raised/recessed features on exactly the same base grain.
    noise = Image.effect_noise((width, height), 7.0)
    noise = ImageOps.colorize(
        noise,
        black=(17, 20, 18),
        white=(43, 46, 41),
    )
    leather = Image.blend(leather, noise, 0.055)
    return leather


def alpha_overlay(
    image: Image.Image,
    colour: tuple[int, int, int],
    mask: Image.Image,
    opacity: float,
) -> None:
    alpha = mask.point(
        lambda value: round(value * max(0.0, min(1.0, opacity)))
    )
    overlay = Image.new("RGBA", image.size, (*colour, 0))
    overlay.putalpha(alpha)
    image.alpha_composite(overlay)


def shifted_mask(mask: Image.Image, dx: int, dy: int) -> Image.Image:
    shifted = Image.new("L", mask.size, 0)
    shifted.paste(mask, (dx, dy))
    return shifted


def render_recess(
    board: Image.Image,
    bbox_px: tuple[int, int, int, int],
    radius_px: int,
    depth_px: int,
    interior_brightness: float,
    outer_cut_opacity: float = 0.26,
) -> None:
    """Carve a rounded recess into the same leather pixels beneath it."""

    margin = max(depth_px * 2, 6)
    x0, y0, x1, y1 = bbox_px
    patch_box = (
        max(0, x0 - margin),
        max(0, y0 - margin),
        min(board.width, x1 + margin),
        min(board.height, y1 + margin),
    )
    patch = board.crop(patch_box).convert("RGBA")
    local = (
        x0 - patch_box[0],
        y0 - patch_box[1],
        x1 - patch_box[0],
        y1 - patch_box[1],
    )

    mask = Image.new("L", patch.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        local,
        radius=max(1, radius_px),
        fill=255,
    )

    interior = patch.convert("RGB")
    interior = ImageEnhance.Brightness(interior).enhance(interior_brightness)
    interior = ImageEnhance.Color(interior).enhance(0.82)
    interior_rgba = interior.convert("RGBA")
    patch.paste(interior_rgba, (0, 0), mask)

    # Recess walls are lit consistently from the global upper-left direction:
    # the upper/left walls darken and the lower/right walls catch restrained
    # reflected light. Every effect remains within the carved silhouette.
    top_edge = ImageChops.subtract(mask, shifted_mask(mask, 0, depth_px))
    left_edge = ImageChops.subtract(mask, shifted_mask(mask, depth_px, 0))
    bottom_edge = ImageChops.subtract(mask, shifted_mask(mask, 0, -depth_px))
    right_edge = ImageChops.subtract(mask, shifted_mask(mask, -depth_px, 0))
    blur_radius = max(0.65, depth_px * 0.34)
    dark = ImageChops.lighter(top_edge, left_edge).filter(
        ImageFilter.GaussianBlur(blur_radius)
    )
    light = ImageChops.lighter(bottom_edge, right_edge).filter(
        ImageFilter.GaussianBlur(blur_radius)
    )

    # A compressed cut line is part of the leather itself, not a raised frame.
    expanded = mask.filter(
        ImageFilter.MaxFilter(max(3, depth_px * 2 + 1))
    )
    outer_cut = ImageChops.subtract(expanded, mask).filter(
        ImageFilter.GaussianBlur(max(0.45, depth_px * 0.16))
    )
    alpha_overlay(patch, (5, 7, 6), outer_cut, outer_cut_opacity)
    alpha_overlay(patch, (3, 4, 4), dark, 0.61)
    alpha_overlay(patch, (104, 99, 82), light, 0.20)

    board.alpha_composite(patch, (patch_box[0], patch_box[1]))


def rounded_rect_path(
    bbox: tuple[float, float, float, float],
    radius: float,
    arc_steps: int = 14,
) -> list[tuple[float, float]]:
    x0, y0, x1, y1 = bbox
    radius = min(radius, (x1 - x0) / 2.0, (y1 - y0) / 2.0)
    points: list[tuple[float, float]] = []

    def arc(cx: float, cy: float, start: float, end: float) -> None:
        for index in range(arc_steps + 1):
            angle = math.radians(
                start + (end - start) * index / arc_steps
            )
            points.append(
                (
                    cx + math.cos(angle) * radius,
                    cy + math.sin(angle) * radius,
                )
            )

    points.append((x0 + radius, y0))
    points.append((x1 - radius, y0))
    arc(x1 - radius, y0 + radius, -90, 0)
    points.append((x1, y1 - radius))
    arc(x1 - radius, y1 - radius, 0, 90)
    points.append((x0 + radius, y1))
    arc(x0 + radius, y1 - radius, 90, 180)
    points.append((x0, y0 + radius))
    arc(x0 + radius, y0 + radius, 180, 270)
    points.append((x0 + radius, y0))
    return points


def resample_path(
    points: list[tuple[float, float]],
    spacing: float = 1.0,
) -> list[tuple[float, float]]:
    sampled: list[tuple[float, float]] = [points[0]]
    carry = 0.0
    for start, end in zip(points, points[1:]):
        dx = end[0] - start[0]
        dy = end[1] - start[1]
        length = math.hypot(dx, dy)
        if length <= 0:
            continue
        distance = spacing - carry
        while distance <= length:
            t = distance / length
            sampled.append((start[0] + dx * t, start[1] + dy * t))
            distance += spacing
        carry = max(0.0, length - (distance - spacing))
        carry %= spacing
    return sampled


_THREAD_STRIP_CACHE: Image.Image | None = None


def load_thread_strip() -> Image.Image:
    """Load the isolated photographed cord and trim transparent padding."""

    global _THREAD_STRIP_CACHE
    if _THREAD_STRIP_CACHE is None:
        with Image.open(THREAD_SOURCE) as source:
            thread = source.convert("RGBA")
        bounds = thread.getchannel("A").getbbox()
        if bounds is None:
            raise RuntimeError(f"No opaque thread pixels found in {THREAD_SOURCE}")
        _THREAD_STRIP_CACHE = thread.crop(bounds)
    return _THREAD_STRIP_CACHE


def tint_thread_strip(
    strip: Image.Image,
    colour: tuple[int, int, int],
) -> Image.Image:
    """Re-dye photographed linen while preserving its fibre luminance."""

    values = np.asarray(strip, dtype=np.float32)
    rgb = values[:, :, :3]
    alpha = values[:, :, 3]
    luminance = (
        rgb[:, :, 0] * 0.2126
        + rgb[:, :, 1] * 0.7152
        + rgb[:, :, 2] * 0.0722
    )
    # The photographed cord ranges from deep ply creases to small wax catches.
    # Map that real luminance onto each resource colour rather than painting a
    # flat coloured stroke over the leather.
    tone = np.clip((luminance - 48.0) / 205.0, 0.0, 1.0)
    target = np.asarray(colour, dtype=np.float32)
    dark = target * 0.34
    light = np.clip(target * 1.28 + 42.0, 0.0, 255.0)
    dyed = dark[None, None, :] + (
        light - dark
    )[None, None, :] * tone[:, :, None]

    # Retain a little neutral photographic fibre information so the coloured
    # threads still have wax, fuzz, and distinct twisted plies.
    neutral = np.repeat(luminance[:, :, None], 3, axis=2)
    dyed = dyed * 0.88 + neutral * 0.12
    result = np.dstack((np.clip(dyed, 0, 255), alpha))
    return Image.fromarray(
        np.rint(result).astype(np.uint8),
        mode="RGBA",
    )


def draw_stitch_puncture(
    board: Image.Image,
    point: tuple[float, float],
    angle_radians: float,
    pixels_per_mm: float,
) -> None:
    """Compress a small angled needle slit into the leather."""

    radius = max(3, px(0.72, pixels_per_mm))
    size = radius * 4 + 1
    centre = size // 2
    patch = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # A narrow slit is cut at a traditional saddle-stitch angle. Its minute
    # lower lip catches the same upper-left global light used elsewhere.
    slit_length = max(3, px(1.05, pixels_per_mm))
    slit_width = max(1, px(0.22, pixels_per_mm))
    slit_angle = angle_radians + math.radians(58.0)
    dx = math.cos(slit_angle) * slit_length / 2.0
    dy = math.sin(slit_angle) * slit_length / 2.0

    compression = Image.new("L", patch.size, 0)
    compression_draw = ImageDraw.Draw(compression)
    compression_draw.ellipse(
        (
            centre - radius,
            centre - radius,
            centre + radius,
            centre + radius,
        ),
        fill=105,
    )
    compression = compression.filter(
        ImageFilter.GaussianBlur(max(0.6, px(0.20, pixels_per_mm)))
    )
    dark = Image.new("RGBA", patch.size, (2, 3, 3, 0))
    dark.putalpha(compression)
    patch.alpha_composite(dark)

    slit = Image.new("RGBA", patch.size, (0, 0, 0, 0))
    slit_draw = ImageDraw.Draw(slit)
    slit_draw.line(
        (
            centre - dx,
            centre - dy,
            centre + dx,
            centre + dy,
        ),
        fill=(1, 2, 2, 225),
        width=slit_width,
    )
    slit = slit.filter(
        ImageFilter.GaussianBlur(max(0.25, px(0.055, pixels_per_mm)))
    )
    patch.alpha_composite(slit)

    lip = Image.new("RGBA", patch.size, (0, 0, 0, 0))
    lip_draw = ImageDraw.Draw(lip)
    lip_draw.line(
        (
            centre - dx + 1,
            centre - dy + 1,
            centre + dx + 1,
            centre + dy + 1,
        ),
        fill=(113, 101, 78, 58),
        width=max(1, slit_width // 2),
    )
    patch.alpha_composite(lip)

    target = (
        round(point[0] - centre),
        round(point[1] - centre),
    )
    board.alpha_composite(patch, target)


def build_photographic_stitch_segment(
    tinted_strip: Image.Image,
    length_px: int,
    width_px: int,
    rng: random.Random,
) -> Image.Image:
    """Cut a unique photographed fibre section for one hand-set stitch."""

    aspect = max(1.8, length_px / max(1, width_px))
    crop_height = tinted_strip.height
    crop_width = min(
        tinted_strip.width,
        max(12, round(crop_height * aspect)),
    )
    max_left = max(0, tinted_strip.width - crop_width)
    left = rng.randint(0, max_left) if max_left else 0
    sample = tinted_strip.crop(
        (left, 0, left + crop_width, tinted_strip.height)
    )
    sample = sample.resize(
        (max(2, length_px), max(2, width_px)),
        Image.Resampling.LANCZOS,
    )

    # Linen disappears into each puncture rather than ending as a clipped
    # rectangular photograph. Preserve stray fibres while tapering only the
    # core opacity near the insertion points.
    values = np.asarray(sample, dtype=np.uint8).copy()
    alpha = values[:, :, 3].astype(np.float32)
    x = np.arange(sample.width, dtype=np.float32)
    taper_width = max(1.0, sample.width * 0.13)
    taper = np.minimum(
        np.clip(x / taper_width, 0.0, 1.0),
        np.clip((sample.width - 1 - x) / taper_width, 0.0, 1.0),
    )
    taper = np.sqrt(np.clip(taper, 0.0, 1.0))
    values[:, :, 3] = np.rint(
        np.clip(alpha * taper[None, :], 0, 255)
    ).astype(np.uint8)
    return Image.fromarray(values, mode="RGBA")


def place_photographic_stitch(
    board: Image.Image,
    segment: Image.Image,
    start: tuple[float, float],
    end: tuple[float, float],
    pixels_per_mm: float,
) -> None:
    """Seat one photographed cord segment into two leather punctures."""

    angle = math.atan2(end[1] - start[1], end[0] - start[0])
    rotated = segment.rotate(
        -math.degrees(angle),
        resample=Image.Resampling.BICUBIC,
        expand=True,
    )
    centre = (
        (start[0] + end[0]) / 2.0,
        (start[1] + end[1]) / 2.0,
    )
    target = (
        round(centre[0] - rotated.width / 2.0),
        round(centre[1] - rotated.height / 2.0),
    )

    # A tight, low-opacity contact occlusion belongs to the cord/leather
    # interface. It is not a detached drop shadow.
    contact_alpha = rotated.getchannel("A").filter(
        ImageFilter.GaussianBlur(max(0.7, px(0.18, pixels_per_mm)))
    ).point(lambda value: round(value * 0.33))
    contact = Image.new("RGBA", rotated.size, (2, 3, 3, 0))
    contact.putalpha(contact_alpha)
    offset = max(1, px(0.16, pixels_per_mm))
    board.alpha_composite(
        contact,
        (target[0] + offset, target[1] + offset),
    )
    board.alpha_composite(rotated, target)


def draw_stitch_path(
    board: Image.Image,
    points: list[tuple[float, float]],
    colour: tuple[int, int, int],
    pixels_per_mm: float,
    seed: int,
) -> None:
    """Lay photographed waxed linen through physical leather punctures."""

    rng = random.Random(seed)
    sampled = resample_path(points, spacing=1.0)
    tinted_strip = tint_thread_strip(load_thread_strip(), colour)
    thread_width = max(4, px(1.05, pixels_per_mm))
    cursor = 0
    is_stitch = True
    while cursor < len(sampled) - 1:
        if is_stitch:
            length_mm = 3.9 + rng.uniform(-0.34, 0.34)
        else:
            length_mm = 2.45 + rng.uniform(-0.28, 0.28)
        count = max(2, round(length_mm * pixels_per_mm))
        end_index = min(len(sampled) - 1, cursor + count)
        if is_stitch and end_index > cursor:
            start = sampled[cursor]
            end = sampled[end_index]
            angle = math.atan2(end[1] - start[1], end[0] - start[0])
            draw_stitch_puncture(
                board,
                start,
                angle,
                pixels_per_mm,
            )
            draw_stitch_puncture(
                board,
                end,
                angle,
                pixels_per_mm,
            )
            physical_length = max(
                2,
                round(math.hypot(end[0] - start[0], end[1] - start[1])),
            )
            stitch = build_photographic_stitch_segment(
                tinted_strip,
                physical_length + max(2, px(0.36, pixels_per_mm)),
                thread_width + rng.choice((-1, 0, 0, 1)),
                rng,
            )
            place_photographic_stitch(
                board,
                stitch,
                start,
                end,
                pixels_per_mm,
            )
        cursor = end_index
        is_stitch = not is_stitch


def material_text_mask(
    text: str,
    font: ImageFont.FreeTypeFont,
    padding: int = 8,
) -> tuple[Image.Image, tuple[int, int]]:
    bounds = font.getbbox(text)
    width = bounds[2] - bounds[0] + padding * 2
    height = bounds[3] - bounds[1] + padding * 2
    mask = Image.new("L", (max(1, width), max(1, height)), 0)
    drawing = ImageDraw.Draw(mask)
    drawing.text(
        (padding - bounds[0], padding - bounds[1]),
        text,
        font=font,
        fill=255,
    )
    return mask, (width, height)


def draw_material_text(
    board: Image.Image,
    text: str,
    center_mm: tuple[float, float],
    font_path: Path,
    size_mm: float,
    colour: tuple[int, int, int],
    pixels_per_mm: float,
    seed: int,
    opacity: float = 0.93,
) -> None:
    font = load_font(font_path, size_mm, pixels_per_mm)
    mask, size = material_text_mask(text, font, padding=max(5, px(0.8, pixels_per_mm)))
    rng = np.random.default_rng(seed)
    wear = rng.uniform(0.82, 1.0, (mask.height, mask.width))
    mask_values = np.asarray(mask, dtype=np.float32) * wear
    mask = Image.fromarray(
        np.rint(np.clip(mask_values, 0, 255)).astype(np.uint8),
        mode="L",
    ).filter(ImageFilter.GaussianBlur(max(0.08, pixels_per_mm * 0.025)))

    center_x = px(center_mm[0], pixels_per_mm)
    center_y = px(center_mm[1], pixels_per_mm)
    target = (
        round(center_x - size[0] / 2),
        round(center_y - size[1] / 2),
    )

    patch = board.crop(
        (
            target[0],
            target[1],
            target[0] + size[0],
            target[1] + size[1],
        )
    ).convert("RGB")
    # The lettering is pressed into the leather rather than laid over it as
    # flat printed ink. Retain the local hide grain in the letter bed and use
    # only a restrained trace of warm pigment caught in the compression.
    compressed = Image.blend(
        patch,
        Image.new("RGB", size, (24, 22, 18)),
        0.34,
    )
    pigment = Image.blend(
        compressed,
        Image.new("RGB", size, colour),
        0.42,
    )

    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    # A pressed groove has a dark upper-left wall and a restrained reflected
    # lip on its lower-right edge. Both stay inside the glyph so the stamp
    # remains physically part of the leather surface.
    dark_edge = ImageChops.subtract(mask, shifted_mask(mask, 1, 1))
    dark = Image.new("RGBA", size, (2, 3, 2, 0))
    dark.putalpha(dark_edge.point(lambda value: round(value * 0.76)))
    layer.alpha_composite(dark)

    pigment_rgba = pigment.convert("RGBA")
    pigment_rgba.putalpha(
        mask.point(lambda value: round(value * opacity * 0.96))
    )
    layer.alpha_composite(pigment_rgba)

    highlight_edge = ImageChops.subtract(mask, shifted_mask(mask, -1, -1))
    highlight = Image.new("RGBA", size, (205, 183, 132, 0))
    highlight.putalpha(
        highlight_edge.point(lambda value: round(value * opacity * 0.42))
    )
    layer.alpha_composite(highlight)
    board.alpha_composite(layer, target)


_BRASS_TEXTURE_CACHE: Image.Image | None = None


def load_brass_texture() -> Image.Image:
    """Load the newly photographed aged-brass material field."""

    global _BRASS_TEXTURE_CACHE
    if _BRASS_TEXTURE_CACHE is None:
        with Image.open(BRASS_SOURCE) as source:
            _BRASS_TEXTURE_CACHE = source.convert("RGB")
    return _BRASS_TEXTURE_CACHE


def brass_material_patch(
    size: int,
    seed: int,
) -> tuple[np.ndarray, np.ndarray]:
    """Sample real brass wear and remap it to a restrained aged palette."""

    source = load_brass_texture()
    rng = random.Random(seed)
    # Use a tighter crop than the full material sheet so real scratches and
    # pitting survive the reduction to a 27 mm fitting at print resolution.
    crop_side = round(min(source.width, source.height) * 0.68)
    left = rng.randint(0, max(0, source.width - crop_side))
    top = rng.randint(0, max(0, source.height - crop_side))
    texture = source.crop(
        (left, top, left + crop_side, top + crop_side)
    ).resize((size, size), Image.Resampling.LANCZOS).filter(
        ImageFilter.UnsharpMask(radius=1.0, percent=100, threshold=2)
    )

    values = np.asarray(texture, dtype=np.float32)
    luminance = (
        values[:, :, 0] * 0.2126
        + values[:, :, 1] * 0.7152
        + values[:, :, 2] * 0.0722
    )
    tone = np.clip((luminance - 45.0) / 185.0, 0.0, 1.0)
    shadow = np.asarray((57.0, 51.0, 40.0), dtype=np.float32)
    mid = np.asarray((139.0, 119.0, 82.0), dtype=np.float32)
    high = np.asarray((207.0, 185.0, 130.0), dtype=np.float32)
    lower = np.clip(tone * 2.0, 0.0, 1.0)
    upper = np.clip((tone - 0.5) * 2.0, 0.0, 1.0)
    base = shadow[None, None, :] * (1.0 - lower[:, :, None])
    base += mid[None, None, :] * lower[:, :, None]
    base = base * (1.0 - upper[:, :, None])
    base += high[None, None, :] * upper[:, :, None]

    # Preserve subtle hue differences from real tarnish, without returning to
    # the bright yellow-gold of a new polished plate.
    chroma = values - luminance[:, :, None]
    photographic_colour = values * np.asarray(
        (0.73, 0.69, 0.59),
        dtype=np.float32,
    )[None, None, :]
    base = base * 0.78 + photographic_colour * 0.22
    base_luminance = (
        base[:, :, 0] * 0.2126
        + base[:, :, 1] * 0.7152
        + base[:, :, 2] * 0.0722
    )
    base = base * 0.90 + base_luminance[:, :, None] * 0.10

    # High-frequency luminance from the photograph becomes minute physical
    # relief, so pitting and worked scratches affect light as well as colour.
    luminance_image = Image.fromarray(
        np.rint(np.clip(luminance, 0, 255)).astype(np.uint8),
        mode="L",
    )
    local_average = np.asarray(
        luminance_image.filter(
            ImageFilter.GaussianBlur(max(1.0, size * 0.009))
        ),
        dtype=np.float32,
    )
    micro_relief = np.clip(
        (luminance - local_average) / 108.0,
        -1.0,
        1.0,
    )
    return (
        np.clip(base + chroma * 0.10, 0, 255),
        micro_relief,
    )


def antialiased_fitting_mask(
    size: int,
    arm: int,
    radius: int,
    pixels_per_mm: float,
    horizontal_sign: int,
    vertical_sign: int,
) -> Image.Image:
    """Cut a smooth, hand-worked L silhouette at four-times resolution."""

    supersample = 4
    high_size = size * supersample
    high = Image.new("L", (high_size, high_size), 0)
    drawing = ImageDraw.Draw(high)
    drawing.rounded_rectangle(
        (0, 0, high_size - 1, high_size - 1),
        radius=radius * supersample,
        fill=255,
    )
    notch_extension = px(5.8, pixels_per_mm) * supersample
    drawing.rounded_rectangle(
        (
            arm * supersample,
            arm * supersample,
            high_size + notch_extension,
            high_size + notch_extension,
        ),
        radius=px(5.8, pixels_per_mm) * supersample,
        fill=0,
    )
    mask = high.resize(
        (size, size),
        Image.Resampling.LANCZOS,
    )
    if horizontal_sign < 0:
        mask = ImageOps.mirror(mask)
    if vertical_sign < 0:
        mask = ImageOps.flip(mask)
    return mask


def render_brass_fitting(
    board: Image.Image,
    map_corner_mm: tuple[float, float],
    horizontal_sign: int,
    vertical_sign: int,
    pixels_per_mm: float,
    seed: int,
    patina_strength: float = 0.0,
) -> None:
    """Shape photographed aged brass into one physically lit corner clip."""

    size_mm = 27.0
    arm_mm = 8.7
    outside_mm = 4.2
    size = px(size_mm, pixels_per_mm)
    arm = px(arm_mm, pixels_per_mm)
    radius = px(2.6, pixels_per_mm)

    if horizontal_sign > 0:
        left_mm = map_corner_mm[0] - outside_mm
    else:
        left_mm = map_corner_mm[0] - size_mm + outside_mm
    if vertical_sign > 0:
        top_mm = map_corner_mm[1] - outside_mm
    else:
        top_mm = map_corner_mm[1] - size_mm + outside_mm
    patch_left = px(left_mm, pixels_per_mm)
    patch_top = px(top_mm, pixels_per_mm)

    mask = antialiased_fitting_mask(
        size,
        arm,
        radius,
        pixels_per_mm,
        horizontal_sign,
        vertical_sign,
    )
    if horizontal_sign > 0:
        rivet_x = px(outside_mm, pixels_per_mm)
    else:
        rivet_x = size - px(outside_mm, pixels_per_mm)
    if vertical_sign > 0:
        rivet_y = px(outside_mm, pixels_per_mm)
    else:
        rivet_y = size - px(outside_mm, pixels_per_mm)

    mask_values = np.asarray(mask, dtype=np.float32) / 255.0
    softened = np.asarray(
        mask.filter(
            ImageFilter.GaussianBlur(max(0.8, px(0.72, pixels_per_mm)))
        ),
        dtype=np.float32,
    ) / 255.0
    plate_height = softened * mask_values

    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    rivet_radius = px(2.9, pixels_per_mm)
    rivet_distance = np.sqrt(
        (xx - rivet_x) ** 2 + (yy - rivet_y) ** 2
    )
    dome = np.sqrt(
        np.clip(
            1.0 - (rivet_distance / max(1, rivet_radius)) ** 2,
            0.0,
            1.0,
        )
    )
    base, micro_relief = brass_material_patch(size, seed)
    height = plate_height + dome * 3.15
    height += micro_relief * mask_values * 0.065
    gradient_y, gradient_x = np.gradient(height)
    normal_x = -gradient_x * 10.5
    normal_y = -gradient_y * 10.5
    normal_z = np.ones_like(height)
    normal_length = np.sqrt(
        normal_x**2 + normal_y**2 + normal_z**2
    )
    normal_x /= normal_length
    normal_y /= normal_length
    normal_z /= normal_length
    diffuse = np.clip(
        normal_x * LIGHT_VECTOR[0]
        + normal_y * LIGHT_VECTOR[1]
        + normal_z * LIGHT_VECTOR[2],
        0.0,
        1.0,
    )

    lighting = 0.53 + diffuse * 0.63
    specular = np.power(diffuse, 20.0) * 78.0
    rgb = base * lighting[:, :, None] + specular[:, :, None]

    # A small reflected catch in the domed rivet follows the same upper-left
    # light, but remains broken by the photographed tarnish beneath it.
    glint_x = rivet_x - rivet_radius * 0.34
    glint_y = rivet_y - rivet_radius * 0.38
    glint_sigma = max(1.0, rivet_radius * 0.19)
    rivet_glint = np.exp(
        -(
            (xx - glint_x) ** 2
            + (yy - glint_y) ** 2
        )
        / (2.0 * glint_sigma**2)
    )
    rivet_glint *= (rivet_distance <= rivet_radius).astype(np.float32)
    rgb += rivet_glint[:, :, None] * np.asarray(
        (75.0, 68.0, 49.0),
        dtype=np.float32,
    )

    # Dark oxidation remains in the deepest cut perimeter; raised edges are
    # modestly polished in the upper-left and shaded on the lower-right.
    erosion_width = max(3, px(0.62, pixels_per_mm))
    if erosion_width % 2 == 0:
        erosion_width += 1
    eroded = mask.filter(ImageFilter.MinFilter(erosion_width))
    edge_ring = np.asarray(
        ImageChops.subtract(mask, eroded),
        dtype=np.float32,
    ) / 255.0
    rgb *= 1.0 - edge_ring[:, :, None] * 0.20

    # Patina grows irregularly in pits and sheltered perimeter areas rather
    # than sitting over the brass as a uniform green tint. Broad, soft fields
    # are broken up by the photographed metal relief and leave raised areas
    # comparatively polished.
    if patina_strength > 0.0:
        patina_rng = np.random.default_rng(seed + 19073)
        noise_side = max(5, round(size / 22))
        patina_noise = Image.fromarray(
            np.rint(
                patina_rng.random((noise_side, noise_side)) * 255.0
            ).astype(np.uint8),
            mode="L",
        ).resize((size, size), Image.Resampling.BICUBIC).filter(
            ImageFilter.GaussianBlur(max(1.0, size * 0.018))
        )
        patina_field = np.asarray(patina_noise, dtype=np.float32) / 255.0
        base_value = (
            base[:, :, 0] * 0.2126
            + base[:, :, 1] * 0.7152
            + base[:, :, 2] * 0.0722
        ) / 255.0
        sheltered = np.clip(1.0 - base_value, 0.0, 1.0)
        mottling = np.clip((patina_field - 0.48) * 2.45, 0.0, 1.0)
        patina_mask = (
            mottling * (0.18 + sheltered * 0.56)
            + edge_ring * (0.18 + mottling * 0.24)
        )
        patina_mask *= mask_values * min(1.0, patina_strength)
        verdigris = np.asarray(
            (49.0, 88.0, 72.0),
            dtype=np.float32,
        )
        oxide = np.asarray(
            (50.0, 48.0, 39.0),
            dtype=np.float32,
        )
        patina_colour = (
            verdigris[None, None, :] * (0.54 + mottling[:, :, None] * 0.22)
            + oxide[None, None, :]
            * (0.46 - mottling[:, :, None] * 0.22)
        )
        blend = np.clip(patina_mask * 0.68, 0.0, 0.52)
        rgb = (
            rgb * (1.0 - blend[:, :, None])
            + patina_colour * blend[:, :, None]
        )

    bevel_distance = max(2, px(1.15, pixels_per_mm))
    top_bevel = ImageChops.subtract(
        mask,
        shifted_mask(mask, 0, bevel_distance),
    )
    left_bevel = ImageChops.subtract(
        mask,
        shifted_mask(mask, bevel_distance, 0),
    )
    bottom_bevel = ImageChops.subtract(
        mask,
        shifted_mask(mask, 0, -bevel_distance),
    )
    right_bevel = ImageChops.subtract(
        mask,
        shifted_mask(mask, -bevel_distance, 0),
    )
    lit_bevel = np.asarray(
        ImageChops.lighter(top_bevel, left_bevel).filter(
            ImageFilter.GaussianBlur(max(0.45, px(0.10, pixels_per_mm)))
        ),
        dtype=np.float32,
    ) / 255.0
    shaded_bevel = np.asarray(
        ImageChops.lighter(bottom_bevel, right_bevel).filter(
            ImageFilter.GaussianBlur(max(0.45, px(0.10, pixels_per_mm)))
        ),
        dtype=np.float32,
    ) / 255.0
    rgb += lit_bevel[:, :, None] * np.asarray(
        (47.0, 41.0, 27.0),
        dtype=np.float32,
    )
    rgb *= 1.0 - shaded_bevel[:, :, None] * 0.25

    # A dark, compressed collar seats the domed rivet into the same plate.
    collar_outer = np.clip(
        1.0 - np.abs(rivet_distance - rivet_radius * 1.05)
        / max(1.0, px(0.60, pixels_per_mm)),
        0.0,
        1.0,
    )
    collar_outer *= mask_values
    rgb *= 1.0 - collar_outer[:, :, None] * 0.35
    if patina_strength > 0.0:
        deposit = (
            edge_ring * (0.16 + mottling * 0.34)
            + collar_outer * (0.10 + mottling * 0.30)
        )
        deposit = np.clip(
            deposit * min(1.0, patina_strength),
            0.0,
            0.38,
        )
        deep_verdigris = np.asarray(
            (38.0, 73.0, 61.0),
            dtype=np.float32,
        )
        rgb = (
            rgb * (1.0 - deposit[:, :, None])
            + deep_verdigris[None, None, :] * deposit[:, :, None]
        )

    brass = Image.fromarray(
        np.rint(np.clip(rgb, 0, 255)).astype(np.uint8),
        mode="RGB",
    ).convert("RGBA")
    brass.putalpha(mask)

    # Seat the metal with only a sub-millimetre contact occlusion. This is
    # physically attached to the edge and cannot read as a floating drop
    # shadow pasted beneath a separate image.
    margin = max(3, px(1.2, pixels_per_mm))
    contact_mask = Image.new(
        "L",
        (size + margin * 2, size + margin * 2),
        0,
    )
    contact_mask.paste(mask, (margin, margin))
    contact_mask = contact_mask.filter(
        ImageFilter.GaussianBlur(max(0.8, px(0.33, pixels_per_mm)))
    ).point(lambda value: round(value * 0.22))
    contact = Image.new("RGBA", contact_mask.size, (5, 4, 3, 0))
    contact.putalpha(contact_mask)
    contact_offset = max(1, px(0.18, pixels_per_mm))
    board.alpha_composite(
        contact,
        (
            patch_left - margin + contact_offset,
            patch_top - margin + contact_offset,
        ),
    )
    board.alpha_composite(brass, (patch_left, patch_top))


def round_tracker_centers_mm(
    offset_x_mm: float = 0.0,
) -> list[float]:
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
    occupied = sum(intervals)
    first = (
        offset_x_mm
        + MAP_X_MM
        + (MAP_WIDTH_MM - occupied) / 2.0
    )
    centers = [first]
    for interval in intervals:
        centers.append(centers[-1] + interval)
    return centers


def draw_outer_finish(board: Image.Image, pixels_per_mm: float) -> None:
    width, height = board.size
    edge = px(2.2, pixels_per_mm)
    overlay = Image.new("RGBA", board.size, (0, 0, 0, 0))
    drawing = ImageDraw.Draw(overlay)
    for index in range(edge):
        opacity = round(82 * (1.0 - index / max(1, edge)))
        drawing.rectangle(
            (index, index, width - 1 - index, height - 1 - index),
            outline=(2, 4, 3, opacity),
            width=1,
        )
    board.alpha_composite(overlay)

    stitch_box = (
        px(6.5, pixels_per_mm),
        px(6.5, pixels_per_mm),
        width - px(6.5, pixels_per_mm),
        height - px(6.5, pixels_per_mm),
    )
    path = rounded_rect_path(
        stitch_box,
        px(4.0, pixels_per_mm),
    )
    draw_stitch_path(
        board,
        path,
        (157, 119, 78),
        pixels_per_mm,
        seed=98031,
    )


def draw_map_stitching(
    board: Image.Image,
    pixels_per_mm: float,
    offset_mm: tuple[float, float] = (0.0, 0.0),
) -> None:
    offset_x_mm, offset_y_mm = offset_mm
    inset = px(2.7, pixels_per_mm)
    path = rounded_rect_path(
        (
            px(MAP_X_MM + offset_x_mm, pixels_per_mm) - inset,
            px(MAP_TOP_MM + offset_y_mm, pixels_per_mm) - inset,
            px(MAP_RIGHT_MM + offset_x_mm, pixels_per_mm) + inset,
            px(MAP_BOTTOM_MM + offset_y_mm, pixels_per_mm) + inset,
        ),
        px(1.4, pixels_per_mm),
        arc_steps=6,
    )
    draw_stitch_path(
        board,
        path,
        (145, 108, 71),
        pixels_per_mm,
        seed=44413,
    )


def draw_warehouses(
    board: Image.Image,
    pixels_per_mm: float,
    offset_mm: tuple[float, float] = (0.0, 0.0),
    layout_width_mm: float = A1_WIDTH_MM,
    warehouse_x_mm: float = WAREHOUSE_X_MM,
    warehouse_width_mm: float = WAREHOUSE_WIDTH_MM,
    warehouse_top_mm: float = WAREHOUSE_TOP_MM,
    warehouse_height_mm: float = WAREHOUSE_HEIGHT_MM,
    warehouse_gap_mm: float = WAREHOUSE_GAP_MM,
    warehouse_label_size_mm: float = 7.0,
) -> None:
    offset_x_mm, offset_y_mm = offset_mm
    for resource, side, row, thread_colour in RESOURCE_ROWS:
        x_mm = (
            offset_x_mm + warehouse_x_mm
            if side == "left"
            else (
                offset_x_mm
                + layout_width_mm
                - warehouse_x_mm
                - warehouse_width_mm
            )
        )
        top_mm = (
            offset_y_mm
            + warehouse_top_mm
            + row * (warehouse_height_mm + warehouse_gap_mm)
        )
        bbox = (
            px(x_mm, pixels_per_mm),
            px(top_mm, pixels_per_mm),
            px(x_mm + warehouse_width_mm, pixels_per_mm),
            px(top_mm + warehouse_height_mm, pixels_per_mm),
        )
        render_recess(
            board,
            bbox,
            radius_px=px(7.5, pixels_per_mm),
            depth_px=max(3, px(2.1, pixels_per_mm)),
            interior_brightness=0.73,
        )

        stitch_inset = px(4.2, pixels_per_mm)
        stitch_path = rounded_rect_path(
            (
                bbox[0] + stitch_inset,
                bbox[1] + stitch_inset,
                bbox[2] - stitch_inset,
                bbox[3] - stitch_inset,
            ),
            px(5.1, pixels_per_mm),
        )
        draw_stitch_path(
            board,
            stitch_path,
            thread_colour,
            pixels_per_mm,
            seed=1100 + row + (0 if side == "left" else 20),
        )
        draw_material_text(
            board,
            resource,
            (
                x_mm + warehouse_width_mm / 2.0,
                top_mm + 17.5,
            ),
            ALMENDRA,
            warehouse_label_size_mm,
            (206, 192, 154),
            pixels_per_mm,
            seed=2400 + row + (0 if side == "left" else 20),
        )


def draw_round_tracker(
    board: Image.Image,
    pixels_per_mm: float,
    offset_x_mm: float = 0.0,
    center_y_mm: float = TRACKER_CENTER_TOP_MM,
    socket_radius_mm: float = TRACKER_SOCKET_RADIUS_MM,
    round_number_size_mm: float = 4.8,
    season_marker_size_mm: float = 4.4,
    season_marker_offset_mm: float = TRACKER_SEASON_MARKER_OFFSET_MM,
    centers_mm: list[float] | None = None,
) -> None:
    centers = (
        round_tracker_centers_mm(offset_x_mm)
        if centers_mm is None
        else centers_mm
    )
    if len(centers) != 12:
        raise ValueError("Round tracker requires exactly twelve centres")
    for index, center_x in enumerate(centers, start=1):
        radius_px = px(socket_radius_mm, pixels_per_mm)
        center_px = (
            px(center_x, pixels_per_mm),
            px(center_y_mm, pixels_per_mm),
        )
        render_recess(
            board,
            (
                center_px[0] - radius_px,
                center_px[1] - radius_px,
                center_px[0] + radius_px,
                center_px[1] + radius_px,
            ),
            radius_px=radius_px,
            depth_px=max(3, px(2.4, pixels_per_mm)),
            interior_brightness=0.56,
            outer_cut_opacity=0.18,
        )
        draw_material_text(
            board,
            str(index),
            (center_x, center_y_mm),
            ALEGREYA_SANS,
            round_number_size_mm,
            (194, 170, 111),
            pixels_per_mm,
            seed=8000 + index,
            opacity=0.92,
        )

    for start_index, marker in zip((0, 4, 8), ("I", "II", "III")):
        draw_material_text(
            board,
            marker,
            (
                centers[start_index] - season_marker_offset_mm,
                center_y_mm,
            ),
            ALMENDRA,
            season_marker_size_mm,
            (190, 170, 121),
            pixels_per_mm,
            seed=9000 + start_index,
            opacity=0.90,
        )


def draw_title(
    board: Image.Image,
    pixels_per_mm: float,
    center_x_mm: float = A1_WIDTH_MM / 2.0,
    main_y_mm: float = 17.0,
    subtitle_y_mm: float = 29.0,
    main_size_mm: float = 8.2,
    subtitle_size_mm: float = 2.65,
) -> None:
    draw_material_text(
        board,
        "THE QUIET VALE",
        (center_x_mm, main_y_mm),
        ALMENDRA,
        main_size_mm,
        (215, 202, 164),
        pixels_per_mm,
        seed=54120,
        opacity=0.94,
    )
    draw_material_text(
        board,
        "SEASONS OF SETTLEMENT",
        (center_x_mm, subtitle_y_mm),
        ALEGREYA_SANS,
        subtitle_size_mm,
        (164, 143, 101),
        pixels_per_mm,
        seed=54121,
        opacity=0.90,
    )


def age_exposed_map_paper(
    map_image: Image.Image,
    source_pixels_per_mm: float,
    strength: float,
    seed: int,
) -> Image.Image:
    """Add restrained edge patina only to pale, unmarked map paper."""

    if strength <= 0.0:
        return map_image

    rgb = map_image.convert("RGB")
    values = np.asarray(rgb, dtype=np.float32)
    luminance = (
        values[:, :, 0] * 0.2126
        + values[:, :, 1] * 0.7152
        + values[:, :, 2] * 0.0722
    )
    chroma = values.max(axis=2) - values.min(axis=2)

    # Keep linework, painted terrain and coloured hex art untouched. A small
    # dilation around dark marks also prevents the patina from muddying ink.
    ink = Image.fromarray(
        np.where(luminance < 126.0, 255, 0).astype(np.uint8),
        mode="L",
    )
    ink_guard_size = max(3, px(1.35, source_pixels_per_mm))
    if ink_guard_size % 2 == 0:
        ink_guard_size += 1
    ink_guard = np.asarray(
        ink.filter(ImageFilter.MaxFilter(ink_guard_size)),
        dtype=np.float32,
    ) / 255.0
    exposed_paper = (
        (luminance > 151.0)
        & (chroma < 48.0)
        & (ink_guard < 0.08)
    ).astype(np.float32)

    height, width = luminance.shape
    yy, xx = np.mgrid[0:height, 0:width].astype(np.float32)
    edge_distance = np.minimum.reduce(
        (xx, yy, width - 1.0 - xx, height - 1.0 - yy)
    )
    age_reach = max(1.0, 17.0 * source_pixels_per_mm)
    edge_falloff = np.clip(1.0 - edge_distance / age_reach, 0.0, 1.0)
    edge_falloff = edge_falloff**1.65

    rng = np.random.default_rng(seed)
    noise_width = max(18, round(width / 54))
    noise_height = max(14, round(height / 54))
    broad_noise = Image.fromarray(
        np.rint(
            rng.random((noise_height, noise_width)) * 255.0
        ).astype(np.uint8),
        mode="L",
    ).resize((width, height), Image.Resampling.BICUBIC).filter(
        ImageFilter.GaussianBlur(max(1.0, source_pixels_per_mm * 1.8))
    )
    mottling = np.asarray(broad_noise, dtype=np.float32) / 255.0
    mottling = 0.52 + (mottling - 0.5) * 0.90

    patina_mask = (
        exposed_paper
        * edge_falloff
        * np.clip(mottling, 0.18, 0.88)
        * min(1.0, strength)
    )
    patina_colour = np.asarray(
        (151.0, 132.0, 95.0),
        dtype=np.float32,
    )
    blend = np.clip(patina_mask * 0.18, 0.0, 0.14)
    aged = (
        values * (1.0 - blend[:, :, None])
        + patina_colour[None, None, :] * blend[:, :, None]
    )
    return Image.fromarray(
        np.rint(np.clip(aged, 0, 255)).astype(np.uint8),
        mode="RGB",
    )


def paste_exact_map(
    board: Image.Image,
    pixels_per_mm: float,
    offset_mm: tuple[float, float] = (0.0, 0.0),
    paper_age_strength: float = 0.0,
    paper_age_seed: int = 73517,
) -> None:
    offset_x_mm, offset_y_mm = offset_mm
    with Image.open(MAP_SOURCE) as source:
        cropped = source.convert("RGB").crop(MAP_CROP_PX)
    cropped = age_exposed_map_paper(
        cropped,
        MAP_CROP_WIDTH_PX / MAP_WIDTH_MM,
        paper_age_strength,
        paper_age_seed,
    )
    target_size = (
        px(MAP_WIDTH_MM, pixels_per_mm),
        px(MAP_HEIGHT_MM, pixels_per_mm),
    )
    cropped = cropped.resize(target_size, Image.Resampling.LANCZOS)
    position = (
        px(MAP_X_MM + offset_x_mm, pixels_per_mm),
        px(MAP_TOP_MM + offset_y_mm, pixels_per_mm),
    )

    # A tight compressed leather seat is generated beneath the paper. It is
    # neither a frame nor a shadow and has no independent source image.
    seat = Image.new("RGBA", board.size, (0, 0, 0, 0))
    seat_draw = ImageDraw.Draw(seat)
    seat_inset = px(1.15, pixels_per_mm)
    seat_draw.rectangle(
        (
            position[0] - seat_inset,
            position[1] - seat_inset,
            position[0] + target_size[0] + seat_inset,
            position[1] + target_size[1] + seat_inset,
        ),
        fill=(5, 7, 6, 214),
    )
    board.alpha_composite(seat)
    board.paste(cropped.convert("RGBA"), position)


def apply_unified_neoprene_finish(
    board: Image.Image,
    pixels_per_mm: float,
) -> Image.Image:
    """Give every material the same restrained dye-sublimation response."""

    finished = board.convert("RGB")

    # Slightly compress saturation and contrast across the complete flattened
    # object. This is deliberately subtle: it does not recolour or sharpen the
    # hand-drawn map, but stops paper, pigment, thread, metal, and leather from
    # looking as though they came from unrelated image sources.
    finished = ImageEnhance.Color(finished).enhance(0.965)
    finished = ImageEnhance.Contrast(finished).enhance(0.986)

    # A common, extremely fine print tooth crosses every material. It is
    # softer than a leather pore and low enough in amplitude to survive
    # neoprene printing without turning into visible digital noise.
    grain = Image.effect_noise(finished.size, 3.2).filter(
        ImageFilter.GaussianBlur(max(0.28, pixels_per_mm * 0.035))
    )
    grain_rgb = Image.merge("RGB", (grain, grain, grain))
    soft_grain = ImageChops.soft_light(finished, grain_rgb)
    finished = Image.blend(finished, soft_grain, 0.024)

    # A fraction of a neutral warm-grey production wash pulls the map cream,
    # muted brass, painted lettering, and charcoal leather into one product
    # palette without flattening their local depth.
    wash = Image.new("RGB", finished.size, (121, 116, 102))
    finished = Image.blend(finished, wash, 0.008)
    return finished


def build_board(pixels_per_mm: float) -> Image.Image:
    width = px(A1_WIDTH_MM, pixels_per_mm)
    height = px(A1_HEIGHT_MM, pixels_per_mm)
    board = tiled_leather(width, height, pixels_per_mm).convert("RGBA")
    draw_outer_finish(board, pixels_per_mm)
    draw_warehouses(board, pixels_per_mm)
    draw_title(board, pixels_per_mm)
    draw_round_tracker(board, pixels_per_mm)
    draw_map_stitching(board, pixels_per_mm)
    paste_exact_map(board, pixels_per_mm)

    # The four fittings are generated last because they physically retain the
    # map. They use one consistent procedural brass field and no cast shadows.
    render_brass_fitting(
        board,
        (MAP_X_MM, MAP_TOP_MM),
        1,
        1,
        pixels_per_mm,
        6601,
    )
    render_brass_fitting(
        board,
        (MAP_RIGHT_MM, MAP_TOP_MM),
        -1,
        1,
        pixels_per_mm,
        6602,
    )
    render_brass_fitting(
        board,
        (MAP_X_MM, MAP_BOTTOM_MM),
        1,
        -1,
        pixels_per_mm,
        6603,
    )
    render_brass_fitting(
        board,
        (MAP_RIGHT_MM, MAP_BOTTOM_MM),
        -1,
        -1,
        pixels_per_mm,
        6604,
    )
    return apply_unified_neoprene_finish(board, pixels_per_mm)


def write_pdf(full_resolution: Image.Image) -> None:
    pdf = canvas.Canvas(
        str(PDF_PATH),
        pagesize=(A1_WIDTH_MM * mm, A1_HEIGHT_MM * mm),
        pageCompression=1,
    )
    pdf.setTitle("The Quiet Vale - unified A1 neoprene board v1")
    pdf.setAuthor("The Quiet Vale project")
    pdf.setSubject(
        "One-surface A1 neoprene board at exact 60 mm hex scale"
    )
    pdf.setCreator("design/a1-board-unified/generate_unified_a1_board.py")
    pdf.drawImage(
        ImageReader(full_resolution),
        0,
        0,
        width=A1_WIDTH_MM * mm,
        height=A1_HEIGHT_MM * mm,
        preserveAspectRatio=False,
        mask="auto",
    )
    pdf.showPage()
    pdf.save()


def write_manifest(pixels_per_mm: float) -> None:
    map_ppi = MAP_CROP_WIDTH_PX / (MAP_WIDTH_MM / 25.4)
    manifest = {
        "title": "The Quiet Vale unified A1 neoprene board v1",
        "construction": (
            "single flattened material raster; only the hand-drawn map and "
            "project fonts are retained"
        ),
        "finishedSize": {
            "standard": "ISO A1 landscape",
            "widthMm": A1_WIDTH_MM,
            "heightMm": A1_HEIGHT_MM,
        },
        "scale": {
            "hexPointToPointMm": HEX_POINT_TO_POINT_MM,
            "productionPercent": 100,
        },
        "material": {
            "newLeatherSource": str(LEATHER_SOURCE.relative_to(ROOT)),
            "newBrassSource": str(BRASS_SOURCE.relative_to(ROOT)),
            "newThreadSource": str(THREAD_SOURCE.relative_to(ROOT)),
            "generationPrompts": [
                str(LEATHER_PROMPT.relative_to(ROOT)),
                str(BRASS_PROMPT.relative_to(ROOT)),
                str(THREAD_PROMPT.relative_to(ROOT)),
            ],
            "generationMode": "OpenAI built-in ImageGen",
            "pixelsPerMm": pixels_per_mm,
            "effectivePpi": round(pixels_per_mm * 25.4, 1),
            "oneGlobalLightDirection": True,
            "globalNeopreneFinish": (
                "shared restrained saturation, contrast, print tooth, "
                "and neutral warm-grey production response"
            ),
            "reusedPreviousBoardAssets": False,
            "buttons": False,
            "warehouseAssociation": "resource-coloured saddle stitching",
        },
        "map": {
            "source": str(MAP_SOURCE.relative_to(ROOT)),
            "cropPixels": {
                "left": MAP_CROP_PX[0],
                "top": MAP_CROP_PX[1],
                "right": MAP_CROP_PX[2],
                "bottom": MAP_CROP_PX[3],
            },
            "placedWidthMm": round(MAP_WIDTH_MM, 4),
            "placedHeightMm": round(MAP_HEIGHT_MM, 4),
            "effectivePpi": round(map_ppi, 2),
            "geometryPreserved": True,
        },
        "warehouses": {
            "count": 6,
            "labels": [entry[0] for entry in RESOURCE_ROWS],
            "openCounterAreas": True,
            "markerButtons": "removed",
            "colouredStitchingInsideEachRecess": True,
        },
        "roundTracker": {
            "rounds": 12,
            "bar": "none",
            "surroundingFrame": "none",
            "surroundingStitching": "none",
            "endRivets": "none",
            "construction": (
                "twelve individual cavities punched directly into the "
                "continuous bottom leather"
            ),
            "verticalAlignment": (
                "centred between the lower map edge and outer stitch line"
            ),
            "centerYmm": round(TRACKER_CENTER_TOP_MM, 3),
            "seasonMarkers": ["I", "II", "III"],
        },
        "hardware": {
            "construction": (
                "new photographic aged-brass material shaped and lit inside "
                "the same render"
            ),
            "tone": "light muted aged brass",
            "detachedDropShadows": False,
            "contactOcclusion": "sub-millimetre physical edge only",
            "reusedHardwareImages": False,
        },
        "files": {
            "pdf": str(PDF_PATH.relative_to(ROOT)),
            "fullResolutionPng": str(FULL_PATH.relative_to(ROOT)),
            "previewPng": str(PREVIEW_PATH.relative_to(ROOT)),
        },
    }
    MANIFEST_PATH.write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )


def write_print_notes() -> None:
    PRINT_NOTES_PATH.write_text(
        """THE QUIET VALE — UNIFIED A1 NEOPRENE BOARD V1

- Finished size: exactly 841 x 594 mm (ISO A1 landscape).
- Print at 100% / Actual Size. Do not Fit or Scale to printable area.
- Playable hex geometry: exactly 60 mm point-to-point.
- Preferred production file: the-quiet-vale-a1-unified-v1.pdf.
- Colour space: RGB for the neoprene vendor's dye-sublimation RIP.
- Disable automatic sharpening, contrast, enhancement, and background removal.
- A1 is the finished trim. If bleed is required, extend only the outer
  charcoal leather in the manufacturer's template; never enlarge the board.
- Request a material proof before the production run.
""",
        encoding="utf-8",
    )


def validate_pdf() -> None:
    reader = PdfReader(str(PDF_PATH))
    if len(reader.pages) != 1:
        raise RuntimeError(f"Expected one page, found {len(reader.pages)}")
    page = reader.pages[0]
    width_mm = float(page.mediabox.width) / 72.0 * 25.4
    height_mm = float(page.mediabox.height) / 72.0 * 25.4
    if abs(width_mm - A1_WIDTH_MM) > 0.02:
        raise RuntimeError(f"Incorrect PDF width: {width_mm:.4f} mm")
    if abs(height_mm - A1_HEIGHT_MM) > 0.02:
        raise RuntimeError(f"Incorrect PDF height: {height_mm:.4f} mm")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--pixels-per-mm",
        type=float,
        default=4.0,
        choices=(4.0, 8.0),
        help="4 creates the proof; 8 creates print-resolution production files.",
    )
    args = parser.parse_args()
    for required in (
        LEATHER_SOURCE,
        LEATHER_PROMPT,
        BRASS_SOURCE,
        BRASS_PROMPT,
        THREAD_SOURCE,
        THREAD_PROMPT,
        MAP_SOURCE,
        ALMENDRA,
        ALEGREYA_SANS,
    ):
        if not required.exists():
            raise FileNotFoundError(required)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    board = build_board(args.pixels_per_mm)
    if args.pixels_per_mm == 4.0:
        board.save(PREVIEW_PATH, format="PNG", optimize=True)
        print(f"Wrote {PREVIEW_PATH}")
        return

    board.save(FULL_PATH, format="PNG", optimize=True)
    preview = board.resize(
        (
            px(A1_WIDTH_MM, 4.0),
            px(A1_HEIGHT_MM, 4.0),
        ),
        Image.Resampling.LANCZOS,
    )
    preview.save(PREVIEW_PATH, format="PNG", optimize=True)
    write_pdf(board)
    write_manifest(args.pixels_per_mm)
    write_print_notes()
    validate_pdf()
    print(f"Wrote {FULL_PATH}")
    print(f"Wrote {PREVIEW_PATH}")
    print(f"Wrote {PDF_PATH}")
    print(f"Wrote {MANIFEST_PATH}")
    print(f"Wrote {PRINT_NOTES_PATH}")


if __name__ == "__main__":
    main()
