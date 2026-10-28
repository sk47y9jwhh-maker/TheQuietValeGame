from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image as PILImage, ImageChops, ImageFilter, ImageOps
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / "working/stewards-ledger-redesign"
TMP = ROOT / "tmp/pdfs/stewards-ledger-v6_5"
OUTPUT = ROOT / "output/pdf/stewards-ledger-v6_5/The_Quiet_Vale_Stewards_Ledger_v6_5.pdf"
LEDGER_SOURCE = ROOT / "src/data/ledger.ts"
PRESTIGE_LABELS = ("1P", "2P", "3P", "4P", "5P")

PAGE_W = 195 * mm
PAGE_H = 255 * mm
MARGIN_X = 15 * mm
BODY_W = PAGE_W - 2 * MARGIN_X
TOP_Y = PAGE_H - 18 * mm
BOTTOM_Y = 15 * mm

PARCHMENT = HexColor("#F4F0E5")
PARCHMENT_ALT = HexColor("#EAE4D5")
PARCHMENT_DEEP = HexColor("#DED4BE")
INK = HexColor("#24312A")
FOREST = HexColor("#315846")
FOREST_DARK = HexColor("#1E382D")
FOREST_MUTED = HexColor("#4A6B5B")
MOSS = HexColor("#6B7D5A")
BRASS = HexColor("#A78343")
BRASS_LIGHT = HexColor("#D9C48E")
MIST = HexColor("#78A0A1")
MIST_LIGHT = HexColor("#DCE9E6")
ROSE = HexColor("#A95E57")
ROSE_LIGHT = HexColor("#ECD9D4")
LINE = HexColor("#9D927B")
COVER_BLACK = HexColor("#070908")
WHITE = colors.white

TREE = ROOT / "src/assets/quiet_vale_tree_brass_transparent.png"
MAP = ROOT / "src/assets/quiet_vale_map_v02.webp"
BOON_ART = ROOT / "src/assets/encounter-cards/boon.png"
BURDEN_ART = ROOT / "src/assets/encounter-cards/burden.png"
GOLDEN_ART = ROOT / "src/assets/encounter-cards/golden-boon.png"

CORNER_LEFT = TMP / "encounter-corner-left.png"
CORNER_RIGHT = TMP / "encounter-corner-right.png"
CORNER_BOTTOM_LEFT = TMP / "encounter-corner-bottom-left.png"
CORNER_BOTTOM_RIGHT = TMP / "encounter-corner-bottom-right.png"
DIVIDER_BRASS = TMP / "encounter-divider-flourish-brass.png"
DIVIDER_LIGHT = TMP / "encounter-divider-flourish-light.png"

RASTER_DIMS: dict[Path, tuple[int, int]] = {}
LAYOUT_ISSUES: list[str] = []


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


def pdf_text(value: str) -> str:
    """Normalize unsupported dash characters while preserving approved wording."""
    return (
        value.replace("\u2011", "-")
        .replace("\u2012", "-")
        .replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("\u00a0", " ")
    )


def entry_reference(entry_id: str) -> str:
    """Convert a locked internal LE identifier to its compact printed reference."""
    match = re.fullmatch(r"LE-(\d{3})", entry_id)
    if not match:
        raise RuntimeError(f"Unexpected Ledger Entry identifier: {entry_id}")
    return f"#{int(match.group(1))}"


def parse_ledger_source() -> tuple[list[dict], list[dict]]:
    source = LEDGER_SOURCE.read_text(encoding="utf-8")
    entry_match = re.search(
        r"const ledgerEntryDefinitions: LedgerEntry\[\] = \[([\s\S]*?)\n\];",
        source,
    )
    if not entry_match:
        raise RuntimeError("Could not find Ledger entry definitions.")
    entries = []
    for raw_line in entry_match.group(1).splitlines():
        line = raw_line.strip().rstrip(",")
        if line.startswith("{"):
            entries.append(json.loads(line))

    milestone_match = re.search(
        r"export const ledgerMilestones: LedgerMilestone\[\] = \[([\s\S]*?)\n\];",
        source,
    )
    if not milestone_match:
        raise RuntimeError("Could not find Golden milestones.")
    milestone_pattern = re.compile(
        r'\{ threshold: (\d+), goldenTileId: "([^"]+)", goldenTile: "([^"]+)", '
        r'goldenTileTheme: "([^"]+)", goldenBoonId: "([^"]+)", goldenBoon: "([^"]+)", '
        r'goldenBoonTheme: "([^"]+)" \}'
    )
    milestones = []
    for match in milestone_pattern.finditer(milestone_match.group(1)):
        milestones.append(
            {
                "threshold": int(match.group(1)),
                "goldenTileId": match.group(2),
                "goldenTile": match.group(3),
                "goldenTileTheme": match.group(4),
                "goldenBoonId": match.group(5),
                "goldenBoon": match.group(6),
                "goldenBoonTheme": match.group(7),
            }
        )

    expected_ids = [f"LE-{index:03d}" for index in range(1, 51)]
    if [entry["id"] for entry in entries] != expected_ids:
        raise RuntimeError("Ledger catalogue is not the exact LE-001 through LE-050 sequence.")
    if [milestone["threshold"] for milestone in milestones] != [5, 12, 18, 25, 32]:
        raise RuntimeError("Golden milestone ladder does not match the locked 5/12/18/25/32 sequence.")
    if sum(bool(entry["declaredVow"]) for entry in entries) != 3:
        raise RuntimeError("Ledger must contain exactly three Vows.")
    if sum(bool(entry["playerCountPrestige"]) for entry in entries) != 18:
        raise RuntimeError("Ledger prestige-entry count changed unexpectedly.")
    return entries, milestones


def raster_dimensions(path: Path) -> tuple[int, int]:
    if path not in RASTER_DIMS:
        with PILImage.open(path) as image:
            RASTER_DIMS[path] = image.size
    return RASTER_DIMS[path]


def prepare_ornaments() -> None:
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

    source = PILImage.open(BURDEN_ART).convert("RGB").crop((800, 715, 1000, 785))
    grayscale = ImageOps.grayscale(source)
    local_background = grayscale.filter(ImageFilter.GaussianBlur(9))
    dark_linework = ImageChops.subtract(local_background, grayscale)
    alpha = dark_linework.point(lambda value: max(0, min(255, (value - 5) * 9)))
    alpha = alpha.filter(ImageFilter.MaxFilter(3))
    clean_alpha = PILImage.new("L", alpha.size, 0)
    clean_alpha.paste(alpha.crop((0, 16, alpha.width, 52)), (0, 16))
    for path, rgb in ((DIVIDER_BRASS, (167, 131, 67)), (DIVIDER_LIGHT, (217, 196, 142))):
        flourish = PILImage.new("RGBA", source.size, (*rgb, 0))
        flourish.putalpha(clean_alpha)
        flourish.save(path)


def draw_spaced_text(c, text: str, x: float, y: float, font: str, size: float, tracking: float, color) -> None:
    c.saveState()
    c.setFont(font, size)
    c.setFillColor(color)
    widths = [pdfmetrics.stringWidth(char, font, size) for char in text]
    total = sum(widths) + tracking * max(0, len(text) - 1)
    cursor = x - total / 2
    for char, width in zip(text, widths):
        c.drawString(cursor, y, char)
        cursor += width + tracking
    c.restoreState()


def draw_cut_corner_frame(c, inset: float, color, line_width: float, alpha: float = 1.0) -> None:
    cut = 4.2 * mm
    path = c.beginPath()
    path.moveTo(inset + cut, inset)
    path.lineTo(PAGE_W - inset - cut, inset)
    path.lineTo(PAGE_W - inset, inset + cut)
    path.lineTo(PAGE_W - inset, PAGE_H - inset - cut)
    path.lineTo(PAGE_W - inset - cut, PAGE_H - inset)
    path.lineTo(inset + cut, PAGE_H - inset)
    path.lineTo(inset, PAGE_H - inset - cut)
    path.lineTo(inset, inset + cut)
    path.close()
    c.saveState()
    c.setStrokeAlpha(alpha)
    c.setStrokeColor(color)
    c.setLineWidth(line_width)
    c.drawPath(path, stroke=1, fill=0)
    c.restoreState()


def draw_cropped_raster(
    c,
    path: Path,
    source_box: tuple[float, float, float, float],
    destination_box: tuple[float, float, float, float],
    alpha: float = 1.0,
) -> None:
    source_width, source_height = raster_dimensions(path)
    sx0, sy0, sx1, sy1 = source_box
    dx, dy, dw, dh = destination_box
    scale_x = dw / (sx1 - sx0)
    scale_y = dh / (sy1 - sy0)
    full_x = dx - sx0 * scale_x
    full_y = dy + dh - (source_height - sy0) * scale_y
    c.saveState()
    clip = c.beginPath()
    clip.rect(dx, dy, dw, dh)
    c.clipPath(clip, stroke=0, fill=0)
    c.setFillAlpha(alpha)
    c.drawImage(
        str(path),
        full_x,
        full_y,
        source_width * scale_x,
        source_height * scale_y,
        preserveAspectRatio=False,
        mask="auto",
    )
    c.restoreState()


