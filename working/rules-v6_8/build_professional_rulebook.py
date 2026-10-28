from __future__ import annotations

import io
import json
import math
import re
from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image as PILImage, ImageChops, ImageFilter, ImageOps
from docx import Document
from docx.oxml.ns import qn
from docx.table import Table as DocxTable
from docx.text.paragraph import Paragraph as DocxParagraph
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import portrait
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    CondPageBreak,
    Flowable,
    Frame,
    Image,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "output/docx/rulebook-v6_8/The_Quiet_Vale_Main_Rulebook_v6_8.docx"
OUTPUT = ROOT / "output/pdf/rulebook-v6_8/The_Quiet_Vale_Main_Rulebook_v6_8.pdf"
WORK = ROOT / "working/rulebook-professional-redesign"
TMP = ROOT / "tmp/pdfs/rulebook-v6_8"
EXTRACTED = TMP / "embedded-assets"
ENCOUNTER_TEXT = ROOT / "src/data/encounterText.generated.ts"

# Verbatim thematic passages approved by the user on 24 August 2026. These
# passages are rulebook narration, not Encounter Card quotations, and contain
# no rules required to play.
APPROVED_BUILDING_FLAVOR = (
    "One roof became three. A path reached the workshop, another reached the river, and neighbours carried tools between them. "
    "Nobody planned the whole shape alone. The settlement grew wherever one piece of work made the next possible."
)
APPROVED_SUPPORTED_FLAVOR = (
    "After the rain, one wall bowed and a path washed thin. Before either failed, neighbours arrived with braces, stone, and dry timber. "
    "Nothing grand was done that day. The settlement held because ordinary repairs were made in time."
)
APPROVED_SCORING_FLAVOR = (
    "The result is a board that feels increasingly lived-in. By the end of play, the settlement is not just a score state; "
    "it is a record of the group’s choices."
)

PAGE_W, PAGE_H = portrait((195 * mm, 255 * mm))
LEFT = 15 * mm
RIGHT = 15 * mm
TOP = 18 * mm
BOTTOM = 15 * mm
BODY_W = PAGE_W - LEFT - RIGHT
BODY_H = PAGE_H - TOP - BOTTOM

PARCHMENT = HexColor("#F4F0E5")
PARCHMENT_ALT = HexColor("#EAE4D5")
PARCHMENT_DEEP = HexColor("#DED4BE")
INK = HexColor("#24312A")
FOREST = HexColor("#315846")
FOREST_DARK = HexColor("#1E382D")
FOREST_MUTED_FILL = HexColor("#4A6B5B")
MOSS = HexColor("#6B7D5A")
BRASS = HexColor("#A78343")
BRASS_LIGHT = HexColor("#D9C48E")
MIST = HexColor("#78A0A1")
MIST_LIGHT = HexColor("#DCE9E6")
ROSE = HexColor("#A95E57")
ROSE_LIGHT = HexColor("#ECD9D4")
LINE = HexColor("#9D927B")
WHITE = colors.white
COVER_BLACK = HexColor("#070908")

TREE = ROOT / "src/assets/quiet_vale_tree_brass_transparent.png"
MAP = ROOT / "src/assets/quiet_vale_map_v02.webp"
BOON_ART = ROOT / "src/assets/encounter-cards/boon.png"
BURDEN_ART = ROOT / "src/assets/encounter-cards/burden.png"
ARRIVAL_ART = ROOT / "src/assets/encounter-cards/arrival.png"
GOLDEN_ART = ROOT / "src/assets/encounter-cards/golden-boon.png"
COVER_HERO = ROOT / "working/rulebook-v6_4-card-visuals/cover-hero.png"
TARGET_TS = ROOT / "src/data/targetCards.ts"
CORNER_LEFT = TMP / "encounter-corner-left.png"
CORNER_RIGHT = TMP / "encounter-corner-right.png"
CORNER_BOTTOM_LEFT = TMP / "encounter-corner-bottom-left.png"
CORNER_BOTTOM_RIGHT = TMP / "encounter-corner-bottom-right.png"
DIVIDER_FLOURISH_BRASS = TMP / "encounter-divider-flourish-brass.png"
DIVIDER_FLOURISH_LIGHT = TMP / "encounter-divider-flourish-light.png"

RASTER_DIMS: dict[Path, tuple[int, int]] = {}


# These labels describe only visuals already embedded in the v6.8 source
# rulebook. They improve navigation and do not add or reinterpret game rules.
IMAGE_META: dict[str, tuple[str, str, float]] = {
    "rId29": ("SETUP REFERENCE", "Standard setup", 82 * mm),
    "rId30": ("ROUND REFERENCE", "Three Seasons - twelve rounds", 50 * mm),
    "rId32": ("ACTION REFERENCE", "Four Actions", 43 * mm),
    "rId33": ("ILLUSTRATED EXAMPLE", "Steward Token Movement", 66 * mm),
    "rId34": ("ILLUSTRATED EXAMPLE", "Linked Production", 68 * mm),
    "rId38": ("TILE EXAMPLE", "Workshops and The Makers Conclave", 68 * mm),
    "rId39": ("TILE EXAMPLE", "Market Stalls and The Seldes", 72 * mm),
    "rId35": ("PLACEMENT REFERENCE", "Terrain, placement and adjacency", 76 * mm),
    "rId36": ("MAP REFERENCE", "Map terrain legend", 72 * mm),
    "rId37": ("ILLUSTRATED EXAMPLE", "Rivers and Bridges", 66 * mm),
    "rId41": ("TIMING EXAMPLE", "Arrival timing", 56 * mm),
    "rId42": ("ILLUSTRATED EXAMPLE", "Inn and Arrival timers", 72 * mm),
    "rId43": ("ILLUSTRATED EXAMPLE", "Passive Supported from Core Tiles", 72 * mm),
    "rId40": ("CHAIN EXAMPLE", "Overstrain chain", 70 * mm),
    "rId28": ("ILLUSTRATED EXAMPLE", "Target Card in action", 66 * mm),
    "rId44": ("SEASON-END EXAMPLE", "Neighbourly Support", 68 * mm),
}


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
    "Body",
    fontName="QVCharter",
    fontSize=9.5,
    leading=12.3,
    textColor=INK,
    alignment=TA_LEFT,
    spaceAfter=4.3,
    allowWidows=0,
    allowOrphans=0,
)
BODY_SMALL = ParagraphStyle(
    "BodySmall",
    parent=BODY,
    fontSize=8.2,
    leading=10.2,
    spaceAfter=2.5,
)
H2 = ParagraphStyle(
    "H2",
    fontName="QVGill-Bold",
    fontSize=11.2,
    leading=13.0,
    textColor=FOREST_DARK,
    spaceBefore=10.0,
    spaceAfter=4.0,
    keepWithNext=1,
)
H3 = ParagraphStyle(
    "H3",
    fontName="QVGill-Bold",
    fontSize=9.1,
    leading=11.0,
    textColor=FOREST,
    spaceBefore=5.0,
    spaceAfter=2.5,
    keepWithNext=1,
)
CAPTION = ParagraphStyle(
    "Caption",
    fontName="QVGill-Italic",
    fontSize=6.9,
    leading=8.2,
    textColor=FOREST,
    alignment=TA_CENTER,
    spaceBefore=2,
)
CELL = ParagraphStyle(
    "Cell",
    fontName="QVCharter",
    fontSize=7.8,
    leading=9.6,
    textColor=INK,
    spaceAfter=0,
)
CELL_HEADER = ParagraphStyle(
    "CellHeader",
    fontName="QVGill-Bold",
    fontSize=7.5,
    leading=9.0,
    textColor=WHITE,
    spaceAfter=0,
)
TOC_STYLE = ParagraphStyle(
    "TOC",
    fontName="QVGill",
    fontSize=8.8,
    leading=13.0,
    textColor=INK,
    leftIndent=0,
    firstLineIndent=0,
    spaceBefore=1,
)
PLACEHOLDER_TEXT = ParagraphStyle(
    "PlaceholderText",
    fontName="QVGill",
    fontSize=7.8,
    leading=9.6,
    textColor=INK,
    alignment=TA_LEFT,
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
        .replace("\u2192", ">")
        .replace("\u21d2", ">")
    )


def normalise_spaces(text: str) -> str:
    return " ".join(text.replace("\xa0", " ").split())


def locked_flavor_card(card_id: str) -> tuple[str, str]:
    """Return an official card title and flavour passage without rewriting it."""
    source = ENCOUNTER_TEXT.read_text(encoding="utf-8")
    json_string = r'"(?:\\.|[^"\\])*"'
    pattern = re.compile(
        rf'"{re.escape(card_id)}"\s*:\s*\{{\s*"name"\s*:\s*({json_string})\s*,\s*"flavorText"\s*:\s*({json_string})',
        flags=re.DOTALL,
    )
    match = pattern.search(source)
    if not match:
        raise RuntimeError(f"Locked flavour source not found: {card_id}")
    return json.loads(match.group(1)), json.loads(match.group(2))


