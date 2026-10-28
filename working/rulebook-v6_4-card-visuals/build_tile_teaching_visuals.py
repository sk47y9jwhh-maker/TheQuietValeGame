from __future__ import annotations

from io import BytesIO
import math
from pathlib import Path
from zipfile import ZipFile

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "working/rulebook-v6_4-card-visuals"
SOURCE_DOCX = OUT / "source/The_Quiet_Vale_Main_Rulebook_v6_3_OneDrive_Table_Fix.docx"
MAP_SOURCE = ROOT / "output/pdf/modular-board-set-v1-printer-ready/map-board/the-quiet-vale-map-board-finished-size.png"

BG = "#F8F2E2"
INK = "#25251F"
GREEN = "#365745"
BRASS = "#9B7A38"
PALE = "#F1EBDD"
PALE_ALT = PALE
CALLOUT_FILL = "#ECE6D5"
BLUE = "#B9C9C8"
HOUSING = "#D9D4B4"
CRAFT = "#B6C8C3"
MERCHANT = "#D8C59E"
TRAVEL = "#C9D2C5"
RED = "#965946"
TOKEN = "#4A6F8A"
SUPPORTED_DISC = "#B08A45"
STRAIN_DISC = "#1D1D1B"

GEORGIA_BOLD = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
ARIAL = "/System/Library/Fonts/Supplemental/Arial.ttf"
ARIAL_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
ARIAL_UNICODE = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"


def font(path: str, size: int):
    return ImageFont.truetype(path, size)


def centered(draw, box, text, fnt, fill=INK):
    left, top, right, bottom = box
    bbox = draw.textbbox((0, 0), text, font=fnt)
    x = left + ((right - left) - (bbox[2] - bbox[0])) / 2
    y = top + ((bottom - top) - (bbox[3] - bbox[1])) / 2 - bbox[1]
    draw.text((x, y), text, font=fnt, fill=fill)


def wrapped(draw, text, box, fnt, fill=INK, spacing=3):
    left, top, right, bottom = box
    lines = []
    line = ""
    for word in text.split():
        candidate = f"{line} {word}".strip()
        if draw.textlength(candidate, font=fnt) <= right - left:
            line = candidate
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    y = top
    for item in lines:
        draw.text((left, y), item, font=fnt, fill=fill)
        y += fnt.size + spacing
    return y


HEX_W = 240
HEX_H = 190
HEX_DX = int(HEX_W * 0.75)
HEX_DY = HEX_H // 2


def hexagon(draw, x, y, w, h, fill, outline=GREEN, width=5):
    """Draw the same flat-top hex geometry used by the locked board visuals.

    A right-up/right-down neighbour is placed at (+0.75w, +/-0.5h).
    The 25/75 points are deliberate: the two hexes then share a complete edge.
    """
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


def meeple(draw, x, y, scale=1.0, fill=TOKEN):
    """Draw a rounded Steward meeple based on the supplied Tabler silhouette."""
    def cubic(p0, p1, p2, p3, steps=8):
        points = []
        for i in range(1, steps + 1):
            t = i / steps
            u = 1 - t
            points.append((
                u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0],
                u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1],
            ))
        return points

    points = [(9, 20), (4, 20)]
    points.extend([(3.62, 19.92), (3.29, 19.71), (3.08, 19.38), (3, 19)])
    current = (3, 19)
    segments = [
        ((3, 17), (6.378, 14.093), (7, 13)),
        ((6, 13), (3, 10.5), (3, 11)),
        ((3, 9), (7, 7.5), (9, 7)),
        ((9, 5.5), (9.5, 3), (12, 3)),
        ((14.5, 3), (15, 5.5), (15, 7)),
        ((17, 7.5), (21, 9), (21, 11)),
        ((21, 12.5), (18, 13), (17, 13)),
        ((17.622, 14.093), (21, 17), (21, 19)),
    ]
    for p1, p2, p3 in segments:
        points.extend(cubic(current, p1, p2, p3))
        current = p3
    points.extend([(20.92, 19.38), (20.71, 19.71), (20.38, 19.92), (20, 20)])
    points.append((15, 20))
    points.extend(cubic((15, 20), (14, 20), (13, 16), (12, 16)))
    points.extend(cubic((12, 16), (11, 16), (10, 20), (9, 20)))
    scaled = [(x + px * scale, y + py * scale) for px, py in points]
    draw.polygon(scaled, fill=fill)
    draw.line(scaled + [scaled[0]], fill="#2F4F65", width=max(2, int(1.5 * scale)), joint="curve")


def token_disc(draw, x, y, size=38, fill=SUPPORTED_DISC, outline="#6D5227", width=3, highlight="#D9C18A"):
    """Draw a physical token with the shared disc treatment used by all markers."""
    shadow = "#B7AE9A" if fill != STRAIN_DISC else "#B0AAA0"
    draw.ellipse((x + 2, y + 3, x + size + 2, y + size + 3), fill=shadow)
    draw.ellipse((x, y, x + size, y + size), fill=fill, outline=outline, width=width)
    draw.arc((x + 5, y + 4, x + size - 5, y + size - 5), 195, 335, fill=highlight, width=max(1, width - 1))


def disc(draw, x, y, size=38, fill=SUPPORTED_DISC, outline="#6D5227", width=3):
    token_disc(draw, x, y, size=size, fill=fill, outline=outline, width=width)


def token_stack(draw, x, y, size=38, count=3, step=11, fill=STRAIN_DISC, outline="#484844", highlight="#666661"):
    """Show matching round tokens as a short, physical-looking stack."""
    for index in range(count - 1, -1, -1):
        token_disc(
            draw,
            x,
            y + index * step,
            size=size,
            fill=fill,
            outline=outline,
            highlight=highlight,
        )


def star(draw, cx, cy, outer=28, inner=12, fill=BRASS):
    points = []
    for index in range(10):
        angle = -math.pi / 2 + index * math.pi / 5
        radius = outer if index % 2 == 0 else inner
        points.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))
    draw.polygon(points, fill=fill)


def tile(draw, x, y, name, category, side, fill=HOUSING, *, token=False, support=False, compact=False):
    # All tiles in a connected example use one geometry. Compact only tightens
    # lettering; it never changes the hex size or its neighbour offsets.
    w, h = HEX_W, HEX_H
    outline = BRASS if side == "Upgraded" else GREEN
    hexagon(draw, x, y, w, h, fill, outline, 6)
    if token:
        meeple(draw, x + 100, y + 8, scale=2.2)
    name_size = 23 if len(name) <= 10 else 19 if len(name) <= 15 else 17
    if compact:
        name_size -= 2
    centered(draw, (x + 28, y + 72, x + w - 28, y + 120), name, font(ARIAL_BOLD, name_size), INK)
    centered(draw, (x + 28, y + 128, x + w - 28, y + h - 28), side, font(ARIAL, 18 if not compact else 16), INK)
    if support:
        # Keep the 12 mm Supported disc clearly on the Tile surface rather
        # than straddling a shared edge.
        disc(draw, x + w - 85, y + 36, size=38)
    return w, h


