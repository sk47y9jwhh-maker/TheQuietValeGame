from __future__ import annotations

import argparse
import json
import math
import subprocess
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape

from PIL import Image as PILImage, ImageChops, ImageFilter, ImageOps
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle


ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / "working/steward-aids-redesign"
TMP = ROOT / "tmp/pdfs/steward-aids-v6_7-suite"
OUTPUT_DIR = ROOT / "output/pdf/steward-aids-v6_7"
EXPORTER = WORK / "export_steward_content.ts"
VITE_NODE = ROOT / "node_modules/.bin/vite-node"

PAGE_W = 105 * mm
PAGE_H = 148 * mm
MARGIN_X = 8 * mm
CONTENT_W = PAGE_W - 2 * MARGIN_X

PARCHMENT = HexColor("#F4F0E5")
PARCHMENT_ALT = HexColor("#EAE4D5")
PARCHMENT_DEEP = HexColor("#DED4BE")
INK = HexColor("#24312A")
FOREST = HexColor("#315846")
FOREST_DARK = HexColor("#1E382D")
FOREST_MUTED = HexColor("#4A6B5B")
BRASS = HexColor("#A78343")
BRASS_LIGHT = HexColor("#D9C48E")
MIST = HexColor("#78A0A1")
MIST_LIGHT = HexColor("#DCE9E6")
ROSE = HexColor("#A95E57")
ROSE_LIGHT = HexColor("#ECD9D4")
LINE = HexColor("#9D927B")
COVER_BLACK = HexColor("#070908")
WHITE = colors.white
DIVIDER_STROKE = 0.42

MAP = ROOT / "working/rules-v6_7/assets/aid-map.png"
TREE = ROOT / "src/assets/quiet_vale_tree_brass_transparent.png"
BOON_ART = ROOT / "src/assets/encounter-cards/boon.png"
BURDEN_ART = ROOT / "src/assets/encounter-cards/burden.png"

CORNER_LEFT = TMP / "encounter-corner-left.png"
CORNER_RIGHT = TMP / "encounter-corner-right.png"
CORNER_BOTTOM_LEFT = TMP / "encounter-corner-bottom-left.png"
CORNER_BOTTOM_RIGHT = TMP / "encounter-corner-bottom-right.png"
DIVIDER_BRASS = TMP / "encounter-divider-flourish-brass.png"
DIVIDER_LIGHT = TMP / "encounter-divider-flourish-light.png"

RESOURCE_ORDER = ["wood", "stone", "metal", "food", "herbs", "goods"]
TERRAIN_LABELS = {
    "woodland": "Woodland",
    "mountains": "Mountains",
    "heaths": "Heaths",
    "arable": "Arable Land",
    "ruins": "Ruins",
    "grasslands": "Grasslands",
    "water": "River/Water",
}

ROLE_META = {
    # These are restrained print accents derived from the user's physical
    # prototype meeples, not replacements for their full text identities.
    "vanguard": {"roman": "I", "code": "V", "accent": HexColor("#55764F")},
    "knight": {"roman": "II", "code": "K", "accent": HexColor("#A88E32")},
    "sentinel": {"roman": "III", "code": "S", "accent": HexColor("#5E8293")},
    "ranger": {"roman": "IV", "code": "R", "accent": HexColor("#776184")},
    "warden": {"roman": "V", "code": "W", "accent": HexColor("#AD673D")},
    "quartermaster": {"roman": "VI", "code": "Q", "accent": HexColor("#A68E6A")},
}

RESOURCE_COLOURS = {
    "wood": "#55764F",
    "stone": "#84683F",
    "metal": "#68767E",
    "food": "#8E7826",
    "herbs": "#776184",
    "goods": "#AD673D",
}

CATEGORY_COLOURS = {
    "resource": HexColor("#5B7C4C"),
    "housing": HexColor("#A6654E"),
    "social": HexColor("#8A6259"),
    "wellbeing": HexColor("#658A8B"),
    "crafting": HexColor("#8D7443"),
    "merchant": HexColor("#9A633F"),
    "travel": HexColor("#4F7B75"),
}

TILE_PAGE_GROUPS = [
    ("WOODLAND · MOUNTAINS", "RESOURCE STACKS I", ["c01_lumber_yard", "c02_mine_tunnel"], False),
    ("HEATHS · ARABLE LAND", "RESOURCE STACKS II", ["c03_gathering_outpost", "c04_farmstead"], False),
    ("RUINS · FIRST HOUSING", "DIG SITE & CABIN", ["c20_dig_site", "c05_cabin"], False),
    ("POPULATION · ARRIVALS", "COTTAGE & INN", ["c06_cottage", "c08_inn"], False),
    ("CLUSTERS · SOCIAL", "STEDDING & TAVERN", ["c07_stedding", "c09_tavern"], False),
    ("WELLBEING", "EATERY & WASHHOUSE", ["c10_eatery", "c11_washhouse"], False),
    ("RECOVERY · RUINS", "APOTHECARY & THE VAULTS", ["c12_apothecary", "c21_the_vaults"], False),
    ("CRAFTING · MERCHANT", "WORKSHOPS & MARKET STALLS", ["c13_workshops", "c14_market_stalls"], False),
    ("TRAVEL · SUPPORT", "PATH & COMMON LAND", ["c15_path", "c18_common_land"], False),
    ("RIVER · TWO-HEX TRAVEL", "BRIDGE & STREET", ["c19_bridge", "c16_street"], False),
    ("THREE-HEX TRAVEL", "TRACK", ["c17_track"], False),
]


def register_fonts() -> None:
    gill = "/System/Library/Fonts/Supplemental/GillSans.ttc"
    charter = "/System/Library/Fonts/Supplemental/Charter.ttc"
    pdfmetrics.registerFont(TTFont("QVGill", gill, subfontIndex=0))
    pdfmetrics.registerFont(TTFont("QVGill-Bold", gill, subfontIndex=1))
    pdfmetrics.registerFont(TTFont("QVGill-Italic", gill, subfontIndex=2))
    pdfmetrics.registerFont(TTFont("QVGill-Light", gill, subfontIndex=7))
    pdfmetrics.registerFont(TTFont("QVCharter", charter, subfontIndex=0))
    pdfmetrics.registerFont(TTFont("QVCharter-Italic", charter, subfontIndex=1))
    pdfmetrics.registerFont(TTFont("QVCharter-BoldItalic", charter, subfontIndex=2))
    pdfmetrics.registerFont(TTFont("QVCharter-Bold", charter, subfontIndex=3))
    pdfmetrics.registerFontFamily(
        "QVCharter",
        normal="QVCharter",
        bold="QVCharter-Bold",
        italic="QVCharter-Italic",
        boldItalic="QVCharter-BoldItalic",
    )
    pdfmetrics.registerFontFamily(
        "QVGill",
        normal="QVGill",
        bold="QVGill-Bold",
        italic="QVGill-Italic",
        boldItalic="QVGill-Bold",
    )


register_fonts()

