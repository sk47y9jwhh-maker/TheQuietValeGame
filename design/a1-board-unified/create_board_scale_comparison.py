#!/usr/bin/env python3
"""Create a same-scale measured comparison of the two production boards."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
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
OUTPUT_DIR = ROOT / "output/comparison"
OUTPUT_PATH = OUTPUT_DIR / "the-quiet-vale-boards-to-scale-measured.png"

PX_PER_IN = 80
MAIN_SIZE_IN = (34.5, 24.5)
STEWARDS_SIZE_IN = (24.5, 8.5)
MARGIN = 150
GAP = 240
DIM_OFFSET = 62
ARROW_SIZE = 14


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = (
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
        if bold
        else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Helvetica.ttc",
    )
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            pass
    return ImageFont.load_default()


LABEL_FONT = font(34, bold=True)
DIM_FONT = font(28)
NOTE_FONT = font(23)


def resize_exact(path: Path, size_in: tuple[float, float]) -> Image.Image:
    image = Image.open(path).convert("RGB")
    return image.resize(
        (
            round(size_in[0] * PX_PER_IN),
            round(size_in[1] * PX_PER_IN),
        ),
        Image.Resampling.LANCZOS,
    )


def arrowhead(
    drawing: ImageDraw.ImageDraw,
    point: tuple[int, int],
    direction: tuple[int, int],
    colour: tuple[int, int, int],
) -> None:
    x, y = point
    dx, dy = direction
    perpendicular = (-dy, dx)
    base_x = x + dx * ARROW_SIZE
    base_y = y + dy * ARROW_SIZE
    spread = ARROW_SIZE * 0.55
    drawing.polygon(
        (
            (x, y),
            (
                base_x + perpendicular[0] * spread,
                base_y + perpendicular[1] * spread,
            ),
            (
                base_x - perpendicular[0] * spread,
                base_y - perpendicular[1] * spread,
            ),
        ),
        fill=colour,
    )


def centered_text(
    drawing: ImageDraw.ImageDraw,
    position: tuple[int, int],
    text: str,
    selected_font: ImageFont.ImageFont,
    fill: tuple[int, int, int],
    background: tuple[int, int, int],
    padding: int = 10,
) -> None:
    box = drawing.textbbox(position, text, font=selected_font, anchor="mm")
    drawing.rounded_rectangle(
        (
            box[0] - padding,
            box[1] - padding // 2,
            box[2] + padding,
            box[3] + padding // 2,
        ),
        radius=8,
        fill=background,
    )
    drawing.text(
        position,
        text,
        font=selected_font,
        fill=fill,
        anchor="mm",
    )


def horizontal_dimension(
    drawing: ImageDraw.ImageDraw,
    left: int,
    right: int,
    y: int,
    object_y: int,
    label: str,
) -> None:
    colour = (214, 169, 89)
    drawing.line((left, object_y, left, y), fill=colour, width=3)
    drawing.line((right, object_y, right, y), fill=colour, width=3)
    drawing.line((left, y, right, y), fill=colour, width=4)
    arrowhead(drawing, (left, y), (1, 0), colour)
    arrowhead(drawing, (right, y), (-1, 0), colour)
    centered_text(
        drawing,
        ((left + right) // 2, y),
        label,
        DIM_FONT,
        (238, 222, 190),
        (24, 25, 25),
    )


def vertical_dimension(
    drawing: ImageDraw.ImageDraw,
    top: int,
    bottom: int,
    x: int,
    object_x: int,
    label: str,
) -> None:
    colour = (214, 169, 89)
    drawing.line((object_x, top, x, top), fill=colour, width=3)
    drawing.line((object_x, bottom, x, bottom), fill=colour, width=3)
    drawing.line((x, top, x, bottom), fill=colour, width=4)
    arrowhead(drawing, (x, top), (0, 1), colour)
    arrowhead(drawing, (x, bottom), (0, -1), colour)
    label_layer = Image.new("RGBA", (360, 70), (24, 25, 25, 245))
    label_draw = ImageDraw.Draw(label_layer)
    label_draw.text(
        (180, 35),
        label,
        font=DIM_FONT,
        fill=(238, 222, 190),
        anchor="mm",
    )
    rotated = label_layer.rotate(90, expand=True, resample=Image.Resampling.BICUBIC)
    canvas.alpha_composite(
        rotated,
        (x - rotated.width // 2, (top + bottom) // 2 - rotated.height // 2),
    )


main = resize_exact(MAIN_PATH, MAIN_SIZE_IN)
stewards = resize_exact(STEWARDS_PATH, STEWARDS_SIZE_IN)

canvas_width = main.width + 2 * MARGIN + 180
main_x = MARGIN
main_y = MARGIN + 80
stewards_x = main_x + (main.width - stewards.width) // 2
stewards_y = main_y + main.height + GAP
canvas_height = stewards_y + stewards.height + MARGIN + 150

canvas = Image.new("RGBA", (canvas_width, canvas_height), (22, 23, 23, 255))
drawing = ImageDraw.Draw(canvas)
canvas.paste(main, (main_x, main_y))
canvas.paste(stewards, (stewards_x, stewards_y))

drawing.text(
    (main_x, main_y - 52),
    "MAIN BOARD",
    font=LABEL_FONT,
    fill=(238, 222, 190),
)
drawing.text(
    (stewards_x, stewards_y - 52),
    "STEWARDS BOARD",
    font=LABEL_FONT,
    fill=(238, 222, 190),
)

horizontal_dimension(
    drawing,
    main_x,
    main_x + main.width,
    main_y - DIM_OFFSET,
    main_y,
    "34.5 in / 876.3 mm",
)
vertical_dimension(
    drawing,
    main_y,
    main_y + main.height,
    main_x + main.width + DIM_OFFSET,
    main_x + main.width,
    "24.5 in / 622.3 mm",
)
horizontal_dimension(
    drawing,
    stewards_x,
    stewards_x + stewards.width,
    stewards_y - DIM_OFFSET,
    stewards_y,
    "24.5 in / 622.3 mm",
)
vertical_dimension(
    drawing,
    stewards_y,
    stewards_y + stewards.height,
    stewards_x + stewards.width + DIM_OFFSET,
    stewards_x + stewards.width,
    "8.5 in / 215.9 mm",
)

drawing.text(
    (canvas_width // 2, canvas_height - 55),
    "Both boards shown at the same scale: 80 pixels per inch",
    font=NOTE_FONT,
    fill=(172, 170, 162),
    anchor="mm",
)

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
canvas.convert("RGB").save(
    OUTPUT_PATH,
    format="PNG",
    optimize=True,
    dpi=(PX_PER_IN, PX_PER_IN),
)
print(OUTPUT_PATH)