RULE_TEXT_OVERRIDES: dict[str, str] = {
    # Outcome: the locked release records one raw shared score and has no
    # pass/fail band. Tie the opening promise to the actual end-game record.
    "Work together to build Population and earn Renown across 12 rounds. Complete Steward Objectives, fulfil Arrivals, resolve Burdens and protect the settlement from Strain. At the end of Round 12, total your shared score and record the story of the Vale you created.":
        "Work together to build Population and earn Renown across 12 rounds. Complete Steward Objectives, fulfil Arrivals, resolve Burdens and protect the settlement from Strain. At the end of Round 12, calculate one shared final score. There is no separate victory threshold: that score is the group's result. Record the shared final score and any newly completed Entries in the Steward's Ledger.",

    # Components: quantities here come from the locked master component list,
    # except the 30-card Target Deck, whose higher-priority structured source
    # is src/data/targetCards.ts.
    "The flat-top hex map on which the shared settlement grows.":
        "1 flat-top hex Game Map on which the shared settlement grows.",
    "Basic settlement Tiles with an upgraded reverse side.":
        "63 double-sided Core Tiles across 21 Tile types. Each has a basic side and an upgraded reverse side.",
    "Tiles unlocked by completing Arrivals.":
        "26 one-sided Special Tile components across 25 designs, unlocked by completing Arrivals.",
    "Boons, Burdens and Arrivals used to shape each Season.":
        "90 Encounter Cards: 30 Boons, 30 Burdens, 25 Arrivals and 5 Golden Boons.",
    "The 24-card deck that selects Tiles for incoming Strain.":
        "30 Target Cards that select Tiles for incoming Strain.",
    "Steward materials":
        "Rules and Steward materials",
    "Six Steward Player Aids and Steward Tokens.":
        "1 Main Rulebook, 6 Steward Aids and 6 matching Steward Tokens.",
    "The shared store of Wood, Stone, Metal, Food, Herbs and Goods.":
        "90 colour-coded resource pieces: 15 each of Wood, Stone, Metal, Food, Herbs and Goods.",
    "Strain, Supported, Arrival timers and Round marker.":
        "30 black markers and 30 bronze markers. Strain is black; Supported and the Round marker are bronze; Arrival timers may use either colour.",
    "A persistent record of achievements across games.":
        "1 Steward's Ledger booklet for tracking achievements, scores and Golden milestones across multiple games.",

    # Setup: make the physical orientation and selected-pool arithmetic explicit.
    "2.1 Lay out the Game Map. Place the Stewards Board, Warehouse and Round Timer beside it.":
        "2.1 Lay out the Game Map. Place the Stewards Board and Warehouse beside it.",
    "2.2 Organise the basic Core Tiles with their basic sides visible. Place upgraded sides, Special Tiles and tokens within reach.":
        "2.2 Organise the Core Tile supply with every basic side face up. The upgraded side is the reverse of the same physical Tile; do not make a separate upgraded supply. Place Special Tiles and tokens within reach.",
    "2.3 Place the Round marker on Round 1.":
        "2.3 Place the Round marker on Round 1 of the round tracker.",
    "2.4 Shuffle all 24 Target Cards and place the deck face down. Do not create a discard pile.":
        "2.4 Shuffle all 30 Target Cards and place the deck face down. Do not create a discard pile and do not reshuffle during play.",
    "2.5 For each player, take 5 Boons, 5 Burdens and 5 Arrivals to form a balanced Encounter pool.":
        "2.5 Separate the standard Encounter Cards by type and shuffle each type. For each player, take 4 Boons, 4 Burdens and 4 Arrivals; combine all selected cards into one 12-card-per-player pool.",
    "2.6 Shuffle that pool and deal 9 hidden Encounter Cards to each player.":
        "2.6 Shuffle the combined selected pool. Deal 9 hidden Encounter Cards to each player.",
    "2.7 Place 3 standard Encounter Cards per player into the starting Encounter Deck.":
        "2.7 Without adding any other cards, place the remaining 3 selected standard Encounter Cards per player face down as the starting Encounter Deck. All selected cards are now in a hand or the deck.",
    "2.8 Keep the remaining standard cards face down as the reserve. Players may not inspect them unless an effect instructs them to do so.":
        "2.8 Return every unselected standard Encounter Card to the box as the reserve. Keep it separate from the starting deck; players may not inspect it unless an effect instructs them to do so.",
    "Each player chooses a different Steward, takes its Player Aid and Steward Token, and reads its Starting Terrain, once-per-Season Power and Steward Objective aloud. There are no Starting Benefits.":
        "Each player chooses a different Steward, takes its Steward Aid and Steward Token, and reads its Starting Terrain, once-per-Season Power and Steward Objective aloud. There are no Starting Benefits. In a 1-player game, choose 1 Steward and follow the normal rules, using the 1-player values wherever shown.",

    # The universal Ruins discount is locked in every Steward Aid. State the
    # complete rule here instead of referring to an undefined discount.
    "Every Tile placement passes the same checks: choose an available Tile, choose an empty reachable hex, check its terrain, adjacency and printed placement rule, pay the listed cost, then place the Tile and resolve any placement effect. The Vale contains Grasslands, Woodland, Arable Land, Mountains, Heaths, Ruins and River/Water terrain. Use the map terrain legend below to identify each region before applying a placement rule. Read the Tile’s printed requirement exactly: Mine Shaft goes on Mountains, Farmstead on Arable Land, Salvage Camp on Ruins and Bridge on Water/River. Ruins are special terrain: they provide a Stone discount. Any Land means an empty non-River hex unless the Tile’s own rule says otherwise.":
        "Every Tile placement passes the same checks: choose an available Tile, choose an empty reachable hex, check its terrain, adjacency and printed placement rule, pay the listed cost, then place the Tile and resolve any placement effect. The Vale contains Grasslands, Woodland, Arable Land, Mountains, Heaths, Ruins and Water/River terrain. Use the map terrain legend below to identify each region before applying a placement rule. Read the Tile’s printed requirement exactly: Mine Shaft goes on Mountains, Farmstead on Arable Land, Salvage Camp on Ruins and Bridge on Water/River. When placing or upgrading a Tile whose entire footprint lies on Ruins, ignore all Stone in that placement or upgrade cost. If any part of the footprint lies outside Ruins, pay the full printed cost. Any Land means an empty non-Water/River hex unless the Tile’s own rule says otherwise.",
    # Round and Action language.
    "Reveal standard Encounter Cards equal to the number of players. Resolve mandatory pending effects before continuing.":
        "Reveal until standard Encounter Cards equal to the number of players have been revealed. Resolve every revealed card's mandatory effect before Player Turns begin.",
    "Every player takes one turn with 4 Actions. The group chooses the order in which players act; each acts exactly once.":
        "The group chooses player order. Every player then takes exactly one turn with up to 4 Actions.",
    "Reveal Encounters → resolve them → each player takes a 4-Action turn → complete upkeep.":
        "Reveal and resolve Encounters → the group chooses player order → each player takes one turn with up to 4 Actions → complete upkeep.",
    "Every player takes one 4-Action turn":
        "Group chooses order; every player takes one turn with up to 4 Actions",
    "Complete Arrival / use Burden interaction":
        "Complete Arrival / resolve active Burden",
    "Remove 1 timer from every active Arrival. Expire those that reach 0. Discard effects whose duration ends, refresh round-based effects and advance the Round marker.":
        "Remove 1 timer from every active Arrival and resolve each expiry. Discard effects whose duration ends, refresh used round-based effects for the next round, then advance the Round marker.",
    "GOLDEN BOONS A revealed Golden Boon resolves for free and does not count toward the standard reveal total. Continue revealing until the required number of standard Encounters has been revealed.":
        "GOLDEN CONTENT Leave Golden Tiles and Golden Boons in the box until the Ledger unlocks them. If the group includes unlocked Golden content, follow Section 16.",
    "Golden Boons are optional advanced cards unlocked through the Steward’s Ledger. They never enter player hands or seasonal seeding. When a Golden Boon is revealed, resolve it for free, do not count it toward the standard reveal total, and continue revealing. The Golden Scroll, for example, lets each player discard any standard Encounter Cards from their hand, then draw the same number at random from the box; Golden Boons cannot be drawn, and if the box runs short, draw as many as possible. Resolve the card, then discard it.":
        "Golden Boons never enter player hands or seasonal seeding. When a Golden Boon is revealed, resolve it for free, do not count it toward the standard reveal total, and continue revealing. The Golden Scroll, for example, lets each player discard any standard Encounter Cards from their hand, then draw the same number at random from the box; Golden Boons cannot be drawn, and if the box runs short, draw as many as possible. Resolve the card, then discard it.",
    "Add an available Tile to a legal, reachable empty hex and pay its cost.":
        "Spend 1 Action to add an available Tile to a legal, reachable empty hex and pay any required cost.",
    "Pay the upgrade cost and flip a reachable basic Core Tile to its upgraded side.":
        "Spend 1 Action, pay the cost printed for the upgraded side and flip a reachable basic Core Tile.",
    "Use a reachable, non-Overstrained Tile’s Activated Effect, including Production.":
        "Spend 1 Action to use a reachable, non-Overstrained Tile's Activated Effect, including Production.",
    "Complete an Arrival or perform a printed interaction with an active Burden.":
        "Spend 1 Action to complete an active Arrival or perform the printed resolution of an active Burden.",
    "5.4 Pay the listed resources from the Warehouse.":
        "5.4 Pay the listed resources from the Warehouse. An unlocked Special Tile costs 0 resources to place.",
    "Spend 1 Action and pay the listed cost to flip a placed basic Core Tile to its upgraded side. It remains the same placed Tile; only its name, cost, effect and printed scoring values change. Upgraded, Special, Golden and Overstrained Tiles cannot be upgraded.":
        "Only a reachable, placed basic Core Tile can be upgraded. It remains the same physical Tile in the same location; its upgraded name, effect and printed scoring values now apply. Upgraded, Special, Golden and Overstrained Tiles cannot be upgraded.",
    "Spend 1 Action to use a reachable, non-Overstrained Tile with an Activated Effect. Passive effects require no Action. A Tile may be activated more than once if every activation is otherwise legal.":
        "Only a reachable, non-Overstrained Tile with an Activated Effect can be activated. A Tile may be activated more than once if every activation is otherwise legal. Passive effects do not use the Activate Action.",
    "Your Steward Token follows the Tile you most recently changed. After the first placement, Place, Upgrade or Activate a Tile, move the Token onto that Tile; the next reachability check starts there.":
        "After your first placement, only Place, Upgrade or Activate moves your Steward Token. Move it onto the Tile you just placed, upgraded or activated; the next reachability check starts there. Interact does not move it.",

    # Linked Production: structured rules and engine tests define an immediate
    # adjacency burst, not a flood-fill through the entire connected chain.
    "The first time an adjacent group of matching Resource Tiles is activated each round, the chosen Tile and every immediately adjacent, non-Overstrained matching Resource Tile produce for the single Activate Action.":
        "When you Activate a Resource Tile, check the chosen Tile and its immediately adjacent copies from the same Tile stack. If none of those Tiles has already participated in Linked Production this round, the chosen Tile and every immediately adjacent, non-Overstrained copy produce for that single Activate Action. Use each producer's current side. Linked Production never continues outward through a chain of Tiles.",
    "Further activations involving that group during the same round produce only from the chosen Tile. A separate disconnected matching group receives its own first Linked Production. Every group refreshes at the start of a round.":
        "Treat every Tile that produced in that Linked Production as having participated this round. If the chosen Tile or any immediately adjacent matching Tile has already participated, only the chosen Tile produces. A disconnected matching set can still use its own Linked Production. All participation refreshes at the start of the next round.",

    # Encounter resolution and exact Arrival failure target pool.
    "Boons help the settlement and are resolved from the row matching the current Season. Resolve the effect immediately unless the italic line says to keep the card face up. A kept Boon remains active until it is used or its printed duration ends, then it is discarded. For example, A Little Time adds 1 timer to an active Arrival in Season I, up to 3; its Season II and III rows add up to 2 or 3 timers as printed. Only one Boon may modify a single Action unless a rule says otherwise.":
        "Boons help the settlement and are resolved from the row matching the current Season. Resolve the effect immediately unless the italic line says to keep the card face up. A kept Boon remains active until it is used or its printed duration ends, then it is discarded. Using a face-up Boon costs no Action unless its text says otherwise. For example, A Little Time adds 1 timer to an active Arrival in Season I, up to 3; its Season II and III rows add up to 2 or 3 timers as printed. Only one Boon may modify a single Action unless a rule says otherwise.",
    "Arrivals are timed objectives that unlock Special Tiles. Place a revealed Arrival face up with 3 timer tokens, one in each circle. For example, Quiet Quest requires 4 Goods and 2 Herbs and rewards the Adventurers’ Guild. To complete it, fulfil its Requirements and spend 1 Interact Action before the final timer is removed. Remove its timers, discard the Arrival and set its unlocked Special Tile beside the board; completing an Arrival unlocks its Tile but does not place it immediately. Timers, expiry and Inn activations are shown in the Arrival examples below. An Inn adds 1 timer to an active Arrival when activated; an upgraded Dawn Break Inn adds up to 2, and no Arrival can hold more than 3 timers.":
        "Arrivals are timed objectives that unlock Special Tiles. Place a revealed Arrival face up with 3 timer tokens, one in each circle. For example, Quiet Quest requires 4 Goods and 2 Herbs and rewards the Adventurers' Guild. To complete it, fulfil its Requirements and spend 1 Interact Action before the final timer is removed. Remove its timers, discard the Arrival and set its unlocked Special Tile beside the board. Completing an Arrival unlocks its Tile but does not place it immediately; any player may later place that Tile with a normal Place Action, following its placement rule and paying 0 resources. Timers, expiry and Inn activations are shown in the Arrival examples below. An Inn adds 1 timer to an active Arrival when activated; an upgraded Dawn Break Inn adds up to 2, and no Arrival can hold more than 3 timers.",
    "The Arrival fails. Discard it, record one failed Arrival and apply 1 Strain to the Tile selected by the Target Deck.":
        "The Arrival fails. Discard it and record one failed Arrival. Build the eligible pool from all placed Tiles below 3 Strain, then draw one Target Card to select a Tile and apply 1 Strain. If no such Tile exists, place no Strain.",

    # Give the two approved Supported sources distinct reference labels without
    # changing the shared game term or introducing a new state.
    "Supported prevents Strain before checking whether a Tile becomes Overstrained. A Tile either has Supported or does not; multiple instances do not stack. Some Core Tiles provide passive Supported: Common Land protects 1 adjacent Housing Tile, while its upgraded side, The Pleasance, protects up to 3. The source must not be Overstrained.":
        "Supported prevents 1 Strain before checking whether a Tile becomes Overstrained. A Tile either has Supported or does not; passive and single-use Supported do not stack. Common Land provides passive Supported to 1 adjacent Housing Tile, while The Pleasance provides it to up to 3. When this effect first becomes active, the group chooses the eligible adjacent Housing Tiles that receive it, following the printed limit. Keep those choices until the set of eligible adjacent Housing Tiles changes or the source becomes Overstrained; choose again when required, including when the source later recovers. Passive Supported cannot be reassigned in response to an incoming Strain effect. Supported granted by a placement, activation or other effect is single-use unless that rule says it is passive.",
    "Passive condition": "Passive Supported",
    "Placement, activation or other grant": "Single-use Supported",

    # Season transition and now-user-confirmed Warden objective.
    "After Rounds 4 and 8, finish Arrival expiry and discard unused face-up Boons whose duration ends with the Season. Resolve Neighbourly Support before unresolved Burdens reapply for the new Season. Then refresh Steward Powers and seed Encounters for the next Season. There is no automatic Season-end Strain spread.":
        "After Rounds 4 and 8, complete this transition in order: (1) finish every Arrival expiry; (2) discard unused face-up Boons whose duration ends with the Season; (3) resolve Neighbourly Support; (4) reapply every unresolved Burden using the new Season row; (5) refresh Steward Powers; and (6) seed Encounters for the next Season. There is no automatic Season-end Strain spread.",
    "No active Burdens.":
        "Fewer active Burdens than the player count.",

    # End-game and campaign statements already locked by the current scoring
    # and Ledger sources.
    "After Round 12 and all required pending effects, calculate one shared score.":
        "After Round 12 and all required pending effects, calculate one shared final score. There is no pass/fail threshold or individual winner.",
    "FINAL SCORE Add Population and all positive Renown, then subtract every penalty. Record the final total and any completed Steward’s Ledger Entries.":
        "FINAL SCORE Add Population and all positive Renown, then subtract every penalty. Record the shared final score and any newly completed Entries in the Steward's Ledger.",
    "The Ledger records achievements across games. Each named Ledger Entry counts once toward Golden unlocks; extra player-count boxes are prestige records only. Entries are never spent and do not make one player the winner.":
        "The Steward's Ledger tracks achievements across multiple games. Before a group's first game, choose a name and an unused Roman numeral (I-VI) in the Group Register. Use that numeral for every Entry mark and its Game Record. After final scoring, mark NAMED for each newly completed Entry and record the shared final score and newly completed Entries on the group's Game Record. Each NAMED mark counts once toward Golden milestones; player-count prestige marks are records only. Completed Entries are never spent or reset. An AFTER gate is met only if the group begins the game with the shown number of Named Entries. Declare a Vow before setup. A group may attempt only one Vow per game.",
    "CURRENT MILESTONES Golden content unlocks after 5, 12, 18, 25 and 32 completed named Ledger Entries. Previously earned milestones remain unlocked.":
        "CURRENT MILESTONES A group reaches Golden milestones at 5, 12, 18, 25 and 32 Named Entries. Each milestone unlocks one Golden Tile and one Golden Boon. Once unlocked, both rewards remain available in later games.",
    "Use each Golden component’s printed rule. Every Golden Tile has a conditional +5 Renown scoring hook. The Golden Boon format is shown in the Encounter card guide on page 14: read its single Effect block, then follow the italic instruction at the base.":
        "Use each Golden component's printed rule. Every Golden Tile has a conditional +5 Renown scoring hook.",

    # Glossary precision.
    "Available to the acting Steward through the network or a specific rule.":
        "A Tile or empty hex the acting Steward can reach through the connected network or a specific rule.",
    "A Tile unlocked by completing an Arrival and placed later with a normal Place Action.":
        "A Tile unlocked by completing an Arrival and placed later with a normal Place Action for 0 resources, following its printed placement rule.",
    "FOR DEFINITIONS, TIMING AND EDGE CASES, USE THE COMPANION RULES REFERENCE v6.4.":
        "FOR DEFINITIONS, TIMING AND EDGE CASES, USE THIS GLOSSARY AND THE RELEVANT RULEBOOK SECTION.",
}


def transform_text(text: str, crossrefs: dict[str, int] | None = None) -> str:
    normalised = normalise_spaces(text)
    value = RULE_TEXT_OVERRIDES.get(normalised, text)
    value = value.replace("24 Target Cards", "30 Target Cards")
    value = value.replace("24-card", "30-card")
    value = value.replace("River/Water", "Water/River")
    value = value.replace("Steward Player Aids", "Steward Aids")
    value = value.replace("Steward Player Aid", "Steward Aid")
    value = value.replace("Steward’s Ledger", "Steward's Ledger")
    if normalise_spaces(value) == "Arable":
        value = "Arable Land"
    value = value.replace(
        "take 5 Boons, 5 Burdens and 5 Arrivals",
        "take 4 Boons, 4 Burdens and 4 Arrivals",
    )
    value = value.replace(
        "The online prototype highlights the current row; on a physical card, follow the matching Roman numeral.",
        "Resolve the row with the matching Roman numeral.",
    )
    if crossrefs and "encounters" in crossrefs:
        value = value.replace(
            "Encounter card guide on page 14",
            f"Encounter card guide on page {crossrefs['encounters']}",
        )
    return ascii_dashes(value)