BODY = ParagraphStyle(
    "AidBody",
    fontName="QVCharter",
    fontSize=8.15,
    leading=9.85,
    textColor=INK,
    alignment=TA_LEFT,
    spaceAfter=0,
    allowWidows=0,
    allowOrphans=0,
)
BODY_SMALL = ParagraphStyle(
    "AidBodySmall",
    parent=BODY,
    fontSize=7.25,
    leading=8.65,
)
BODY_TINY = ParagraphStyle(
    "AidBodyTiny",
    parent=BODY,
    fontSize=6.55,
    leading=7.65,
)
ROLE_COMPACT_BODY = ParagraphStyle(
    "AidRoleCompactBody",
    parent=BODY,
    fontSize=7.8,
    leading=9.25,
)
KICKER_STYLE = ParagraphStyle(
    "AidKicker",
    fontName="QVGill-Bold",
    fontSize=6.0,
    leading=7.0,
    textColor=BRASS,
    alignment=TA_LEFT,
    spaceAfter=0,
)
CENTER_SMALL = ParagraphStyle(
    "AidCenterSmall",
    parent=BODY_SMALL,
    alignment=TA_CENTER,
)


def ascii_dashes(text: str) -> str:
    return (
        text.replace("\u2010", "-")
        .replace("\u2011", "-")
        .replace("\u2012", "-")
        .replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("\u2212", "-")
        .replace("\u00ad", "")
    )


def normalise(text: str) -> str:
    return " ".join(ascii_dashes(text).replace("River/Water", "Water/River").replace("\xa0", " ").split())


def markup(text: str) -> str:
    return escape(ascii_dashes(text).replace("River/Water", "Water/River"))


def load_content() -> dict[str, Any]:
    result = subprocess.run(
        [str(VITE_NODE), str(EXPORTER)],
        cwd=ROOT,
        check=True,
        text=True,
        capture_output=True,
    )
    return json.loads(result.stdout)


def prepare_encounter_assets() -> None:
    TMP.mkdir(parents=True, exist_ok=True)
    source = PILImage.open(BOON_ART).convert("RGB").crop((60, 55, 390, 355))
    grayscale = ImageOps.grayscale(source)
    local_background = grayscale.filter(ImageFilter.GaussianBlur(14))
    dark_linework = ImageChops.subtract(local_background, grayscale)
    alpha = dark_linework.point(lambda value: max(0, min(255, (value - 5) * 7)))
    alpha = alpha.filter(ImageFilter.MaxFilter(3))
    ornament = PILImage.new("RGBA", source.size, (167, 131, 67, 0))
    ornament.putalpha(alpha)
    ornament.save(CORNER_LEFT)
    mirrored = ImageOps.mirror(ornament)
    mirrored.save(CORNER_RIGHT)
    ImageOps.flip(ornament).save(CORNER_BOTTOM_LEFT)
    ImageOps.flip(mirrored).save(CORNER_BOTTOM_RIGHT)

    divider_source = PILImage.open(BURDEN_ART).convert("RGB").crop((800, 715, 1000, 785))
    divider_gray = ImageOps.grayscale(divider_source)
    divider_background = divider_gray.filter(ImageFilter.GaussianBlur(9))
    divider_lines = ImageChops.subtract(divider_background, divider_gray)
    divider_alpha = divider_lines.point(lambda value: max(0, min(255, (value - 5) * 9)))
    divider_alpha = divider_alpha.filter(ImageFilter.MaxFilter(3))
    clean_alpha = PILImage.new("L", divider_alpha.size, 0)
    clean_alpha.paste(divider_alpha.crop((0, 16, divider_alpha.width, 52)), (0, 16))
    for path, rgb in ((DIVIDER_BRASS, (167, 131, 67)), (DIVIDER_LIGHT, (217, 196, 142))):
        flourish = PILImage.new("RGBA", divider_source.size, (*rgb, 0))
        flourish.putalpha(clean_alpha)
        flourish.save(path)


def cut_corner_path(c, x: float, y: float, w: float, h: float, cut: float):
    p = c.beginPath()
    p.moveTo(x + cut, y)
    p.lineTo(x + w - cut, y)
    p.lineTo(x + w, y + cut)
    p.lineTo(x + w, y + h - cut)
    p.lineTo(x + w - cut, y + h)
    p.lineTo(x + cut, y + h)
    p.lineTo(x, y + h - cut)
    p.lineTo(x, y + cut)
    p.close()
    return p


def draw_cut_frame(c, inset: float, colour, width: float, alpha: float) -> None:
    c.saveState()
    c.setStrokeColor(colour)
    c.setStrokeAlpha(alpha)
    c.setLineWidth(width)
    c.drawPath(cut_corner_path(c, inset, inset, PAGE_W - 2 * inset, PAGE_H - 2 * inset, 3.1 * mm), stroke=1, fill=0)
    c.restoreState()


def draw_divider(c, x0: float, x1: float, y: float, *, light: bool = False, alpha: float = 0.62, width: float = DIVIDER_STROKE) -> None:
    if x1 <= x0:
        return
    source = DIVIDER_LIGHT if light else DIVIDER_BRASS
    centre = (x0 + x1) / 2
    flourish_w = min(6.2 * mm, (x1 - x0) * 0.30)
    with PILImage.open(source) as image:
        sw, sh = image.size
    flourish_h = flourish_w * sh / sw
    left = centre - flourish_w / 2
    right = centre + flourish_w / 2
    c.saveState()
    c.setStrokeColor(BRASS_LIGHT if light else BRASS)
    c.setStrokeAlpha(alpha)
    c.setLineWidth(width)
    c.setLineCap(1)
    c.line(x0, y, left, y)
    c.line(right, y, x1, y)
    c.setFillAlpha(alpha)
    c.drawImage(str(source), left, y - flourish_h / 2, flourish_w, flourish_h, preserveAspectRatio=True, mask="auto")
    c.restoreState()


def draw_map_wash(c, alpha: float = 0.026, y_shift: float = 0) -> None:
    with PILImage.open(MAP) as image:
        mw, mh = image.size
    draw_h = PAGE_H * 1.05
    draw_w = draw_h * mw / mh
    c.saveState()
    c.setFillAlpha(alpha)
    c.drawImage(str(MAP), (PAGE_W - draw_w) / 2, -0.02 * PAGE_H + y_shift, draw_w, draw_h, preserveAspectRatio=True, mask="auto")
    c.restoreState()


def draw_corner_ornaments(c) -> None:
    inset = 3.2 * mm
    width = 8.2 * mm
    with PILImage.open(CORNER_LEFT) as image:
        sw, sh = image.size
    height = width * sh / sw
    c.saveState()
    c.setFillAlpha(0.55)
    c.drawImage(str(CORNER_LEFT), inset, PAGE_H - inset - height, width, height, preserveAspectRatio=True, mask="auto")
    c.drawImage(str(CORNER_RIGHT), PAGE_W - inset - width, PAGE_H - inset - height, width, height, preserveAspectRatio=True, mask="auto")
    c.drawImage(str(CORNER_BOTTOM_LEFT), inset, inset, width, height, preserveAspectRatio=True, mask="auto")
    c.drawImage(str(CORNER_BOTTOM_RIGHT), PAGE_W - inset - width, inset, width, height, preserveAspectRatio=True, mask="auto")
    c.restoreState()


