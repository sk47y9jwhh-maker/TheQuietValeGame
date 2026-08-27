#!/usr/bin/env python3
"""Show all three production boards together at a common tabletop scale."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output/comparison/the-quiet-vale-three-board-table-layout.png"
MEASURED_OUTPUT = (
    ROOT / "output/comparison/the-quiet-vale-three-board-table-layout-measured.png"
)
PPM = 4.0
GAP_MM = 10.0
MAIN_WIDTH_MM = 34.5 * 25.4
MAIN_HEIGHT_MM = 24.5 * 25.4
SMALL_WIDTH_MM = 24.5 * 25.4
SMALL_HEIGHT_MM = 7.0 * 25.4

MAIN_PATH = (
    ROOT
    / "output/pdf/production-board-v1-printer-ready"
    / "the-quiet-vale-production-board-v1-finished-size.png"
)
STEWARDS_PATH = (
    ROOT
    / "output/pdf/stewards-board-compact-v3-printer-ready"
    / "the-quiet-vale-stewards-board-compact-v3-finished-size.png"
)
COMPONENT_PATH = (
    ROOT
    / "output/pdf/component-board-v1-printer-ready"
    / "the-quiet-vale-component-board-v1-finished-size.png"
)


def px(mm_value: float) -> int:
    return round(mm_value * PPM)


def scaled(path: Path, width_mm: float, height_mm: float) -> Image.Image:
    with Image.open(path) as source:
        return source.convert("RGB").resize(
            (px(width_mm), px(height_mm)),
            Image.Resampling.LANCZOS,
        )


def main() -> None:
    main_board = scaled(MAIN_PATH, MAIN_WIDTH_MM, MAIN_HEIGHT_MM)
    stewards = scaled(STEWARDS_PATH, SMALL_WIDTH_MM, SMALL_HEIGHT_MM)
    component = scaled(COMPONENT_PATH, SMALL_WIDTH_MM, SMALL_HEIGHT_MM)

    # Titles face away from the main board toward the players on either side.
    stewards = stewards.transpose(Image.Transpose.ROTATE_90)
    component = component.transpose(Image.Transpose.ROTATE_270)

    gap = px(GAP_MM)
    margin = px(12.0)
    width = margin * 2 + stewards.width + gap + main_board.width + gap + component.width
    height = margin * 2 + main_board.height
    layout = Image.new("RGB", (width, height), (46, 40, 32))

    # A restrained tabletop texture keeps the footprint readable without
    # competing with the production artwork.
    draw = ImageDraw.Draw(layout)
    for y in range(height):
        shade = 46 + round(4 * y / max(1, height - 1))
        draw.line((0, y, width, y), fill=(shade, shade - 6, shade - 14))

    x = margin
    y = margin
    layout.paste(stewards, (x, y))
    x += stewards.width + gap
    layout.paste(main_board, (x, y))
    x += main_board.width + gap
    layout.paste(component, (x, y))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    layout.save(OUTPUT, format="PNG", optimize=True)

    measure_margin = 165
    measured = Image.new(
        "RGB",
        (layout.width + measure_margin * 2, layout.height + measure_margin * 2),
        (36, 32, 27),
    )
    measured.paste(layout, (measure_margin, measure_margin))
    draw = ImageDraw.Draw(measured)
    try:
        font = ImageFont.truetype(
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            30,
        )
        small_font = ImageFont.truetype(
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            24,
        )
    except OSError:
        font = ImageFont.load_default()
        small_font = ImageFont.load_default()

    colour = (228, 213, 179)
    faint = (168, 148, 112)
    arrow = 13

    def horizontal_dimension(x1: int, x2: int, y: int, label: str, label_above: bool) -> None:
        draw.line((x1, y, x2, y), fill=colour, width=3)
        draw.line((x1, y - 13, x1, y + 13), fill=colour, width=3)
        draw.line((x2, y - 13, x2, y + 13), fill=colour, width=3)
        draw.polygon(((x1, y), (x1 + arrow, y - 7), (x1 + arrow, y + 7)), fill=colour)
        draw.polygon(((x2, y), (x2 - arrow, y - 7), (x2 - arrow, y + 7)), fill=colour)
        text_y = y - 25 if label_above else y + 25
        draw.text(
            ((x1 + x2) // 2, text_y),
            label,
            font=font,
            fill=colour,
            anchor="ms" if label_above else "ma",
        )

    def vertical_dimension(x: int, y1: int, y2: int, label: str, side: str) -> None:
        draw.line((x, y1, x, y2), fill=colour, width=3)
        draw.line((x - 13, y1, x + 13, y1), fill=colour, width=3)
        draw.line((x - 13, y2, x + 13, y2), fill=colour, width=3)
        draw.polygon(((x, y1), (x - 7, y1 + arrow), (x + 7, y1 + arrow)), fill=colour)
        draw.polygon(((x, y2), (x - 7, y2 - arrow), (x + 7, y2 - arrow)), fill=colour)
        label_layer = Image.new("RGBA", measured.size, (0, 0, 0, 0))
        label_draw = ImageDraw.Draw(label_layer)
        offset = 32 if side == "left" else -32
        label_draw.text(
            (x + offset, (y1 + y2) // 2),
            label,
            font=font,
            fill=colour,
            anchor="ms",
        )
        label_layer = label_layer.rotate(
            90 if side == "left" else -90,
            center=(x + offset, (y1 + y2) // 2),
        )
        measured.paste(label_layer, (0, 0), label_layer)

    board_left = measure_margin + margin
    board_top = measure_margin + margin
    left_small_right = board_left + stewards.width
    main_left = left_small_right + gap
    main_right = main_left + main_board.width
    right_small_left = main_right + gap
    board_right = right_small_left + component.width
    board_bottom = board_top + main_board.height

    horizontal_dimension(
        board_left,
        board_right,
        62,
        (
            f"{(MAIN_WIDTH_MM + 2 * SMALL_HEIGHT_MM + 2 * GAP_MM) / 25.4:.1f}"
            " in overall (with two 10 mm gaps)"
        ),
        False,
    )
    horizontal_dimension(
        main_left,
        main_right,
        measured.height - 62,
        "Main Board - 34.5 in",
        True,
    )
    horizontal_dimension(
        board_left,
        left_small_right,
        measured.height - 62,
        f"{SMALL_HEIGHT_MM / 25.4:g} in",
        True,
    )
    horizontal_dimension(
        right_small_left,
        board_right,
        measured.height - 62,
        f"{SMALL_HEIGHT_MM / 25.4:g} in",
        True,
    )
    vertical_dimension(62, board_top, board_bottom, "24.5 in", "left")
    vertical_dimension(
        measured.width - 62,
        board_top,
        board_bottom,
        "24.5 in",
        "right",
    )
    draw.text(
        (measured.width // 2, measured.height - 18),
        "All boards shown at the same physical scale",
        font=small_font,
        fill=faint,
        anchor="ms",
    )
    measured.save(MEASURED_OUTPUT, format="PNG", optimize=True)
    print(OUTPUT)
    print(MEASURED_OUTPUT)
    print(layout.size)


if __name__ == "__main__":
    main()