def paragraph_markup(paragraph: DocxParagraph, crossrefs: dict[str, int] | None = None) -> str:
    if normalise_spaces(paragraph.text) in RULE_TEXT_OVERRIDES:
        return escape(transform_text(paragraph.text, crossrefs)).replace("\n", "<br/>")
    parts: list[str] = []
    for run in paragraph.runs:
        text = transform_text(run.text, crossrefs)
        if not text:
            continue
        value = escape(text).replace("\n", "<br/>")
        if run.bold and run.italic:
            value = f"<b><i>{value}</i></b>"
        elif run.bold:
            value = f"<b>{value}</b>"
        elif run.italic:
            value = f"<i>{value}</i>"
        parts.append(value)
    if not parts:
        return escape(transform_text(paragraph.text, crossrefs)).replace("\n", "<br/>")
    return "".join(parts)


def iter_blocks(document: Document):
    for child in document.element.body.iterchildren():
        if child.tag == qn("w:p"):
            yield "P", DocxParagraph(child, document)
        elif child.tag == qn("w:tbl"):
            yield "T", DocxTable(child, document)


def paragraph_has_page_break(paragraph: DocxParagraph) -> bool:
    xml = paragraph._p.xml
    # Only honour authored page breaks. ``w:lastRenderedPageBreak`` records where
    # Word happened to paginate the source layout; treating it as an instruction
    # creates empty and near-empty pages when the content is recomposed here.
    return 'w:br w:type="page"' in xml


def paragraph_page_before(paragraph: DocxParagraph) -> bool:
    return "w:pageBreakBefore" in paragraph._p.xml


def image_relationships(paragraph: DocxParagraph) -> list[str]:
    ids: list[str] = []
    for blip in paragraph._p.xpath(".//a:blip"):
        rel_id = blip.get(qn("r:embed"))
        if rel_id:
            ids.append(rel_id)
    return ids


def extract_embedded_images(document: Document) -> dict[str, Path]:
    EXTRACTED.mkdir(parents=True, exist_ok=True)
    paths: dict[str, Path] = {}
    for rel_id, part in document.part.related_parts.items():
        if not getattr(part, "content_type", "").startswith("image/"):
            continue
        suffix = Path(str(part.partname)).suffix or ".png"
        output = EXTRACTED / f"{rel_id}{suffix}"
        output.write_bytes(part.blob)
        paths[rel_id] = output
    return paths


def image_size(path: Path, max_w: float, max_h: float) -> tuple[float, float]:
    with PILImage.open(path) as image:
        width, height = image.size
    scale = min(max_w / width, max_h / height)
    return width * scale, height * scale


def draw_spaced_text(canvas, text: str, x: float, y: float, font: str, size: float, tracking: float, color) -> None:
    canvas.saveState()
    canvas.setFont(font, size)
    canvas.setFillColor(color)
    widths = [pdfmetrics.stringWidth(char, font, size) for char in text]
    total = sum(widths) + tracking * max(0, len(text) - 1)
    cursor = x - total / 2
    for char, width in zip(text, widths):
        canvas.drawString(cursor, y, char)
        cursor += width + tracking
    canvas.restoreState()


def draw_paragraph(canvas, markup: str, style: ParagraphStyle, x: float, y_top: float, width: float) -> float:
    paragraph = Paragraph(markup, style)
    _, height = paragraph.wrap(width, PAGE_H)
    paragraph.drawOn(canvas, x, y_top - height)
    return height


def raster_dimensions(path: Path) -> tuple[int, int]:
    if path not in RASTER_DIMS:
        with PILImage.open(path) as image:
            RASTER_DIMS[path] = image.size
    return RASTER_DIMS[path]


def draw_cropped_raster(
    canvas,
    path: Path,
    source_box: tuple[float, float, float, float],
    destination_box: tuple[float, float, float, float],
    alpha: float = 1.0,
) -> None:
    """Draw a source crop into a destination rectangle without making a derivative asset."""
    source_width, source_height = raster_dimensions(path)
    sx0, sy0, sx1, sy1 = source_box
    dx, dy, dw, dh = destination_box
    scale_x = dw / (sx1 - sx0)
    scale_y = dh / (sy1 - sy0)
    full_x = dx - sx0 * scale_x
    full_y = dy + dh - (source_height - sy0) * scale_y

    canvas.saveState()
    clip = canvas.beginPath()
    clip.rect(dx, dy, dw, dh)
    canvas.clipPath(clip, stroke=0, fill=0)
    canvas.setFillAlpha(alpha)
    canvas.drawImage(
        str(path),
        full_x,
        full_y,
        source_width * scale_x,
        source_height * scale_y,
        preserveAspectRatio=False,
        mask="auto",
    )
    canvas.restoreState()


def draw_cut_corner_frame(canvas, inset: float, color, line_width: float, alpha: float = 1.0) -> None:
    cut = 4.2 * mm
    path = canvas.beginPath()
    path.moveTo(inset + cut, inset)
    path.lineTo(PAGE_W - inset - cut, inset)
    path.lineTo(PAGE_W - inset, inset + cut)
    path.lineTo(PAGE_W - inset, PAGE_H - inset - cut)
    path.lineTo(PAGE_W - inset - cut, PAGE_H - inset)
    path.lineTo(inset + cut, PAGE_H - inset)
    path.lineTo(inset, PAGE_H - inset - cut)
    path.lineTo(inset, inset + cut)
    path.close()
    canvas.saveState()
    canvas.setStrokeAlpha(alpha)
    canvas.setStrokeColor(color)
    canvas.setLineWidth(line_width)
    canvas.drawPath(path, stroke=1, fill=0)
    canvas.restoreState()


def draw_map_wash(canvas, alpha: float = 0.045, y_shift: float = 0) -> None:
    map_width, map_height = raster_dimensions(MAP)
    draw_height = PAGE_H * 1.04
    draw_width = draw_height * map_width / map_height
    draw_x = (PAGE_W - draw_width) / 2
    canvas.saveState()
    canvas.setFillAlpha(alpha)
    canvas.drawImage(
        str(MAP),
        draw_x,
        -0.02 * PAGE_H + y_shift,
        draw_width,
        draw_height,
        preserveAspectRatio=True,
        anchor="c",
        mask="auto",
    )
    canvas.restoreState()


def prepare_encounter_corner_assets() -> None:
    """Extract one approved Encounter-card corner and mirror it exactly.

    Only the dark printed linework is retained; the parchment and colour wash
    become transparent. Using a single source for both sides guarantees that
    the ornaments match while avoiding the rectangular crop edges seen in the
    earlier proof.
    """
    CORNER_LEFT.parent.mkdir(parents=True, exist_ok=True)
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


def prepare_encounter_divider_assets() -> None:
    """Extract the exact central line flourish from the Encounter Card art.

    The source crop includes the flourish and its short horizontal tails. The
    parchment is removed so the original printed linework can sit directly on
    the rulebook's brass divider lines without a rectangular raster edge.
    """
    DIVIDER_FLOURISH_BRASS.parent.mkdir(parents=True, exist_ok=True)
    source = PILImage.open(BURDEN_ART).convert("RGB").crop((800, 715, 1000, 785))
    grayscale = ImageOps.grayscale(source)
    local_background = grayscale.filter(ImageFilter.GaussianBlur(9))
    dark_linework = ImageChops.subtract(local_background, grayscale)
    alpha = dark_linework.point(lambda value: max(0, min(255, (value - 5) * 9)))
    alpha = alpha.filter(ImageFilter.MaxFilter(3))
    clean_alpha = PILImage.new("L", alpha.size, 0)
    clean_alpha.paste(alpha.crop((0, 16, alpha.width, 52)), (0, 16))
    alpha = clean_alpha

    for path, rgb in (
        (DIVIDER_FLOURISH_BRASS, (167, 131, 67)),
        (DIVIDER_FLOURISH_LIGHT, (217, 196, 142)),
    ):
        flourish = PILImage.new("RGBA", source.size, (*rgb, 0))
        flourish.putalpha(alpha)
        flourish.save(path)


def draw_page_corner_flourishes(canvas) -> None:
    """Frame every body page with the complete approved corner motif."""
    inset = 5.8 * mm
    width = 13.5 * mm
    source_width, source_height = raster_dimensions(CORNER_LEFT)
    height = width * source_height / source_width
    top_y = PAGE_H - inset - height
    bottom_y = inset
    canvas.saveState()
    canvas.setFillAlpha(0.60)
    canvas.drawImage(str(CORNER_LEFT), inset, top_y, width, height, preserveAspectRatio=True, mask="auto")
    canvas.drawImage(str(CORNER_RIGHT), PAGE_W - inset - width, top_y, width, height, preserveAspectRatio=True, mask="auto")
    canvas.drawImage(str(CORNER_BOTTOM_LEFT), inset, bottom_y, width, height, preserveAspectRatio=True, mask="auto")
    canvas.drawImage(str(CORNER_BOTTOM_RIGHT), PAGE_W - inset - width, bottom_y, width, height, preserveAspectRatio=True, mask="auto")
    canvas.restoreState()


def draw_encounter_divider_rule(
    canvas,
    x0: float,
    x1: float,
    y: float,
    color=BRASS,
    alpha: float = 0.58,
    line_width: float = 0.3,
) -> None:
    """Fine divider using the exact central flourish from the Encounter Cards."""
    if x1 <= x0:
        return
    centre = (x0 + x1) / 2
    flourish_width = min(8.2 * mm, (x1 - x0) * 0.32)
    source_path = DIVIDER_FLOURISH_LIGHT if color == BRASS_LIGHT else DIVIDER_FLOURISH_BRASS
    source_width, source_height = raster_dimensions(source_path)
    flourish_height = flourish_width * source_height / source_width
    flourish_left = centre - flourish_width / 2
    flourish_right = centre + flourish_width / 2
    canvas.saveState()
    canvas.setStrokeAlpha(alpha)
    canvas.setStrokeColor(color)
    canvas.setLineWidth(line_width)
    canvas.setLineCap(1)
    canvas.line(x0, y, flourish_left, y)
    canvas.line(flourish_right, y, x1, y)
    canvas.setFillAlpha(alpha)
    canvas.drawImage(
        str(source_path),
        flourish_left,
        y - flourish_height / 2,
        flourish_width,
        flourish_height,
        preserveAspectRatio=True,
        mask="auto",
    )
    canvas.restoreState()


def draw_spare_space_vignette(canvas, page: int) -> None:
    """Use sanctioned map/tree art to compose known quiet page endings."""
    if page == 12:
        draw_cropped_raster(
            canvas,
            MAP,
            (0, 420, 3200, 2020),
            (15 * mm, 14 * mm, PAGE_W - 30 * mm, 82.5 * mm),
            alpha=0.052,
        )
    elif page in {3, 5, 21}:
        draw_cropped_raster(
            canvas,
            MAP,
            (0, 700, 3200, 1767),
            (15 * mm, 14 * mm, PAGE_W - 30 * mm, 55 * mm),
            alpha=0.048,
        )
    elif page == 22 and TREE.exists():
        canvas.saveState()
        canvas.setFillAlpha(0.14)
        canvas.drawImage(
            str(TREE),
            PAGE_W / 2 - 20 * mm,
            24 * mm,
            40 * mm,
            58 * mm,
            preserveAspectRatio=True,
            anchor="c",
            mask="auto",
        )
        canvas.restoreState()


def draw_card_icon(canvas, path: Path, destination_box: tuple[float, float, float, float], alpha: float = 0.9) -> None:
    if path == BOON_ART:
        crop = (330, 85, 570, 335)
    elif path == BURDEN_ART:
        crop = (690, 205, 1110, 710)
    elif path == ARRIVAL_ART:
        crop = (640, 180, 1160, 735)
    else:
        crop = (300, 70, 600, 365)
    dx, dy, dw, dh = destination_box
    cut = min(dw, dh) * 0.22
    medallion = canvas.beginPath()
    medallion.moveTo(dx + cut, dy)
    medallion.lineTo(dx + dw - cut, dy)
    medallion.lineTo(dx + dw, dy + cut)
    medallion.lineTo(dx + dw, dy + dh - cut)
    medallion.lineTo(dx + dw - cut, dy + dh)
    medallion.lineTo(dx + cut, dy + dh)
    medallion.lineTo(dx, dy + dh - cut)
    medallion.lineTo(dx, dy + cut)
    medallion.close()
    canvas.saveState()
    canvas.clipPath(medallion, stroke=0, fill=0)
    draw_cropped_raster(canvas, path, crop, destination_box, alpha=alpha)
    canvas.restoreState()
    canvas.setStrokeColor(BRASS)
    canvas.setLineWidth(0.35)
    canvas.drawPath(medallion, stroke=1, fill=0)


def draw_golden_compass(canvas, centre_x: float, centre_y: float, diameter: float) -> None:
    """Use only the approved compass artwork through its natural bevel edge."""
    radius = diameter / 2
    kappa = radius * 0.5522847498
    clip = canvas.beginPath()
    clip.moveTo(centre_x + radius, centre_y)
    clip.curveTo(centre_x + radius, centre_y + kappa, centre_x + kappa, centre_y + radius, centre_x, centre_y + radius)
    clip.curveTo(centre_x - kappa, centre_y + radius, centre_x - radius, centre_y + kappa, centre_x - radius, centre_y)
    clip.curveTo(centre_x - radius, centre_y - kappa, centre_x - kappa, centre_y - radius, centre_x, centre_y - radius)
    clip.curveTo(centre_x + kappa, centre_y - radius, centre_x + radius, centre_y - kappa, centre_x + radius, centre_y)
    clip.close()

    canvas.saveState()
    canvas.clipPath(clip, stroke=0, fill=0)
    draw_cropped_raster(
        canvas,
        GOLDEN_ART,
        (346, 101, 554, 309),
        (centre_x - radius, centre_y - radius, diameter, diameter),
        alpha=1,
    )
    canvas.restoreState()