def draw_paragraph(c, text_markup: str, style: ParagraphStyle, x: float, y_top: float, width: float, max_height: float = PAGE_H) -> float:
    paragraph = Paragraph(text_markup, style)
    _, height = paragraph.wrap(width, max_height)
    paragraph.drawOn(c, x, y_top - height)
    return height


def paragraph_height(text_markup: str, style: ParagraphStyle, width: float, max_height: float = PAGE_H) -> float:
    paragraph = Paragraph(text_markup, style)
    _, height = paragraph.wrap(width, max_height)
    return height


def draw_body_background(c, page_number: int, role: dict[str, Any]) -> None:
    c.saveState()
    c.setFillColor(PARCHMENT)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    draw_map_wash(c, alpha=0.025, y_shift=((page_number % 3) - 1) * 2.5 * mm)
    draw_corner_ornaments(c)
    c.setFont("QVGill", 5.15)
    c.setFillColor(FOREST)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 4.9 * mm, "THE QUIET VALE  ·  STEWARD AID")
    draw_divider(c, PAGE_W / 2 - 11 * mm, PAGE_W / 2 + 11 * mm, PAGE_H - 7.8 * mm, alpha=0.45)
    c.setFont("QVGill-Bold", 6.3)
    c.setFillColor(FOREST_DARK)
    c.drawCentredString(PAGE_W / 2, 3.9 * mm, str(page_number))
    c.setStrokeColor(BRASS)
    c.setLineWidth(0.4)
    c.line(PAGE_W / 2 - 3.5 * mm, 5.8 * mm, PAGE_W / 2 + 3.5 * mm, 5.8 * mm)
    c.restoreState()


def draw_section_header(c, kicker: str, title: str, y_top: float) -> float:
    x = MARGIN_X
    w = CONTENT_W
    h = 13.5 * mm
    y = y_top - h
    swash = c.beginPath()
    swash.moveTo(x, y + 1.4 * mm)
    swash.curveTo(x + 12 * mm, y + 0.6 * mm, x + 29 * mm, y + 1.4 * mm, x + 43 * mm, y + 0.9 * mm)
    swash.curveTo(x + w * 0.55, y + 0.4 * mm, x + w * 0.79, y + 1.7 * mm, x + w, y + 0.9 * mm)
    swash.lineTo(x + w, y + h - 1.9 * mm)
    swash.curveTo(x + w * 0.82, y + h - 1.1 * mm, x + w * 0.61, y + h - 2.1 * mm, x + w * 0.43, y + h - 1.5 * mm)
    swash.curveTo(x + 30 * mm, y + h - 0.8 * mm, x + 12 * mm, y + h - 2.0 * mm, x, y + h - 1.3 * mm)
    swash.close()
    c.saveState()
    c.setFillColor(MIST_LIGHT)
    c.setFillAlpha(0.54)
    c.drawPath(swash, stroke=0, fill=1)
    c.saveState()
    c.clipPath(swash, stroke=0, fill=0)
    draw_map_wash(c, alpha=0.038, y_shift=y - 8 * mm)
    c.restoreState()
    c.setFillAlpha(1)
    c.setFont("QVGill-Bold", 5.4)
    c.setFillColor(BRASS)
    c.drawString(x + 2.0 * mm, y + h - 4.2 * mm, ascii_dashes(kicker.upper()))
    title_style = ParagraphStyle(
        "AidSectionTitle",
        fontName="QVGill-Light",
        fontSize=11.4,
        leading=11.7,
        textColor=FOREST_DARK,
        spaceAfter=0,
    )
    draw_paragraph(c, markup(title.upper()), title_style, x + 2.0 * mm, y + 6.2 * mm, w - 4 * mm)
    draw_divider(c, x, x + w, y + 0.7 * mm, alpha=0.62)
    c.restoreState()
    return y


def draw_panel(c, x: float, y: float, w: float, h: float, *, fill=PARCHMENT_ALT, stroke=BRASS, accent=None, alpha: float = 0.88, cut: float = 0) -> None:
    """Simple rulebook-style rectangular band.

    Interior information never uses the cover's cut-corner geometry and never
    receives a vertical colour bar.  A restrained top rule carries hierarchy.
    """
    c.saveState()
    c.setFillColor(fill)
    c.setFillAlpha(alpha)
    c.rect(x, y, w, h, stroke=0, fill=1)
    c.setStrokeColor(accent if accent is not None else stroke)
    c.setStrokeAlpha(0.62)
    c.setLineWidth(0.42)
    c.line(x, y + h, x + w, y + h)
    if accent is not None:
        c.setStrokeAlpha(0.26)
        c.setLineWidth(0.24)
        c.line(x, y, x + w, y)
    c.restoreState()


def starting_terrain_text(role: dict[str, Any]) -> str:
    labels = [TERRAIN_LABELS[value] for value in role["startingTerrains"]]
    if role["id"] == "quartermaster":
        return "Starting terrain: Woodland, Mountains, Heaths, Arable Land or Ruins - not Grasslands or Water/River."
    return f"Starting terrain: {labels[0]}."


def draw_info_block(
    c,
    label: str,
    body: str,
    y_top: float,
    *,
    fill=PARCHMENT_ALT,
    accent=BRASS,
    body_style=BODY,
    min_height: float = 0,
) -> float:
    """Draw one open rectangular information band with readable A6 type."""
    x = MARGIN_X
    w = CONTENT_W
    inner_x = x + 3.0 * mm
    inner_w = w - 6.0 * mm
    body_h = paragraph_height(markup(body), body_style, inner_w)
    h = max(min_height, body_h + 11.0 * mm)
    y = y_top - h
    draw_panel(c, x, y, w, h, fill=fill, stroke=accent, accent=accent, alpha=0.72)
    c.setFont("QVGill-Bold", 5.75)
    c.setFillColor(accent)
    c.drawString(inner_x, y_top - 4.8 * mm, label.upper())
    draw_paragraph(c, markup(body), body_style, inner_x, y_top - 7.7 * mm, inner_w, h - 8 * mm)
    return y


def draw_cover(c, role: dict[str, Any]) -> None:
    meta = ROLE_META[role["id"]]
    c.saveState()
    c.setTitle(f"The Quiet Vale - {role['name']} Steward Aid v6.7")
    c.setSubject("A6 Steward Aid using locked game content")
    c.setAuthor("The Quiet Vale")
    c.setFillColor(COVER_BLACK)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    draw_cut_frame(c, 4.2 * mm, BRASS_LIGHT, 0.7, 0.93)
    draw_cut_frame(c, 5.7 * mm, BRASS_LIGHT, 0.3, 0.58)
    c.setFont("QVGill-Light", 13.6)
    c.setFillColor(WHITE)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 13.8 * mm, "THE QUIET VALE")
    c.setFont("QVCharter-Italic", 6.5)
    c.setFillColor(BRASS_LIGHT)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 20.1 * mm, "Seasons of Settlement")
    draw_divider(c, 29 * mm, PAGE_W - 29 * mm, PAGE_H - 24.7 * mm, light=True, alpha=0.66)

    if TREE.exists():
        c.saveState()
        c.setFillAlpha(0.48)
        c.drawImage(str(TREE), PAGE_W / 2 - 14 * mm, PAGE_H - 83 * mm, 28 * mm, 52 * mm, preserveAspectRatio=True, mask="auto")
        c.restoreState()

    c.setFont("QVGill-Bold", 5.8)
    c.setFillColor(meta["accent"])
    c.drawCentredString(PAGE_W / 2, PAGE_H - 91 * mm, f"STEWARD {meta['roman']}")
    c.setFont("QVGill-Light", 18.0 if len(role["name"]) < 11 else 15.3)
    c.setFillColor(WHITE)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 102 * mm, role["name"].upper())
    draw_divider(c, 25 * mm, PAGE_W - 25 * mm, PAGE_H - 109 * mm, light=True, alpha=0.58)
    c.setFont("QVGill-Bold", 6.0)
    c.setFillColor(BRASS_LIGHT)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 119 * mm, "STEWARD AID")
    c.restoreState()