def draw_corner_flourishes(c, alpha: float = 0.58) -> None:
    inset = 5.8 * mm
    width = 13.5 * mm
    source_width, source_height = raster_dimensions(CORNER_LEFT)
    height = width * source_height / source_width
    c.saveState()
    c.setFillAlpha(alpha)
    c.drawImage(str(CORNER_LEFT), inset, PAGE_H - inset - height, width, height, preserveAspectRatio=True, mask="auto")
    c.drawImage(str(CORNER_RIGHT), PAGE_W - inset - width, PAGE_H - inset - height, width, height, preserveAspectRatio=True, mask="auto")
    c.drawImage(str(CORNER_BOTTOM_LEFT), inset, inset, width, height, preserveAspectRatio=True, mask="auto")
    c.drawImage(str(CORNER_BOTTOM_RIGHT), PAGE_W - inset - width, inset, width, height, preserveAspectRatio=True, mask="auto")
    c.restoreState()


def draw_divider(
    c,
    x0: float,
    x1: float,
    y: float,
    color=BRASS,
    alpha: float = 0.58,
    line_width: float = 0.3,
) -> None:
    centre = (x0 + x1) / 2
    flourish_width = min(8.2 * mm, (x1 - x0) * 0.32)
    path = DIVIDER_LIGHT if color == BRASS_LIGHT else DIVIDER_BRASS
    source_width, source_height = raster_dimensions(path)
    flourish_height = flourish_width * source_height / source_width
    left = centre - flourish_width / 2
    right = centre + flourish_width / 2
    c.saveState()
    c.setStrokeAlpha(alpha)
    c.setStrokeColor(color)
    c.setLineWidth(line_width)
    c.setLineCap(1)
    c.line(x0, y, left, y)
    c.line(right, y, x1, y)
    c.setFillAlpha(alpha)
    c.drawImage(str(path), left, y - flourish_height / 2, flourish_width, flourish_height, preserveAspectRatio=True, mask="auto")
    c.restoreState()


def draw_map_wash(c, alpha: float = 0.045, y_shift: float = 0) -> None:
    """Draw the same oversized, page-spanning map wash used in the rulebook."""
    map_width, map_height = raster_dimensions(MAP)
    draw_height = PAGE_H * 1.04
    draw_width = draw_height * map_width / map_height
    draw_x = (PAGE_W - draw_width) / 2
    c.saveState()
    c.setFillAlpha(alpha)
    c.drawImage(
        str(MAP),
        draw_x,
        -0.02 * PAGE_H + y_shift,
        draw_width,
        draw_height,
        preserveAspectRatio=True,
        anchor="c",
        mask="auto",
    )
    c.restoreState()


def draw_interior_base(c, logical_page: int, _section_label: str, writable: bool = False) -> None:
    c.saveState()
    c.setFillColor(PARCHMENT)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    draw_map_wash(c, alpha=0.027, y_shift=(logical_page % 3 - 1) * 5 * mm)
    draw_corner_flourishes(c, alpha=0.55 if writable else 0.60)
    draw_divider(c, PAGE_W / 2 - 18 * mm, PAGE_W / 2 + 18 * mm, PAGE_H - 10.9 * mm, alpha=0.48, line_width=0.27)
    c.setFont("QVGill", 5.9)
    c.setFillColor(FOREST)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 6.4 * mm, "THE QUIET VALE  ·  STEWARD'S LEDGER")
    c.setFont("QVGill-Bold", 7.4)
    c.setFillColor(FOREST_DARK)
    c.drawCentredString(PAGE_W / 2, 5.7 * mm, str(logical_page))
    c.setStrokeColor(BRASS)
    c.setLineWidth(0.45)
    c.line(PAGE_W / 2 - 4.2 * mm, 8.2 * mm, PAGE_W / 2 + 4.2 * mm, 8.2 * mm)
    c.restoreState()


def draw_endpaper_base(c, _section_label: str, map_side: str = "right") -> None:
    c.saveState()
    c.setFillColor(PARCHMENT)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    draw_map_wash(c, alpha=0.027, y_shift=(-5 if map_side == "left" else 5) * mm)
    draw_corner_flourishes(c, alpha=0.60)
    draw_divider(c, PAGE_W / 2 - 18 * mm, PAGE_W / 2 + 18 * mm, PAGE_H - 10.9 * mm, alpha=0.48, line_width=0.27)
    c.setFont("QVGill", 5.9)
    c.setFillColor(FOREST)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 6.4 * mm, "THE QUIET VALE  ·  STEWARD'S LEDGER")
    c.restoreState()


def draw_section_header(c, title: str, kicker: str, y_top: float = TOP_Y, accent=ROSE) -> float:
    height = 17.5 * mm
    x = MARGIN_X
    y = y_top - height
    path = c.beginPath()
    path.moveTo(x, y + 1.7 * mm)
    path.curveTo(x + 22 * mm, y + 0.6 * mm, x + 47 * mm, y + 1.6 * mm, x + 72 * mm, y + 1.0 * mm)
    path.curveTo(x + 104 * mm, y + 0.4 * mm, x + 137 * mm, y + 1.8 * mm, x + BODY_W, y + 0.9 * mm)
    path.lineTo(x + BODY_W, y + height - 3.6 * mm)
    path.curveTo(x + 132 * mm, y + height - 2.3 * mm, x + 98 * mm, y + height - 3.8 * mm, x + 67 * mm, y + height - 2.9 * mm)
    path.curveTo(x + 42 * mm, y + height - 2.2 * mm, x + 19 * mm, y + height - 3.9 * mm, x, y + height - 2.7 * mm)
    path.close()
    c.saveState()
    c.setFillAlpha(0.50)
    c.setFillColor(MIST_LIGHT)
    c.drawPath(path, stroke=0, fill=1)
    c.saveState()
    c.clipPath(path, stroke=0, fill=0)
    draw_cropped_raster(c, MAP, (350, 220, 2850, 1030), (x, y, BODY_W, height), alpha=0.035)
    c.restoreState()
    c.setFillAlpha(1)
    c.setFillColor(accent)
    c.setFont("QVGill-Bold", 15.2)
    c.drawString(x + 2 * mm, y + 5.2 * mm, pdf_text(title).upper())
    c.setFillColor(FOREST)
    c.setFont("QVGill-Bold", 5.8)
    c.drawRightString(x + BODY_W - 2 * mm, y + 5.8 * mm, pdf_text(kicker).upper())
    draw_divider(c, x, x + BODY_W, y + 0.8 * mm, alpha=0.62, line_width=0.38)
    c.restoreState()
    return y - 4.5 * mm


def paragraph_height(markup: str, style: ParagraphStyle, width: float) -> tuple[Paragraph, float]:
    paragraph = Paragraph(markup, style)
    _, height = paragraph.wrap(width, PAGE_H)
    return paragraph, height


def draw_paragraph(c, markup: str, style: ParagraphStyle, x: float, y_top: float, width: float, max_height: float | None = None, label: str = "") -> float:
    paragraph, height = paragraph_height(markup, style, width)
    if max_height is not None and height > max_height + 0.5:
        LAYOUT_ISSUES.append(f"{label or 'paragraph'}: {height/mm:.1f} mm exceeds {max_height/mm:.1f} mm")
    paragraph.drawOn(c, x, y_top - height)
    return height


BODY_STYLE = ParagraphStyle(
    "LedgerBody",
    fontName="QVCharter",
    fontSize=9.1,
    leading=12.0,
    textColor=INK,
    spaceAfter=0,
)
SMALL_BODY_STYLE = ParagraphStyle(
    "LedgerSmallBody",
    fontName="QVCharter",
    fontSize=8.25,
    leading=10.5,
    textColor=INK,
)
ENTRY_STYLE = ParagraphStyle(
    "LedgerEntryRequirement",
    fontName="QVCharter",
    fontSize=8.0,
    leading=9.8,
    textColor=INK,
)
ENTRY_SMALL_STYLE = ParagraphStyle(
    "LedgerEntryRequirementSmall",
    fontName="QVCharter",
    fontSize=7.45,
    leading=9.05,
    textColor=INK,
)
NOTE_STYLE = ParagraphStyle(
    "LedgerNote",
    fontName="QVCharter-Italic",
    fontSize=8.1,
    leading=10.4,
    textColor=FOREST_DARK,
)
RULE_NOTE_STYLE = ParagraphStyle(
    "LedgerRuleNote",
    fontName="QVCharter",
    fontSize=8.1,
    leading=10.4,
    textColor=FOREST_DARK,
)
TABLE_STYLE = ParagraphStyle(
    "LedgerTable",
    fontName="QVGill",
    fontSize=6.2,
    leading=7.1,
    textColor=INK,
)