def cover_on_page(canvas, doc) -> None:
    canvas.saveState()
    canvas.setTitle("The Quiet Vale - Main Rulebook v6.8")
    canvas.setSubject("Polished reading edition with current artist tiles and numbered Arrival cards")
    canvas.setFillColor(COVER_BLACK)
    canvas.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    draw_cut_corner_frame(canvas, 7 * mm, BRASS_LIGHT, 0.8, 0.95)
    draw_cut_corner_frame(canvas, 9 * mm, BRASS_LIGHT, 0.35, 0.65)

    draw_spaced_text(canvas, "THE QUIET VALE", PAGE_W / 2, PAGE_H - 35 * mm, "QVGill-Light", 24, 1.6, WHITE)
    canvas.setFont("QVCharter-Italic", 11)
    canvas.setFillColor(BRASS_LIGHT)
    canvas.drawCentredString(PAGE_W / 2, PAGE_H - 45 * mm, "Seasons of Settlement")
    canvas.setFont("QVGill-Bold", 8)
    canvas.setFillColor(WHITE)
    canvas.drawCentredString(PAGE_W / 2, PAGE_H - 58 * mm, "MAIN RULEBOOK")
    draw_encounter_divider_rule(canvas, 61 * mm, PAGE_W - 61 * mm, PAGE_H - 66 * mm, color=BRASS_LIGHT, alpha=0.72, line_width=0.42)

    draw_golden_compass(canvas, PAGE_W / 2, PAGE_H / 2 + 3 * mm, 68 * mm)

    canvas.setFont("QVGill-Bold", 7.5)
    canvas.setFillColor(BRASS_LIGHT)
    canvas.drawCentredString(PAGE_W / 2, 67 * mm, "A GAME OF STEWARDSHIP AND RENEWAL")
    draw_encounter_divider_rule(canvas, 56 * mm, PAGE_W - 56 * mm, 59 * mm, color=BRASS_LIGHT, alpha=0.60, line_width=0.35)
    canvas.setFont("QVGill", 7.2)
    canvas.setFillColor(MIST_LIGHT)
    canvas.drawCentredString(PAGE_W / 2, 49 * mm, "1-5 players  ·  45-150 minutes  ·  Cooperative")
    canvas.restoreState()


def body_on_page(canvas, doc) -> None:
    page = canvas.getPageNumber()
    canvas.saveState()
    canvas.setFillColor(PARCHMENT)
    canvas.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    draw_map_wash(canvas, alpha=0.027, y_shift=(page % 3 - 1) * 5 * mm)
    draw_spare_space_vignette(canvas, page)
    draw_page_corner_flourishes(canvas)
    draw_encounter_divider_rule(canvas, PAGE_W / 2 - 18 * mm, PAGE_W / 2 + 18 * mm, PAGE_H - 10.9 * mm, alpha=0.48, line_width=0.27)

    folio_x = PAGE_W / 2
    canvas.setFont("QVGill-Bold", 7.4)
    canvas.setFillColor(FOREST_DARK)
    canvas.drawCentredString(folio_x, 5.7 * mm, str(page))
    canvas.setStrokeColor(BRASS)
    canvas.setLineWidth(0.45)
    canvas.line(folio_x - 4.2 * mm, 8.2 * mm, folio_x + 4.2 * mm, 8.2 * mm)
    canvas.restoreState()


def back_cover_on_page(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFillColor(COVER_BLACK)
    canvas.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    draw_cut_corner_frame(canvas, 7 * mm, BRASS_LIGHT, 0.8, 0.9)
    draw_cut_corner_frame(canvas, 9 * mm, BRASS_LIGHT, 0.35, 0.6)
    if TREE.exists():
        canvas.drawImage(str(TREE), PAGE_W / 2 - 24 * mm, PAGE_H - 116 * mm, 48 * mm, 90 * mm, preserveAspectRatio=True, mask="auto")
    draw_spaced_text(canvas, "THE QUIET VALE", PAGE_W / 2, PAGE_H - 132 * mm, "QVGill-Light", 18, 1.2, WHITE)
    canvas.setFont("QVCharter-Italic", 9)
    canvas.setFillColor(BRASS_LIGHT)
    canvas.drawCentredString(PAGE_W / 2, PAGE_H - 143 * mm, "A shared settlement. A changing Vale. One story built together.")
    draw_encounter_divider_rule(canvas, 55 * mm, PAGE_W - 55 * mm, PAGE_H - 154 * mm, color=BRASS_LIGHT, alpha=0.60, line_width=0.35)
    canvas.restoreState()


class SectionHeader(Flowable):
    def __init__(self, title: str, include_in_toc: bool = True):
        super().__init__()
        self.title = transform_text(title)
        self.include_in_toc = include_in_toc
        self._section_title = self.title
        self.width = BODY_W
        self.height = 18 * mm

    def wrap(self, availWidth, availHeight):
        self.width = availWidth
        return availWidth, self.height

    def draw(self):
        canvas = self.canv
        number_match = re.match(r"^(\d+)\.\s*(.+)$", self.title)
        canvas.saveState()
        # One soft, irregular wash carries section identity. The cards' divider
        # motif supplies the only linework; there is no enclosing banner frame.
        swash = canvas.beginPath()
        swash.moveTo(0, 3.0 * mm)
        swash.curveTo(13 * mm, 1.8 * mm, 29 * mm, 2.6 * mm, 44 * mm, 2.2 * mm)
        swash.curveTo(self.width * 0.47, 1.5 * mm, self.width * 0.73, 2.8 * mm, self.width, 2.0 * mm)
        swash.lineTo(self.width, self.height - 4.0 * mm)
        swash.curveTo(self.width * 0.80, self.height - 2.6 * mm, self.width * 0.61, self.height - 3.8 * mm, self.width * 0.42, self.height - 3.1 * mm)
        swash.curveTo(30 * mm, self.height - 2.4 * mm, 13 * mm, self.height - 3.7 * mm, 0, self.height - 2.8 * mm)
        swash.close()
        canvas.setFillAlpha(0.54)
        canvas.setFillColor(MIST_LIGHT)
        canvas.drawPath(swash, stroke=0, fill=1)
        canvas.setFillAlpha(1)
        canvas.saveState()
        canvas.clipPath(swash, stroke=0, fill=0)
        draw_cropped_raster(canvas, MAP, (430, 250, 2770, 1040), (0, 1.4 * mm, self.width, self.height - 2.6 * mm), alpha=0.042)
        canvas.restoreState()
        has_encounter_icons = self.title.startswith("8.")
        has_golden_icon = self.title.startswith("16.")
        if number_match:
            number, label = number_match.groups()
            text_x = 3.2 * mm
            kicker = f"SECTION {number}"
        else:
            label = self.title
            text_x = 3.2 * mm
            kicker = "RULEBOOK"
        canvas.setFont("QVGill-Bold", 5.8)
        canvas.setFillColor(BRASS)
        canvas.drawString(text_x, self.height - 5.6 * mm, kicker)
        icon_reserve = 29 * mm if has_encounter_icons else (11 * mm if has_golden_icon else 6 * mm)
        label_p = Paragraph(
            escape(label.upper()),
            ParagraphStyle(
                "SectionLabel",
                fontName="QVGill-Light",
                fontSize=14.2 if number_match else 12.6,
                leading=14.6,
                textColor=FOREST_DARK,
            ),
        )
        label_p.wrapOn(canvas, self.width - text_x - icon_reserve, 8 * mm)
        label_p.drawOn(canvas, text_x, 3.1 * mm)
        draw_encounter_divider_rule(canvas, 0, self.width, 1.65 * mm, alpha=0.60, line_width=0.30)
        if has_encounter_icons:
            icon_paths = (BOON_ART, BURDEN_ART, ARRIVAL_ART, GOLDEN_ART)
            icon_w = 5.0 * mm
            gap = 0.9 * mm
            start_x = self.width - 4 * icon_w - 3 * gap - 2.5 * mm
            for index, icon_path in enumerate(icon_paths):
                draw_card_icon(canvas, icon_path, (start_x + index * (icon_w + gap), 5.2 * mm, icon_w, 6.2 * mm), alpha=0.82)
        elif has_golden_icon:
            draw_card_icon(canvas, GOLDEN_ART, (self.width - 9.2 * mm, 5.0 * mm, 6.7 * mm, 7.2 * mm), alpha=0.9)
        canvas.restoreState()


class NumberedStep(Flowable):
    def __init__(self, number: str, markup: str):
        super().__init__()
        self.number = number
        self.paragraph = Paragraph(markup, BODY)
        self.height = 0
        self.width = 0

    def wrap(self, availWidth, availHeight):
        self.width = availWidth
        self.tab_w = 15 * mm if len(self.number) <= 3 else (18 * mm if len(self.number) <= 5 else 22 * mm)
        self.text_x = self.tab_w + 4 * mm
        _, ph = self.paragraph.wrap(availWidth - self.text_x, availHeight)
        self.height = max(9 * mm, ph + 2.5 * mm)
        return availWidth, self.height

    def draw(self):
        canvas = self.canv
        tab_h = 6.8 * mm
        cut = 1.25 * mm
        y = self.height - tab_h - 0.5 * mm
        tab = canvas.beginPath()
        tab.moveTo(cut, y)
        tab.lineTo(self.tab_w - cut, y)
        tab.lineTo(self.tab_w, y + cut)
        tab.lineTo(self.tab_w, y + tab_h - cut)
        tab.lineTo(self.tab_w - cut, y + tab_h)
        tab.lineTo(cut, y + tab_h)
        tab.lineTo(0, y + tab_h - cut)
        tab.lineTo(0, y + cut)
        tab.close()
        canvas.saveState()
        canvas.setFillColor(FOREST_MUTED_FILL)
        canvas.setStrokeColor(BRASS)
        canvas.setLineWidth(0.45)
        canvas.drawPath(tab, stroke=1, fill=1)
        canvas.setFont("QVGill-Bold", 7)
        canvas.setFillColor(WHITE)
        canvas.drawCentredString(self.tab_w / 2, y + 2.1 * mm, self.number)
        _, ph = self.paragraph.wrap(self.width - self.text_x, self.height)
        self.paragraph.drawOn(canvas, self.text_x, self.height - ph - 0.8 * mm)
        canvas.restoreState()


class ImagePlate(Flowable):
    def __init__(self, path: Path, rel_id: str, label: str, title: str, max_height: float = 78 * mm):
        super().__init__()
        self.path = path
        self.rel_id = rel_id
        self.label = label
        self.title = title
        self.max_height = max_height
        self.keepWithNext = rel_id == "rId47"
        self.draw_w = 0
        self.draw_h = 0
        self.width = 0
        self.height = 0

    def wrap(self, availWidth, availHeight):
        self.width = availWidth
        label_h = 8 * mm
        # Use the visual's intended readable size. If it cannot fit in the
        # remaining space, ReportLab moves the whole plate to the next page
        # instead of shrinking it into an illegible thumbnail.
        self.draw_w, self.draw_h = image_size(
            self.path,
            availWidth - 5 * mm,
            self.max_height,
        )
        self.height = self.draw_h + label_h + 2.5 * mm
        return availWidth, self.height

    def draw(self):
        canvas = self.canv
        x = (self.width - self.draw_w) / 2
        y = 1.8 * mm
        canvas.saveState()
        canvas.drawImage(str(self.path), x, y, self.draw_w, self.draw_h, preserveAspectRatio=True, anchor="c", mask="auto")
        if self.rel_id == "rId29":
            # The inherited setup diagram predates the structured 30-card Target
            # Deck. Correct only those two stale count labels with live vector
            # type; the rest of the sanctioned diagram remains untouched.
            source_w = 1800.0
            source_h = 850.0
            scale_x = self.draw_w / source_w
            scale_y = self.draw_h / source_h

            def overlay_text(px: float, py_top: float, pw: float, ph: float, fill, markup: str, style: ParagraphStyle) -> None:
                ox = x + px * scale_x
                oy = y + self.draw_h - (py_top + ph) * scale_y
                ow = pw * scale_x
                oh = ph * scale_y
                canvas.setFillColor(fill)
                canvas.rect(ox, oy, ow, oh, stroke=0, fill=1)
                paragraph = Paragraph(markup, style)
                _, paragraph_h = paragraph.wrap(ow - 3 * mm, oh)
                paragraph.drawOn(canvas, ox + 1.5 * mm, oy + (oh - paragraph_h) / 2)

            overlay_text(
                84,
                616,
                292,
                100,
                HexColor("#ECE6D5"),
                "Shuffle the 30 Target Cards. Each player chooses one Steward, takes its Steward Aid and Steward Token, then places the Token on matching Starting Terrain.",
                ParagraphStyle("SetupCountLeft", fontName="QVGill", fontSize=4.45, leading=5.05, textColor=INK),
            )
            overlay_text(
                1418,
                515,
                308,
                48,
                HexColor("#F1EBDD"),
                "30 cards  ·  shuffle once  ·  face down",
                ParagraphStyle("SetupCountRight", fontName="QVGill", fontSize=4.6, leading=5.2, textColor=INK, alignment=TA_CENTER),
            )
        label_y = self.height - 4.6 * mm
        canvas.setStrokeColor(BRASS)
        canvas.setLineWidth(0.9)
        canvas.line(0, label_y - 0.4 * mm, 3.0 * mm, label_y - 0.4 * mm)
        caption = Paragraph(
            f"<b>{escape(self.title)}</b>",
            ParagraphStyle(
                "ImagePlateLabel",
                fontName="QVGill",
                fontSize=6.6,
                leading=7.4,
                textColor=BRASS,
                spaceAfter=0,
            ),
        )
        caption.wrapOn(canvas, self.width - 4 * mm, 7 * mm)
        caption.drawOn(canvas, 3.5 * mm, self.height - 6.4 * mm)
        canvas.restoreState()


class PlaceholderBox(Flowable):
    def __init__(self, title: str, brief: str, height: float = 44 * mm):
        super().__init__()
        self.title = ascii_dashes(title)
        self.brief = ascii_dashes(brief)
        self.height = height
        self.width = 0

    def wrap(self, availWidth, availHeight):
        self.width = availWidth
        return availWidth, self.height

    def draw(self):
        canvas = self.canv
        canvas.saveState()
        canvas.setFillAlpha(0.64)
        canvas.setFillColor(ROSE_LIGHT)
        canvas.rect(0, 0, self.width, self.height, stroke=0, fill=1)
        canvas.setFillAlpha(1)
        canvas.setFillColor(ROSE)
        canvas.rect(0, 0, 1.6 * mm, self.height, stroke=0, fill=1)
        icon_x = 14 * mm
        icon_y = self.height / 2
        canvas.setStrokeColor(ROSE)
        canvas.setStrokeAlpha(0.82)
        canvas.setLineWidth(0.75)
        canvas.rect(icon_x - 6 * mm, icon_y - 5 * mm, 12 * mm, 10 * mm, stroke=1, fill=0)
        canvas.circle(icon_x, icon_y, 2.7 * mm, stroke=1, fill=0)
        canvas.line(icon_x - 4.5 * mm, icon_y + 6 * mm, icon_x + 4.5 * mm, icon_y + 6 * mm)
        canvas.setStrokeAlpha(1)
        text_x = 27 * mm
        text_w = self.width - 34 * mm
        label_p = Paragraph("<b>ART / PHOTO PLACEHOLDER</b>", ParagraphStyle("PlaceholderLabel", parent=PLACEHOLDER_TEXT, fontName="QVGill-Bold", fontSize=7.3, leading=8.4, textColor=ROSE))
        title_p = Paragraph(f"<b>{escape(self.title)}</b>", ParagraphStyle("PlaceholderTitle", parent=PLACEHOLDER_TEXT, fontSize=9.0, leading=10.6, textColor=FOREST_DARK))
        brief_p = Paragraph(escape(self.brief), PLACEHOLDER_TEXT)
        _, label_h = label_p.wrap(text_w, 10 * mm)
        _, title_h = title_p.wrap(text_w, 16 * mm)
        _, brief_h = brief_p.wrap(text_w, max(12 * mm, self.height - 20 * mm))
        total_h = label_h + title_h + brief_h + 5.2 * mm
        cursor_y = min(self.height - 6 * mm, (self.height + total_h) / 2)
        label_p.drawOn(canvas, text_x, cursor_y - label_h)
        cursor_y -= label_h + 2.0 * mm
        title_p.drawOn(canvas, text_x, cursor_y - title_h)
        cursor_y -= title_h + 3.2 * mm
        brief_p.drawOn(canvas, text_x, cursor_y - brief_h)
        canvas.restoreState()


class ThematicFlavorBox(Flowable):
    """A distinct, non-rules frame for verbatim locked thematic copy."""

    def __init__(self, passages: str | list[str], source: str):
        super().__init__()
        if isinstance(passages, str):
            passages = [passages]
        self.passages = [ascii_dashes(value) for value in passages]
        self.source = ascii_dashes(source.upper())
        body_markup = "<br/><br/>".join(escape(value) for value in self.passages)
        self.source_paragraph = Paragraph(
            escape(self.source),
            ParagraphStyle(
                "ThematicFlavorSource",
                fontName="QVGill-Bold",
                fontSize=5.9,
                leading=6.8,
                textColor=BRASS,
                spaceAfter=0,
            ),
        )
        self.body_paragraph = Paragraph(
            body_markup,
            ParagraphStyle(
                "ThematicFlavorBody",
                fontName="QVCharter-Italic",
                fontSize=8.25,
                leading=10.35,
                textColor=FOREST_DARK,
                spaceAfter=0,
                allowWidows=0,
                allowOrphans=0,
            ),
        )
        self.width = 0
        self.height = 0

    def wrap(self, availWidth, availHeight):
        self.width = availWidth
        self.inner_width = availWidth - 11 * mm
        _, self.source_height = self.source_paragraph.wrap(self.inner_width, availHeight)
        _, self.body_height = self.body_paragraph.wrap(self.inner_width, availHeight)
        self.height = 9.7 * mm + self.source_height + self.body_height
        return availWidth, self.height

    def draw(self):
        canvas = self.canv
        cut = 2.4 * mm
        inset = 0.35 * mm
        top = self.height - inset
        right = self.width - inset
        wash = HexColor("#EFE6D0")
        frame = canvas.beginPath()
        frame.moveTo(inset + cut, inset)
        frame.lineTo(right - cut, inset)
        frame.lineTo(right, inset + cut)
        frame.lineTo(right, top - cut)
        frame.lineTo(right - cut, top)
        frame.lineTo(inset + cut, top)
        frame.lineTo(inset, top - cut)
        frame.lineTo(inset, inset + cut)
        frame.close()

        canvas.saveState()
        canvas.setFillAlpha(0.78)
        canvas.setFillColor(wash)
        canvas.setStrokeAlpha(0.78)
        canvas.setStrokeColor(BRASS)
        canvas.setLineWidth(0.55)
        canvas.drawPath(frame, stroke=1, fill=1)
        canvas.setFillAlpha(1)
        canvas.setStrokeAlpha(1)

        # Let the Encounter-card divider flourish interrupt the upper border cleanly.
        gap = 10.5 * mm
        canvas.setFillColor(wash)
        canvas.rect(self.width / 2 - gap, top - 0.8 * mm, 2 * gap, 1.6 * mm, stroke=0, fill=1)
        draw_encounter_divider_rule(
            canvas,
            self.width / 2 - gap,
            self.width / 2 + gap,
            top,
            color=BRASS,
            alpha=0.86,
            line_width=0.38,
        )

        text_x = 5.5 * mm
        source_y = self.height - 5.2 * mm - self.source_height
        self.source_paragraph.drawOn(canvas, text_x, source_y)
        body_y = source_y - 1.3 * mm - self.body_height
        self.body_paragraph.drawOn(canvas, text_x, body_y)
        canvas.restoreState()


def callout_style(label: str) -> tuple[colors.Color, colors.Color, colors.Color]:
    upper = label.upper()
    if any(key in upper for key in ("IMPORTANT", "FIRST PLACEMENT", "FIRST GAME", "BEFORE YOUR FIRST GAME", "WHEN A RULE")):
        return ROSE_LIGHT, ROSE, FOREST_DARK
    if any(key in upper for key in ("GOLDEN", "CURRENT MILESTONES", "FINAL SCORE")):
        return HexColor("#EEE3BE"), BRASS, FOREST_DARK
    if any(key in upper for key in ("EXAMPLE", "WHY", "FINISH", "CURRENT SEASON")):
        return MIST_LIGHT, MIST, FOREST_DARK
    return PARCHMENT_ALT, LINE, FOREST_DARK


def one_cell_callout(text: str) -> Table:
    value = transform_text(text)
    words = value.split()
    label = " ".join(words[: min(5, len(words))])
    fill, accent, ink = callout_style(label)
    paragraph = Paragraph(escape(value), ParagraphStyle("Callout", parent=BODY_SMALL, fontSize=7.5, leading=9.3, textColor=ink))
    table = Table([[paragraph]], colWidths=[BODY_W], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), fill),
                ("LINEBEFORE", (0, 0), (0, -1), 2.2, accent),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