def draw_steward_page(c, role: dict[str, Any]) -> None:
    meta = ROLE_META[role["id"]]
    role_body_style = ROLE_COMPACT_BODY if role["id"] == "ranger" else BODY
    block_gap = {"ranger": 1.0, "vanguard": 1.4}.get(role["id"], 2.0) * mm
    draw_body_background(c, 2, role)
    y = draw_section_header(c, f"STEWARD {meta['roman']}", role["name"], PAGE_H - 10.8 * mm) - 2.2 * mm
    y = draw_info_block(
        c,
        "POWER · ONCE PER SEASON",
        role["powerText"],
        y,
        fill=PARCHMENT_ALT,
        accent=FOREST_MUTED,
        body_style=role_body_style,
        min_height=24 * mm,
    ) - block_gap
    y = draw_info_block(
        c,
        "OBJECTIVE · +15 RENOWN",
        role["objectiveText"],
        y,
        fill=HexColor("#EEE3BE"),
        accent=BRASS,
        body_style=role_body_style,
        min_height=20 * mm,
    ) - block_gap
    y = draw_info_block(
        c,
        "STARTING TERRAIN",
        starting_terrain_text(role),
        y,
        fill=PARCHMENT_ALT,
        accent=FOREST_MUTED,
        body_style=BODY_SMALL,
        min_height=17 * mm,
    ) - block_gap
    y = draw_info_block(
        c,
        "FIRST PLACEMENT",
        "On your first turn, your first Action must place any legal Tile on the hex occupied by your Steward Token. It need not be a Resource Tile and need not connect to another Tile.",
        y,
        fill=ROSE_LIGHT,
        accent=ROSE,
        body_style=BODY_SMALL,
        min_height=20 * mm,
    ) - block_gap
    draw_info_block(
        c,
        "SHELTER IN THE RUINS",
        "When placing or upgrading a Tile whose entire footprint lies on Ruins, ignore all Stone in that placement or upgrade cost. If any part of the footprint lies outside Ruins, pay the full printed cost.",
        y,
        fill=HexColor("#EEE3BE"),
        accent=BRASS,
        body_style=ParagraphStyle("RuinsDiscount", parent=BODY_SMALL, fontSize=6.9, leading=8.1),
        min_height=19 * mm,
    )


def draw_labeled_callout(c, label: str, body: str, x: float, y: float, w: float, h: float, *, fill=MIST_LIGHT, accent=MIST, body_style=BODY_SMALL) -> None:
    draw_panel(c, x, y, w, h, fill=fill, stroke=accent, accent=accent, alpha=0.68)
    c.setFont("QVGill-Bold", 5.4)
    c.setFillColor(accent)
    c.drawString(x + 3.0 * mm, y + h - 4.4 * mm, label.upper())
    draw_paragraph(c, markup(body), body_style, x + 3.0 * mm, y + h - 7.2 * mm, w - 6.0 * mm, h - 8 * mm)


def draw_season_band(c, y: float, h: float) -> None:
    entries = [("I", "FOUNDATIONS", "Rounds 1-4"), ("II", "GROWTH", "Rounds 5-8"), ("III", "MATURITY", "Rounds 9-12")]
    cell_w = CONTENT_W / 3
    for index, (roman, title, rounds) in enumerate(entries):
        x = MARGIN_X + index * cell_w
        draw_panel(c, x, y, cell_w - (0.6 * mm if index < 2 else 0), h, fill=PARCHMENT_ALT, stroke=BRASS, alpha=0.76)
        c.setFont("QVGill-Bold", 5.3)
        c.setFillColor(BRASS)
        c.drawString(x + 2.2 * mm, y + h - 4.0 * mm, roman)
        c.setFont("QVGill-Bold", 4.65)
        c.setFillColor(FOREST_DARK)
        c.drawString(x + 6.2 * mm, y + h - 4.0 * mm, title)
        c.setFont("QVCharter", 6.1)
        c.drawString(x + 2.2 * mm, y + 2.6 * mm, rounds)


def draw_round_table(c, y: float, h: float) -> None:
    rows = [
        ("1 · REVEAL", "Reveal standard Encounter Cards until their number equals the player count; finish every mandatory effect."),
        ("2 · PLAYER TURNS", "The group chooses player order. Each player takes one turn with up to 4 Actions."),
        ("3 · END OF ROUND", "Remove 1 timer from every active Arrival; resolve expiry, end durations, refresh round effects and advance the Round marker."),
    ]
    row_h = h / 3
    for index, (label, body) in enumerate(rows):
        row_y = y + h - (index + 1) * row_h
        fill = PARCHMENT_ALT if index % 2 == 0 else PARCHMENT
        draw_panel(c, MARGIN_X, row_y, CONTENT_W, row_h - 0.35 * mm, fill=fill, stroke=LINE, alpha=0.72)
        c.setFont("QVGill-Bold", 5.05)
        c.setFillColor(FOREST)
        c.drawString(MARGIN_X + 2.4 * mm, row_y + row_h - 4.0 * mm, label)
        draw_paragraph(
            c,
            markup(body),
            ParagraphStyle("RoundRow", parent=BODY_TINY, fontSize=6.55, leading=7.5),
            MARGIN_X + 22.5 * mm,
            row_y + row_h - 2.3 * mm,
            CONTENT_W - 25.0 * mm,
            row_h - 1.5 * mm,
        )


def draw_actions(c, y: float, h: float) -> None:
    actions = [
        ("PLACE", "Add an available Tile to a legal, reachable empty hex; pay any cost."),
        ("UPGRADE", "Pay the upgraded-side cost; flip a reachable basic Core Tile."),
        ("ACTIVATE", "Use a reachable, non-Overstrained Tile's Activated Effect."),
        ("INTERACT", "Complete an Arrival or resolve an active Burden."),
    ]
    gap = 1.0 * mm
    cell_w = (CONTENT_W - gap) / 2
    cell_h = (h - gap) / 2
    for index, (label, body) in enumerate(actions):
        column = index % 2
        row = 1 - index // 2
        x = MARGIN_X + column * (cell_w + gap)
        cell_y = y + row * (cell_h + gap)
        draw_panel(c, x, cell_y, cell_w, cell_h, fill=PARCHMENT_ALT, stroke=BRASS, alpha=0.76)
        c.setFillColor(FOREST_MUTED)
        c.rect(x, cell_y + cell_h - 5.8 * mm, cell_w, 5.8 * mm, stroke=0, fill=1)
        c.setFont("QVGill-Bold", 5.4)
        c.setFillColor(WHITE)
        c.drawString(x + 2.5 * mm, cell_y + cell_h - 4.0 * mm, label)
        draw_paragraph(
            c,
            markup(body),
            ParagraphStyle("ActionBody", parent=BODY_SMALL, fontSize=7.05, leading=8.3),
            x + 2.5 * mm,
            cell_y + cell_h - 8.2 * mm,
            cell_w - 5.0 * mm,
            cell_h - 9 * mm,
        )


