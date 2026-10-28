from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
CARD = ROOT / "output/target-card-visual/target-card-05-vale-blue-rose-front.png"
OUTPUT = ROOT / "working/rulebook-v6_4-card-visuals/target-card-in-action.png"

W, H = 1800, 610
BG = "#F8F2E2"
INK = "#25251F"
GREEN = "#365745"
BRASS = "#9B7A38"
PALE = "#F1EBDD"
PALE_ALT = PALE
CALLOUT_FILL = "#ECE6D5"
BLUE = "#B9C9C8"
SPECIAL = "#B5A398"
MUTED = "#CFCBBE"
ROSE = "#965946"


def font(path: str, size: int):
    return ImageFont.truetype(path, size)


GEORGIA = "/System/Library/Fonts/Supplemental/Georgia.ttf"
GEORGIA_BOLD = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
ARIAL = "/System/Library/Fonts/Supplemental/Arial.ttf"
ARIAL_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"


def centered(draw: ImageDraw.ImageDraw, box, text: str, fnt, fill=INK):
    left, top, right, bottom = box
    bbox = draw.textbbox((0, 0), text, font=fnt)
    x = left + ((right - left) - (bbox[2] - bbox[0])) / 2
    y = top + ((bottom - top) - (bbox[3] - bbox[1])) / 2 - bbox[1]
    draw.text((x, y), text, font=fnt, fill=fill)


def wrapped(draw: ImageDraw.ImageDraw, text: str, box, fnt, fill=INK, spacing=4):
    left, top, right, bottom = box
    words = text.split()
    lines = []
    line = ""
    for word in words:
        candidate = f"{line} {word}".strip()
        if draw.textlength(candidate, font=fnt) <= right - left:
            line = candidate
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    line_h = fnt.size + spacing
    y = top
    for item in lines:
        draw.text((left, y), item, font=fnt, fill=fill)
        y += line_h
    return y


def hexagon(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, fill: str, outline: str, width: int = 4):
    points = [
        (x + int(w * 0.25), y),
        (x + int(w * 0.75), y),
        (x + w, y + h // 2),
        (x + int(w * 0.75), y + h),
        (x + int(w * 0.25), y + h),
        (x, y + h // 2),
    ]
    draw.polygon(points, fill=fill)
    draw.line(points + [points[0]], fill=outline, width=width, joint="curve")


def badge(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, fill: str, text_fill="white"):
    fnt = font(ARIAL_BOLD, 20)
    bbox = draw.textbbox((0, 0), text, font=fnt)
    width = bbox[2] - bbox[0] + 22
    height = 32
    draw.rounded_rectangle((x, y, x + width, y + height), radius=10, fill=fill)
    centered(draw, (x, y, x + width, y + height), text, fnt, text_fill)
    return width


def tile(draw: ImageDraw.ImageDraw, x: int, y: int, name: str, kind: str, side: str, *, muted=False, kept=False, removed_by=""):
    w, h = 190, 150
    fill = MUTED if muted else (SPECIAL if kind == "S" else BLUE if side == "Upgraded" else "#D9D4B4")
    outline = BRASS if kept else (ROSE if muted else GREEN)
    hexagon(draw, x, y, w, h, fill, outline, 6 if kept else 4)
    centered(draw, (x + 22, y + 42, x + w - 22, y + 91), name, font(ARIAL_BOLD, 22), INK if not muted else "#68665E")
    centered(draw, (x + 22, y + 91, x + w - 22, y + 121), side, font(ARIAL, 17), INK if not muted else "#68665E")
    if removed_by:
        badge(draw, x + 18, y + 119, removed_by, ROSE, "white")
    elif kept:
        badge(draw, x + 18, y + 119, "KEEP", GREEN, "white")


def callout(draw: ImageDraw.ImageDraw, number: int, y: int, text: str):
    x, right = 1080, 1765
    draw.rounded_rectangle((x, y, right, y + 75), radius=14, fill=CALLOUT_FILL)
    draw.ellipse((x + 17, y + 18, x + 57, y + 58), fill=BRASS)
    centered(draw, (x + 17, y + 18, x + 57, y + 58), str(number), font(ARIAL_BOLD, 20), "white")
    wrapped(draw, text, (x + 78, y + 13, right - 18, y + 64), font(ARIAL, 21), INK, spacing=2)


def main():
    if not CARD.exists():
        raise FileNotFoundError(CARD)
    image = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(image)

    draw.rectangle((18, 18, W - 18, H - 18), outline="#D2C8B0", width=3)
    centered(draw, (0, 22, W, 62), "Target Card in action", font(GEORGIA_BOLD, 34), GREEN)
    draw.line((85, 76, W - 85, 76), fill="#C6B994", width=3)

    draw.rounded_rectangle((35, 105, 250, 545), radius=18, fill=PALE, outline=GREEN, width=4)
    card = Image.open(CARD).convert("RGB")
    card.thumbnail((175, 310), Image.Resampling.LANCZOS)
    image.paste(card, (55, 126))
    centered(draw, (40, 450, 245, 485), "REAL CARD 05", font(ARIAL_BOLD, 20), GREEN)
    wrapped(draw, "Read the real card from top to bottom.", (55, 492, 230, 530), font(ARIAL, 17), INK, spacing=1)

    draw.rounded_rectangle((275, 105, 1045, 545), radius=18, fill=PALE, outline=GREEN, width=3)
    centered(draw, (300, 115, 1020, 148), "EXAMPLE BOARD STATE • FOUR ELIGIBLE TILES", font(ARIAL_BOLD, 23), GREEN)
    tile(draw, 315, 250, "Alms House", "S", "Special", muted=True, removed_by="CORE")
    tile(draw, 457, 175, "Path", "T", "Basic", muted=True, removed_by="UPGRADED")
    tile(draw, 599, 250, "Fine Cabin", "H", "Upgraded", kept=True)
    tile(draw, 741, 175, "Improved Path", "T", "Upgraded", kept=True)
    draw.line((840, 430, 925, 370), fill=BRASS, width=5)
    draw.polygon([(925, 370), (906, 373), (916, 388)], fill=BRASS)
    centered(draw, (850, 427, 1005, 458), "SE →", font(ARIAL_BOLD, 25), BRASS)
    centered(draw, (330, 465, 990, 510), "After the filters, compare Fine Cabin and Improved Path to each other.", font(ARIAL_BOLD, 20), GREEN)

    callout(draw, 1, 105, "Start with the four Tiles made eligible by the triggering effect.")
    callout(draw, 2, 190, "Core removes Alms House, which is a Special Tile.")
    callout(draw, 3, 275, "Upgraded removes Path, which is a Basic Tile.")
    callout(draw, 4, 360, "3+ Neighbours and Already Strained keep Fine Cabin and Improved Path.")
    callout(draw, 5, 445, "Compare those two survivors in the printed SE direction. Improved Path is most southeast, so it is selected.")

    image.save(OUTPUT, optimize=True)
    print(OUTPUT)


if __name__ == "__main__":
    main()