def draw_open_panel(c, x: float, y_top: float, width: float, height: float, label: str, body: str, number: str | None = None) -> None:
    y = y_top - height
    c.saveState()
    c.setFillAlpha(0.42)
    c.setFillColor(PARCHMENT_ALT)
    c.rect(x, y, width, height, stroke=0, fill=1)
    c.setFillAlpha(0.58)
    c.setFillColor(FOREST_MUTED)
    c.rect(x, y + height - 9.2 * mm, width, 9.2 * mm, stroke=0, fill=1)
    c.setFillAlpha(1)
    c.setStrokeColor(BRASS)
    c.setLineWidth(0.38)
    c.line(x, y + height - 9.2 * mm, x + width, y + height - 9.2 * mm)
    c.line(x, y, x + width, y)
    if number is not None:
        c.setFillColor(BRASS_LIGHT)
        c.setFont("QVGill-Bold", 7.1)
        c.drawString(x + 3 * mm, y + height - 6.0 * mm, number)
        label_x = x + 11 * mm
    else:
        label_x = x + 3 * mm
    c.setFillColor(WHITE)
    c.setFont("QVGill-Bold", 7.2)
    c.drawString(label_x, y + height - 6.0 * mm, pdf_text(label).upper())
    draw_paragraph(
        c,
        escape(pdf_text(body)),
        SMALL_BODY_STYLE,
        x + 3 * mm,
        y + height - 13 * mm,
        width - 6 * mm,
        max_height=height - 16 * mm,
        label=f"panel {label}",
    )
    c.restoreState()


def draw_cover(c) -> None:
    c.saveState()
    c.setFillColor(COVER_BLACK)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    draw_cut_corner_frame(c, 7 * mm, BRASS_LIGHT, 0.8, 0.95)
    draw_cut_corner_frame(c, 9 * mm, BRASS_LIGHT, 0.35, 0.65)
    draw_spaced_text(c, "THE QUIET VALE", PAGE_W / 2, PAGE_H - 35 * mm, "QVGill-Light", 24, 1.6, WHITE)
    c.setFont("QVCharter-Italic", 11)
    c.setFillColor(BRASS_LIGHT)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 45 * mm, "Seasons of Settlement")
    c.setFont("QVGill-Bold", 8)
    c.setFillColor(WHITE)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 58 * mm, "STEWARD'S LEDGER")
    draw_divider(c, 61 * mm, PAGE_W - 61 * mm, PAGE_H - 66 * mm, color=BRASS_LIGHT, alpha=0.72, line_width=0.42)
    if TREE.exists():
        c.drawImage(str(TREE), PAGE_W / 2 - 31 * mm, PAGE_H / 2 - 49 * mm, 62 * mm, 102 * mm, preserveAspectRatio=True, mask="auto")
    c.setFont("QVGill-Bold", 7.2)
    c.setFillColor(BRASS_LIGHT)
    c.drawCentredString(PAGE_W / 2, 61 * mm, "ACHIEVEMENTS ACROSS MANY GAMES")
    draw_divider(c, 56 * mm, PAGE_W - 56 * mm, 53 * mm, color=BRASS_LIGHT, alpha=0.60, line_width=0.35)
    c.setFont("QVGill", 7.0)
    c.setFillColor(MIST_LIGHT)
    c.drawCentredString(PAGE_W / 2, 43 * mm, "50 ENTRIES  ·  5 GOLDEN MILESTONES  ·  6 GROUP RECORDS")
    c.restoreState()


def draw_group_register_row(c, roman: str, y_top: float, height: float, shaded: bool) -> None:
    y = y_top - height
    c.saveState()
    c.setFillAlpha(0.34 if shaded else 0.20)
    c.setFillColor(PARCHMENT_DEEP)
    c.rect(MARGIN_X, y, BODY_W, height - 1.4 * mm, stroke=0, fill=1)
    c.setFillAlpha(0.88)
    c.setFillColor(FOREST_MUTED)
    c.rect(MARGIN_X, y, 25 * mm, height - 1.4 * mm, stroke=0, fill=1)
    c.setFillAlpha(1)
    c.setFillColor(BRASS_LIGHT)
    c.setFont("QVGill-Bold", 13.0)
    c.drawCentredString(MARGIN_X + 12.5 * mm, y + 8.1 * mm, roman)
    c.setFillColor(FOREST)
    c.setFont("QVGill-Bold", 5.6)
    c.drawString(MARGIN_X + 30 * mm, y + 13.4 * mm, "GROUP NAME")
    c.setFillColor(MOSS)
    c.setFont("QVGill-Bold", 5.0)
    c.drawRightString(MARGIN_X + BODY_W - 3 * mm, y + 13.4 * mm, f"ENTRY COLUMN {roman}  ·  GAME RECORD {roman}")
    c.setStrokeColor(LINE)
    c.setLineWidth(0.35)
    c.line(MARGIN_X + 30 * mm, y + 6.1 * mm, MARGIN_X + BODY_W - 3 * mm, y + 6.1 * mm)
    c.setStrokeColor(BRASS)
    c.setLineWidth(0.35)
    c.line(MARGIN_X, y, MARGIN_X + BODY_W, y)
    c.restoreState()


def draw_inside_front(c) -> None:
    draw_endpaper_base(c, "Group register", map_side="right")
    y = draw_section_header(c, "Group Register", "Name your group · choose a number", accent=FOREST)
    intro = (
        "Before your group's first game, choose a name and one unused Roman numeral (I-VI). "
        "Write the name here and on the matching Game Record page. Use that numeral for every Entry mark."
    )
    h = draw_paragraph(c, escape(intro), BODY_STYLE, MARGIN_X + 2 * mm, y, BODY_W - 4 * mm, label="Group register introduction")
    y -= h + 5 * mm

    header_h = 8.5 * mm
    c.saveState()
    c.setFillAlpha(0.82)
    c.setFillColor(FOREST)
    c.rect(MARGIN_X, y - header_h, BODY_W, header_h, stroke=0, fill=1)
    c.setFillAlpha(1)
    c.setFillColor(WHITE)
    c.setFont("QVGill-Bold", 5.8)
    c.drawCentredString(MARGIN_X + 12.5 * mm, y - 5.6 * mm, "GROUP NUMBER")
    c.drawString(MARGIN_X + 30 * mm, y - 5.6 * mm, "GROUP NAME")
    c.restoreState()
    y -= header_h + 1.5 * mm

    row_h = 21.5 * mm
    for index, roman in enumerate(("I", "II", "III", "IV", "V", "VI")):
        draw_group_register_row(c, roman, y, row_h, shaded=index % 2 == 0)
        y -= row_h

    note_y = y - 3 * mm
    c.saveState()
    c.setFillAlpha(0.34)
    c.setFillColor(MIST_LIGHT)
    c.rect(MARGIN_X, note_y - 18 * mm, BODY_W, 18 * mm, stroke=0, fill=1)
    c.setStrokeColor(BRASS)
    c.setLineWidth(0.38)
    c.line(MARGIN_X, note_y, MARGIN_X + BODY_W, note_y)
    c.setFillColor(FOREST)
    c.setFont("QVGill-Bold", 6.4)
    c.drawString(MARGIN_X + 3 * mm, note_y - 6 * mm, "FIND YOUR GROUP NUMBER")
    draw_paragraph(
        c,
        escape("Before marking an Entry, find your group's name here and use the Roman numeral beside it."),
        RULE_NOTE_STYLE,
        MARGIN_X + 3 * mm,
        note_y - 9.2 * mm,
        BODY_W - 6 * mm,
        max_height=8 * mm,
        label="Group register reminder",
    )
    c.restoreState()


def draw_how_to_page(c, logical_page: int) -> None:
    draw_interior_base(c, logical_page, "How to use the Ledger")
    y = draw_section_header(c, "Using the Ledger", "One continuous record")
    intro = (
        "Use this Ledger to track achievements across multiple games. Each group uses one Roman numeral (I-VI) for every Entry mark and its Game Record. "
        "Completed Entries are permanent: they are never spent or reset."
    )
    h = draw_paragraph(c, escape(intro), BODY_STYLE, MARGIN_X + 2 * mm, y, BODY_W - 4 * mm, label="Ledger introduction")
    y -= h + 5.5 * mm
    gap = 5 * mm
    panel_w = (BODY_W - gap) / 2
    panel_h = 51 * mm
    draw_open_panel(
        c,
        MARGIN_X,
        y,
        panel_w,
        panel_h,
        "Name your group",
        "Before the first game, choose a group name. Write it beside one unused Roman numeral in the Group Register, then copy it to the matching Game Record page.",
        "01",
    )
    draw_open_panel(
        c,
        MARGIN_X + panel_w + gap,
        y,
        panel_w,
        panel_h,
        "Check available Entries",
        "Check the group's Named Entry count before each game. An AFTER gate is met only if the group begins the game with the shown number of Named Entries. If the group reaches that number during a game, Entries at that gate become available for its next game.",
        "02",
    )
    y2 = y - panel_h - gap
    draw_open_panel(
        c,
        MARGIN_X,
        y2,
        panel_w,
        panel_h,
        "Mark completed Entries",
        "After final scoring, mark NAMED under the group's numeral for each Entry it completed. If an Entry includes prestige rows, also mark the player count for that game.",
        "03",
    )
    draw_open_panel(
        c,
        MARGIN_X + panel_w + gap,
        y2,
        panel_w,
        panel_h,
        "Record the game",
        "On the group's Game Record page, write the date, player count, shared final score, newly completed Entries and any declared Vow. Update the Named Entry count and mark any newly reached Golden milestones.",
        "04",
    )
    note_y = y2 - panel_h - 6 * mm
    c.saveState()
    c.setFillAlpha(0.34)
    c.setFillColor(MIST_LIGHT)
    c.rect(MARGIN_X, note_y - 23 * mm, BODY_W, 23 * mm, stroke=0, fill=1)
    c.setStrokeColor(BRASS)
    c.setLineWidth(0.4)
    c.line(MARGIN_X, note_y, MARGIN_X + BODY_W, note_y)
    c.setFont("QVGill-Bold", 6.8)
    c.setFillColor(FOREST)
    c.drawString(MARGIN_X + 3 * mm, note_y - 6 * mm, "VOWS")
    draw_paragraph(
        c,
        escape("Declare a Vow before setup. A group may attempt only one Vow per game."),
        RULE_NOTE_STYLE,
        MARGIN_X + 3 * mm,
        note_y - 9.5 * mm,
        BODY_W - 6 * mm,
        max_height=11 * mm,
        label="Vow note",
    )
    c.restoreState()