def draw_round_reference_page(c, role: dict[str, Any]) -> None:
    draw_body_background(c, 3, role)
    y = draw_section_header(c, "HOW YOUR TURN MOVES", "ROUND & ACTION REMINDER", PAGE_H - 10.8 * mm) - 1.5 * mm

    season_h = 11.5 * mm
    draw_season_band(c, y - season_h, season_h)
    y -= season_h + 1.7 * mm

    c.setFont("QVGill-Bold", 5.25)
    c.setFillColor(BRASS)
    c.drawString(MARGIN_X, y - 1.3 * mm, "ROUND SEQUENCE")
    y -= 3.4 * mm
    round_h = 27.0 * mm
    draw_round_table(c, y - round_h, round_h)
    y -= round_h + 1.7 * mm

    c.setFont("QVGill-Bold", 5.25)
    c.setFillColor(BRASS)
    c.drawString(MARGIN_X, y - 1.3 * mm, "FOUR ACTIONS")
    y -= 3.4 * mm
    action_h = 38.0 * mm
    draw_actions(c, y - action_h, action_h)
    y -= action_h + 1.7 * mm

    movement_h = 18.0 * mm
    draw_labeled_callout(
        c,
        "STEWARD TOKEN",
        "After your first placement, only Place, Upgrade or Activate moves your Steward Token. Move it onto the Tile you just placed, upgraded or activated; the next reachability check starts there. Interact does not move it.",
        MARGIN_X,
        y - movement_h,
        CONTENT_W,
        movement_h,
        fill=MIST_LIGHT,
        accent=MIST,
        body_style=ParagraphStyle("MovementNote", parent=BODY_SMALL, fontSize=6.9, leading=8.0),
    )
    y -= movement_h + 1.4 * mm


def cost_markup(face: dict[str, Any]) -> str:
    alternate = face.get("alternateCostText")
    if alternate:
        text = escape(ascii_dashes(alternate))
        for resource, colour in RESOURCE_COLOURS.items():
            label = resource.title()
            text = text.replace(label, f"<font color='{colour}'><b>{label}</b></font>")
        return text
    values = face.get("cost", {})
    parts = [
        f"<font color='{RESOURCE_COLOURS[name]}'><b>{values[name]} {name.title()}</b></font>"
        for name in RESOURCE_ORDER
        if values.get(name, 0)
    ]
    if len(parts) > 2:
        return " · ".join(parts[:2]) + "<br/>" + " · ".join(parts[2:])
    return " · ".join(parts) if parts else "Free"


def cost_plain(face: dict[str, Any]) -> str:
    alternate = face.get("alternateCostText")
    if alternate:
        return ascii_dashes(alternate)
    values = face.get("cost", {})
    parts = [f"{values[name]} {name.title()}" for name in RESOURCE_ORDER if values.get(name, 0)]
    if len(parts) > 2:
        return " · ".join(parts[:2]) + " " + " · ".join(parts[2:])
    return " · ".join(parts) if parts else "Free"


def compact_effect(text: str) -> str:
    text = ascii_dashes(text)
    marker = " Passive: Linked Production"
    if marker in text:
        return text.split(marker, 1)[0].rstrip() + " Linked Production."
    return text


def score_text(face: dict[str, Any]) -> str:
    population = face.get("population", 0)
    renown = face.get("renown", 0)
    parts = []
    if population:
        parts.append(f"{population} Population")
    if renown:
        parts.append(f"{renown} Renown")
    return " · ".join(parts) if parts else "No printed score"


def draw_hex_placeholder(c, x: float, y: float, w: float, accent) -> None:
    h = w * math.sqrt(3) / 2
    p = c.beginPath()
    p.moveTo(x + w * 0.25, y)
    p.lineTo(x + w * 0.75, y)
    p.lineTo(x + w, y + h / 2)
    p.lineTo(x + w * 0.75, y + h)
    p.lineTo(x + w * 0.25, y + h)
    p.lineTo(x, y + h / 2)
    p.close()
    c.saveState()
    c.setFillColor(PARCHMENT)
    c.setFillAlpha(0.52)
    c.setStrokeColor(LINE)
    c.setStrokeAlpha(0.62)
    c.setLineWidth(0.32)
    c.drawPath(p, stroke=1, fill=1)
    c.setFillAlpha(1)
    c.setFont("QVGill-Bold", 3.8)
    c.setFillColor(accent)
    c.drawCentredString(x + w / 2, y + h / 2 + 0.7, "FINAL")
    c.drawCentredString(x + w / 2, y + h / 2 - 2.7, "TILE ART")
    c.restoreState()


def draw_tile_side(c, x: float, y: float, w: float, h: float, face: dict[str, Any], side: str, accent, tile_id: str) -> None:
    large_entry = h >= 44 * mm
    art_w = min(15.5 * mm if large_entry else 13.0 * mm, h * 0.34)
    art_h = art_w * math.sqrt(3) / 2
    art_x = x + 2.3 * mm
    art_y = y + h - art_h - 6.7 * mm
    art_path = ROOT / "working/rules-v6_7/assets/tile-thumbnails" / (tile_id + "-" + side.lower() + ".png")
    c.drawImage(str(art_path), art_x, art_y, art_w, art_h, preserveAspectRatio=True, mask="auto")

    c.setFont("QVGill-Bold", 5.0)
    c.setFillColor(accent)
    c.drawString(x + 2.2 * mm, y + h - 4.2 * mm, side.upper())
    title_x = art_x + art_w + 2.1 * mm
    title_w = w - (title_x - x) - 2 * mm
    title_style = ParagraphStyle(
        f"TileName{side}",
        fontName="QVCharter-Bold",
        fontSize=7.7 if len(face["name"]) < 20 else 7.0,
        leading=8.2,
        textColor=FOREST_DARK,
        spaceAfter=0,
    )
    draw_paragraph(c, markup(face["name"]), title_style, title_x, y + h - 4.3 * mm, title_w, 11 * mm)

    cost_label_y = y + h - 13.0 * mm
    c.setFont("QVGill-Bold", 4.8)
    c.setFillColor(BRASS)
    c.drawString(title_x, cost_label_y, "COST")
    cost_style = ParagraphStyle(
        f"TileCost{side}",
        fontName="QVGill",
        fontSize=6.25,
        leading=7.2,
        textColor=INK,
        spaceAfter=0,
    )
    draw_paragraph(c, cost_markup(face), cost_style, title_x, cost_label_y - 1.5 * mm, title_w, 10 * mm)

    effect_style = ParagraphStyle(
        f"TileEffect{side}",
        fontName="QVCharter",
        fontSize=6.85 if h < 44 * mm else 7.05,
        leading=8.0 if h < 44 * mm else 8.2,
        textColor=INK,
        spaceAfter=0,
        allowWidows=0,
        allowOrphans=0,
    )
    effect_y_top = y + h - 24.0 * mm
    draw_paragraph(c, markup(compact_effect(face["effectText"])), effect_style, x + 2.2 * mm, effect_y_top, w - 4.4 * mm, h - 29 * mm)

    c.setStrokeColor(LINE)
    c.setStrokeAlpha(0.54)
    c.setLineWidth(0.25)
    c.line(x + 2.2 * mm, y + 6.1 * mm, x + w - 2.2 * mm, y + 6.1 * mm)
    c.setFont("QVGill-Bold", 4.5)
    c.setFillColor(BRASS)
    c.drawString(x + 2.2 * mm, y + 2.6 * mm, "PRINTED")
    score_style = ParagraphStyle(
        f"TileScore{side}",
        fontName="QVCharter",
        fontSize=6.05,
        leading=6.8,
        textColor=INK,
        spaceAfter=0,
    )
    draw_paragraph(c, markup(score_text(face)), score_style, x + 13.3 * mm, y + 4.1 * mm, w - 15.0 * mm, 6 * mm)