def compact_reference_table(
    headers: tuple[str, ...],
    rows: list[tuple[str, ...]],
    widths: list[float] | None = None,
    font_size: float = 6.9,
) -> Table:
    if widths is None:
        widths = [BODY_W / len(headers)] * len(headers)
    header_style = ParagraphStyle(
        "CompactReferenceHeader",
        parent=CELL_HEADER,
        fontSize=6.6,
        leading=7.7,
    )
    body_style = ParagraphStyle(
        "CompactReferenceBody",
        parent=CELL,
        fontSize=font_size,
        leading=font_size + 1.35,
    )
    data: list[list[Paragraph]] = [
        [Paragraph(escape(value.upper()), header_style) for value in headers]
    ]
    for row in rows:
        data.append([Paragraph(value, body_style) for value in row])
    table = Table(data, colWidths=widths, repeatRows=1, splitByRow=1, hAlign="LEFT")
    commands = [
        ("BACKGROUND", (0, 0), (-1, 0), FOREST_MUTED_FILL),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("LINEBELOW", (0, 0), (-1, 0), 0.9, BRASS),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5.0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5.0),
        ("TOPPADDING", (0, 0), (-1, -1), 4.2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.2),
    ]
    for row_index in range(1, len(data)):
        commands.extend(
            [
                ("BACKGROUND", (0, row_index), (-1, row_index), PARCHMENT_ALT if row_index % 2 else PARCHMENT),
                ("LINEBELOW", (0, row_index), (-1, row_index), 0.24, LINE),
            ]
        )
    table.setStyle(TableStyle(commands))
    return table


def action_procedure(kind: str) -> list[Flowable]:
    if kind == "upgrade":
        steps = [
            ("5.6", "Choose a reachable, placed basic Core Tile that is not Overstrained."),
            ("5.7", "Spend 1 Action."),
            ("5.8", "Pay the resource cost printed for the upgraded side."),
            ("5.9", "Flip the same physical Tile, resolve any effect created by the upgrade, then move your Steward Token onto it."),
        ]
    elif kind == "activate":
        steps = [
            ("5.10", "Choose a reachable, non-Overstrained Tile with an Activated Effect."),
            ("5.11", "Spend 1 Action and pay any cost printed as part of that activation."),
            ("5.12", "Resolve the full effect. If it is Production, apply Linked Production when eligible."),
            ("5.13", "Move your Steward Token onto the activated Tile."),
        ]
    else:
        raise ValueError(f"Unknown Action procedure: {kind}")
    output: list[Flowable] = []
    for number, body in steps:
        output.extend([NumberedStep(number, escape(body)), Spacer(1, 1.0 * mm)])
    return output


def interact_procedure() -> list[Flowable]:
    return [
        Paragraph("Interact with an Encounter", H2),
        Paragraph(
            "Interact uses 1 Action and does not move your Steward Token. Choose one of the procedures below.",
            BODY,
        ),
        NumberedStep(
            "ARRIVAL",
            "Choose an active Arrival, meet and pay its printed Requirement, and spend 1 Action. Remove its timers and discard the card. Match its Reward number to the Special Tile back, then set that Tile beside the board for later placement.",
        ),
        Spacer(1, 1.0 * mm),
        NumberedStep(
            "BURDEN",
            "Choose an active Burden, spend 1 Action and perform its printed current-Season resolution, including any payment. Discard it. Strain already placed by that Burden remains.",
        ),
        Spacer(1, 1.0 * mm),
        NumberedStep(
            "EFFECT",
            "If another effect explicitly resolves a Burden, follow that effect's own cost and timing. Do not also perform the Burden's printed Interact resolution unless instructed.",
        ),
        Spacer(1, 2.2 * mm),
        one_cell_callout(
            "FREE EFFECTS Face-up Boons and Steward Powers cost no Actions unless their text says otherwise. A 0-Action benefit saves the Action only; pay the normal resource cost unless the effect also changes that cost."
        ),
    ]


def season_transition_checklist() -> Table:
    return compact_reference_table(
        ("Step", "After Rounds 4 and 8"),
        [
            ("1", "Finish every Arrival expiry."),
            ("2", "Discard unused face-up Boons whose duration ends with the Season."),
            ("3", "Resolve Neighbourly Support."),
            ("4", "Reapply every unresolved Burden using the new Season row."),
            ("5", "Refresh every Steward Power."),
            ("6", "Seed Encounters for the next Season."),
        ],
        [18 * mm, BODY_W - 18 * mm],
    )


def section_page(crossrefs: dict[str, int] | None, key: str) -> str:
    if not crossrefs or key not in crossrefs:
        return "page --"
    return f"page {crossrefs[key]}"


def special_number_lookup():
    from polish_reference import special_number_table
    return special_number_table(globals())


def quick_reference_supplement(crossrefs: dict[str, int] | None) -> list[Flowable]:
    lookup_rows = [
        ("Setup", section_page(crossrefs, "setup")),
        ("Round sequence", section_page(crossrefs, "round")),
        ("Four Actions", section_page(crossrefs, "actions")),
        ("Encounter Cards", section_page(crossrefs, "encounters")),
        ("Strain / Supported", section_page(crossrefs, "strain")),
        ("Target Deck", section_page(crossrefs, "target")),
        ("Season end", section_page(crossrefs, "season_end")),
        ("Final scoring", section_page(crossrefs, "scoring")),
    ]
    return [
        Paragraph("Season transition", H2),
        season_transition_checklist(),
        Spacer(1, 2.5 * mm),
        Paragraph("Key costs and limits", H2),
        compact_reference_table(
            ("Rule", "Remember"),
            [
                ("Warehouse", "Maximum 15 of each resource. Start with 15 / 10 / 5 / 0 / 0 of each resource at 1 / 2 / 3 / 4 / 5 players."),
                ("Special Tile", "After it is unlocked: spend 1 normal Place Action, follow its placement rule and pay 0 resources."),
                ("0 Actions", "Only the Action is waived. Pay the normal resource cost unless the effect also changes it."),
                ("Steward Token", "Place, Upgrade and Activate move it. Interact does not."),
                ("Arrival", "Enters with 3 timers; maximum 3. Remove 1 from every active Arrival at round end."),
                ("Target Card", "Start with the effect's eligible pool. Read top to bottom, resolve the target, then return the card face down to the deck bottom."),
            ],
            [35 * mm, BODY_W - 35 * mm],
            font_size=6.75,
        ),
        Spacer(1, 2.5 * mm),
        Paragraph("Where to look", H2),
        compact_reference_table(
            ("Topic", "Location"),
            lookup_rows,
            [BODY_W * 0.64, BODY_W * 0.36],
            font_size=6.7,
        ),
        Spacer(1, 4 * mm),
    ]


GLOSSARY_ADDITIONS: list[tuple[str, str]] = [
    ("Action", "One of the up to 4 normal activities a player may spend during their turn: Place, Upgrade, Activate or Interact."),
    ("Available Tile", "A Core Tile still in the shared supply, or an unlocked Special Tile ready to be placed."),
    ("Arrival", "A timed Encounter completed with an Interact Action to unlock its named Special Tile."),
    ("Boon", "A helpful Encounter resolved immediately or kept face up for its printed duration."),
    ("Burden", "An Encounter that applies its current-Season effect and remains active until resolved."),
    ("Core Tile", "A double-sided settlement Tile with a basic side and an upgraded reverse side."),
    ("Golden Tile", "Optional advanced content selected through the Steward's Ledger and placed during Golden setup."),
    ("Housing cluster", "A side-connected group of non-Overstrained Housing Tiles."),
    ("Linked Production", "The first eligible activation in an immediately adjacent set of copies from the same Resource Tile stack; it does not chain outward."),
    ("Pending effect", "A mandatory choice, payment, placement, Strain application, chain or other instruction already created but not yet completed."),
    ("Round", "Reveal Encounters, take one turn per player in the group-chosen order, then complete end-of-round upkeep."),
    ("Season", "Four rounds: Foundations 1-4, Growth 5-8 or Maturity 9-12."),
    ("Warehouse", "The shared resource supply, normally limited to 15 of each resource."),
    ("Water/River", "The map's water terrain. It blocks normal connection unless a Bridge or another rule allows the crossing."),
]