def draw_golden_compass(c, centre_x: float, centre_y: float, diameter: float) -> None:
    radius = diameter / 2
    kappa = radius * 0.5522847498
    clip = c.beginPath()
    clip.moveTo(centre_x + radius, centre_y)
    clip.curveTo(centre_x + radius, centre_y + kappa, centre_x + kappa, centre_y + radius, centre_x, centre_y + radius)
    clip.curveTo(centre_x - kappa, centre_y + radius, centre_x - radius, centre_y + kappa, centre_x - radius, centre_y)
    clip.curveTo(centre_x - radius, centre_y - kappa, centre_x - kappa, centre_y - radius, centre_x, centre_y - radius)
    clip.curveTo(centre_x + kappa, centre_y - radius, centre_x + radius, centre_y - kappa, centre_x + radius, centre_y)
    clip.close()
    c.saveState()
    c.clipPath(clip, stroke=0, fill=0)
    draw_cropped_raster(c, GOLDEN_ART, (346, 101, 554, 309), (centre_x - radius, centre_y - radius, diameter, diameter), alpha=1)
    c.restoreState()


def draw_golden_page(c, logical_page: int, milestones: list[dict]) -> None:
    draw_interior_base(c, logical_page, "Golden legacy")
    y = draw_section_header(c, "Golden Legacy", "Five milestones", accent=BRASS)
    intro_width = BODY_W - 43 * mm
    intro = (
        "When a group reaches 5, 12, 18, 25 or 32 Named Entries, it unlocks both rewards in that row: one Golden Tile and one Golden Boon card. "
        "Mark the milestone on the group's Game Record. Both rewards are available in later games."
    )
    h = draw_paragraph(c, escape(intro), BODY_STYLE, MARGIN_X + 2 * mm, y, intro_width, label="Golden introduction")
    draw_golden_compass(c, PAGE_W - 35 * mm, y - 11 * mm, 31 * mm)
    y -= max(h, 31 * mm) + 5 * mm

    milestone_w = 23 * mm
    reward_w = BODY_W - milestone_w
    tile_w = reward_w / 2
    card_w = reward_w - tile_w
    header_h = 9.5 * mm
    header_y = y - header_h
    c.saveState()
    for cell_x, cell_w, fill in (
        (MARGIN_X, milestone_w, FOREST_MUTED),
        (MARGIN_X + milestone_w, tile_w, FOREST),
        (MARGIN_X + milestone_w + tile_w, card_w, FOREST),
    ):
        c.setFillAlpha(0.90)
        c.setFillColor(fill)
        c.rect(cell_x, header_y, cell_w, header_h, stroke=0, fill=1)
    c.setFillAlpha(1)
    c.setFillColor(WHITE)
    c.setFont("QVGill-Bold", 5.4)
    c.drawCentredString(MARGIN_X + milestone_w / 2, header_y + 3.4 * mm, "NAMED ENTRIES")
    tile_icon_x = MARGIN_X + milestone_w + 5 * mm
    tile_icon_y = header_y + 2.5 * mm
    tile_icon_w = 4.8 * mm
    tile_icon_h = 4.5 * mm
    c.setStrokeColor(BRASS_LIGHT)
    c.setLineWidth(0.55)
    tile_icon = c.beginPath()
    tile_icon.moveTo(tile_icon_x + tile_icon_w * 0.25, tile_icon_y)
    tile_icon.lineTo(tile_icon_x + tile_icon_w * 0.75, tile_icon_y)
    tile_icon.lineTo(tile_icon_x + tile_icon_w, tile_icon_y + tile_icon_h * 0.5)
    tile_icon.lineTo(tile_icon_x + tile_icon_w * 0.75, tile_icon_y + tile_icon_h)
    tile_icon.lineTo(tile_icon_x + tile_icon_w * 0.25, tile_icon_y + tile_icon_h)
    tile_icon.lineTo(tile_icon_x, tile_icon_y + tile_icon_h * 0.5)
    tile_icon.close()
    c.drawPath(tile_icon, stroke=1, fill=0)
    c.setFillColor(WHITE)
    c.setFont("QVGill-Bold", 6.1)
    c.drawString(tile_icon_x + 7 * mm, header_y + 3.2 * mm, "GOLDEN TILE")
    card_icon_x = MARGIN_X + milestone_w + tile_w + 5 * mm
    c.setStrokeColor(BRASS_LIGHT)
    c.roundRect(card_icon_x, header_y + 1.8 * mm, 3.8 * mm, 5.4 * mm, 0.7 * mm, stroke=1, fill=0)
    c.setFillColor(WHITE)
    c.drawString(card_icon_x + 6.5 * mm, header_y + 3.2 * mm, "GOLDEN BOON CARD")
    c.setStrokeColor(BRASS)
    c.setLineWidth(0.45)
    c.line(MARGIN_X, header_y, MARGIN_X + BODY_W, header_y)
    c.restoreState()
    y = header_y - 1.4 * mm

    row_h = 25.6 * mm
    for index, milestone in enumerate(milestones, 1):
        row_y = y - row_h
        c.saveState()
        c.setFillAlpha(0.32 if index % 2 else 0.20)
        c.setFillColor(PARCHMENT_DEEP)
        c.rect(MARGIN_X, row_y, BODY_W, row_h - 1.2 * mm, stroke=0, fill=1)
        c.setFillAlpha(0.28)
        c.setFillColor(MIST_LIGHT)
        c.rect(MARGIN_X + milestone_w, row_y, tile_w, row_h - 1.2 * mm, stroke=0, fill=1)
        c.setFillAlpha(0.28)
        c.setFillColor(MIST_LIGHT)
        c.rect(MARGIN_X + milestone_w + tile_w, row_y, card_w, row_h - 1.2 * mm, stroke=0, fill=1)
        c.setFillAlpha(1)
        c.setFillColor(FOREST_MUTED)
        c.rect(MARGIN_X, row_y, milestone_w, row_h - 1.2 * mm, stroke=0, fill=1)
        c.setStrokeColor(BRASS)
        c.setLineWidth(0.38)
        c.line(MARGIN_X, row_y, MARGIN_X + BODY_W, row_y)
        c.line(MARGIN_X + milestone_w, row_y, MARGIN_X + milestone_w, row_y + row_h - 1.2 * mm)
        c.line(MARGIN_X + milestone_w + tile_w, row_y, MARGIN_X + milestone_w + tile_w, row_y + row_h - 1.2 * mm)
        c.setFillColor(BRASS_LIGHT)
        c.setFont("QVGill-Bold", 15.5)
        c.drawCentredString(MARGIN_X + milestone_w / 2, row_y + 10.0 * mm, str(milestone["threshold"]))
        c.setFont("QVGill-Bold", 5.1)
        c.drawCentredString(MARGIN_X + milestone_w / 2, row_y + 4.9 * mm, "ENTRIES")

        tile_x = MARGIN_X + milestone_w + 4 * mm
        c.setFillColor(FOREST_DARK)
        c.setFont("QVGill-Bold", 8.2)
        c.drawString(tile_x, row_y + 14.2 * mm, pdf_text(milestone["goldenTile"]))
        c.setFillColor(MOSS)
        c.setFont("QVGill", 5.15)
        c.drawString(tile_x, row_y + 6.1 * mm, pdf_text(milestone["goldenTileTheme"]).upper())

        card_x = MARGIN_X + milestone_w + tile_w + 4 * mm
        c.setFillColor(FOREST_DARK)
        c.setFont("QVGill-Bold", 8.2)
        c.drawString(card_x, row_y + 14.2 * mm, pdf_text(milestone["goldenBoon"]))
        c.setFillColor(MOSS)
        c.setFont("QVGill", 5.15)
        c.drawString(card_x, row_y + 6.1 * mm, pdf_text(milestone["goldenBoonTheme"]).upper())
        c.restoreState()
        y -= row_h
    note = "Follow the rule printed on each Golden component. During final scoring, add +5 Renown for each Golden Tile whose printed condition is met."
    draw_paragraph(c, escape(note), RULE_NOTE_STYLE, MARGIN_X + 2 * mm, y - 1 * mm, BODY_W - 4 * mm, label="Golden component note")