def panel(draw, box, fill=PALE, title=None):
    left, top, right, bottom = box
    draw.rounded_rectangle(box, radius=18, fill=fill, outline="#9B927C", width=3)
    if title:
        centered(draw, (left + 15, top + 12, right - 15, top + 45), title, font(ARIAL_BOLD, 22), GREEN)


def arrow(draw, start, end, fill=BRASS, width=5):
    draw.line((*start, *end), fill=fill, width=width)
    x1, y1 = start
    x2, y2 = end
    dx, dy = x2 - x1, y2 - y1
    length = max((dx * dx + dy * dy) ** 0.5, 1)
    ux, uy = dx / length, dy / length
    px, py = -uy, ux
    tip = (x2, y2)
    left = (x2 - ux * 18 + px * 9, y2 - uy * 18 + py * 9)
    right = (x2 - ux * 18 - px * 9, y2 - uy * 18 - py * 9)
    draw.polygon([tip, left, right], fill=fill)


def callout(draw, box, title, body, fill=CALLOUT_FILL):
    left, top, right, bottom = box
    draw.rounded_rectangle(box, radius=12, fill=fill, outline="#D2C8B0", width=2)
    draw.text((left + 15, top + 11), title, font=font(ARIAL_BOLD, 19), fill=GREEN)
    wrapped(draw, body, (left + 15, top + 42, right - 15, bottom - 12), font(ARIAL, 17), INK, spacing=2)


def title(draw, text, width):
    centered(draw, (0, 22, width, 62), text, font(GEORGIA_BOLD, 34), GREEN)
    draw.line((85, 76, width - 85, 76), fill="#C6B994", width=3)


def source_map_crop():
    """Reuse the painted map artwork while redrawing its teaching frame."""
    with ZipFile(SOURCE_DOCX) as archive:
        data = archive.read("word/media/image2.png")
    source = Image.open(BytesIO(data)).convert("RGB")
    crop = source.crop((420, 165, 1080, 685))
    crop.thumbnail((820, 500), Image.Resampling.LANCZOS)
    return crop


def cover_visual():
    """Rebuild the cover montage with the current connected Tile language."""
    w, h = 1500, 760
    map_source = Image.open(MAP_SOURCE).convert("RGB")
    # Use the real map artwork, cropped inside the printed board frame and
    # tracker strip so the cover has no embedded setup labels or old diagrams.
    map_art = map_source.crop((250, 250, 8130, 4200)).resize((w, h), Image.Resampling.LANCZOS)
    image = map_art.copy()
    draw = ImageDraw.Draw(image)

    draw.rectangle((0, 0, w - 1, h - 1), outline="#8E7A4A", width=4)

    image.save(OUT / "cover-hero.png", optimize=True)