def combined_glossary(table: DocxTable, crossrefs: dict[str, int] | None) -> Table:
    rows: dict[str, tuple[str, str]] = {}
    for row in table.rows[1:]:
        term = transform_text(normalise_spaces(row.cells[0].text), crossrefs)
        meaning = transform_text(normalise_spaces(row.cells[1].text), crossrefs)
        if term:
            rows[term.casefold()] = (term, meaning)
    for term, meaning in GLOSSARY_ADDITIONS:
        rows.setdefault(term.casefold(), (term, meaning))
    ordered = sorted(rows.values(), key=lambda item: item[0].casefold())
    return compact_reference_table(
        ("Term", "Meaning"),
        [(escape(term), escape(meaning)) for term, meaning in ordered],
        [BODY_W * 0.28, BODY_W * 0.72],
        font_size=6.75,
    )


def column_widths(table: DocxTable) -> list[float]:
    cols = len(table.columns)
    if cols == 1:
        return [BODY_W]
    headers = [normalise_spaces(cell.text).lower() for cell in table.rows[0].cells]
    if cols == 2:
        left = headers[0] if headers else ""
        if left in {"component group", "term", "step", "phase", "timing", "source of supported", "target card rule"}:
            ratio = 0.28
        elif left in {"players"}:
            ratio = 0.23
        elif "golden tile" in left:
            ratio = 0.34 if headers[1] == 'final scoring condition' else 0.5
        else:
            ratio = 0.35
        return [BODY_W * ratio, BODY_W * (1 - ratio)]
    if cols == 3:
        if headers and headers[0] == "card":
            ratios = [0.145, 0.4275, 0.4275]
            return [BODY_W * ratio for ratio in ratios]
        return [BODY_W / 3] * 3
    if cols == 4 and headers[0] == "no.":
        return [9 * mm, BODY_W / 2 - 9 * mm, 9 * mm, BODY_W / 2 - 9 * mm]
    if cols == 4:
        if headers and headers[0] == "steward":
            ratios = [0.16, 0.15, 0.34, 0.35]
        else:
            ratios = [0.25] * 4
        return [BODY_W * ratio for ratio in ratios]
    return [BODY_W / cols] * cols


def scaled_rl_image(path: Path, max_w: float, max_h: float) -> Image:
    width, height = image_size(path, max_w, max_h)
    return Image(str(path), width=width, height=height)


def cell_contents(cell, rel_paths: dict[str, Path], width: float, header: bool, crossrefs: dict[str, int] | None) -> list[Flowable]:
    flowables: list[Flowable] = []
    for paragraph in cell.paragraphs:
        for rel_id in image_relationships(paragraph):
            path = rel_paths.get(rel_id)
            if path and path.exists():
                flowables.append(scaled_rl_image(path, width - 5 * mm, 43 * mm))
                flowables.append(Spacer(1, 1.5 * mm))
        markup = paragraph_markup(paragraph, crossrefs).strip()
        if markup:
            flowables.append(Paragraph(markup, CELL_HEADER if header else CELL))
    if not flowables:
        flowables.append(Paragraph("", CELL_HEADER if header else CELL))
    return flowables


def first_cell_image(cell, rel_paths: dict[str, Path]) -> Path | None:
    for paragraph in cell.paragraphs:
        for rel_id in image_relationships(paragraph):
            path = rel_paths.get(rel_id)
            if path and path.exists():
                return path
    return None


def strip_panel_title(value: str, title: str) -> str:
    clean = transform_text(normalise_spaces(value))
    if clean.upper().startswith(title.upper()):
        return clean[len(title):].strip()
    return clean


def encounter_card_gallery(table: DocxTable, rel_paths: dict[str, Path]) -> Table:
    titles = ("BOON", "BURDEN", "ARRIVAL", "GOLDEN BOON")
    fills = (HexColor("#F1E8CE"), HexColor("#E2E5E3"), HexColor("#E9E4ED"), HexColor("#F1E3B9"))
    panel_w = (BODY_W - 3.2 * mm) / 2
    panels: list[Table] = []
    cells = [table.cell(0, 0), table.cell(0, 1), table.cell(1, 0), table.cell(1, 1)]
    for cell, title, fill in zip(cells, titles, fills):
        path = first_cell_image(cell, rel_paths)
        if path is None:
            raise RuntimeError(f"Missing approved card image for {title}")
        card = scaled_rl_image(path, 31 * mm, 55 * mm)
        title_p = Paragraph(
            title,
            ParagraphStyle("CardGalleryTitle", fontName="QVGill-Bold", fontSize=8.2, leading=9.2, textColor=FOREST_DARK),
        )
        body_p = Paragraph(
            escape(strip_panel_title(cell.text, title)),
            ParagraphStyle("CardGalleryBody", parent=BODY_SMALL, fontSize=8.0, leading=10.0, spaceAfter=0),
        )
        panel = Table(
            [[card, [title_p, Spacer(1, 1.4 * mm), body_p]]],
            colWidths=[33.5 * mm, panel_w - 33.5 * mm],
            hAlign="LEFT",
        )
        panel.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), fill),
                    ("LINEABOVE", (0, 0), (-1, 0), 0.9, BRASS),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 5),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        panels.append(panel)
    output = Table(
        [[panels[0], "", panels[1]], ["", "", ""], [panels[2], "", panels[3]]],
        colWidths=[panel_w, 3.2 * mm, panel_w],
        rowHeights=[None, 3.2 * mm, None],
        hAlign="LEFT",
    )
    output.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    return output


def target_card_gallery(table: DocxTable, rel_paths: dict[str, Path]) -> Table:
    titles = ("STRUCTURED • CARD 05", "OPEN • CARD 25")
    fills = (MIST_LIGHT, PARCHMENT_ALT)
    panel_w = (BODY_W - 3.2 * mm) / 2
    panels: list[Table] = []
    for index, (title, fill) in enumerate(zip(titles, fills)):
        cell = table.cell(0, index)
        path = first_cell_image(cell, rel_paths)
        if path is None:
            raise RuntimeError(f"Missing approved Target Card image for {title}")
        card = scaled_rl_image(path, 31 * mm, 47 * mm)
        body = strip_panel_title(cell.text, title.replace(" - ", " • "))
        if body == transform_text(normalise_spaces(cell.text)):
            body = re.sub(r"^(STRUCTURED|OPEN)\s*[•\-]\s*CARD\s+\d+\s*", "", body, flags=re.I)
        title_p = Paragraph(title, ParagraphStyle("TargetGalleryTitle", fontName="QVGill-Bold", fontSize=7.7, leading=8.8, textColor=FOREST_DARK))
        body_p = Paragraph(escape(body), ParagraphStyle("TargetGalleryBody", parent=BODY_SMALL, fontSize=6.9, leading=8.35, spaceAfter=0))
        panel = Table([[card, [title_p, Spacer(1, 1.3 * mm), body_p]]], colWidths=[33.5 * mm, panel_w - 33.5 * mm], hAlign="LEFT")
        panel.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), fill), ("LINEABOVE", (0, 0), (-1, 0), 0.9, BRASS), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
        panels.append(panel)
    output = Table([[panels[0], "", panels[1]]], colWidths=[panel_w, 3.2 * mm, panel_w], hAlign="LEFT")
    output.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    return output


def game_at_glance_strip(table: DocxTable) -> Table:
    fills = (HexColor("#E8E2D2"), MIST_LIGHT, HexColor("#E6E9DE"))
    panel_w = (BODY_W - 6 * mm) / 3
    panels: list[Table] = []
    for index in range(3):
        heading = transform_text(normalise_spaces(table.cell(0, index).text))
        body = transform_text(normalise_spaces(table.cell(1, index).text))
        contents = [
            Paragraph(f"<font color='#A78343'><b>0{index + 1}</b></font>  <b>{escape(heading.upper())}</b>", ParagraphStyle("GlanceHeading", fontName="QVGill", fontSize=7.2, leading=8.5, textColor=FOREST_DARK)),
            Spacer(1, 1.5 * mm),
            Paragraph(escape(body), ParagraphStyle("GlanceBody", parent=BODY_SMALL, fontSize=6.9, leading=8.4, spaceAfter=0)),
        ]
        panel = Table(
            [[contents]],
            colWidths=[panel_w],
            rowHeights=[24 * mm],
            hAlign="LEFT",
        )
        panel.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), fills[index]), ("LINEABOVE", (0, 0), (-1, 0), 0.9, BRASS), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7)]))
        panels.append(panel)
    output = Table([[panels[0], "", panels[1], "", panels[2]]], colWidths=[panel_w, 3 * mm, panel_w, 3 * mm, panel_w], hAlign="LEFT")
    output.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    return output


class SeasonOverview(Flowable):
    """Welcome-page overview using three sectional map washes, not one watermark."""

    def __init__(self):
        super().__init__()
        self.width = BODY_W
        self.height = 66 * mm

    def wrap(self, availWidth, availHeight):
        self.width = availWidth
        return availWidth, self.height

    def draw(self):
        canvas = self.canv
        canvas.saveState()

        title = Paragraph("The Vale across three Seasons", H2)
        _, title_h = title.wrap(self.width, 10 * mm)
        title.drawOn(canvas, 0, self.height - title_h)

        intro = Paragraph(
            "Each Season lasts four rounds. Complete the Season transition after Rounds 4 and 8; after Round 12, proceed to final scoring.",
            ParagraphStyle("SeasonOverviewIntro", parent=BODY_SMALL, fontSize=7.15, leading=8.8, textColor=INK),
        )
        intro_top = self.height - title_h - 1.5 * mm
        _, intro_h = intro.wrap(self.width, 12 * mm)
        intro.drawOn(canvas, 0, intro_top - intro_h)

        panel_y = 1.0 * mm
        panel_top = intro_top - intro_h - 3.0 * mm
        panel_h = panel_top - panel_y
        gap = 4 * mm
        panel_w = (self.width - 2 * gap) / 3
        fills = (HexColor("#E8E2D2"), MIST_LIGHT, HexColor("#E6E9DE"))
        specs = (
            ("SEASON I", "FOUNDATIONS", "Rounds 1-4", "After Round 4", "Season transition", (0, 760, 1150, 1900)),
            ("SEASON II", "GROWTH", "Rounds 5-8", "After Round 8", "Season transition", (1025, 470, 2200, 1650)),
            ("SEASON III", "MATURITY", "Rounds 9-12", "After Round 12", "Final scoring", (2050, 310, 3200, 1500)),
        )

        for index, (kicker, name, rounds, timing, outcome, crop) in enumerate(specs):
            x = index * (panel_w + gap)
            cut = 2.5 * mm
            panel = canvas.beginPath()
            panel.moveTo(x + cut, panel_y)
            panel.lineTo(x + panel_w - cut, panel_y)
            panel.lineTo(x + panel_w, panel_y + cut)
            panel.lineTo(x + panel_w, panel_y + panel_h - cut)
            panel.lineTo(x + panel_w - cut, panel_y + panel_h)
            panel.lineTo(x + cut, panel_y + panel_h)
            panel.lineTo(x, panel_y + panel_h - cut)
            panel.lineTo(x, panel_y + cut)
            panel.close()

            canvas.setFillColor(fills[index])
            canvas.setFillAlpha(0.88)
            canvas.drawPath(panel, stroke=0, fill=1)
            canvas.setFillAlpha(1)
            canvas.saveState()
            canvas.clipPath(panel, stroke=0, fill=0)
            draw_cropped_raster(canvas, MAP, crop, (x, panel_y, panel_w, panel_h), alpha=0.075)
            canvas.restoreState()

            canvas.setStrokeColor(BRASS)
            canvas.setStrokeAlpha(0.78)
            canvas.setLineWidth(0.55)
            canvas.drawPath(panel, stroke=1, fill=0)
            canvas.setStrokeAlpha(1)
            canvas.line(x + 4 * mm, panel_y + panel_h - 7.2 * mm, x + panel_w - 4 * mm, panel_y + panel_h - 7.2 * mm)

            canvas.setFillColor(BRASS)
            canvas.setFont("QVGill-Bold", 6.0)
            canvas.drawString(x + 4 * mm, panel_y + panel_h - 5.4 * mm, kicker)
            canvas.setFillColor(FOREST_DARK)
            canvas.setFont("QVGill-Light", 10.7)
            canvas.drawString(x + 4 * mm, panel_y + panel_h - 12.3 * mm, name)
            canvas.setFont("QVCharter-Italic", 7.1)
            canvas.drawString(x + 4 * mm, panel_y + panel_h - 17.2 * mm, rounds)

            outcome_p = Paragraph(
                f"{escape(timing)}<br/><b>{escape(outcome)}</b>",
                ParagraphStyle(
                    "SeasonOverviewOutcome",
                    fontName="QVGill",
                    fontSize=6.7,
                    leading=8.0,
                    textColor=FOREST_DARK,
                    alignment=TA_LEFT,
                ),
            )
            _, outcome_h = outcome_p.wrap(panel_w - 8 * mm, 14 * mm)
            outcome_p.drawOn(canvas, x + 4 * mm, panel_y + 4 * mm)

        canvas.restoreState()


def styled_table(table: DocxTable, rel_paths: dict[str, Path], crossrefs: dict[str, int] | None) -> Flowable:
    if len(table.columns) == 2 and normalise_spaces(table.cell(0, 1).text) == "Final scoring condition":
        from polish_reference import golden_scoring_gallery
        return golden_scoring_gallery(table, globals())
    if len(table.columns) == 1:
        return one_cell_callout(table.cell(0, 0).text)
    widths = column_widths(table)
    first_header = normalise_spaces(table.cell(0, 0).text).lower()
    header_keys = {
        "component group", "players", "phase", "action", "timing",
        "source of supported", "steward", "step", "golden tile", "term",
        "1", "place", "select", "active burden", "card", "place on", "no.",
    }
    has_header = first_header in header_keys
    data: list[list[list[Flowable]]] = []
    for row_index, row in enumerate(table.rows):
        data.append(
            [
                cell_contents(cell, rel_paths, widths[col_index], has_header and row_index == 0, crossrefs)
                for col_index, cell in enumerate(row.cells)
            ]
        )
    if first_header == "component group":
        data.append(
            [
                [Paragraph("Golden Tiles", CELL)],
                [Paragraph("5 optional one-sided Golden Tiles unlocked through the Steward's Ledger.", CELL)],
            ]
        )
    output = Table(data, colWidths=widths, repeatRows=1 if has_header else 0, splitByRow=1, hAlign="LEFT")
    commands = [
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5.0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5.0),
        ("TOPPADDING", (0, 0), (-1, -1), 4.0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.0),
    ]
    if has_header:
        commands.extend([("BACKGROUND", (0, 0), (-1, 0), FOREST_MUTED_FILL), ("TEXTCOLOR", (0, 0), (-1, 0), WHITE), ("LINEBELOW", (0, 0), (-1, 0), 0.9, BRASS)])
    body_start = 1 if has_header else 0
    for row_index in range(body_start, len(data)):
        commands.append(("BACKGROUND", (0, row_index), (-1, row_index), PARCHMENT_ALT if (row_index - body_start) % 2 == 0 else PARCHMENT))
        commands.append(("LINEBELOW", (0, row_index), (-1, row_index), 0.24, LINE))
    output.setStyle(TableStyle(commands))
    return output