def entry_meta(entry: dict) -> str:
    parts = [entry["chronicle"], entry["entryType"], entry["scope"]]
    if entry["requiredSteward"]:
        parts.append(f"{entry['requiredSteward']} required")
    return "  ·  ".join(pdf_text(str(part)).upper() for part in parts)


def draw_threshold_strip(c, entry: dict, x: float, y: float, width: float) -> None:
    thresholds = entry.get("thresholdsByPlayerCount")
    if not thresholds:
        return
    cell_w = min(25 * mm, width / 5)
    total_w = cell_w * 5
    c.saveState()
    c.setFillAlpha(0.25)
    c.setFillColor(MIST_LIGHT)
    c.rect(x, y, total_w, 7.3 * mm, stroke=0, fill=1)
    c.setFillAlpha(1)
    for index, player_count in enumerate(("1", "2", "3", "4", "5")):
        cell_x = x + index * cell_w
        if index:
            c.setStrokeColor(LINE)
            c.setLineWidth(0.25)
            c.line(cell_x, y + 1.1 * mm, cell_x, y + 6.2 * mm)
        c.setFillColor(FOREST)
        c.setFont("QVGill-Bold", 5.4)
        c.drawString(cell_x + 2 * mm, y + 2.5 * mm, f"{player_count}P")
        c.setFillColor(INK)
        c.setFont("QVGill-Bold", 7.1)
        c.drawRightString(cell_x + cell_w - 2 * mm, y + 2.0 * mm, str(thresholds[player_count]))
    c.setStrokeColor(BRASS)
    c.setLineWidth(0.35)
    c.line(x, y, x + total_w, y)
    c.restoreState()


def group_tracking_height(entry: dict) -> float:
    header_h = 4.8 * mm
    row_h = 4.25 * mm
    return header_h + row_h * (6 if entry["playerCountPrestige"] else 1)


def draw_group_tracking_strip(c, entry: dict, x: float, y: float, width: float) -> float:
    header_h = 4.8 * mm
    row_h = 4.25 * mm
    row_labels = ["NAMED"]
    if entry["playerCountPrestige"]:
        row_labels.extend(PRESTIGE_LABELS)
    height = header_h + row_h * len(row_labels)
    label_w = 20 * mm
    column_w = (width - label_w) / 6

    c.saveState()
    c.setFillAlpha(0.30)
    c.setFillColor(MIST_LIGHT)
    c.rect(x, y, width, height, stroke=0, fill=1)
    c.setFillAlpha(1)
    c.setFillColor(FOREST_MUTED)
    c.setFont("QVGill-Bold", 5.2)
    c.drawString(x + 2 * mm, y + height - 3.4 * mm, "GROUP MARKS")
    for group_index, roman in enumerate(("I", "II", "III", "IV", "V", "VI")):
        centre_x = x + label_w + column_w * (group_index + 0.5)
        c.drawCentredString(centre_x, y + height - 3.4 * mm, roman)
    c.setStrokeColor(BRASS)
    c.setLineWidth(0.28)
    c.line(x, y + height - header_h, x + width, y + height - header_h)

    for row_index, label in enumerate(row_labels):
        row_y = y + height - header_h - row_h * (row_index + 1)
        c.setFillColor(FOREST if row_index == 0 else BRASS)
        c.setFont("QVGill-Bold", 5.0)
        c.drawString(x + 2 * mm, row_y + 1.45 * mm, label)
        box_size = 3.25 * mm if row_index == 0 else 3.0 * mm
        box_color = FOREST if row_index == 0 else BRASS
        for group_index in range(6):
            centre_x = x + label_w + column_w * (group_index + 0.5)
            draw_box(c, centre_x - box_size / 2, row_y + (row_h - box_size) / 2, box_size, line_width=0.30, color=box_color)
        if row_index < len(row_labels) - 1:
            c.setStrokeColor(LINE)
            c.setStrokeAlpha(0.40)
            c.setLineWidth(0.16)
            c.line(x, row_y, x + width, row_y)
            c.setStrokeAlpha(1)
    c.setStrokeColor(BRASS)
    c.setLineWidth(0.28)
    c.line(x, y, x + width, y)
    c.restoreState()
    return height


def draw_catalogue_entry(c, entry: dict, x: float, y_top: float, width: float, height: float, index_on_page: int) -> None:
    y = y_top - height
    c.saveState()
    if index_on_page % 2:
        c.setFillAlpha(0.16)
        c.setFillColor(PARCHMENT_DEEP)
        c.rect(x, y + 1.1 * mm, width, height - 2.2 * mm, stroke=0, fill=1)
    c.setFillAlpha(1)
    badge_w = 24 * mm
    badge_h = 7.2 * mm
    badge_y = y_top - 8.6 * mm
    c.setFillColor(FOREST_MUTED if not entry["declaredVow"] else ROSE)
    c.rect(x, badge_y, badge_w, badge_h, stroke=0, fill=1)
    c.setFillColor(WHITE)
    access_label = "AVAILABLE" if entry["unlockAt"] == 0 else f"AFTER {entry['unlockAt']}"
    access_size = 5.2 if entry["unlockAt"] == 0 else 5.4
    c.setFont("QVGill-Bold", access_size)
    c.drawCentredString(x + badge_w / 2, badge_y + 2.2 * mm, access_label)
    name_x = x + badge_w + 3 * mm
    c.setFillColor(FOREST_DARK)
    name_size = 9.8 if len(entry["name"]) < 31 else 9.2
    available_name_width = width - badge_w - 31 * mm
    while name_size > 8.4 and pdfmetrics.stringWidth(pdf_text(entry["name"]), "QVGill-Bold", name_size) > available_name_width:
        name_size -= 0.2
    c.setFont("QVGill-Bold", name_size)
    c.drawString(name_x, y_top - 6.8 * mm, pdf_text(entry["name"]))
    c.setFillColor(ROSE if entry["declaredVow"] else BRASS)
    c.setFont("QVGill-Bold", 5.2)
    c.drawRightString(x + width - 3 * mm, y_top - 6.6 * mm, entry_reference(entry["id"]))
    c.setFillColor(ROSE if entry["declaredVow"] else FOREST)
    c.setFont("QVGill-Bold", 5.25)
    c.drawString(name_x, y_top - 11.7 * mm, entry_meta(entry))

    tracking_y = y + 2.8 * mm
    tracking_height = group_tracking_height(entry)
    threshold_height = 9.0 * mm if entry.get("thresholdsByPlayerCount") else 0
    requirement_top = y_top - 15.2 * mm
    support_top = tracking_y + tracking_height
    threshold_y = support_top + 1.6 * mm
    if threshold_height:
        support_top = threshold_y + 7.3 * mm
    requirement_bottom = support_top + 2.0 * mm
    max_requirement_height = max(8 * mm, requirement_top - requirement_bottom)
    requirement = escape(pdf_text(entry["requirement"]))
    paragraph, paragraph_h = paragraph_height(requirement, ENTRY_STYLE, width - 6 * mm)
    style = ENTRY_STYLE
    if paragraph_h > max_requirement_height:
        style = ENTRY_SMALL_STYLE
    draw_paragraph(
        c,
        requirement,
        style,
        x + 3 * mm,
        requirement_top,
        width - 6 * mm,
        max_height=max_requirement_height,
        label=entry["id"],
    )
    if entry.get("thresholdsByPlayerCount"):
        draw_threshold_strip(c, entry, x + 3 * mm, threshold_y, width - 6 * mm)
    draw_group_tracking_strip(c, entry, x + 3 * mm, tracking_y, width - 6 * mm)
    c.setStrokeColor(BRASS)
    c.setLineWidth(0.3)
    c.line(x, y + 0.4 * mm, x + width, y + 0.4 * mm)
    c.restoreState()