def draw_tile_row(c, tile: dict[str, Any], y_top: float, h: float) -> None:
    x = MARGIN_X
    w = CONTENT_W
    y = y_top - h
    accent = CATEGORY_COLOURS[tile["category"]]
    draw_panel(c, x, y, w, h, fill=PARCHMENT_ALT, stroke=BRASS, accent=accent, alpha=0.68)

    header_h = 9.0 * mm
    c.saveState()
    c.setFillColor(accent)
    c.setFillAlpha(0.14)
    c.rect(x, y + h - header_h, w, header_h, stroke=0, fill=1)
    c.restoreState()
    size_word = "hex" if tile["size"] == 1 else "hexes"
    placement = tile.get("placement", {}).get("text") or "No additional placement requirement."
    header_markup = (
        f"<b>{escape(tile['category'].upper())}</b>  ·  {tile['size']} {size_word}  ·  STOCK {tile['count']}"
        f"<br/><font color='#24312A'>{escape(ascii_dashes(placement))}</font>"
    )
    header_style = ParagraphStyle(
        "TileRowHeader",
        fontName="QVGill",
        fontSize=5.7,
        leading=6.7,
        textColor=accent,
        spaceAfter=0,
    )
    draw_paragraph(c, header_markup, header_style, x + 2.4 * mm, y + h - 1.3 * mm, w - 4.8 * mm, header_h)

    side_y = y + 0.8 * mm
    side_h = h - header_h - 1.1 * mm
    half_w = (w - 2.5 * mm) / 2
    divider_x = x + w / 2
    c.setStrokeColor(LINE)
    c.setStrokeAlpha(0.48)
    c.setLineWidth(0.3)
    c.line(divider_x, side_y + 1.2 * mm, divider_x, side_y + side_h - 0.8 * mm)
    draw_tile_side(c, x + 1.5 * mm, side_y, half_w - 1.2 * mm, side_h, tile["basic"], "BASIC", accent, tile["id"])
    draw_tile_side(c, divider_x + 1.0 * mm, side_y, half_w - 1.6 * mm, side_h, tile["upgraded"], "UPGRADED", accent, tile["id"])


def draw_tile_page(c, role: dict[str, Any], page_number: int, kicker: str, title: str, tiles: list[dict[str, Any]], linked_note: bool) -> None:
    draw_body_background(c, page_number, role)
    y = draw_section_header(c, kicker, title, PAGE_H - 10.8 * mm) - 1.2 * mm
    if linked_note:
        note_h = 15.5 * mm
        draw_labeled_callout(
            c,
            "LINKED PRODUCTION",
            "Check the chosen Resource Tile and its immediately adjacent copies from the same stack. If none has participated this round, all eligible copies produce. Otherwise, only the chosen Tile produces. It never continues outward through a chain.",
            MARGIN_X,
            y - note_h,
            CONTENT_W,
            note_h,
            fill=MIST_LIGHT,
            accent=MIST,
            body_style=ParagraphStyle("LinkedProductionNote", parent=BODY_SMALL, fontSize=6.6, leading=7.7),
        )
        y -= note_h + 1.4 * mm

    bottom = 9.2 * mm
    gap = 1.25 * mm
    available = y - bottom - gap * (len(tiles) - 1)
    row_h = available / len(tiles)
    if len(tiles) == 1:
        row_h = min(row_h, 56 * mm)
    for tile in tiles:
        draw_tile_row(c, tile, y, row_h)
        y -= row_h + gap
    if len(tiles) == 1:
        y -= 0.3 * mm
        y = draw_info_block(
            c,
            "LINKED PRODUCTION",
            "Check the chosen Resource Tile and its immediately adjacent copies from the same stack. If none has participated this round, all eligible copies produce. Otherwise, only the chosen Tile produces. It never continues outward through a chain.",
            y,
            fill=MIST_LIGHT,
            accent=MIST,
            body_style=BODY_SMALL,
            min_height=22 * mm,
        ) - 1.5 * mm
        c.setFont("QVGill-Bold", 5.25)
        c.setFillColor(ROSE)
        c.drawString(MARGIN_X, y - 1.2 * mm, "SCORING PENALTIES")
        y -= 3.2 * mm
        penalty_h = 12.0 * mm
        draw_penalties(c, y - penalty_h, penalty_h)
        y -= penalty_h + 1.0 * mm
        final_h = 15.0 * mm
        draw_labeled_callout(
            c,
            "FINAL SCORE",
            "Add Population and all positive Renown, then subtract every penalty. Record the shared final score and any newly completed Entries in the Steward's Ledger.",
            MARGIN_X,
            y - final_h,
            CONTENT_W,
            final_h,
            fill=ROSE_LIGHT,
            accent=ROSE,
            body_style=ParagraphStyle("FinalScoreTilePage", parent=BODY_SMALL, fontSize=6.75, leading=7.9),
        )


def draw_four_step_band(c, y: float, h: float) -> None:
    steps = [
        ("1 · SELECT", "Draw a Target Card within the eligible pool."),
        ("2 · PREVENT", "Resolve Supported and other prevention."),
        ("3 · CHECK", "At 3 Strain, the Tile becomes Overstrained."),
        ("4 · CHAIN", "After the original effect, each new Overstrained Tile spreads."),
    ]
    row_h = h / 4
    for index, (label, body) in enumerate(steps):
        row_y = y + h - (index + 1) * row_h
        draw_panel(
            c,
            MARGIN_X,
            row_y,
            CONTENT_W,
            row_h - 0.25 * mm,
            fill=PARCHMENT_ALT if index % 2 == 0 else PARCHMENT,
            stroke=LINE,
            alpha=0.72,
        )
        c.setFont("QVGill-Bold", 5.0)
        c.setFillColor(FOREST)
        c.drawString(MARGIN_X + 2.4 * mm, row_y + row_h - 4.0 * mm, label)
        draw_paragraph(
            c,
            markup(body),
            ParagraphStyle("StrainStep", parent=BODY_SMALL, fontSize=7.0, leading=8.15),
            MARGIN_X + 20.5 * mm,
            row_y + row_h - 2.2 * mm,
            CONTENT_W - 23.0 * mm,
            row_h - 1.2 * mm,
        )