def target_rules_text() -> str:
    source = TARGET_TS.read_text(encoding="utf-8")
    match = re.search(r'export const targetCardRulesText\s*=\s*\n?\s*"([^"]+)";', source)
    if not match:
        raise RuntimeError("Could not read targetCardRulesText from structured data")
    return ascii_dashes(match.group(1))


def target_resolution_checklist() -> Table:
    """Lay out the locked Target Card rule as six scan-friendly microsteps."""
    return compact_reference_table(
        ("Step", "Resolve one Target Card"),
        [
            ("1", "Start with only the Tiles made eligible by the effect causing the Strain. Resolve any printed fallback first."),
            ("2", "Draw the top card for each different target, even if only 1 Tile is eligible. Multiple Strain on the same Tile uses 1 card."),
            ("3", "Read from top to bottom: Tile Class, Tile Side, Adjacency, then Current Strain."),
            ("4", "At each preference, keep the matches if at least 1 current candidate matches. Otherwise ignore that preference. Never restore a removed Tile. Any neither narrows nor widens the pool."),
            ("5", "If several Tiles remain, an Open card lets the players choose any remaining Tile; otherwise use the arrow. Use fixed map-coordinate order only for an exact directional tie."),
            ("6", "Return the card face down to the deck bottom. Then resolve Supported and other prevention. Prevented Strain is not redirected."),
        ],
        [14 * mm, BODY_W - 14 * mm],
        font_size=6.85,
    )


class QuietValeDocTemplate(BaseDocTemplate):
    def __init__(
        self,
        filename: Path,
        cover_callout_body: str,
        continuation_suppressed_pages: set[int] | None = None,
        **kwargs,
    ):
        super().__init__(str(filename), pagesize=(PAGE_W, PAGE_H), **kwargs)
        self.cover_callout_body = cover_callout_body
        self.section_pages: dict[str, int] = {}
        self.active_section = ""
        self.continuation_drawn_pages: set[int] = set()
        self.continuation_suppressed_pages = continuation_suppressed_pages or set()
        cover_frame = Frame(0, 0, PAGE_W, PAGE_H, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0, id="cover")
        body_frame = Frame(LEFT, BOTTOM, BODY_W, BODY_H, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0, id="body")
        back_frame = Frame(0, 0, PAGE_W, PAGE_H, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0, id="back")
        self.addPageTemplates(
            [
                PageTemplate(id="Cover", frames=[cover_frame], onPage=cover_on_page),
                PageTemplate(id="Body", frames=[body_frame], onPage=body_on_page),
                PageTemplate(id="BackCover", frames=[back_frame], onPage=back_cover_on_page),
            ]
        )

    def beforeDocument(self):
        """Reset pass-local running-head state before each multiBuild pass."""
        self.active_section = ""
        self.continuation_drawn_pages.clear()

    def afterFlowable(self, flowable):
        page = self.page
        if isinstance(flowable, SectionHeader):
            title = flowable.title
            self.active_section = title
            self.section_pages.setdefault(title, page)
            if flowable.include_in_toc and re.match(r"^\d+\.", title):
                key = "section-" + re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
                self.canv.bookmarkPage(key)
                self.canv.addOutlineEntry(title, key, level=0, closed=False)
                self.notify("TOCEntry", (0, title, page, key))

        # ReportLab inserts an internal LCActionFlowable at the start of a page.
        # It has no visible content, so letting it trigger the running head makes
        # section-opening pages inherit the previous page's label.
        internal_action = flowable.__class__.__name__.endswith("ActionFlowable")
        meaningful = not isinstance(flowable, (CondPageBreak, PageBreak, NextPageTemplate, Spacer)) and not internal_action
        if (
            self.pageTemplate.id == "Body"
            and page >= 2
            and page not in self.continuation_drawn_pages
            and meaningful
        ):
            section_name = re.sub(r"\s+continued$", "", self.active_section, flags=re.IGNORECASE)
            continued = not isinstance(flowable, SectionHeader)
            if section_name.lower() in {"setup", "setup continued"}:
                label = "SECTION 2 · SETUP"
            else:
                numbered = re.match(r"^(\d+)\.\s*(.+)$", section_name)
                if numbered:
                    number, name = numbered.groups()
                    label = f"SECTION {number} · {name}".upper()
                elif section_name:
                    label = section_name.upper()
                else:
                    label = "THE QUIET VALE · SEASONS OF SETTLEMENT"
            if continued:
                label = f"{label} · CONTINUED"
            font_size = 5.3
            while pdfmetrics.stringWidth(label, "QVGill-Bold", font_size) > BODY_W - 12 * mm and font_size > 4.1:
                font_size -= 0.2
            self.canv.saveState()
            self.canv.setFont("QVGill-Bold", font_size)
            self.canv.setFillColor(FOREST)
            self.canv.drawCentredString(PAGE_W / 2, PAGE_H - 6.4 * mm, label)
            self.canv.restoreState()
            self.continuation_drawn_pages.add(page)


def cover_callout_body(document: Document) -> str:
    text = normalise_spaces(document.tables[0].cell(0, 0).text)
    prefix = "A GAME OF STEWARDSHIP AND RENEWAL"
    if text.startswith(prefix):
        text = text[len(prefix):].strip()
    return text


def make_toc() -> TableOfContents:
    toc = TableOfContents()
    toc.levelStyles = [TOC_STYLE]
    toc.dotsMinLevel = 0
    return toc



IMAGE_META.update({
    'rId45': ('TILE GUIDE', 'Basic and upgraded Core faces', 75 * mm),
    'rId46': ('ICON KEY', 'Resources, Population and Renown', 20 * mm),
    'rId47': ('ARRIVAL REWARD', 'Reward number → matching back → Special Tile', 68 * mm),
    'rId48': ('GOLDEN TILES', 'Golden Tile scoring', 35 * mm),
})


IMAGE_META.update({
    'rId49': ('COMPONENT GUIDE', 'Tile and card families', 85 * mm),
    'rId50': ('STEWARD GUIDES', 'Choose a different Steward for each player', 40 * mm),
})

def build_story(document: Document, rel_paths: dict[str, Path], filler_count: int, crossrefs: dict[str, int] | None) -> list[Flowable]:
    story: list[Flowable] = [NextPageTemplate("Body"), Spacer(1, PAGE_H - 2), PageBreak()]
    toc: TableOfContents | None = None
    skipped_cover = False
    current_section = ""
    components_table_seen = False
    score_table_seen = False
    inserted_target_rules = False
    inserted_interact_procedure = False
    inserted_round_pending_note = False
    inserted_arrival_failure_note = False
    inserted_quick_reference_supplement = False
    inserted_season_transition_checklist = False
    inserted_strain_edge_case = False
    inserted_golden_boon_reference = False
    inserted_opening_flavor = False
    inserted_building_flavor = False
    inserted_supported_flavor = False
    inserted_scoring_flavor = False
    last_was_break = True

    for block_index, (kind, block) in enumerate(iter_blocks(document)):
        if not skipped_cover:
            if kind == "P" and paragraph_has_page_break(block):
                skipped_cover = True
            continue

        if kind == "P":
            paragraph = block
            raw_text = normalise_spaces(paragraph.text)
            style_name = paragraph.style.name if paragraph.style else "Normal"

            # Source pageBreakBefore settings belong to the previous US-Letter
            # composition. The compact booklet uses semantic keep-space instead
            # so a forced break cannot create an empty page after natural flow.

            if paragraph_has_page_break(paragraph):
                # The source document's empty page-break paragraphs preserve its
                # US-Letter pagination. They are not semantic content and can
                # fall after an automatic break at this smaller trim, producing
                # blank pages. Section-level pageBreakBefore rules below retain
                # the meaningful starts while this layout repaginates naturally.
                continue

            rel_ids = image_relationships(paragraph)
            if rel_ids:
                for rel_id in rel_ids:
                    if rel_id == "rId48":
                        continue  # Golden faces are shown at readable size beside their scoring conditions.
                    path = rel_paths.get(rel_id)
                    if path and path.exists():
                        label, title, max_height = IMAGE_META.get(
                            rel_id,
                            ("APPROVED VISUAL", path.stem, 78 * mm),
                        )
                        story.append(Spacer(1, 2 * mm))
                        if rel_id == "rId37":
                            from polish_reference import river_diagram
                            story.append(river_diagram(globals(), path))
                        else:
                            story.append(ImagePlate(path, rel_id, label, title, max_height=max_height))
                        story.append(Spacer(1, 3.5 * mm))
                        if rel_id == "rId35" and not inserted_building_flavor:
                            story.append(
                                ThematicFlavorBox(
                                    APPROVED_BUILDING_FLAVOR,
                                    "THE QUIET VALE",
                                )
                            )
                            story.append(Spacer(1, 3.5 * mm))
                            inserted_building_flavor = True
                        last_was_break = False
                if not raw_text:
                    continue

            if not raw_text:
                continue

            if (
                current_section == "8. Encounter cards"
                and raw_text.startswith("Golden Boons are optional advanced cards")
            ):
                # The same approved material is presented with the other
                # optional Golden rules in Section 16.
                continue

            if style_name == "Heading 1":
                current_section = transform_text(raw_text, crossrefs)
                include = current_section != "Setup continued"
                if current_section == "1. Components" and toc is not None:
                    # Give the contents page a clean finish and begin the first
                    # rules section with full-page authority.
                    story.append(PageBreak())
                elif current_section in {"2. Setup", "5. Your turn and four Actions", "7. Building the settlement", "8. Encounter cards", "9. Strain and Supported", "11. The Target Deck", "14. Final scoring", "17. Quick reference"}:
                    # Keep the section introduction and its four-card visual
                    # system together instead of stranding the banner low on a page.
                    story.append(PageBreak())
                elif current_section == "15. Steward's Ledger":
                    story.append(CondPageBreak(40 * mm))
                else:
                    story.append(CondPageBreak(76 * mm))
                story.append(SectionHeader(current_section, include_in_toc=include))
                story.append(Spacer(1, 2.5 * mm))
                last_was_break = False
                continue

            if style_name == "Heading 2":
                heading = transform_text(raw_text, crossrefs)
                if current_section == "8. Encounter cards" and heading.startswith("Golden Boons"):
                    # Golden rules are consolidated in Section 16 so the core
                    # Encounter lesson stays focused on standard play.
                    continue
                if heading == "Rivers and Bridges":
                    story.append(CondPageBreak(205 * mm))
                if heading in {"Build the Encounter material", "Terrain, placement and adjacency"}:
                    story.append(CondPageBreak(75 * mm))
                story.append(Paragraph(escape(heading), H2))
                if heading == "Contents":
                    toc = make_toc()
                    story.append(toc)
                    story.append(Spacer(1, 3 * mm))
                last_was_break = False
                continue

            if style_name == "Heading 3":
                story.append(Paragraph(paragraph_markup(paragraph, crossrefs), H3))
                last_was_break = False
                continue

            if (
                current_section == "Welcome to the Vale"
                and raw_text.startswith("War’s banners have long since fallen silent")
                and not inserted_opening_flavor
            ):
                story.append(
                    ThematicFlavorBox(
                        [
                            raw_text,
                            "The Quiet Vale is a game of stewardship: build carefully, support your neighbours and leave the Vale stronger than you found it.",
                        ],
                        "THE QUIET VALE",
                    )
                )
                story.append(Spacer(1, 3.5 * mm))
                inserted_opening_flavor = True
                last_was_break = False
                continue

            if (
                current_section == "Welcome to the Vale"
                and raw_text.startswith("The Quiet Vale is a game of stewardship")
                and inserted_opening_flavor
            ):
                continue

            if (
                current_section == "13. End of a Season"
                and raw_text.startswith("After Rounds 4 and 8")
                and not inserted_season_transition_checklist
            ):
                story.append(season_transition_checklist())
                story.append(Spacer(1, 2 * mm))
                story.append(
                    one_cell_callout(
                        "NO AUTOMATIC SPREAD There is no automatic Season-end Strain spread. Resolve an Overstrain chain only when a Tile newly crosses to 3 Strain."
                    )
                )
                story.append(Spacer(1, 3 * mm))
                inserted_season_transition_checklist = True
                last_was_break = False
                continue

            markup = paragraph_markup(paragraph, crossrefs)
            numbered = re.match(r"^(\d+\.\d+)\s+(.+)$", transform_text(raw_text, crossrefs))
            if numbered:
                number, body_text = numbered.groups()
                # Preserve direct emphasis when possible, but remove the duplicated number from the rendered body.
                body_markup = escape(body_text)
                story.append(NumberedStep(number, body_markup))
                story.append(Spacer(1, 1.2 * mm))
            else:
                story.append(Paragraph(markup, BODY))
            last_was_break = False

            if (
                current_section == "16. Golden content"
                and raw_text.startswith("Use each Golden component")
                and not inserted_golden_boon_reference
            ):
                story.append(Paragraph("Golden Boons - optional advanced effects", H2))
                story.append(
                    Paragraph(
                        "Golden Boons never enter player hands or seasonal seeding. When a Golden Boon is revealed, resolve it for free, do not count it toward the standard reveal total, and continue revealing. The Golden Scroll, for example, lets each player discard any standard Encounter Cards from their hand, then draw the same number at random from the box; Golden Boons cannot be drawn, and if the box runs short, draw as many as possible. Resolve the card, then discard it.",
                        BODY,
                    )
                )
                inserted_golden_boon_reference = True

            if current_section == "5. Your turn and four Actions":
                if raw_text.startswith("To Upgrade, spend 1 Action"):
                    story.extend(action_procedure("upgrade"))
                    story.append(Spacer(1, 1.6 * mm))
                elif raw_text.startswith("To Activate, spend 1 Action"):
                    story.extend(action_procedure("activate"))
                    story.append(Spacer(1, 1.6 * mm))
                elif raw_text.startswith("After your first placement, only Place, Upgrade or Activate") and not inserted_interact_procedure:
                    story.append(Spacer(1, 1.5 * mm))
                    story.extend(interact_procedure())
                    story.append(Spacer(1, 2.5 * mm))
                    inserted_interact_procedure = True

            if (
                current_section == "9. Strain and Supported"
                and raw_text.startswith("A Tile can hold at most 3 Strain")
                and not inserted_strain_edge_case
            ):
                story.append(
                    one_cell_callout(
                        "PARTIAL RESOLUTION If the full amount or number of legal targets is unavailable, place as much Strain as possible on as many eligible Tiles as possible. 'If none' means that no legal target exists; it does not permit choosing zero while a legal target remains."
                    )
                )
                story.append(Spacer(1, 3 * mm))
                inserted_strain_edge_case = True

            if (
                current_section == "14. Final scoring"
                and raw_text.startswith("Unlocked but unplaced Special Tiles do not score")
                and not inserted_scoring_flavor
            ):
                story.append(Spacer(1, 2 * mm))
                story.append(
                    ThematicFlavorBox(
                        APPROVED_SCORING_FLAVOR,
                        "THE QUIET VALE",
                    )
                )
                story.append(Spacer(1, 3 * mm))
                inserted_scoring_flavor = True

            if current_section == "11. The Target Deck" and not inserted_target_rules:
                # The structured rule is preserved as a numbered scan path so
                # readers can align each step with the printed card fields.
                story.append(target_resolution_checklist())
                story.append(Spacer(1, 3 * mm))
                inserted_target_rules = True

        else:
            table = block
            # Replace the source's fixed-page contents table with the live TOC above.
            if len(table.columns) == 2 and normalise_spaces(table.cell(0, 0).text) == "Section" and normalise_spaces(table.cell(0, 1).text) == "Page":
                continue
            first_cell = normalise_spaces(table.cell(0, 0).text)
            is_game_at_glance = current_section == "Welcome to the Vale" and len(table.rows) == 2 and len(table.columns) == 3 and first_cell == "Season start"
            if is_game_at_glance:
                flowable = game_at_glance_strip(table)
            elif current_section == "8. Encounter cards" and len(table.rows) == 2 and len(table.columns) == 2 and first_cell.startswith("BOON"):
                flowable = encounter_card_gallery(table, rel_paths)
            elif current_section == "11. The Target Deck" and len(table.rows) == 1 and len(table.columns) == 2 and first_cell.startswith("STRUCTURED"):
                flowable = target_card_gallery(table, rel_paths)
            elif current_section == "17. Quick reference" and first_cell == "Term":
                flowable = combined_glossary(table, crossrefs)
            elif first_cell == "No." and len(table.columns) == 4:
                flowable = compact_reference_table([c.text for c in table.rows[0].cells], [[c.text for c in row.cells] for row in table.rows[1:]], [9 * mm, BODY_W / 2 - 9 * mm, 9 * mm, BODY_W / 2 - 9 * mm], font_size=7.0)
            else:
                flowable = styled_table(table, rel_paths, crossrefs)
            if len(table.columns) == 2 and normalise_spaces(table.cell(0, 1).text) == "Final scoring condition":
                story.extend([PageBreak(), SectionHeader("Golden Tile scoring", include_in_toc=False), Spacer(1, 4 * mm), Paragraph("Each placed, non-Overstrained Golden Tile earns +5 Renown at final scoring only if its condition is met.", BODY)])
            story.append(flowable)
            story.append(Spacer(1, 3 * mm))
            if is_game_at_glance:
                story.append(SeasonOverview())
                story.append(Spacer(1, 3 * mm))
            last_was_break = False

            if (
                current_section == "4. Round sequence"
                and first_cell == "Phase"
                and not inserted_round_pending_note
            ):
                story.append(
                    one_cell_callout(
                        "PENDING EFFECT A pending effect is any mandatory choice, payment, placement, Strain application, chain or other instruction already created but not yet completed. Finish it before beginning Player Turns or advancing to the next timing step."
                    )
                )
                story.append(Spacer(1, 3 * mm))
                inserted_round_pending_note = True

            if (
                current_section == "8. Encounter cards"
                and first_cell == "Timing"
                and not inserted_arrival_failure_note
            ):
                story.append(
                    one_cell_callout(
                        "MULTIPLE FAILED ARRIVALS Resolve each failed Arrival separately. For each failure, rebuild the eligible pool and draw a fresh Target Card; return that card face down to the deck bottom before resolving another failure."
                    )
                )
                story.append(Spacer(1, 3 * mm))
                inserted_arrival_failure_note = True

            if (
                current_section == "9. Strain and Supported"
                and first_cell == "Source of Supported"
                and not inserted_supported_flavor
            ):
                story.append(
                    ThematicFlavorBox(
                        APPROVED_SUPPORTED_FLAVOR,
                        "THE QUIET VALE",
                    )
                )
                story.append(Spacer(1, 3.5 * mm))
                inserted_supported_flavor = True

            if (
                current_section == "17. Quick reference"
                and first_cell == "Active Burden"
                and not inserted_quick_reference_supplement
            ):
                story.extend(quick_reference_supplement(crossrefs))
                story.append(Spacer(1, 3 * mm))
                inserted_quick_reference_supplement = True

    if filler_count:
        from polish_reference import reference_pages
        story.extend(reference_pages(filler_count, globals()))

    story.append(NextPageTemplate("BackCover"))
    story.append(PageBreak())
    story.append(Spacer(1, PAGE_H - 2))
    return story