def draw_reading_page(c, logical_page: int, entries: list[dict]) -> None:
    draw_interior_base(c, logical_page, "Reading an Entry")
    y = draw_section_header(c, "Reading an Entry", "Mark beside the rule")
    intro = (
        "Use the catalogue as both a rule reference and a tracker. Entries appear in the order they become available. "
        "Read the requirement, then mark the same panel under the group's Roman numeral. The small number (for example, #11) is for reference only."
    )
    h = draw_paragraph(c, escape(intro), BODY_STYLE, MARGIN_X + 2 * mm, y, BODY_W - 4 * mm, label="Entry anatomy introduction")
    y -= h + 5 * mm
    sample_h = 68 * mm
    draw_catalogue_entry(c, entries[10], MARGIN_X, y, BODY_W, sample_h, 0)
    y -= sample_h + 5 * mm
    key_items = [
        ("GROUP COLUMN", "Find the group's Roman numeral in the Group Register, then use that column throughout the catalogue."),
        ("NAMED", "Mark NAMED once, the first time the group completes the Entry. Each mark increases the group's Named Entry count by 1 and counts toward Golden milestones."),
        ("PRESTIGE", "If 1P-5P rows appear, also mark the player count for that game. Prestige marks are records only; they do not increase the Named Entry count."),
        ("THRESHOLDS", "If five values appear, use the value for that game's player count."),
        ("AVAILABILITY", "AVAILABLE Entries may be attempted from the first game. An AFTER gate is met only if the group begins the game with the shown number of Named Entries."),
        ("VOW", "Declare a Vow before setup. A group may attempt only one Vow per game."),
    ]
    line_h = 13.0 * mm
    for index, (label, body) in enumerate(key_items):
        line_y = y - line_h
        if index % 2 == 0:
            c.saveState()
            c.setFillAlpha(0.26)
            c.setFillColor(PARCHMENT_DEEP)
            c.rect(MARGIN_X, line_y, BODY_W, line_h, stroke=0, fill=1)
            c.restoreState()
        c.setFillColor(FOREST)
        c.setFont("QVGill-Bold", 6.8)
        c.drawString(MARGIN_X + 3 * mm, line_y + 6.4 * mm, label)
        draw_paragraph(
            c,
            escape(pdf_text(body)),
            SMALL_BODY_STYLE,
            MARGIN_X + 35 * mm,
            line_y + 10.1 * mm,
            BODY_W - 38 * mm,
            max_height=9.8 * mm,
            label=f"reading key {label}",
        )
        y -= line_h

    opening = [entry for entry in entries if entry["unlockAt"] == 0]
    y -= 5 * mm
    c.setFillColor(ROSE)
    c.setFont("QVGill-Bold", 8.8)
    c.drawString(MARGIN_X, y, "AVAILABLE FROM THE FIRST GAME")
    c.setFont("QVCharter", 8.1)
    c.setFillColor(INK)
    opening_text = "  ·  ".join(pdf_text(entry["name"]) for entry in opening)
    draw_paragraph(c, escape(opening_text), SMALL_BODY_STYLE, MARGIN_X, y - 4 * mm, BODY_W, max_height=18 * mm, label="Available from the First Game")


def draw_catalogue_page(
    c,
    logical_page: int,
    title: str,
    entries: list[dict],
    first_position: int,
    last_position: int,
    total_entries: int,
) -> None:
    draw_interior_base(c, logical_page, "Entry catalogue")
    kicker = f"Availability order · {first_position}-{last_position} of {total_entries}"
    y = draw_section_header(c, title, kicker)
    area_bottom = 17 * mm
    available = y - area_bottom
    gap = 2.2 * mm
    preferred_heights = []
    for entry in entries:
        requirement = escape(pdf_text(entry["requirement"]))
        _, requirement_h = paragraph_height(requirement, ENTRY_STYLE, BODY_W - 6 * mm)
        threshold_h = 8.9 * mm if entry.get("thresholdsByPlayerCount") else 0
        minimum_h = 64 * mm if entry["playerCountPrestige"] else 40 * mm
        preferred_h = 22 * mm + group_tracking_height(entry) + threshold_h + requirement_h
        preferred_heights.append(min(72 * mm, max(minimum_h, preferred_h)))

    height_budget = available - gap * (len(entries) - 1)
    preferred_total = sum(preferred_heights)
    if preferred_total > height_budget:
        scale = height_budget / preferred_total
        preferred_heights = [height * scale for height in preferred_heights]

    for index, (entry, block_h) in enumerate(zip(entries, preferred_heights)):
        draw_catalogue_entry(c, entry, MARGIN_X, y, BODY_W, block_h, index)
        y -= block_h + gap


def draw_box(c, x: float, y: float, size: float, line_width: float = 0.35, color=FOREST) -> None:
    c.saveState()
    c.setFillColor(colors.white)
    c.setFillAlpha(0.60)
    c.rect(x, y, size, size, stroke=0, fill=1)
    c.setFillAlpha(1)
    c.setStrokeColor(color)
    c.setLineWidth(line_width)
    c.rect(x, y, size, size, stroke=1, fill=0)
    c.restoreState()


def tracker_name_size(name: str) -> float:
    if len(name) >= 27:
        return 5.8
    if len(name) >= 23:
        return 6.0
    return 6.2


def draw_tracker_column(c, entries: list[dict], x: float, y_top: float, width: float, row_h: float) -> None:
    box = 3.15 * mm
    header_h = 8 * mm
    prestige_step = 4.25 * mm
    prestige_x = x + width - prestige_step * len(PRESTIGE_LABELS)
    c.saveState()
    c.setFillAlpha(0.46)
    c.setFillColor(FOREST_MUTED)
    c.rect(x, y_top - header_h, width, header_h, stroke=0, fill=1)
    c.setFillAlpha(1)
    c.setFillColor(WHITE)
    c.setFont("QVGill-Bold", 5.4)
    c.drawString(x + 2 * mm, y_top - 5.2 * mm, "ENTRY")
    for index, label in enumerate(PRESTIGE_LABELS):
        c.drawCentredString(prestige_x + index * prestige_step + 1.55 * mm, y_top - 5.2 * mm, label)
    c.setStrokeColor(BRASS)
    c.setLineWidth(0.35)
    c.line(x, y_top - header_h, x + width, y_top - header_h)
    y = y_top - header_h
    for index, entry in enumerate(entries):
        row_y = y - row_h
        if index % 2 == 0:
            c.setFillAlpha(0.23)
            c.setFillColor(PARCHMENT_DEEP)
            c.rect(x, row_y, width, row_h, stroke=0, fill=1)
            c.setFillAlpha(1)
        draw_box(c, x + 1.6 * mm, row_y + (row_h - box) / 2, box, line_width=0.32)
        c.setFillColor(BRASS)
        c.setFont("QVGill-Bold", 5.15)
        c.drawString(x + 6.6 * mm, row_y + 2.35 * mm, entry_reference(entry["id"]))
        c.setFillColor(INK)
        c.setFont("QVGill", tracker_name_size(entry["name"]))
        c.drawString(x + 18.2 * mm, row_y + 2.25 * mm, pdf_text(entry["name"]))
        if entry["playerCountPrestige"]:
            for prestige_index in range(len(PRESTIGE_LABELS)):
                draw_box(
                    c,
                    prestige_x + prestige_index * prestige_step,
                    row_y + (row_h - box) / 2,
                    box,
                    line_width=0.28,
                    color=BRASS,
                )
        c.setStrokeColor(LINE)
        c.setStrokeAlpha(0.52)
        c.setLineWidth(0.18)
        c.line(x, row_y, x + width, row_y)
        c.setStrokeAlpha(1)
        y = row_y
    c.restoreState()


def draw_group_entry_page(c, logical_page: int, group_roman: str, entries: list[dict]) -> None:
    draw_interior_base(c, logical_page, f"Group {group_roman} · Entry record", writable=True)
    y = draw_section_header(c, f"Group {group_roman} · Entry Record", "Access order · persistent spread", accent=FOREST)
    c.setFillColor(FOREST)
    c.setFont("QVGill-Bold", 6.0)
    c.drawString(MARGIN_X, y - 1 * mm, "GROUP NAME")
    c.setStrokeColor(LINE)
    c.setLineWidth(0.35)
    c.line(MARGIN_X + 25 * mm, y - 1.5 * mm, MARGIN_X + 108 * mm, y - 1.5 * mm)
    c.setFont("QVGill-Bold", 5.8)
    c.drawString(MARGIN_X + 113 * mm, y - 1 * mm, "NAMED ENTRIES")
    c.line(MARGIN_X + 145 * mm, y - 1.5 * mm, MARGIN_X + BODY_W, y - 1.5 * mm)
    c.setFillColor(BRASS)
    c.setFont("QVGill-Bold", 5.1)
    c.drawString(MARGIN_X, y - 5.6 * mm, "ORDERED BY AVAILABILITY · READ DOWN LEFT, THEN RIGHT")
    y -= 7 * mm
    gap = 4 * mm
    col_w = (BODY_W - gap) / 2
    row_h = 7.1 * mm
    ordered_entries = entries_in_access_order(entries)
    draw_tracker_column(c, ordered_entries[:25], MARGIN_X, y, col_w, row_h)
    draw_tracker_column(c, ordered_entries[25:], MARGIN_X + col_w + gap, y, col_w, row_h)
    legend_y = y - 8 * mm - 25 * row_h - 6.2 * mm
    draw_box(c, MARGIN_X, legend_y, 3.2 * mm)
    c.setFillColor(INK)
    c.setFont("QVGill", 5.6)
    c.drawString(MARGIN_X + 5 * mm, legend_y + 0.7 * mm, "Named completion - mark once")
    for index, label in enumerate(PRESTIGE_LABELS):
        x = MARGIN_X + 67 * mm + index * 17 * mm
        draw_box(c, x, legend_y, 3.2 * mm, color=BRASS)
        c.drawString(x + 4.5 * mm, legend_y + 0.7 * mm, f"{label} prestige")