def draw_season_transition(c, y: float, h: float) -> None:
    steps = [
        "Finish every Arrival expiry.",
        "Discard unused face-up Boons whose duration ends with the Season.",
        "Resolve Neighbourly Support.",
        "Reapply every unresolved Burden using the new Season row.",
        "Refresh every Steward Power.",
        "Choose 3 cards from your hand; assign top, middle and bottom.",
    ]
    row_h = h / 6
    for index, body in enumerate(steps, 1):
        row_y = y + h - index * row_h
        c.setFillColor(PARCHMENT_ALT if index % 2 else PARCHMENT)
        c.setFillAlpha(0.82)
        c.rect(MARGIN_X, row_y, CONTENT_W, row_h - 0.2 * mm, stroke=0, fill=1)
        c.setFillAlpha(1)
        c.setFont("QVGill-Bold", 5.0)
        c.setFillColor(FOREST)
        c.drawCentredString(MARGIN_X + 4.0 * mm, row_y + row_h / 2 - 1.3, str(index))
        draw_paragraph(
            c,
            markup(body),
            ParagraphStyle("SeasonTransitionRow", parent=BODY_SMALL, fontSize=6.9, leading=8.0),
            MARGIN_X + 8.1 * mm,
            row_y + row_h - 1.0 * mm,
            CONTENT_W - 10 * mm,
            row_h,
        )


def draw_penalties(c, y: float, h: float) -> None:
    entries = [("ACTIVE BURDEN", "-10"), ("FAILED ARRIVAL", "-10"), ("EACH STRAIN", "-10")]
    w = CONTENT_W / 3
    for index, (label, value) in enumerate(entries):
        x = MARGIN_X + index * w
        c.setFillColor(FOREST_MUTED)
        c.rect(x, y + h - 6.0 * mm, w - 0.3 * mm, 6.0 * mm, stroke=0, fill=1)
        c.setFont("QVGill-Bold", 4.05)
        c.setFillColor(WHITE)
        label_style = ParagraphStyle("PenaltyLabel", fontName="QVGill-Bold", fontSize=4.05, leading=4.55, textColor=WHITE, alignment=TA_CENTER)
        draw_paragraph(c, escape(label), label_style, x + 1.0 * mm, y + h - 1.1 * mm, w - 2.3 * mm, 5.0 * mm)
        c.setFillColor(PARCHMENT_ALT)
        c.rect(x, y, w - 0.3 * mm, h - 6.0 * mm, stroke=0, fill=1)
        c.setFont("QVCharter-Bold", 8.2)
        c.setFillColor(ROSE)
        c.drawCentredString(x + (w - 0.3 * mm) / 2, y + 2.1 * mm, value)


def draw_reference_page(c, role: dict[str, Any]) -> None:
    draw_body_background(c, 19, role)
    y = draw_section_header(c, "STRAIN · SEASONS · SCORING", "AT-TABLE REFERENCE", PAGE_H - 10.8 * mm) - 1.2 * mm

    c.setFont("QVGill-Bold", 5.25)
    c.setFillColor(ROSE)
    c.drawString(MARGIN_X, y - 1.2 * mm, "STRAIN SEQUENCE")
    y -= 3.2 * mm
    strain_h = 26.5 * mm
    draw_four_step_band(c, y - strain_h, strain_h)
    y -= strain_h + 1.1 * mm

    supported_h = 20.0 * mm
    draw_labeled_callout(
        c,
        "SUPPORTED",
        "Supported prevents 1 Strain before checking for Overstrain. Passive Supported refreshes each round while its condition remains true; single-use Supported prevents 1 Strain, then is spent. They do not stack.",
        MARGIN_X,
        y - supported_h,
        CONTENT_W,
        supported_h,
        fill=MIST_LIGHT,
        accent=MIST,
        body_style=ParagraphStyle("SupportedNote", parent=BODY_SMALL, fontSize=7.2, leading=8.5),
    )
    y -= supported_h + 1.1 * mm

    c.setFont("QVGill-Bold", 5.25)
    c.setFillColor(ROSE)
    c.drawString(MARGIN_X, y - 1.2 * mm, "SEASON TRANSITION · AFTER ROUNDS 4 AND 8")
    y -= 3.2 * mm
    transition_h = 37.0 * mm
    draw_season_transition(c, y - transition_h, transition_h)
    y -= transition_h + 1.1 * mm
    draw_info_block(
        c,
        "SPECIAL TILES",
        "After a Special Tile is unlocked, spend 1 normal Place Action, follow its printed placement rule and pay 0 resources. Use the unlocked Tile's printed rule.",
        y,
        fill=HexColor("#EEE3BE"),
        accent=BRASS,
        body_style=ParagraphStyle("SpecialTileReference", parent=BODY_SMALL, fontSize=6.9, leading=8.0),
        min_height=19 * mm,
    )


def draw_back_cover(c, role: dict[str, Any]) -> None:
    meta = ROLE_META[role["id"]]
    c.saveState()
    c.setFillColor(COVER_BLACK)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    draw_cut_frame(c, 4.2 * mm, BRASS_LIGHT, 0.7, 0.88)
    draw_cut_frame(c, 5.7 * mm, BRASS_LIGHT, 0.3, 0.54)
    if TREE.exists():
        c.saveState()
        c.setFillAlpha(0.70)
        c.drawImage(str(TREE), PAGE_W / 2 - 15 * mm, PAGE_H - 83 * mm, 30 * mm, 56 * mm, preserveAspectRatio=True, mask="auto")
        c.restoreState()
    c.setFont("QVGill-Light", 11.5)
    c.setFillColor(WHITE)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 91 * mm, "THE QUIET VALE")
    c.setFont("QVCharter-Italic", 6.4)
    c.setFillColor(BRASS_LIGHT)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 98 * mm, "Seasons of Settlement")
    draw_divider(c, 26 * mm, PAGE_W - 26 * mm, PAGE_H - 104.5 * mm, light=True, alpha=0.62)
    c.setFont("QVGill-Bold", 5.0)
    c.setFillColor(meta["accent"])
    c.drawCentredString(PAGE_W / 2, PAGE_H - 114.5 * mm, f"STEWARD {meta['roman']}  ·  {role['name'].upper()}")
    c.setFont("QVGill", 4.2)
    c.setFillColor(WHITE)
    c.drawCentredString(PAGE_W / 2, 12.2 * mm, "A6 STEWARD AID  ·  v6.7")
    c.restoreState()