def standard_setup_visual():
    w, h = 1800, 850
    image = Image.new("RGB", (w, h), BG)
    draw = ImageDraw.Draw(image)
    draw.rectangle((18, 18, w - 18, h - 18), outline="#D2C8B0", width=3)
    title(draw, "Standard Setup", w)

    panel(draw, (45, 105, 405, 805), PALE, "SUPPLY AND BOARDS")
    draw.rounded_rectangle((75, 175, 375, 255), radius=12, fill=CALLOUT_FILL, outline="#D2C8B0", width=2)
    draw.text((95, 192), "Core Tiles", font=font(ARIAL_BOLD, 20), fill=GREEN)
    draw.rectangle((95, 230, 120, 255), fill=MERCHANT, outline=BRASS, width=2)
    draw.text((135, 230), "basic sides visible", font=font(ARIAL, 17), fill=INK)
    draw.rounded_rectangle((75, 275, 375, 355), radius=12, fill=CALLOUT_FILL, outline="#D2C8B0", width=2)
    draw.text((95, 292), "Shared boards", font=font(ARIAL_BOLD, 20), fill=GREEN)
    draw.rectangle((95, 330, 120, 355), fill=GREEN, outline=GREEN, width=2)
    draw.text((135, 330), "Warehouse + Stewards", font=font(ARIAL, 17), fill=INK)
    draw.rounded_rectangle((75, 375, 375, 535), radius=12, fill=CALLOUT_FILL, outline="#D2C8B0", width=2)
    draw.text((95, 395), "Warehouse", font=font(ARIAL_BOLD, 20), fill=GREEN)
    wrapped(draw, "Stock by player count. All six resources are shared; normal capacity is 15 each.", (95, 435, 355, 510), font(ARIAL, 17), INK, spacing=3)
    draw.rounded_rectangle((75, 565, 375, 735), radius=12, fill=CALLOUT_FILL, outline="#D2C8B0", width=2)
    draw.text((95, 585), "Before the first turn", font=font(ARIAL_BOLD, 20), fill=GREEN)
    wrapped(draw, "Shuffle all 30 Target Cards. Each player takes a Steward, its matching Aid and Token, then places the Token on that Steward's terrain.", (95, 625, 355, 710), font(ARIAL, 17), INK, spacing=3)

    panel(draw, (430, 105, 1370, 805), PALE, "PAINTED GAME MAP")
    map_image = source_map_crop()
    map_x = 480 + (820 - map_image.width) // 2
    map_y = 170 + (500 - map_image.height) // 2
    image.paste(map_image, (map_x, map_y))
    draw.rectangle((map_x, map_y, map_x + map_image.width, map_y + map_image.height), outline="#7E866C", width=4)
    centered(draw, (480, 700, 1320, 740), "Example positions shown · each Steward begins on its Starting Terrain", font(ARIAL, 17), INK)
    centered(draw, (480, 755, 1320, 785), "At 5 players, choose any 5 of the 6 Stewards.", font(ARIAL_BOLD, 18), GREEN)

    panel(draw, (1395, 105, 1755, 805), PALE, "DECKS & CONTENT")
    draw.text((1430, 175), "Encounters", font=font(ARIAL_BOLD, 20), fill=GREEN)
    for x, label in [(1415, "BOON"), (1515, "BURDEN"), (1615, "ARRIVAL")]:
        draw.rounded_rectangle((x, 215, x + 90, 275), radius=10, fill=CALLOUT_FILL, outline=BRASS, width=2)
        centered(draw, (x, 215, x + 90, 275), label, font(ARIAL_BOLD, 13), BRASS)
    centered(draw, (1425, 292, 1725, 325), "hidden hands · deck · reserve", font(ARIAL, 15), INK)
    draw.text((1430, 370), "Target Deck", font=font(ARIAL_BOLD, 20), fill=GREEN)
    for offset in (0, 12, 24):
        draw.rounded_rectangle((1500 + offset, 415 - offset // 2, 1625 + offset, 495 - offset // 2), radius=10, fill=GREEN, outline=BRASS, width=3)
    centered(draw, (1425, 515, 1725, 548), "30 cards · shuffle once · face down", font(ARIAL, 15), INK)
    draw.text((1430, 590), "Golden content", font=font(ARIAL_BOLD, 20), fill=GREEN)
    wrapped(draw, "Use only after it is unlocked through the Steward’s Ledger.", (1430, 630, 1720, 700), font(ARIAL, 17), INK, spacing=3)
    centered(draw, (1430, 742, 1720, 780), "Leave it in the box for a first game.", font(ARIAL_BOLD, 16), GREEN)
    image.save(OUT / "standard-setup.png", optimize=True)


def seasons_visual():
    w, h = 1800, 520
    image = Image.new("RGB", (w, h), BG)
    draw = ImageDraw.Draw(image)
    draw.rectangle((18, 18, w - 18, h - 18), outline="#D2C8B0", width=3)
    title(draw, "Three Seasons · Twelve Rounds", w)
    seasons = [
        (45, "I  FOUNDATIONS", [1, 2, 3, 4]),
        (635, "II  GROWTH", [5, 6, 7, 8]),
        (1225, "III  MATURITY", [9, 10, 11, 12]),
    ]
    for x, label, rounds in seasons:
        panel(draw, (x, 105, x + 530, 405), PALE, label)
        draw.text((x + 440, 125), "SEED", font=font(ARIAL_BOLD, 17), fill=BRASS)
        for index, round_number in enumerate(rounds):
            cx = x + 90 + index * 112
            draw.ellipse((cx - 32, 205, cx + 32, 269), fill=BG, outline=GREEN, width=4)
            centered(draw, (cx - 32, 205, cx + 32, 269), str(round_number), font(ARIAL_BOLD, 19), INK)
        centered(draw, (x + 20, 305, x + 510, 365), "Reveal + resolve → choose order → up to 4 Actions each → upkeep", font(ARIAL, 14), INK)
    draw.rounded_rectangle((45, 435, 1755, 500), radius=12, fill=CALLOUT_FILL, outline=BRASS, width=3)
    centered(draw, (65, 445, 1735, 490), "Seed before Rounds 1, 5 and 9 · after Rounds 4 and 8: Arrivals expire → discard expiring Boons → Neighbourly Support → reapply Burdens → refresh Powers → seed · after Round 12: score", font(ARIAL_BOLD, 15), GREEN)
    image.save(OUT / "seasons-rounds.png", optimize=True)


def card_back(draw, x, y, w=82, h=112):
    draw.rounded_rectangle((x, y, x + w, y + h), radius=10, fill=GREEN, outline=BRASS, width=3)
    draw.rounded_rectangle((x + 9, y + 9, x + w - 9, y + h - 9), radius=7, outline="#B8C7B7", width=2)
    draw.line((x + 18, y + h // 2, x + w - 18, y + h // 2), fill="#B8C7B7", width=2)
    draw.ellipse((x + w // 2 - 9, y + h // 2 - 9, x + w // 2 + 9, y + h // 2 + 9), outline="#B8C7B7", width=2)


def seeding_visual():
    w, h = 1800, 560
    image = Image.new("RGB", (w, h), BG)
    draw = ImageDraw.Draw(image)
    draw.rectangle((18, 18, w - 18, h - 18), outline="#D2C8B0", width=3)
    title(draw, "Seed the Encounter Deck", w)

    panel(draw, (45, 105, 545, 535), PALE, "1  CHOOSE IN SECRET")
    card_back(draw, 125, 200)
    card_back(draw, 225, 200)
    card_back(draw, 325, 200)
    centered(draw, (80, 345, 510, 380), "Each player secretly chooses 3 cards from their hand.", font(ARIAL_BOLD, 18), GREEN)
    centered(draw, (80, 420, 510, 465), "Keep the chosen cards hidden while seeding.", font(ARIAL, 18), INK)

    panel(draw, (585, 105, 1755, 535), PALE_ALT, "2  PLACE ONE CARD IN EACH POSITION")
    # The deck is shown as a short stack with three labelled destinations.
    deck_x, deck_y = 1240, 195
    for offset in (0, 14, 28, 42):
        draw.rounded_rectangle((deck_x + offset, deck_y - offset // 3, deck_x + 250 + offset, deck_y + 120 - offset // 3), radius=10, fill=GREEN, outline=BRASS, width=3)
    draw.text((deck_x + 72, deck_y + 48), "ENCOUNTER", font=font(ARIAL_BOLD, 16), fill="#E8E3D0")
    draw.text((deck_x + 84, deck_y + 73), "DECK", font=font(ARIAL_BOLD, 16), fill="#E8E3D0")

    destinations = [
        ("ON TOP", "Seed one card on top of the deck.", 650, 170, 1040, 205),
        ("IN THE MIDDLE", "Insert one card into the middle without counting the deck.", 650, 285, 1040, 320),
        ("ON THE BOTTOM", "Seed one card on the bottom of the deck.", 650, 400, 1040, 435),
    ]
    for label, body, x1, y1, x2, y2 in destinations:
        draw.ellipse((x1, y1, x1 + 54, y1 + 54), fill=BRASS)
        centered(draw, (x1, y1, x1 + 54, y1 + 54), str(destinations.index((label, body, x1, y1, x2, y2)) + 1), font(ARIAL_BOLD, 21), "white")
        draw.text((x1 + 78, y1 + 2), label, font=font(ARIAL_BOLD, 20), fill=GREEN)
        wrapped(draw, body, (x1 + 78, y1 + 32, x2, y2 + 48), font(ARIAL, 17), INK, spacing=2)
        arrow(draw, (x1 + 520, y1 + 25), (deck_x - 30, y1 + 25), fill=BRASS, width=4)
    # Destination cards make the three points of contact visible without
    # exposing any hidden Encounter content.
    card_back(draw, 1070, 140, w=82, h=112)
    card_back(draw, 1070, 255, w=82, h=112)
    card_back(draw, 1070, 370, w=82, h=112)
    draw.line((1152, 181, 1210, 181), fill=BRASS, width=4)
    draw.line((1152, 296, 1210, 296), fill=BRASS, width=4)
    draw.line((1152, 411, 1210, 411), fill=BRASS, width=4)
    draw.rounded_rectangle((1335, 425, 1715, 500), radius=12, fill=CALLOUT_FILL, outline=BRASS, width=3)
    wrapped(draw, "After seeding, nobody may count, inspect, reorder or reveal cards in the deck unless an effect allows it.", (1355, 443, 1695, 488), font(ARIAL, 16), INK, spacing=2)
    image.save(OUT / "encounter-seeding.png", optimize=True)


def actions_visual():
    w, h = 1800, 420
    image = Image.new("RGB", (w, h), BG)
    draw = ImageDraw.Draw(image)
    draw.rectangle((18, 18, w - 18, h - 18), outline="#D2C8B0", width=3)
    title(draw, "Four Actions", w)
    actions = [
        (45, "PLACE", "Add a legal Tile", "+", "1 Action"),
        (480, "UPGRADE", "Flip a Core Tile", "↑", "1 Action"),
        (915, "ACTIVATE", "Use an Activated Effect", "✦", "1 Action"),
        (1350, "INTERACT", "Complete Arrival / resolve Burden", "!", "1 Action"),
    ]
    for x, label, body, icon, cost in actions:
        panel(draw, (x, 105, x + 405, 365), PALE, label)
        if icon in ("+", "↑"):
            hexagon(draw, x + 45, 190, 75, 60, CALLOUT_FILL, GREEN, 4)
        elif icon == "✦":
            draw.ellipse((x + 45, 185, x + 120, 260), fill=CALLOUT_FILL, outline=GREEN, width=4)
        else:
            draw.rounded_rectangle((x + 45, 185, x + 120, 260), radius=10, fill=CALLOUT_FILL, outline=GREEN, width=4)
        if icon == "✦":
            star(draw, x + 82, 222, outer=25, inner=11, fill=BRASS)
        else:
            centered(draw, (x + 45, 185, x + 120, 260), icon, font(ARIAL_BOLD, 29), BRASS)
        wrapped(draw, body, (x + 150, 230, x + 370, 270), font(ARIAL, 17), INK, spacing=2)
        draw.text((x + 150, 300), cost, font=font(ARIAL_BOLD, 18), fill=BRASS)
    image.save(OUT / "four-actions.png", optimize=True)


def arrival_timing_visual():
    w, h = 1800, 500
    image = Image.new("RGB", (w, h), BG)
    draw = ImageDraw.Draw(image)
    draw.rectangle((18, 18, w - 18, h - 18), outline="#D2C8B0", width=3)
    title(draw, "Arrival Timing", w)
    panel(draw, (45, 105, 335, 400), PALE, "WHEN REVEALED")
    centered(draw, (75, 165, 305, 210), "Arrival", font(GEORGIA_BOLD, 28), GREEN)
    draw.ellipse((145, 230, 235, 320), fill=BG, outline=GREEN, width=5)
    centered(draw, (145, 230, 235, 320), "3", font(ARIAL_BOLD, 28), INK)
    centered(draw, (75, 335, 305, 370), "starts with 3 timers", font(ARIAL, 17), INK)
    panel(draw, (370, 105, 1425, 400), PALE, "REMOVE 1 AT EACH ROUND END")
    points = [
        (590, 250, "2", "FIRST ROUND END"),
        (900, 250, "1", "NEXT ROUND END"),
        (1210, 250, "0", "THIRD ROUND END"),
    ]
    arrow(draw, (650, 250), (840, 250), fill=BRASS, width=4)
    arrow(draw, (960, 250), (1150, 250), fill=BRASS, width=4)
    for cx, cy, value, timing in points:
        draw.ellipse((cx - 55, cy - 55, cx + 55, cy + 55), fill=BG, outline=GREEN, width=5)
        centered(draw, (cx - 55, cy - 55, cx + 55, cy + 55), value, font(ARIAL_BOLD, 28), INK)
        centered(draw, (cx - 125, 320, cx + 125, 348), timing, font(ARIAL_BOLD, 14), GREEN)
    centered(draw, (420, 355, 1375, 385), "Before it reaches 0: fulfil the Requirement and spend 1 Interact Action.", font(ARIAL_BOLD, 15), GREEN)
    panel(draw, (1460, 105, 1755, 400), PALE, "IF IT REACHES 0")
    centered(draw, (1490, 165, 1725, 205), "Failed Arrival", font(GEORGIA_BOLD, 24), GREEN)
    draw.ellipse((1560, 220, 1650, 310), fill=BG, outline="#965946", width=5)
    centered(draw, (1560, 220, 1650, 310), "0", font(ARIAL_BOLD, 27), "#965946")
    wrapped(draw, "Record -10 at final scoring; draw a Target Card and apply 1 Strain.", (1495, 322, 1725, 388), font(ARIAL, 15), INK, spacing=2)
    image.save(OUT / "arrival-timing.png", optimize=True)


def small_tile(draw, x, y, name, side, fill, *, support=False, strain=False):
    scale = 0.66
    w, h = int(HEX_W * scale), int(HEX_H * scale)
    outline = BRASS if side == "Upgraded" else GREEN
    hexagon(draw, x, y, w, h, fill, outline, 4)
    name_size = 15 if len(name) <= 10 else 12
    centered(draw, (x + 12, y + 40, x + w - 12, y + 70), name, font(ARIAL_BOLD, name_size), INK)
    centered(draw, (x + 12, y + 74, x + w - 12, y + h - 14), side, font(ARIAL, 11), INK)
    if support:
        # Keep the small physical token above the label so it remains fully
        # on the Tile without obscuring a long name such as Fine Cottage.
        disc(draw, x + w - 66, y + 16, size=24)
    if strain:
        token_stack(draw, x + 20, y + 13, size=22, step=6)
    return w, h


def terrain_placement_visual():
    w, h = 1800, 800
    image = Image.new("RGB", (w, h), BG)
    draw = ImageDraw.Draw(image)
    draw.rectangle((18, 18, w - 18, h - 18), outline="#D2C8B0", width=3)
    title(draw, "Terrain, placement and adjacency", w)

    panel(draw, (45, 105, 600, 755), PALE, "TERRAIN MATCH")
    terrain_examples = [
        (78, 205, "Mine Tunnel", "MOUNTAINS", BLUE),
        (315, 205, "Farmstead", "ARABLE LAND", BLUE),
        (78, 440, "Salvage Camp", "RUINS", BLUE),
        (315, 440, "Bridge", "WATER / RIVER", TRAVEL),
    ]
    for x, y, name, terrain, fill in terrain_examples:
        small_tile(draw, x, y, name, "Basic", fill)
        draw.rounded_rectangle((x + 5, y - 42, x + 153, y - 8), radius=8, fill=CALLOUT_FILL, outline=BRASS, width=2)
        centered(draw, (x + 8, y - 40, x + 150, y - 10), terrain, font(ARIAL_BOLD, 12), GREEN)
    wrapped(draw, "Core examples: Mine Tunnel → Mountains; Farmstead → Arable Land; Salvage Camp → Ruins; Bridge → Water/River. Shelter in the Ruins: a full Ruins footprint ignores Stone in its placement or upgrade cost.", (70, 625, 575, 715), font(ARIAL, 14), INK, spacing=2)

    panel(draw, (625, 105, 1175, 755), PALE_ALT, "ADJACENCY = SHARED SIDE")
    small_tile(draw, 655, 295, "Path", "Basic", TRAVEL)
    small_tile(draw, 773, 232, "Workshops", "Basic", CRAFT)
    small_tile(draw, 891, 295, "Cabin", "Basic", HOUSING)
    small_tile(draw, 1009, 232, "Cottage", "Basic", HOUSING)
    centered(draw, (655, 445, 1135, 485), "Path ↔ Workshops    •    Cabin ↔ Cottage", font(ARIAL_BOLD, 16), GREEN)
    wrapped(draw, "Examples: Workshops and Market Stalls need adjacent Travel; Cottage needs adjacent Housing; Washhouse needs adjacent River; The Vaults needs adjacent Ruins.", (655, 520, 1145, 620), font(ARIAL, 15), INK, spacing=2)
    draw.rounded_rectangle((655, 650, 1145, 705), radius=10, fill=CALLOUT_FILL, outline=BRASS, width=2)
    centered(draw, (670, 660, 1130, 695), "A corner touch is not adjacency.", font(ARIAL_BOLD, 16), GREEN)

    panel(draw, (1200, 105, 1755, 755), PALE, "EVERY PLACEMENT CHECK")
    steps = [
        "Choose an available Tile.",
        "Choose an empty reachable hex.",
        "Check terrain, adjacency and the printed rule.",
        "Pay the listed resources.",
        "Place the Tile and resolve its placement effect.",
    ]
    for index, body in enumerate(steps):
        y = 175 + index * 78
        draw.ellipse((1245, y, 1289, y + 44), fill=GREEN)
        centered(draw, (1245, y, 1289, y + 44), str(index + 1), font(ARIAL_BOLD, 17), "white")
        wrapped(draw, body, (1310, y + 1, 1710, y + 42), font(ARIAL, 16), INK, spacing=2)
    draw.rounded_rectangle((1245, 590, 1710, 700), radius=12, fill=CALLOUT_FILL, outline=BRASS, width=2)
    wrapped(draw, "Do not place a Tile on Water/River terrain unless its own rule permits or requires it. A Bridge follows its printed Water/River placement rule.", (1260, 608, 1695, 685), font(ARIAL, 15), INK, spacing=2)
    image.save(OUT / "terrain-placement.png", optimize=True)


def terrain_map_legend_visual():
    """Show clipped map art beside the names used by the placement rules."""
    w, h = 1800, 760
    image = Image.new("RGB", (w, h), BG)
    draw = ImageDraw.Draw(image)
    draw.rectangle((18, 18, w - 18, h - 18), outline="#D2C8B0", width=3)
    title(draw, "Map terrain legend", w)
    wrapped(
        draw,
        "The map uses shapes, colour and artwork instead of printed terrain names. Match the region to a clip below before checking a Tile's placement rule.",
        (70, 78, 1730, 112),
        font(ARIAL, 18),
        INK,
        spacing=2,
    )

    source = Image.open(MAP_SOURCE).convert("RGB")
    preview_w, preview_h = 1800, 1465
    scale_x = source.width / preview_w
    scale_y = source.height / preview_h
    entries = [
        ("Mountains", "Grey peaks", (100, 75, 300, 245)),
        ("Woodland", "Green forest", (770, 75, 1030, 245)),
        ("Arable Land", "Gold fields", (1420, 80, 1720, 275)),
        ("Heaths", "Purple wildlands", (75, 360, 320, 610)),
        ("Ruins", "Red-brown stone", (620, 470, 870, 790)),
        ("Water / River", "Blue watercourse", (540, 820, 780, 1100)),
        ("Grasslands", "Open tan land", (1020, 250, 1250, 430)),
    ]
    card_w = 390
    card_h = 250
    positions = [(45, 135), (480, 135), (915, 135), (1350, 135), (260, 430), (695, 430), (1130, 430)]
    for (name, descriptor, crop_box), (x, y) in zip(entries, positions):
        draw.rounded_rectangle((x, y, x + card_w, y + card_h), radius=16, fill=PALE, outline="#9B927C", width=3)
        left, top, right, bottom = crop_box
        crop = source.crop((int(left * scale_x), int(top * scale_y), int(right * scale_x), int(bottom * scale_y)))
        crop.thumbnail((card_w - 24, 155), Image.Resampling.LANCZOS)
        paste_x = x + (card_w - crop.width) // 2
        paste_y = y + 12 + (155 - crop.height) // 2
        image.paste(crop, (paste_x, paste_y))
        draw.rectangle((x + 10, y + 10, x + card_w - 10, y + 12 + 155), outline="#C9B98C", width=2)
        centered(draw, (x + 15, y + 175, x + card_w - 15, y + 207), name, font(ARIAL_BOLD, 21), GREEN)
        centered(draw, (x + 15, y + 210, x + card_w - 15, y + 238), descriptor, font(ARIAL, 17), INK)
    image.save(OUT / "terrain-map-legend.png", optimize=True)


def neighbourly_support_visual():
    w, h = 1800, 690
    image = Image.new("RGB", (w, h), BG)
    draw = ImageDraw.Draw(image)
    draw.rectangle((18, 18, w - 18, h - 18), outline="#D2C8B0", width=3)
    title(draw, "Neighbourly Support · End of Seasons I and II", w)
    panel(draw, (45, 105, 900, 655), PALE, "COUNT THE CONNECTED HOUSING CLUSTER")
    small_tile(draw, 95, 210, "Cabin", "Overstrained", HOUSING, strain=True)
    small_tile(draw, 95, 325, "Cabin", "Basic", HOUSING)
    small_tile(draw, 203, 267, "Cottage", "Basic", HOUSING)
    small_tile(draw, 311, 210, "Fine Cabin", "Upgraded", HOUSING)
    small_tile(draw, 419, 267, "Fine Cottage", "Upgraded", HOUSING)
    small_tile(draw, 527, 210, "Inn", "Basic", HOUSING)
    small_tile(draw, 203, 382, "Stedding", "Basic", HOUSING)
    centered(draw, (70, 550, 870, 590), "Six connected, non-Overstrained Housing Tiles count as one cluster.", font(ARIAL_BOLD, 17), GREEN)

    panel(draw, (935, 105, 1755, 655), PALE, "APPLY THE SEASON-END SUPPORT")
    steps = [
        "Ignore the Overstrained Housing Tile for connection and cluster size.",
        "Count 6 eligible Housing Tiles: two complete groups of 3 give 2 Supported.",
        "Place one bronze Supported disc on two different eligible Housing Tiles.",
    ]
    for index, body in enumerate(steps):
        y = 185 + index * 125
        draw.ellipse((985, y, 1035, y + 50), fill=GREEN)
        centered(draw, (985, y, 1035, y + 50), str(index + 1), font(ARIAL_BOLD, 20), "white")
        wrapped(draw, body, (1065, y + 2, 1695, y + 48), font(ARIAL, 19), INK, spacing=3)
    draw.rounded_rectangle((985, 570, 1705, 620), radius=12, fill=CALLOUT_FILL, outline=BRASS, width=3)
    centered(draw, (1005, 580, 1685, 610), "The bronze discs are single-use Supported.", font(ARIAL_BOLD, 18), GREEN)
    image.save(OUT / "neighbourly-support.png", optimize=True)


def steward_visual():
    w, h = 1800, 610
    image = Image.new("RGB", (w, h), BG)
    draw = ImageDraw.Draw(image)
    draw.rectangle((18, 18, w - 18, h - 18), outline="#D2C8B0", width=3)
    title(draw, "Steward Token Movement", w)
    panels = [(45, 105, 575, 565), (610, 105, 1165, 565), (1200, 105, 1755, 565)]
    labels = [
        ("1  PLACE", "Place Cabin on the Token's starting hex."),
        ("2  UPGRADE", "Later, upgrade Cabin to Fine Cabin."),
        ("3  ACTIVATE", "Activate an existing reachable Mine Tunnel."),
    ]
    for box, (label, body) in zip(panels, labels):
        panel(draw, box, PALE)
        left, top, right, bottom = box
        centered(draw, (left + 20, top + 15, right - 20, top + 48), label, font(ARIAL_BOLD, 22), GREEN)
        wrapped(draw, body, (left + 25, bottom - 60, right - 25, bottom - 25), font(ARIAL, 18), INK, spacing=2)
    tile(draw, 190, 175, "Cabin", "H", "Basic", HOUSING, token=True)
    centered(draw, (80, 395, 540, 435), "First placement starts the network.", font(ARIAL_BOLD, 19), GREEN)
    small_tile(draw, 645, 285, "Fine Cabin", "Upgraded", HOUSING)
    small_tile(draw, 763, 222, "Path", "Basic", TRAVEL)
    small_tile(draw, 881, 285, "Mine Tunnel", "Basic", CRAFT)
    meeple(draw, 705, 294, scale=1.5)
    centered(draw, (635, 450, 1140, 490), "The network stays in place; the Token follows the upgrade.", font(ARIAL_BOLD, 17), GREEN)
    small_tile(draw, 1235, 285, "Fine Cabin", "Upgraded", HOUSING)
    small_tile(draw, 1353, 222, "Path", "Basic", TRAVEL)
    small_tile(draw, 1471, 285, "Mine Tunnel", "Basic", CRAFT)
    meeple(draw, 1531, 294, scale=1.5)
    centered(draw, (1225, 450, 1730, 490), "Gain 2 Stone; the Token moves to Mine Tunnel.", font(ARIAL_BOLD, 18), GREEN)
    arrow(draw, (580, 325), (605, 325))
    arrow(draw, (1170, 325), (1195, 325))
    image.save(OUT / "steward-token-movement.png", optimize=True)


def core_tile_visual():
    w, h = 1800, 1060
    image = Image.new("RGB", (w, h), BG)
    draw = ImageDraw.Draw(image)
    draw.rectangle((18, 18, w - 18, h - 18), outline="#D2C8B0", width=3)
    title(draw, "Core Tile patterns in practice", w)
    boxes = [
        (45, 105, 875, 570),
        (925, 105, 1755, 570),
        (45, 600, 875, 1035),
        (925, 600, 1755, 1035),
    ]
    panel(draw, boxes[0], PALE, "WORKSHOPS • BASIC SIDE • PASSIVE")
    tile(draw, 80, 255, "Path", "T", "Basic", TRAVEL)
    tile(draw, 260, 160, "Workshops", "C", "Basic", CRAFT)
    tile(draw, 440, 255, "Cabin", "H", "Basic", HOUSING)
    centered(draw, (80, 470, 840, 505), "Workshops is adjacent to Cabin.", font(ARIAL_BOLD, 20), GREEN)
    wrapped(draw, "When Cabin is upgraded to Fine Cabin, reduce its cost by 1 resource. No Activate Action is used.", (90, 512, 830, 560), font(ARIAL, 17), INK, spacing=2)

    panel(draw, boxes[1], PALE_ALT, "THE MAKERS CONCLAVE • UPGRADED • PASSIVE")
    tile(draw, 980, 255, "Makers Conclave", "C", "Upgraded", CRAFT, compact=True)
    tile(draw, 1160, 160, "Path", "T", "Basic", TRAVEL)
    tile(draw, 1340, 255, "Cottage", "H", "Basic", HOUSING, compact=True)
    centered(draw, (980, 470, 1710, 505), "Path connects the network; Cottage is reachable, not adjacent.", font(ARIAL_BOLD, 18), GREEN)
    wrapped(draw, "When Cottage is upgraded to Fine Cottage, reduce its cost by up to 2 resources. No Activate Action is used.", (970, 512, 1710, 560), font(ARIAL, 17), INK, spacing=2)

    panel(draw, boxes[2], PALE_ALT, "MARKET STALLS • BASIC SIDE • PASSIVE")
    tile(draw, 80, 760, "Market Stalls", "M", "Basic", MERCHANT, compact=True)
    tile(draw, 260, 665, "Path", "T", "Basic", TRAVEL)
    callout(draw, (500, 680, 835, 805), "TILE COST", "Fine Cabin costs 2 Stone + 5 Food. Convert 1 Goods into 1 Food: pay 2 Stone + 4 Food + 1 Goods.")
    callout(draw, (500, 830, 835, 955), "ARRIVAL COST", "Quiet Quest costs 4 Goods + 2 Herbs. Convert 1 Goods into 1 Herb: pay 5 Goods + 1 Herb.")
    centered(draw, (80, 970, 840, 1010), "One conversion each round; printed Goods costs remain.", font(ARIAL_BOLD, 18), GREEN)

    panel(draw, boxes[3], PALE, "THE SELDES • UPGRADED • PASSIVE")
    tile(draw, 980, 760, "The Seldes", "M", "Upgraded", MERCHANT, compact=True)
    tile(draw, 1160, 665, "Path", "T", "Basic", TRAVEL)
    callout(draw, (1400, 680, 1715, 805), "UPGRADE", "Fine Cabin: 2 Stone + 5 Food. Convert 1 Goods into up to 2 Food: pay 2 Stone + 3 Food + 1 Goods.")
    callout(draw, (1400, 830, 1715, 955), "ARRIVAL", "The conversion covers up to 2 of one non-Goods resource. The printed Goods requirement remains.")
    centered(draw, (970, 970, 1715, 1010), "The Merchant changes payment, not Actions or printed requirements.", font(ARIAL_BOLD, 17), GREEN)
    image.save(OUT / "core-tile-patterns.png", optimize=True)


def linked_production_visual():
    w, h = 1800, 650
    image = Image.new("RGB", (w, h), BG)
    draw = ImageDraw.Draw(image)
    draw.rectangle((18, 18, w - 18, h - 18), outline="#D2C8B0", width=3)
    title(draw, "Linked Production", w)

    panel(draw, (45, 105, 900, 615), PALE, "FIRST ACTIVATION THIS ROUND")
    tile(draw, 90, 275, "Mine Shaft", "R", "Upgraded", CRAFT)
    tile(draw, 270, 180, "Mine Shaft", "R", "Upgraded", CRAFT)
    tile(draw, 450, 275, "Mine Shaft", "R", "Upgraded", CRAFT)
    centered(draw, (270, 155, 510, 178), "CHOSEN TILE", font(ARIAL_BOLD, 18), BRASS)
    centered(draw, (80, 505, 865, 545), "Each immediately adjacent matching Mine Shaft also produces.", font(ARIAL_BOLD, 19), GREEN)
    centered(draw, (80, 555, 865, 590), "3 Stone + 2 Metal from each = 15 resources total.", font(ARIAL, 19), INK)

    panel(draw, (945, 105, 1755, 615), PALE_ALT, "LATER ACTIVATION OF THE SAME GROUP")
    tile(draw, 1030, 275, "Mine Shaft", "R", "Upgraded", CRAFT)
    centered(draw, (1010, 505, 1730, 545), "Only the chosen Mine Shaft produces again this round.", font(ARIAL_BOLD, 19), GREEN)
    centered(draw, (1010, 555, 1730, 590), "3 Stone + 2 Metal = 5 resources.", font(ARIAL, 19), INK)
    image.save(OUT / "linked-production.png", optimize=True)


def workshops_core_visual():
    w, h = 1800, 650
    image = Image.new("RGB", (w, h), BG)
    draw = ImageDraw.Draw(image)
    draw.rectangle((18, 18, w - 18, h - 18), outline="#D2C8B0", width=3)
    title(draw, "Workshops and The Makers Conclave", w)

    panel(draw, (45, 105, 875, 615), PALE, "WORKSHOPS • BASIC SIDE • PASSIVE")
    tile(draw, 80, 270, "Path", "T", "Basic", TRAVEL)
    tile(draw, 260, 175, "Workshops", "C", "Basic", CRAFT)
    tile(draw, 440, 270, "Cabin", "H", "Basic", HOUSING)
    centered(draw, (80, 475, 840, 505), "Adjacent Core Tile: Cabin → Fine Cabin", font(ARIAL_BOLD, 18), GREEN)
    wrapped(draw, "When Cabin is upgraded to Fine Cabin, reduce its cost by 1 resource. No Activate Action is used.", (90, 520, 830, 590), font(ARIAL, 16), INK, spacing=2)

    panel(draw, (925, 105, 1755, 615), PALE_ALT, "THE MAKERS CONCLAVE • UPGRADED • PASSIVE")
    tile(draw, 980, 270, "Makers Conclave", "C", "Upgraded", CRAFT, compact=True)
    tile(draw, 1160, 175, "Path", "T", "Basic", TRAVEL)
    tile(draw, 1340, 270, "Cottage", "H", "Basic", HOUSING, compact=True)
    centered(draw, (965, 475, 1715, 505), "Reachable Core Tile: Cottage can be farther away.", font(ARIAL_BOLD, 18), GREEN)
    wrapped(draw, "When Cottage is upgraded to Fine Cottage, reduce its cost by up to 2 resources. It need not be adjacent, and no Activate Action is used.", (970, 520, 1710, 595), font(ARIAL, 16), INK, spacing=2)
    image.save(OUT / "workshops-core.png", optimize=True)


def merchant_core_visual():
    w, h = 1800, 760
    image = Image.new("RGB", (w, h), BG)
    draw = ImageDraw.Draw(image)
    draw.rectangle((18, 18, w - 18, h - 18), outline="#D2C8B0", width=3)
    title(draw, "Market Stalls and The Seldes", w)

    panel(draw, (45, 105, 875, 725), PALE_ALT, "MARKET STALLS • BASIC SIDE • PASSIVE")
    tile(draw, 80, 330, "Market Stalls", "M", "Basic", MERCHANT, compact=True)
    tile(draw, 260, 235, "Path", "T", "Basic", TRAVEL)
    callout(draw, (500, 270, 835, 405), "TILE COST", "Fine Cabin costs 2 Stone + 5 Food. Convert 1 Goods into 1 Food: pay 2 Stone + 4 Food + 1 Goods.")
    centered(draw, (80, 635, 840, 680), "Once per round, spend 1 Goods as 1 resource of any type.", font(ARIAL_BOLD, 18), GREEN)

    panel(draw, (925, 105, 1755, 725), PALE, "THE SELDES • UPGRADED • PASSIVE")
    tile(draw, 980, 330, "The Seldes", "M", "Upgraded", MERCHANT, compact=True)
    tile(draw, 1160, 235, "Path", "T", "Basic", TRAVEL)
    callout(draw, (1400, 270, 1715, 405), "UPGRADE", "Fine Cabin: 2 Stone + 5 Food. Convert 1 Goods into up to 2 Food: pay 2 Stone + 3 Food + 1 Goods.")
    callout(draw, (1400, 445, 1715, 580), "ARRIVAL", "The conversion covers up to 2 of one non-Goods resource. The printed Goods requirement remains.")
    centered(draw, (970, 635, 1715, 680), "Once per round, spend 1 Goods as up to 2 resources of one type.", font(ARIAL_BOLD, 17), GREEN)
    image.save(OUT / "merchant-core.png", optimize=True)


def overstrain_visual():
    w, h = 1800, 690
    image = Image.new("RGB", (w, h), BG)
    draw = ImageDraw.Draw(image)
    draw.rectangle((18, 18, w - 18, h - 18), outline="#D2C8B0", width=3)
    title(draw, "Overstrain Chain", w)

    panel(draw, (45, 105, 930, 655), PALE, "COTTAGE AT 3 • PATH AT 2")
    tile(draw, 140, 250, "Cottage", "H", "Basic", HOUSING)
    tile(draw, 320, 345, "Path", "T", "Basic", TRAVEL)
    tile(draw, 500, 250, "Tavern", "S", "Basic", PALE_ALT)
    token_stack(draw, 170, 260, size=38, step=11)
    token_stack(draw, 350, 355, size=38, count=2, step=11)
    centered(draw, (95, 555, 880, 590), "Cottage reaches 3 and starts the first spread.", font(ARIAL_BOLD, 19), GREEN)
    centered(draw, (95, 600, 880, 635), "If the Target Card selects Path, Path reaches 3 and spreads next.", font(ARIAL, 17), INK)

    panel(draw, (965, 105, 1755, 655), PALE_ALT, "RESOLVE THE CHAIN")
    steps = [
        "Finish the effect that caused Cottage to reach 3.",
        "Draw a fresh Target Card for Cottage's spread.",
        "Apply 1 Strain to the selected eligible Tile.",
        "If that Tile reaches 3 from below, it spreads next.",
    ]
    for i, text in enumerate(steps):
        y = 175 + i * 92
        draw.ellipse((1010, y, 1052, y + 42), fill=BRASS)
        centered(draw, (1010, y, 1052, y + 42), str(i + 1), font(ARIAL_BOLD, 19), "white")
        wrapped(draw, text, (1075, y + 2, 1715, y + 42), font(ARIAL, 19), INK, spacing=2)
    centered(draw, (1000, 570, 1725, 620), "A Tile already at 3 does not spread again unless it first falls below 3.", font(ARIAL_BOLD, 18), GREEN)
    image.save(OUT / "overstrain-chain.png", optimize=True)


def river_connection_visual():
    w, h = 1800, 590
    image = Image.new("RGB", (w, h), BG)
    draw = ImageDraw.Draw(image)
    draw.rectangle((18, 18, w - 18, h - 18), outline="#D2C8B0", width=3)
    title(draw, "Rivers and Bridges", w)

    panel(draw, (45, 105, 875, 555), PALE, "WITHOUT A BRIDGE")
    draw.rectangle((395, 150, 445, 445), fill=BLUE)
    for index, letter in enumerate("RIVER"):
        centered(draw, (395, 228 + index * 38, 445, 258 + index * 38), letter, font(ARIAL_BOLD, 17), GREEN)
    tile(draw, 90, 205, "Path", "T", "Basic", TRAVEL)
    tile(draw, 520, 205, "Cottage", "H", "Basic", HOUSING)
    centered(draw, (85, 455, 835, 505), "Opposite banks do not connect through an unbridged River.", font(ARIAL_BOLD, 18), GREEN)

    panel(draw, (925, 105, 1755, 555), PALE_ALT, "WITH A BRIDGE")
    draw.rectangle((1255, 150, 1305, 445), fill=BLUE)
    for index, letter in enumerate("RIVER"):
        centered(draw, (1255, 188 + index * 38, 1305, 218 + index * 38), letter, font(ARIAL_BOLD, 17), GREEN)
    tile(draw, 980, 265, "Path", "T", "Basic", TRAVEL)
    tile(draw, 1160, 170, "Bridge", "T", "Basic", TRAVEL)
    tile(draw, 1340, 265, "Cottage", "H", "Basic", HOUSING)
    centered(draw, (965, 485, 1715, 525), "A Bridge on Water/River reconnects the settlement network.", font(ARIAL_BOLD, 18), GREEN)
    image.save(OUT / "river-connection.png", optimize=True)


def inn_visual():
    w, h = 1800, 760
    image = Image.new("RGB", (w, h), BG)
    draw = ImageDraw.Draw(image)
    draw.rectangle((18, 18, w - 18, h - 18), outline="#D2C8B0", width=3)
    title(draw, "Inn and Arrival timers", w)
    panel(draw, (45, 105, 835, 725), PALE, "INN • BASIC AND UPGRADED SIDES")
    tile(draw, 85, 300, "Inn", "H", "Basic", HOUSING)
    tile(draw, 265, 205, "Path", "T", "Basic", TRAVEL)
    tile(draw, 85, 490, "Dawn Break Inn", "H", "Upgraded", HOUSING, compact=True)
    wrapped(draw, "Activate the Inn while an Arrival is active.", (520, 235, 805, 300), font(ARIAL_BOLD, 17), GREEN, spacing=2)
    centered(draw, (520, 310, 805, 350), "Inn: +1 timer", font(ARIAL_BOLD, 20), GREEN)
    centered(draw, (520, 365, 805, 405), "Dawn Break Inn: up to +2", font(ARIAL_BOLD, 17), GREEN)
    wrapped(draw, "Timers cannot exceed 3. The Inn adds time; it does not complete the Arrival.", (520, 430, 805, 515), font(ARIAL, 16), INK, spacing=2)

    panel(draw, (875, 105, 1755, 725), PALE_ALT, "QUIET QUEST • A TIMELY ACTIVATION")
    card = Image.open(OUT / "current-card-examples/arrival-quiet-quest.png").convert("RGB")
    card.thumbnail((190, 335), Image.Resampling.LANCZOS)
    image.paste(card, (930, 175))
    centered(draw, (910, 525, 1140, 565), "REAL ARRIVAL CARD", font(ARIAL_BOLD, 17), GREEN)
    centered(draw, (1190, 165, 1705, 205), "1 timer remaining → activate Inn → 2 timers", font(ARIAL_BOLD, 21), GREEN)
    for x, label, fill in [(1220, "1", RED), (1390, "+1", BRASS), (1560, "2", GREEN)]:
        draw.ellipse((x, 245, x + 72, 317), fill=PALE, outline=fill, width=5)
        centered(draw, (x, 245, x + 72, 317), label, font(ARIAL_BOLD, 25), fill)
        if label != "2":
            arrow(draw, (x + 84, 281), (x + 158, 281), fill=BRASS, width=4)
    wrapped(draw, "The extra timer buys time. To complete Quiet Quest, still pay 4 Goods and 2 Herbs and spend 1 Interact Action.", (1190, 370, 1705, 480), font(ARIAL, 19), INK, spacing=3)
    image.save(OUT / "inn-arrival-timers.png", optimize=True)


def supported_visual():
    w, h = 1800, 760
    image = Image.new("RGB", (w, h), BG)
    draw = ImageDraw.Draw(image)
    draw.rectangle((18, 18, w - 18, h - 18), outline="#D2C8B0", width=3)
    title(draw, "Passive Supported from Core Tiles", w)
    panel(draw, (45, 105, 870, 705), PALE, "COMMON LAND • BASIC SIDE")
    tile(draw, 80, 300, "Common Land", "T", "Basic", TRAVEL)
    tile(draw, 260, 205, "Cabin", "H", "Basic", HOUSING, support=True)
    tile(draw, 440, 300, "Cottage", "H", "Basic", HOUSING)
    centered(draw, (80, 515, 835, 555), "Common Land gives passive Supported to the adjacent Cabin.", font(ARIAL_BOLD, 18), GREEN)
    wrapped(draw, "The source Tile must not be Overstrained. Cottage is connected, but not adjacent, so it is not Supported.", (90, 575, 825, 660), font(ARIAL, 18), INK, spacing=2)

    panel(draw, (930, 105, 1755, 705), PALE_ALT, "THE PLEASANCE • UPGRADED SIDE")
    tile(draw, 975, 260, "The Pleasance", "T", "Upgraded", TRAVEL)
    tile(draw, 1155, 165, "Cabin", "H", "Basic", HOUSING, support=True)
    tile(draw, 1155, 355, "Cottage", "H", "Basic", HOUSING, support=True)
    tile(draw, 975, 450, "Fine Cabin", "H", "Upgraded", HOUSING, support=True)
    centered(draw, (955, 655, 1730, 695), "The Pleasance gives passive Supported to up to 3 adjacent Housing Tiles.", font(ARIAL_BOLD, 18), GREEN)
    image.save(OUT / "supported-from-core.png", optimize=True)


def main():
    cover_visual()
    standard_setup_visual()
    seasons_visual()
    seeding_visual()
    actions_visual()
    arrival_timing_visual()
    terrain_placement_visual()
    terrain_map_legend_visual()
    neighbourly_support_visual()
    steward_visual()
    core_tile_visual()
    linked_production_visual()
    workshops_core_visual()
    merchant_core_visual()
    overstrain_visual()
    river_connection_visual()
    inn_visual()
    supported_visual()
    print(OUT)


if __name__ == "__main__":
    main()