def draw_milestone_record(c, x: float, y_top: float, width: float, milestones: list[dict]) -> float:
    c.saveState()
    c.setFillAlpha(0.48)
    c.setFillColor(FOREST_MUTED)
    header_h = 7.2 * mm
    c.rect(x, y_top - header_h, width, header_h, stroke=0, fill=1)
    c.setFillAlpha(1)
    c.setFillColor(WHITE)
    c.setFont("QVGill-Bold", 6.7)
    c.drawString(x + 3 * mm, y_top - 4.8 * mm, "GOLDEN MILESTONES")
    c.setFont("QVGill-Bold", 5.3)
    c.drawRightString(x + width - 3 * mm, y_top - 4.8 * mm, "TILE + BOON CARD")
    c.setStrokeColor(BRASS)
    c.setLineWidth(0.35)
    c.line(x, y_top - header_h, x + width, y_top - header_h)
    y = y_top - header_h
    row_h = 6.35 * mm
    for index, milestone in enumerate(milestones):
        row_y = y - row_h
        if index % 2 == 0:
            c.setFillAlpha(0.22)
            c.setFillColor(PARCHMENT_DEEP)
            c.rect(x, row_y, width, row_h, stroke=0, fill=1)
            c.setFillAlpha(1)
        draw_box(c, x + 2.2 * mm, row_y + 1.28 * mm, 3.8 * mm, color=BRASS)
        c.setFillColor(BRASS)
        c.setFont("QVGill-Bold", 6.5)
        c.drawString(x + 8 * mm, row_y + 1.85 * mm, str(milestone["threshold"]))
        c.setFillColor(FOREST_DARK)
        c.setFont("QVGill", 6.0)
        pair = f"{pdf_text(milestone['goldenTile'])} + {pdf_text(milestone['goldenBoon'])}"
        c.drawString(x + 17 * mm, row_y + 1.75 * mm, pair)
        c.setStrokeColor(LINE)
        c.setStrokeAlpha(0.52)
        c.setLineWidth(0.18)
        c.line(x, row_y, x + width, row_y)
        c.setStrokeAlpha(1)
        y = row_y
    c.restoreState()
    return y


def draw_game_table(c, x: float, y_top: float, width: float, rows: int, first_game_number: int = 1, include_group: bool = False) -> float:
    header_h = 7.2 * mm
    row_h = 5.5 * mm
    if include_group:
        specs = [
            ("GROUP", 22), ("GAME", 12), ("DATE", 21), ("PLAYERS", 15), ("FINAL SCORE", 22), ("NEW ENTRIES", 52), ("VOW", 21)
        ]
    else:
        specs = [("GAME", 12), ("DATE", 23), ("PLAYERS", 15), ("FINAL SCORE", 24), ("NEW ENTRIES", 66), ("VOW", 25)]
    scale = width / (sum(spec[1] for spec in specs) * mm)
    widths = [spec[1] * mm * scale for spec in specs]
    c.saveState()
    c.setFillAlpha(0.48)
    c.setFillColor(FOREST_MUTED)
    c.rect(x, y_top - header_h, width, header_h, stroke=0, fill=1)
    c.setFillAlpha(1)
    c.setFillColor(WHITE)
    c.setFont("QVGill-Bold", 5.5)
    cursor = x
    for (label, _), col_w in zip(specs, widths):
        c.drawCentredString(cursor + col_w / 2, y_top - 4.8 * mm, label)
        cursor += col_w
    c.setStrokeColor(BRASS)
    c.setLineWidth(0.35)
    c.line(x, y_top - header_h, x + width, y_top - header_h)
    y = y_top - header_h
    for row in range(rows):
        row_y = y - row_h
        if row % 2 == 0:
            c.setFillAlpha(0.16)
            c.setFillColor(PARCHMENT_DEEP)
            c.rect(x, row_y, width, row_h, stroke=0, fill=1)
            c.setFillAlpha(1)
        cursor = x
        for col_w in widths[:-1]:
            cursor += col_w
            c.setStrokeColor(LINE)
            c.setStrokeAlpha(0.55)
            c.setLineWidth(0.18)
            c.line(cursor, row_y, cursor, row_y + row_h)
        c.setStrokeAlpha(1)
        c.setStrokeColor(LINE)
        c.setLineWidth(0.18)
        c.line(x, row_y, x + width, row_y)
        if not include_group:
            c.setFillColor(MOSS)
            c.setFont("QVGill", 5.0)
            c.drawCentredString(x + widths[0] / 2, row_y + 1.45 * mm, str(first_game_number + row))
        y = row_y
    c.restoreState()
    return y


def draw_group_game_page(c, logical_page: int, group_roman: str, milestones: list[dict]) -> None:
    draw_interior_base(c, logical_page, f"Group {group_roman} · Game record", writable=True)
    y = draw_section_header(c, f"Group {group_roman} · Game Record", "Scores · Milestones · Vows", accent=FOREST)
    c.setFillColor(FOREST)
    c.setFont("QVGill-Bold", 6.0)
    c.drawString(MARGIN_X, y - 1 * mm, "GROUP NAME")
    c.setStrokeColor(LINE)
    c.setLineWidth(0.35)
    c.line(MARGIN_X + 25 * mm, y - 1.5 * mm, MARGIN_X + 110 * mm, y - 1.5 * mm)
    c.setFont("QVGill-Bold", 5.8)
    c.drawString(MARGIN_X + 115 * mm, y - 1 * mm, "NAMED ENTRY COUNT")
    c.line(MARGIN_X + 153 * mm, y - 1.5 * mm, MARGIN_X + BODY_W, y - 1.5 * mm)
    y -= 7 * mm
    y = draw_milestone_record(c, MARGIN_X, y, BODY_W, milestones)
    y -= 5 * mm
    bottom = draw_game_table(c, MARGIN_X, y, BODY_W, 24)
    if bottom < 16 * mm:
        LAYOUT_ISSUES.append(f"Group {group_roman} game table ends at {bottom/mm:.1f} mm")


def draw_additional_games_page(c, logical_page: int) -> None:
    draw_interior_base(c, logical_page, "Additional game record", writable=True)
    y = draw_section_header(c, "Additional Game Record", "Continuation page", accent=FOREST)
    note = "Use this page after a group's Game Record is full. Continue marking Entries in the catalogue and Golden milestones on that group's original Game Record page."
    h = draw_paragraph(c, escape(note), SMALL_BODY_STYLE, MARGIN_X + 2 * mm, y, BODY_W - 4 * mm, label="Additional games note")
    y -= h + 5 * mm
    bottom = draw_game_table(c, MARGIN_X, y, BODY_W, 32, include_group=True)
    if bottom < 17 * mm:
        LAYOUT_ISSUES.append(f"Additional game table ends at {bottom/mm:.1f} mm")


def draw_inside_back(c) -> None:
    draw_endpaper_base(c, "Printable records", map_side="left")
    y = draw_section_header(c, "Printable Record Pages", "Approved link required", accent=FOREST)
    intro = (
        "When a group's Game Record is full, continue on page 28. Before retail release, replace the panel below with the approved QR code or short URL for printable Group Game Record and continuation pages."
    )
    h = draw_paragraph(c, escape(intro), BODY_STYLE, MARGIN_X + 2 * mm, y, BODY_W - 4 * mm, label="Printable records introduction")
    y -= h + 8 * mm

    box_w = 108 * mm
    box_h = 95 * mm
    box_x = PAGE_W / 2 - box_w / 2
    box_y = y - box_h
    cut = 5 * mm
    path = c.beginPath()
    path.moveTo(box_x + cut, box_y)
    path.lineTo(box_x + box_w - cut, box_y)
    path.lineTo(box_x + box_w, box_y + cut)
    path.lineTo(box_x + box_w, box_y + box_h - cut)
    path.lineTo(box_x + box_w - cut, box_y + box_h)
    path.lineTo(box_x + cut, box_y + box_h)
    path.lineTo(box_x, box_y + box_h - cut)
    path.lineTo(box_x, box_y + cut)
    path.close()
    c.saveState()
    c.setFillAlpha(0.34)
    c.setFillColor(MIST_LIGHT)
    c.setStrokeAlpha(0.74)
    c.setStrokeColor(BRASS)
    c.setLineWidth(0.55)
    c.drawPath(path, stroke=1, fill=1)
    c.setFillAlpha(0.84)
    c.setFillColor(FOREST_MUTED)
    c.rect(box_x, box_y + box_h - 12 * mm, box_w, 12 * mm, stroke=0, fill=1)
    c.setFillAlpha(1)
    c.setFillColor(WHITE)
    c.setFont("QVGill-Bold", 6.8)
    c.drawCentredString(PAGE_W / 2, box_y + box_h - 7.5 * mm, "PRODUCTION PLACEHOLDER")

    qr_size = 45 * mm
    qr_x = PAGE_W / 2 - qr_size / 2
    qr_y = box_y + 29 * mm
    c.setFillColor(PARCHMENT)
    c.setStrokeColor(FOREST_MUTED)
    c.setLineWidth(0.65)
    c.rect(qr_x, qr_y, qr_size, qr_size, stroke=1, fill=1)
    c.setStrokeColor(BRASS)
    c.setLineWidth(0.32)
    c.line(qr_x + 5 * mm, qr_y + 5 * mm, qr_x + qr_size - 5 * mm, qr_y + qr_size - 5 * mm)
    c.line(qr_x + 5 * mm, qr_y + qr_size - 5 * mm, qr_x + qr_size - 5 * mm, qr_y + 5 * mm)
    c.setFillColor(FOREST)
    c.setFont("QVGill-Bold", 6.5)
    c.drawCentredString(PAGE_W / 2, qr_y + qr_size / 2 + 1.5 * mm, "QR CODE")
    c.setFont("QVGill", 5.4)
    c.drawCentredString(PAGE_W / 2, qr_y + qr_size / 2 - 3.0 * mm, "OR SHORT URL")
    placeholder = Paragraph(
        "Add the approved QR code or short URL for printable record pages before retail release.",
        ParagraphStyle(
            "ReplacementPlaceholder",
            fontName="QVCharter",
            fontSize=7.6,
            leading=9.5,
            textColor=FOREST_DARK,
            alignment=1,
        ),
    )
    _, placeholder_h = placeholder.wrap(box_w - 18 * mm, 20 * mm)
    placeholder.drawOn(c, box_x + 9 * mm, box_y + 10 * mm - placeholder_h / 2)
    c.restoreState()

    draw_divider(c, 58 * mm, PAGE_W - 58 * mm, box_y - 13 * mm, alpha=0.52, line_width=0.30)
    c.setFillColor(MOSS)
    c.setFont("QVGill-Bold", 5.8)
    c.drawCentredString(PAGE_W / 2, box_y - 21 * mm, "PRINTABLE RECORD LOCATION PENDING")