def build_pdf(
    path: Path,
    filler_count: int,
    crossrefs: dict[str, int] | None = None,
    continuation_suppressed_pages: set[int] | None = None,
) -> dict[str, int]:
    document = Document(SOURCE)
    rel_paths = extract_embedded_images(document)
    prepare_encounter_corner_assets()
    prepare_encounter_divider_assets()
    path.parent.mkdir(parents=True, exist_ok=True)
    template = QuietValeDocTemplate(
        path,
        cover_callout_body=cover_callout_body(document),
        continuation_suppressed_pages=continuation_suppressed_pages,
        title="The Quiet Vale - Main Rulebook v6.8",
        author="",
        creator="The Quiet Vale polished rulebook design workflow",
        showBoundary=0,
    )
    template.multiBuild(build_story(document, rel_paths, filler_count, crossrefs))
    return template.section_pages


def source_section_titles(document: Document) -> list[str]:
    titles: list[str] = []
    cover_finished = False
    for kind, block in iter_blocks(document):
        if not cover_finished:
            if kind == "P" and paragraph_has_page_break(block):
                cover_finished = True
            continue
        if kind == "P" and block.style and block.style.name == "Heading 1":
            title = transform_text(normalise_spaces(block.text))
            if title:
                titles.append(title)
    return titles


def scan_section_pages(path: Path, titles: list[str]) -> dict[str, int]:
    page_texts = [normalise_spaces(page.extract_text() or "").upper() for page in PdfReader(str(path)).pages]
    section_pages: dict[str, int] = {}
    for title in titles:
        numbered = re.match(r"^(\d+)\.\s*(.+)$", title)
        markers = [title.upper()]
        if numbered:
            number, label = numbered.groups()
            markers = [f"SECTION {number}", label.upper()]
        for index, page_text in enumerate(page_texts, 1):
            if len(markers) == 1:
                matched = markers[0] in page_text
            else:
                section_position = page_text.find(markers[0])
                label_position = page_text.find(markers[1], section_position + len(markers[0]))
                matched = (
                    section_position >= 0
                    and label_position >= 0
                    and label_position - section_position < 120
                )
            if matched:
                section_pages[title] = index
                break
    return section_pages


def scan_top_section_openers(path: Path) -> set[int]:
    """Find pages whose body begins with a new section, not prior-section content."""
    opening_pages: set[int] = set()
    for page_number, page in enumerate(PdfReader(str(path)).pages, 1):
        lines = [normalise_spaces(line).upper() for line in (page.extract_text() or "").splitlines()]
        lines = [line for line in lines if line]
        body_lines = [
            line
            for line in lines
            if not line.startswith("THE QUIET VALE")
            and line != str(page_number)
            and not line.endswith("· CONTINUED")
        ]
        first_line = body_lines[0] if body_lines else ""
        if re.fullmatch(r"SECTION \d+", first_line):
            opening_pages.add(page_number)
        elif first_line == "RULEBOOK" and any("PRODUCTION PLACEHOLDER" in line for line in body_lines[:3]):
            opening_pages.add(page_number)
    return opening_pages


def crossrefs_from_sections(section_pages: dict[str, int]) -> dict[str, int]:
    keys = {
        "setup": "2. Setup",
        "round": "4. Round sequence",
        "actions": "5. Your turn and four Actions",
        "encounters": "8. Encounter cards",
        "strain": "9. Strain and Supported",
        "target": "11. The Target Deck",
        "season_end": "13. End of a Season",
        "scoring": "14. Final scoring",
    }
    return {
        key: section_pages[title]
        for key, title in keys.items()
        if title in section_pages
    }


def main() -> None:
    TMP.mkdir(parents=True, exist_ok=True)
    document = Document(SOURCE)
    titles = source_section_titles(document)
    preview = TMP / "layout-pass.pdf"
    build_pdf(preview, filler_count=0)
    preview_count = len(PdfReader(str(preview)).pages)
    preview_sections = scan_section_pages(preview, titles)
    preview_crossrefs = crossrefs_from_sections(preview_sections)
    encounter_page = preview_crossrefs.get("encounters", 14)
    filler_count = (-preview_count) % 4
    continuation_suppressed_pages = scan_top_section_openers(preview)
    continuation_suppressed_pages.update(range(preview_count, preview_count + filler_count))
    build_pdf(
        OUTPUT,
        filler_count=filler_count,
        crossrefs=preview_crossrefs,
        continuation_suppressed_pages=continuation_suppressed_pages,
    )
    final_pages = scan_section_pages(OUTPUT, titles)
    final_crossrefs = crossrefs_from_sections(final_pages)
    final_encounter_page = final_crossrefs.get("encounters", encounter_page)
    if final_crossrefs != preview_crossrefs:
        build_pdf(
            OUTPUT,
            filler_count=filler_count,
            crossrefs=final_crossrefs,
            continuation_suppressed_pages=continuation_suppressed_pages,
        )
        final_pages = scan_section_pages(OUTPUT, titles)
        final_crossrefs = crossrefs_from_sections(final_pages)
    reader = PdfReader(str(OUTPUT))
    page_count = len(reader.pages)
    if page_count % 4:
        raise RuntimeError(f"Final page count {page_count} is not divisible by four")
    manifest = {
        "source": str(SOURCE),
        "output": str(OUTPUT),
        "page_count": page_count,
        "trim_mm": [195, 255],
        "filler_placeholder_pages": filler_count,
        "approved_visual_labels": [title for _, title, _ in IMAGE_META.values()],
        "visual_system_revision": [
            "Full-width map-wash section bands with the exact Encounter-card divider flourish",
            "Matched full Encounter-card ornaments frame all four body-page corners",
            "Every approved instructional diagram receives a functional label",
            "Encounter and Target Card examples use dedicated comparison panels",
            "Rules procedures use consistent angular numbered tabs, restrained tables and layered callouts",
            "The Welcome page uses three sectional map washes to show the full Season arc",
            "Black front and back covers use the approved Golden Boon compass and brass tree; the compass retains only its natural textured bevel",
            "Body-page folios are centred and descriptive footer copy has been removed",
            "Angular numbered tabs and table headers share a softened muted-forest fill",
            "Running section labels are centred in the top header; continuation pages add a restrained continued marker",
            "Body and table typography increased for retail-size print legibility",
            "Thematic copy uses a dedicated pale-flax, aged-brass cut-corner frame and italic Charter typography",
            "Flavour frames are sparse, source-labelled and visually separate from rules callouts",
        ],
        "content_corrections": [
            "Target Deck count: 24 -> 30 (structured source)",
            "Encounter selection per player: 5/5/5 -> 4/4/4 (structured source)",
            "Supported player count expanded from 1-4 to 1-5, with five distinct Stewards chosen from the six available",
            "Five-player setup uses 20 Boons, 20 Burdens and 20 Arrivals: 45 cards dealt and 15 in the starting deck",
            "Starting Warehouse expanded to 15 / 10 / 5 / 0 / 0 resources at 1 / 2 / 3 / 4 / 5 players",
            "Target Card rules converted from the structured source into six field-aligned microsteps",
            "Locked component quantities added for Core, Special, Encounter, Target, Steward and Golden families",
            "Working retail token allocation added: 15 of each resource, 30 black markers and 30 bronze markers",
            "Arrival timers permitted to use either black or bronze markers",
            "Printed rules suite locked to the Main Rulebook, six Steward aids and the multi-campaign Steward's Ledger",
            "Ledger workflow reconciled to the locked Group Register, shared catalogue and per-group Game Record architecture",
            "Shared final score and newly completed Entry wording aligned across the Rulebook, Steward Aids and Ledger",
            "The Ruins Stone discount is named Shelter in the Ruins across the rules suite",
            "Reader-facing component name standardised as Steward Aid",
            "Retired scorepad and pre-Ledger-layout photography language removed",
            "Opening thematic copy tightened for warmth, clarity and direct player address",
            "Two section-specific thematic passages use verbatim user-approved rulebook narration",
            "Final-scoring thematic passage uses the verbatim user-approved overview copy",
            "Setup rewritten to show the complete 12-card-per-player selected-pool arithmetic",
            "Raw shared-score outcome and normal solo play stated explicitly",
            "Upgrade, Activate and Interact expanded into complete procedures",
            "Linked Production clarified for immediate adjacency, overlaps and non-chaining groups",
            "Passive and single-use Supported given distinct reference labels without changing the game state",
            "Persistent group-selected beneficiaries and reassignment timing locked for Common Land and The Pleasance",
            "Arrival failure eligibility and no-target handling made explicit",
            "Warden objective updated to fewer active Burdens than player count",
            "Golden rules consolidated in the optional-content section",
            "End-game penalties updated to -10 for active Burdens, failed Arrivals and each Strain; active Arrivals have no penalty",
            "Season transition and quick reference expanded; glossary consolidated into one alphabetical table",
            "Seeding guidance now separates Season commitment from deck position and gives accurate Boon, Burden and Arrival timing tradeoffs",
            "Teaching visuals distinguish Passive Effects from Activated Effects and use basic-side Tile names where required",
            "Credits, edition, legal, support and accessibility fields assigned a no-fabrication production placeholder",
            f"Encounter guide cross-reference updated to page {final_pages.get('8. Encounter cards', final_encounter_page)}",
        ],
        "section_pages": final_pages,
    }
    (TMP / "build-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