def audit_pdf(path: Path, role: dict[str, Any], tile_by_id: dict[str, dict[str, Any]]) -> dict[str, Any]:
    reader = PdfReader(str(path))
    if len(reader.pages) != 20:
        raise RuntimeError(f"Expected 20 pages, found {len(reader.pages)}")
    for page in reader.pages:
        width_mm = float(page.mediabox.width) / 72 * 25.4
        height_mm = float(page.mediabox.height) / 72 * 25.4
        if abs(width_mm - 105) > 0.05 or abs(height_mm - 148) > 0.05:
            raise RuntimeError(f"Unexpected page size {width_mm:.2f} x {height_mm:.2f} mm")
    raw_text = " ".join(page.extract_text() or "" for page in reader.pages).casefold()
    page_texts = [normalise(page.extract_text() or "").casefold() for page in reader.pages]
    text = " ".join(page_texts)
    required = [role["name"], role["powerText"], role["objectiveText"], starting_terrain_text(role)]
    missing = [value for value in required if normalise(value).casefold() not in page_texts[1]]

    meta = ROLE_META[role["id"]]
    cover_required = [role["name"], f"STEWARD {meta['roman']}", "STEWARD AID"]
    missing.extend(value for value in cover_required if normalise(value).casefold() not in page_texts[0])
    required.extend(cover_required)

    steward_page_required = [
        "Shelter in the Ruins",
        "When placing or upgrading a Tile whose entire footprint lies on Ruins, ignore all Stone in that placement or upgrade cost. If any part of the footprint lies outside Ruins, pay the full printed cost.",
    ]
    missing.extend(value for value in steward_page_required if normalise(value).casefold() not in page_texts[1])
    required.extend(steward_page_required)

    round_page_required = [
        "Reveal standard Encounter Cards until their number equals the player count; finish every mandatory effect.",
        "The group chooses player order. Each player takes one turn with up to 4 Actions.",
        "Remove 1 timer from every active Arrival; resolve expiry, end durations, refresh round effects and advance the Round marker.",
        "Move it onto the Tile you just placed, upgraded or activated",
    ]
    missing.extend(value for value in round_page_required if normalise(value).casefold() not in page_texts[2])
    required.extend(round_page_required)

    for page_index, group in enumerate(TILE_PAGE_GROUPS, start=3):
        tile_page_text = page_texts[page_index]
        for tile_id in group[2]:
            tile = tile_by_id[tile_id]
            placement = tile.get("placement", {}).get("text") or "No additional placement requirement."
            tile_required = [placement, f"STOCK {tile['count']}"]
            for face_key in ("basic", "upgraded"):
                face = tile[face_key]
                tile_required.extend(
                    [
                        face["name"],
                        cost_plain(face),
                        compact_effect(face["effectText"]),
                        score_text(face),
                    ]
                )
            missing.extend(value for value in tile_required if normalise(value).casefold() not in tile_page_text)
            required.extend(tile_required)

    reference_required = [
        "Supported prevents 1 Strain before checking for Overstrain.",
        "Reapply every unresolved Burden using the new Season row.",
        "Choose 3 cards from your hand; assign top, middle and bottom.",
        "After a Special Tile is unlocked, spend 1 normal Place Action",
    ]
    missing.extend(value for value in reference_required if normalise(value).casefold() not in page_texts[18])
    required.extend(reference_required)

    scoring_required = [
        "Active Burden",
        "Failed Arrival",
        "Each Strain",
        "-10",
        "Record the shared final score and any newly completed Entries in the Steward's Ledger",
    ]
    missing.extend(value for value in scoring_required if normalise(value).casefold() not in page_texts[13])
    required.extend(scoring_required)

    placeholder_count = text.count("final tile art")
    if placeholder_count != 0:
        missing.append(f"Expected no FINAL TILE ART labels; found {placeholder_count}")
    if "final role icon" in text:
        missing.append("Unexpected FINAL ROLE ICON placeholder remains")
    if "0 actions" in text:
        missing.append("Unexpected 0 ACTIONS note remains")
    if "online prototype" in text:
        missing.append("Unexpected online prototype reference remains")
    if "design proof" in text:
        missing.append("Unexpected design-proof label remains")
    if "unfulfilled promise" in text:
        missing.append("Unexpected Unfulfilled Promise penalty remains")
    if "seed encounters for the next season" in text:
        missing.append("Outdated Season-transition seeding shorthand remains")
    if "river/water" in raw_text:
        missing.append("Unexpected River/Water terminology remains; use Water/River")
    if "final total and completed entries" in text:
        missing.append("Outdated final-score recording language remains")
    if missing:
        raise RuntimeError(f"Content audit failed; missing: {missing}")
    return {
        "output": str(path),
        "role": role["id"],
        "pages": len(reader.pages),
        "trim_mm": [105, 148],
        "tile_types": 21,
        "tile_faces": 42,
        "final_art_placeholders": placeholder_count,
        "locked_content_checks": len(required),
        "suite_language_revision": "v3",
        "terrain_display_term": "Water/River",
        "score_record_term": "shared final score and any newly completed Entries",
    }


def build(role_id: str) -> Path:
    prepare_encounter_assets()
    content = load_content()
    role_by_id = {role["id"]: role for role in content["stewards"]}
    tile_by_id = {tile["id"]: tile for tile in content["coreTiles"]}
    role = role_by_id[role_id]
    meta = ROLE_META[role_id]

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output = OUTPUT_DIR / f"The_Quiet_Vale_A6_{role['name'].replace(' ', '_')}_Steward_Aid_v6_7.pdf"
    c = pdfcanvas.Canvas(str(output), pagesize=(PAGE_W, PAGE_H), pageCompression=1)
    c.setCreator("The Quiet Vale Steward Aid generator")
    c.setKeywords("The Quiet Vale, Steward Aid, A6, cooperative board game")

    draw_cover(c, role)
    c.showPage()
    draw_steward_page(c, role)
    c.showPage()
    draw_round_reference_page(c, role)
    c.showPage()

    page_number = 4
    for kicker, title, tile_ids, linked_note in TILE_PAGE_GROUPS:
        draw_tile_page(c, role, page_number, kicker, title, [tile_by_id[tile_id] for tile_id in tile_ids], linked_note)
        c.showPage()
        page_number += 1

    from suite_reference_pages import draw_extra_pages
    draw_extra_pages(c, role, globals())
    draw_reference_page(c, role)
    c.showPage()
    draw_back_cover(c, role)
    c.showPage()
    c.save()

    manifest = audit_pdf(output, role, tile_by_id)
    manifest["role_code"] = meta["code"]
    TMP.mkdir(parents=True, exist_ok=True)
    (TMP / f"{role_id}-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))
    return output


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--role", choices=sorted(ROLE_META), default="quartermaster")
    parser.add_argument("--all", action="store_true", help="Build the complete six-role Steward Aid suite")
    args = parser.parse_args()
    if args.all:
        outputs = [str(build(role_id)) for role_id in ROLE_META]
        suite_manifest = {
            "suite": "steward-aids-v6.7",
            "roles": list(ROLE_META),
            "outputs": outputs,
            "suite_language_revision": "v3",
            "locked_role_and_tile_content_edited": False,
        }
        (TMP / "suite-manifest.json").write_text(json.dumps(suite_manifest, indent=2), encoding="utf-8")
        print(json.dumps(suite_manifest, indent=2))
    else:
        build(args.role)


if __name__ == "__main__":
    main()