def draw_back_cover(c) -> None:
    c.saveState()
    c.setFillColor(COVER_BLACK)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    draw_cut_corner_frame(c, 7 * mm, BRASS_LIGHT, 0.8, 0.9)
    draw_cut_corner_frame(c, 9 * mm, BRASS_LIGHT, 0.35, 0.6)
    if TREE.exists():
        c.drawImage(str(TREE), PAGE_W / 2 - 24 * mm, PAGE_H - 119 * mm, 48 * mm, 86 * mm, preserveAspectRatio=True, mask="auto")
    draw_spaced_text(c, "THE QUIET VALE", PAGE_W / 2, PAGE_H - 139 * mm, "QVGill-Light", 18, 1.2, WHITE)
    c.setFont("QVGill-Bold", 7.2)
    c.setFillColor(BRASS_LIGHT)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 152 * mm, "STEWARD'S LEDGER")
    draw_divider(c, 55 * mm, PAGE_W - 55 * mm, PAGE_H - 161 * mm, color=BRASS_LIGHT, alpha=0.60, line_width=0.35)
    c.restoreState()


def entries_in_access_order(entries: list[dict]) -> list[dict]:
    """Keep LE identifiers stable while presenting Entries by first availability."""
    return sorted(entries, key=lambda entry: (entry["unlockAt"], entry["id"]))


def access_page_title(page_entries: list[dict]) -> str:
    unlock_values = sorted({entry["unlockAt"] for entry in page_entries})
    if unlock_values == [0]:
        return "Available from the First Game"
    if unlock_values[0] == 0:
        return f"First Game + After {unlock_values[-1]} Entries"
    if len(unlock_values) == 1:
        return f"After {unlock_values[0]} Entries"
    return f"After {unlock_values[0]}-{unlock_values[-1]} Entries"


def catalogue_pages(entries: list[dict]) -> list[tuple[str, list[dict], int, int, int]]:
    ordered_entries = entries_in_access_order(entries)
    # Eighteen integrated catalogue/tracker pages replace the six duplicate
    # group Entry indexes. Four-entry pages contain only compact non-prestige
    # panels; the long late Vows receive two-entry pages.
    page_sizes = [3, 3, 3, 3, 3, 3, 3, 3, 4, 3, 2, 4, 2, 2, 3, 2, 2, 2]
    if sum(page_sizes) != len(ordered_entries):
        raise RuntimeError(f"Access-order page map covers {sum(page_sizes)} of {len(ordered_entries)} Entries.")
    pages = []
    cursor = 0
    total_entries = len(ordered_entries)
    for page_size in page_sizes:
        page_entries = ordered_entries[cursor : cursor + page_size]
        first_position = cursor + 1
        cursor += page_size
        pages.append((access_page_title(page_entries), page_entries, first_position, cursor, total_entries))
    return pages


def build_pdf() -> dict:
    register_fonts()
    prepare_ornaments()
    entries, milestones = parse_ledger_source()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = pdfcanvas.Canvas(str(OUTPUT), pagesize=(PAGE_W, PAGE_H), pageCompression=1)
    c.setTitle("The Quiet Vale - Steward's Ledger v6.5")
    c.setSubject("Five-player multi-campaign Ledger using the v4.6 catalogue")
    c.setCreator("The Quiet Vale Steward's Ledger production workflow")
    c.setKeywords("The Quiet Vale, Steward's Ledger, cooperative board game, campaign record")

    # Four-page cover: black outside covers with parchment inside covers.
    draw_cover(c)
    c.showPage()
    draw_inside_front(c)
    c.showPage()

    # Twenty-eight numbered interior pages begin here; logical folios run 1-28.
    logical_page = 1
    draw_how_to_page(c, logical_page)
    c.showPage()
    logical_page += 1
    draw_golden_page(c, logical_page, milestones)
    c.showPage()
    logical_page += 1
    draw_reading_page(c, logical_page, entries)
    c.showPage()
    logical_page += 1

    for title, page_entries, first_position, last_position, total_entries in catalogue_pages(entries):
        draw_catalogue_page(c, logical_page, title, page_entries, first_position, last_position, total_entries)
        c.showPage()
        logical_page += 1

    for group_roman in ("I", "II", "III", "IV", "V", "VI"):
        draw_group_game_page(c, logical_page, group_roman, milestones)
        c.showPage()
        logical_page += 1

    draw_additional_games_page(c, logical_page)
    c.showPage()
    logical_page += 1
    if logical_page != 29:
        raise RuntimeError(f"Expected 28 text pages; next logical page is {logical_page}.")

    draw_inside_back(c)
    c.showPage()
    draw_back_cover(c)
    c.save()

    reader = PdfReader(str(OUTPUT))
    if len(reader.pages) != 32:
        raise RuntimeError(f"Expected 32 PDF pages, found {len(reader.pages)}.")
    if LAYOUT_ISSUES:
        raise RuntimeError("Layout overflow detected:\n" + "\n".join(LAYOUT_ISSUES))

    tree_source_px = list(raster_dimensions(TREE)) if TREE.exists() else None
    manifest = {
        "output": str(OUTPUT),
        "release_status": "FIVE-PLAYER MASTER",
        "approved_from_proof": "v8",
        "physical_pages": 32,
        "cover_pages": 4,
        "black_cover_pages": 2,
        "parchment_inside_cover_pages": 2,
        "numbered_interior_pages": 28,
        "trim_mm": [195, 255],
        "group_register_rows": 6,
        "catalogue_tracker_pages": 18,
        "integrated_entry_tracking": True,
        "starting_access_label": "AVAILABLE",
        "gated_access_label": "AFTER N",
        "golden_unlock_columns": ["GOLDEN TILE", "GOLDEN BOON CARD"],
        "golden_unlock_colour_coding": False,
        "golden_tile_icon": "flat-top hex",
        "plain_language_pass": True,
        "locked_entry_requirements_edited": False,
        "catalogue_order_label": "AVAILABILITY ORDER",
        "player_count_table_label": "PLAYERS",
        "top_right_running_headers": False,
        "centred_document_running_header": True,
        "display_entry_reference_format": "#number",
        "locked_source_ids_edited": False,
        "group_columns_per_entry": 6,
        "named_completion_marks": len(entries) * 6,
        "prestige_marks": sum(bool(entry["playerCountPrestige"]) for entry in entries) * 6 * len(PRESTIGE_LABELS),
        "group_game_record_pages": 6,
        "duplicate_group_entry_index_pages": 0,
        "game_rows_per_group": 24,
        "additional_game_rows": 32,
        "entries": len(entries),
        "prestige_entries": sum(bool(entry["playerCountPrestige"]) for entry in entries),
        "vows": sum(bool(entry["declaredVow"]) for entry in entries),
        "milestones": [milestone["threshold"] for milestone in milestones],
        "catalogue_version": "v4.6 + five-player thresholds",
        "source_sha256": hashlib.sha256(LEDGER_SOURCE.read_bytes()).hexdigest(),
        "artwork_placeholders": {
            "cover_tree": {
                "status": "placement only",
                "source_px": tree_source_px,
                "front_rendered_size_mm": [62, 88.9],
                "minimum_raster_replacement_px_at_300dpi": [733, 1051],
                "preferred_replacement": "approved transparent vector master",
            },
            "replacement_record_page_distribution": {
                "status": "approved location required before retail release"
            },
        },
    }
    (TMP / "build-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


if __name__ == "__main__":
    print(json.dumps(build_pdf(), indent=2))
