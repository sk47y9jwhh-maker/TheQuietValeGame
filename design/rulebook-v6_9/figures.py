#!/usr/bin/env python3
"""Every picture in the v6.9 rulebook, made from the real components instead of
photographs: the v4 boards, the artist's tiles, the printed card files and the
online game's own card component, with wooden tokens and Steward meeples.

    python3 design/rulebook-v7/figures.py <boards-dir> <cards-dir>

<boards-dir> holds the v4 board renders (design/boards-v4/build_leather_boards.py).
<cards-dir> holds the Encounter Cards drawn by the online EncounterCard
component (render-cards.mjs). Writes assets/fig-*.jpg and figures.json.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import scene as S  # noqa: E402
from scene import Scene, _disc, _meeple, _shadow, tile_image, STEWARD_COLOURS  # noqa: E402

ROOT = HERE.parents[1]
BOARDS = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "output/boards-v4"
CARDS = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "output/rulebook-v6_9/cards"
OUT = HERE / "assets"
OUT.mkdir(parents=True, exist_ok=True)
META: dict[str, dict] = {}

CARD_BACK_TAROT = ROOT / "design/encounter-card-templates/card-back/print/card-back-tarot-printerstudio-600dpi.png"
BACK_GOLD = ROOT / "design/encounter-card-templates/card-back/print/card-back-poker-gold-printerstudio-600dpi.png"
BACK_SILVER = ROOT / "design/encounter-card-templates/card-back/print/card-back-poker-silver-printerstudio-600dpi.png"
QUEST = lambda n: ROOT / f"design/quest-cards/print/quest-{n:02d}.png"  # noqa: E731
TARGET = lambda n: ROOT / f"design/target-cards/print/target-{n:02d}.png"  # noqa: E731
GUIDE = lambda sid: ROOT / f"design/steward-guides/assets/cover-{sid}.jpg"  # noqa: E731
RES_COLOURS = {"stone": (126, 135, 142), "metal": (101, 133, 151), "goods": (149, 86, 62),
               "wood": (91, 124, 76), "food": (151, 141, 52), "herbs": (123, 91, 137)}
BRONZE = (176, 124, 62)
STRAIN = (34, 31, 28)


def save(name: str, im: Image.Image, meta: dict | None = None, q: int = 90):
    im.convert("RGB").save(OUT / f"{name}.jpg", quality=q, dpi=(300, 300))
    META[name] = {"w": im.width, "h": im.height, **(meta or {})}
    print(name, im.size)


def rounded(im: Image.Image, r_px: int) -> Image.Image:
    im = im.convert("RGBA")
    k = 3
    m = Image.new("L", (im.width * k, im.height * k), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, im.width * k - 1, im.height * k - 1), r_px * k, fill=255)
    m = m.resize(im.size, Image.Resampling.LANCZOS)
    im.putalpha(Image.fromarray(np.minimum(np.asarray(im.getchannel("A")), np.asarray(m))))
    return im


def card(path: Path, trim_mm: tuple[float, float], ppm: float, bleed_mm: float | None = None) -> Image.Image:
    """A printed card trimmed to size with rounded corners, at ppm px/mm."""
    src = Image.open(path).convert("RGBA")
    tw, th = trim_mm
    if bleed_mm is None:
        # Crop to the trim aspect, centred: the print files carry even bleed.
        aspect = tw / th
        w, h = src.size
        if w / h > aspect:
            nw = round(h * aspect); src = src.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
        else:
            nh = round(w / aspect); src = src.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    else:
        px = src.width / (tw + 2 * bleed_mm)
        b = round(bleed_mm * px)
        src = src.crop((b, b, src.width - b, src.height - b))
    out = src.resize((round(tw * ppm), round(th * ppm)), Image.Resampling.LANCZOS)
    return rounded(out, round(3 * ppm))


def tarot_back(ppm):
    return card(CARD_BACK_TAROT, (70, 120), ppm, bleed_mm=None)


def enc(name: str, ppm: float) -> Image.Image:
    """An Encounter Card drawn by the online component (print mode, with bleed)."""
    src = Image.open(CARDS / f"{name}.png").convert("RGBA")
    # The component's print canvas is 3 x 5 in (76.2 x 127 mm); trim is 70 x 120.
    pxmm = src.width / 76.2
    w, h = 70 * pxmm, 120 * pxmm
    x0, y0 = (src.width - w) / 2, (src.height - h) / 2
    src = src.crop((round(x0), round(y0), round(x0 + w), round(y0 + h)))
    return rounded(src.resize((round(70 * ppm), round(120 * ppm)), Image.Resampling.LANCZOS), round(3 * ppm))


def poker(path: Path, ppm: float) -> Image.Image:
    return card(path, (63, 88), ppm, bleed_mm=3)


def place(canvas: Image.Image, im: Image.Image, x: float, y: float, ppm: float, rot: float = 0, shadow=(1.6, 0.55), lift=(0.6, 1.0)):
    """Put im with its top-left at (x, y) mm, optionally turned by rot degrees."""
    if rot:
        im = im.rotate(rot, resample=Image.Resampling.BICUBIC, expand=True)
    X, Y = round(x * ppm), round(y * ppm)
    if shadow:
        sh, pad = _shadow(im.getchannel("A"), shadow[0] * ppm, shadow[1])
        canvas.alpha_composite(sh, (X - pad + round(lift[0] * ppm), Y - pad + round(lift[1] * ppm)))
    canvas.alpha_composite(im, (X, Y))


def centre(canvas, im, cx, cy, ppm, **kw):
    if kw.get("rot"):
        r = kw.pop("rot")
        im = im.rotate(r, resample=Image.Resampling.BICUBIC, expand=True)
    place(canvas, im, cx - im.width / ppm / 2, cy - im.height / ppm / 2, ppm, **kw)


def disc(d_mm: float, colour, ppm: float, seed=1, grain=0.0, sheen=0.5):
    return _disc(max(4, round(d_mm * ppm)), colour, sheen=sheen, grain=grain, seed=seed, rim=0.32)


def wood_table(w_px: int, h_px: int, seed: int = 7) -> Image.Image:
    """A dark oiled walnut tabletop with long boards."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:h_px, 0:w_px].astype(np.float32)
    board_h = h_px / 5.5
    idx = np.floor(yy / board_h)
    off = rng.uniform(0, 1000, 12)[idx.astype(int) % 12]
    u = xx / w_px * 6 + off
    v = (yy % board_h) / board_h
    grain = 0.5 + 0.5 * np.sin(u * 9 + 4 * np.sin(v * 3 + u * 0.7) + 2.3 * np.sin(u * 2.1))
    fine = rng.normal(0, 1, (h_px // 3 + 1, w_px // 3 + 1)).astype(np.float32)
    fine = np.asarray(Image.fromarray(((fine * 0.5 + 0.5).clip(0, 1) * 255).astype(np.uint8)).resize((w_px, h_px), Image.Resampling.BICUBIC), np.float32)[:h_px, :w_px] / 255
    tone = 0.78 + 0.12 * grain + 0.06 * fine
    seam = np.clip(np.abs(v - 0.0) * board_h / 2.0, 0, 1) * np.clip(np.abs(1 - v) * board_h / 2.0, 0, 1)
    tone *= 0.55 + 0.45 * seam
    shade = rng.uniform(0.9, 1.06, 12)[idx.astype(int) % 12]
    base = np.array((92, 62, 40), np.float32)
    rgb = base * (tone * shade)[..., None]
    # Soft vignette so the boards sit in a pool of light.
    cx, cy = w_px / 2, h_px / 2
    r = np.hypot((xx - cx) / w_px, (yy - cy) / h_px)
    rgb *= (1.08 - 0.55 * r ** 2)[..., None]
    return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).convert("RGBA")


def board(name: str, ppm: float) -> Image.Image:
    src = Image.open(BOARDS / f"{name}-with-bleed.png").convert("RGBA")
    b = round(S.BLEED * S.PPM)
    src = src.crop((b, b, src.width - b, src.height - b))
    w = round(src.width / S.PPM * ppm)
    return rounded(src.resize((w, round(src.height / S.PPM * ppm)), Image.Resampling.LANCZOS), round(2.5 * ppm))


def tile_stack(tile: str, n: int, ppm: float, side="basic") -> Image.Image:
    """A short stack of identical tiles, turned point-up to fit a bay."""
    face = tile_image(f"{tile}-{side}").resize((round(60 * ppm), round(51.96 * ppm)), Image.Resampling.LANCZOS)
    edge = Image.new("RGBA", face.size, (52, 44, 34, 255)); edge.putalpha(face.getchannel("A"))
    k = max(1, round(2 * ppm))
    out = Image.new("RGBA", (face.width + 2 * k, face.height + n * k + 2 * k), (0, 0, 0, 0))
    for i in range(n):
        y = (n - i) * k
        out.alpha_composite(edge, (0, y + k // 2))
        out.alpha_composite(face if i == n - 1 else edge, (0, y))
    return out


# ---------------------------------------------------------------- setup table
LW, LH = 568.5, 146.0       # Encounter and Logistics boards, lying flat
BW, BH = 284.25, 232.83     # Tiles board
MAPW, MAPH = 698.5, 568.5


def setup_pieces(T):
    """The four boards with their setup contents, each drawn flat."""
    # Map board with Steward meeples and the Round marker on 1.
    sc = Scene()
    sc.steward("B6", "knight", 0, 0)
    sc.steward("B1", "sentinel", 0, 0)
    rm = _disc(round(15 * S.PPM), BRONZE, sheen=0.6, rim=0.3)
    sc._paste(rm, (80.42 + S.BLEED) * S.PPM, (548.76 + S.BLEED) * S.PPM, shadow=(5, 0.7), lift=(3, 6))
    b = round(S.BLEED * S.PPM)
    mapb = sc.img.crop((b, b, sc.img.width - b, sc.img.height - b))
    mapb = rounded(mapb.resize((round(MAPW * T), round(MAPH * T)), Image.Resampling.LANCZOS), round(2.5 * T))

    # Encounter board: the Encounter deck face down in its well.
    eb = board("02-encounter-board-v4", T)
    back = tarot_back(T)
    for i in range(4):
        place(eb, back, 6 + 5 + i * 0.25, 6 + 7 - i * 0.4, T, shadow=(0.8, 0.5))

    # Logistics board: Target deck, Warehouse at 2 players, tokens.
    lb = board("03-logistics-board-v4", T)
    sil = poker(BACK_SILVER, T)
    for i in range(4):
        place(lb, sil, 6 + 8.5 + i * 0.2, 6 + 23 - i * 0.35, T, shadow=(0.8, 0.5))
    cl, cr = 6 + 80 + 7, LW - (6 + 80 + 7)
    inner_l, inner_r = cl + 4, cr - 4
    lw = (inner_r - inner_l) / 6
    rng = np.random.default_rng(3)
    for i, r in enumerate(["stone", "metal", "goods", "wood", "food", "herbs"]):
        cx = inner_l + lw * (i + 0.5)
        for k in range(10):  # stock: 10 each at 2 players
            x = cx + (k % 4 - 1.5) * 11.5 + rng.uniform(-1.2, 1.2)
            y = 30 + (k // 4) * 11.5 + rng.uniform(-1.2, 1.2)
            centre(lb, disc(10, RES_COLOURS[r], T, seed=k + i * 20, grain=0.05), x, y, T, shadow=(0.6, 0.6), lift=(0.4, 0.7))
        for k in range(5):  # spare pieces below the stitch
            x = cx + (k - 2) * 7.5 + rng.uniform(-1.5, 1.5)
            y = 92 + (k % 2) * 6 + rng.uniform(-1, 1)
            centre(lb, disc(10, RES_COLOURS[r], T, seed=k + i * 20 + 300, grain=0.05), x, y, T, shadow=(0.6, 0.6), lift=(0.4, 0.7))
    tx = LW - 6 - 80
    for k in range(18):
        centre(lb, disc(12, STRAIN, T, seed=k, grain=0.06, sheen=0.55), tx + 18 + (k % 4) * 13 + rng.uniform(-2, 2), 28 + (k // 4) * 13 + rng.uniform(-2, 2), T, shadow=(0.6, 0.6), lift=(0.4, 0.7))
    for k in range(10):
        centre(lb, disc(12, BRONZE, T, seed=k, sheen=0.6), tx + 22 + (k % 4) * 12 + rng.uniform(-2, 2), 98 + (k // 4) * 11 + rng.uniform(-2, 2), T, shadow=(0.6, 0.6), lift=(0.4, 0.7))

    # Tiles board: the Quest Card and the Core Tile stacks.
    tb = board("04-tiles-board-v4", T)
    place(tb, poker(QUEST(7), T), 10, 9.5, T, rot=90, shadow=(0.9, 0.55))
    bays = [("c01_lumber_yard", 4), ("c14_market_stalls", 3), ("c09_tavern", 3), ("c05_cabin", 4), ("c15_path", 5)]
    il, ir = 6 + 4, BW - 6 - 4
    bw = (ir - il) / 5
    for i, (tid, n) in enumerate(bays):
        centre(tb, tile_stack(tid, n, T), il + bw * (i + 0.5), 124 if i % 2 == 0 else 171, T, shadow=(1.2, 0.6), lift=(0.6, 1.2))
    return mapb, eb, lb, tb, back


def players(canvas, T, back, seats, pos):
    """Each player's Steward Guide with their hidden hand fanned below it."""
    for i, (sid, gx, gy, rot, hx) in enumerate(seats):
        g = Image.open(GUIDE(sid)).convert("RGBA")
        bpx = round(3.175 * g.width / 111.35)
        g = g.crop((bpx, bpx, g.width - bpx, g.height - bpx)).resize((round(105 * T), round(148 * T)), Image.Resampling.LANCZOS)
        place(canvas, rounded(g, round(1.5 * T)), gx, gy, T, rot=rot, shadow=(2.2, 0.75), lift=(1, 2))
        for k in range(5):
            centre(canvas, back, hx + (k - 2) * 9, gy + 202 + abs(k - 2) * 2.4, T, rot=(k - 2) * 6, shadow=(0.9, 0.5))
        pos[f"guide{i}"] = (gx + 52, gy + 74)
        pos[f"hand{i}"] = (hx, gy + 202)


def setup_table():
    """The table from above, laid out long and narrow: the Encounter board on
    end at the map's left, the Logistics board on end at its right (both with
    their lettering facing the map), then the Tiles board, with the players'
    Steward Guides and hands below it."""
    T = 2.6  # px per mm on the table
    W_MM, H_MM = 1372, 640
    canvas = wood_table(round(W_MM * T), round(H_MM * T))
    mapb, eb, lb, tb, back = setup_pieces(T)
    pos = {}
    GAP = 14
    EX, MY = 30, 30
    MX = EX + LH + GAP
    LX = MX + MAPW + GAP

    def left(x, y):    # Encounter board point -> table, turned clockwise (top faces the map)
        return EX + (LH - y), MY + x

    def right(x, y):   # Logistics board point -> table, turned anticlockwise (top faces the map)
        return LX + y, MY + (LW - x)

    place(canvas, mapb, MX, MY, T, shadow=(4, 0.8), lift=(1.5, 3))
    place(canvas, eb, EX, MY, T, rot=-90, shadow=(4, 0.8), lift=(1.5, 3))
    place(canvas, lb, LX, MY, T, rot=90, shadow=(4, 0.8), lift=(1.5, 3))
    BX, BY = LX + LH + GAP + 4, MY
    place(canvas, tb, BX, BY, T, shadow=(4, 0.8), lift=(1.5, 3))
    players(canvas, T, back, [("knight", BX + 14, BY + BH + 12, 3, BX + 70), ("sentinel", BX + BW - 119, BY + BH + 16, -3, BX + BW - 70)], pos)

    pos["map"] = (MX + 349, MY + 280)
    pos["round"] = (MX + 80.42, MY + 548.76)
    pos["meeple"] = (MX + S.svg_centre("B6")[0] + S.OFF_X, MY + S.svg_centre("B6")[1] + S.OFF_Y)
    pos["encdeck"] = left(46, 73)
    pos["target"] = right(46, 73)
    pos["warehouse"] = right(284, 30)
    pos["tokens"] = right(LW - 6 - 40, 73)
    pos["quest"] = (BX + 54, BY + 41)
    pos["tiles"] = (BX + 142, BY + 147)
    save("fig-setup", canvas, {"points": {k: (round(v[0] / W_MM, 4), round(v[1] / H_MM, 4)) for k, v in pos.items()}})


def setup_table_alt():
    """Another layout for a deeper table: the map on the left; to its right,
    the Encounter board, the Logistics board and the Tiles board, all lying
    flat, one below the other. The players' guides and hands sit beside the
    Tiles board."""
    T = 2.6
    GAP = 12
    MX, MY = 30, 30
    RX = MX + MAPW + 18
    W_MM = RX + LW + 30
    H_MM = MY + MAPH + 30
    canvas = wood_table(round(W_MM * T), round(H_MM * T), seed=9)
    mapb, eb, lb, tb, back = setup_pieces(T)
    place(canvas, mapb, MX, MY, T, shadow=(4, 0.8), lift=(1.5, 3))
    ey = MY - 4
    place(canvas, eb, RX, ey, T, shadow=(4, 0.8), lift=(1.5, 3))
    ly = ey + LH + GAP
    place(canvas, lb, RX, ly, T, shadow=(4, 0.8), lift=(1.5, 3))
    ty = ly + LH + GAP
    place(canvas, tb, RX, ty, T, shadow=(4, 0.8), lift=(1.5, 3))
    # Guides and hands in the space beside the Tiles board.
    for i, (sid, gx, rot) in enumerate([("knight", RX + BW + 22, 3), ("sentinel", RX + BW + 150, -3)]):
        g = Image.open(GUIDE(sid)).convert("RGBA")
        bpx = round(3.175 * g.width / 111.35)
        g = g.crop((bpx, bpx, g.width - bpx, g.height - bpx)).resize((round(105 * T), round(148 * T)), Image.Resampling.LANCZOS)
        place(canvas, rounded(g, round(1.5 * T)), gx, ty + 2, T, rot=rot, shadow=(2.2, 0.75), lift=(1, 2))
        for k in range(5):
            centre(canvas, back, gx + 52 + (k - 2) * 7, ty + 186 + abs(k - 2) * 2, T, rot=(k - 2) * 6 + 90, shadow=(0.9, 0.5))
    save("fig-setup-alt", canvas)


# ---------------------------------------------------------- map close-ups
def map_fig(name: str, sc: Scene, hexes, width=1800, margin=6.0, aspect=None):
    im, meta = sc.crop(hexes, margin_mm=margin, width_px=width, aspect=aspect)
    save(name, im, meta)


def map_figures():
    # Steward Token movement: Knight starts on Arable Land at B6.
    sc = Scene()
    sc.tile("B6", "c04_farmstead").tile("C6", "c05_cabin").tile("D6", "c06_cottage")
    sc.steward("B6", "knight", 0.25, -0.18)
    map_fig("fig-movement", sc, ["A5", "E7"], margin=2, aspect=2.1)

    # Linked Production: three Mine Shafts on the Mountains.
    sc = Scene()
    for h in ("A1", "B1", "C1"):
        sc.tile(h, "c02_mine_tunnel", "upgraded")
    sc.steward("B1", "sentinel", 0.25, -0.18)
    map_fig("fig-linked", sc, ["A1", "C2"], margin=4, aspect=1.9)

    # Adjacency: six neighbours round a Cabin.
    sc = Scene()
    sc.tile("I3", "c05_cabin").tile("H3", "c15_path").tile("J3", "c06_cottage").tile("K3", "c10_eatery")
    map_fig("fig-adjacency", sc, ["H2", "K4"], margin=4, aspect=1.5)

    # River: no Bridge, then a Bridge.
    for nm, bridge in (("fig-river-a", False), ("fig-river-b", True)):
        sc = Scene()
        sc.tile("D5", "c05_cabin").tile("F5", "c20_dig_site")
        if bridge:
            sc.tile("E5", "c19_bridge")
        map_fig(nm, sc, ["D4", "F6"], margin=2, aspect=1.25)

    # Strain and Supported, one picture: 0, 1, 2 and 3 Strain.
    sc = Scene()
    sc.tile("H6", "c05_cabin", strain=2, supported=True)
    sc.tile("H7", "c18_common_land")
    sc.tile("I6", "c06_cottage", strain=1)
    sc.tile("G6", "c15_path", strain=3)
    sc.tile("G5", "c10_eatery")
    map_fig("fig-strain", sc, ["G5", "I7"], margin=3, aspect=1.4)

    # Overstrain chain: before and after.
    for nm, a, b2 in (("fig-chain-a", 2, 2), ("fig-chain-b", 3, 3)):
        sc = Scene()
        sc.tile("I3", "c06_cottage", strain=a).tile("J3", "c15_path", strain=b2)
        sc.tile("I2", "c05_cabin").tile("H3", "c10_eatery", strain=1 if nm.endswith("b") else 1)
        sc.tile("J4", "c12_apothecary", strain=1 if nm.endswith("b") else 0)
        map_fig(nm, sc, ["H2", "J4"], margin=2, aspect=1.15)

    # Neighbourly Support: a cluster of six Housing Tiles gains 2 Supported.
    sc = Scene()
    for h, t in (("H2", "c05_cabin"), ("I2", "c06_cottage"), ("J2", "c05_cabin"), ("H3", "c06_cottage"), ("I3", "c07_stedding"), ("J3", "c05_cabin")):
        sc.tile(h, t, supported=h in ("I2", "J3"))
    sc.tile("K3", "c15_path")
    map_fig("fig-neighbourly", sc, ["H2", "K3"], margin=5, aspect=2.0)

    # Target Card 05 at work: Housing Tiles hit by a Burden.
    sc = Scene()
    sc.tile("J6", "c05_cabin", strain=1)                 # basic: ruled out by Tile side
    sc.tile("I6", "c05_cabin", "upgraded")               # upgraded
    sc.tile("I7", "c06_cottage", "upgraded", strain=1)   # upgraded, strained
    sc.tile("J7", "c06_cottage", "upgraded", strain=1)   # upgraded, strained
    sc.tile("H6", "c15_path").tile("H7", "c18_common_land").tile("K7", "c15_path").tile("J8", "c15_path").tile("I8", "c10_eatery")
    map_fig("fig-target", sc, ["H6", "K8"], margin=7, aspect=1.35)

    # Special Tile on its terrain: The Root Weavers Respite on Heaths.
    sc = Scene()
    sc.tile("M4", "special_the_root_weavers_respite", None)
    sc.tile("L4", "c15_path").tile("L3", "c05_cabin")
    map_fig("fig-special", sc, ["L3", "N5"], margin=2, aspect=1.25)

    # A finished settlement, for the final scoring page.
    sc = Scene()
    lay = [("B6", "c04_farmstead", "upgraded", 0), ("A6", "c04_farmstead", "upgraded", 0), ("C6", "c05_cabin", "upgraded", 0), ("C5", "c06_cottage", "upgraded", 1),
           ("D5", "c06_cottage", "basic", 0), ("C7", "c15_path", "upgraded", 0), ("D6", "c08_inn", "basic", 0), ("D7", "c09_tavern", "basic", 1),
           ("C4", "c07_stedding", "basic", 0), ("D4", "c18_common_land", "basic", 0), ("E5", "c19_bridge", "upgraded", 0), ("F5", "c20_dig_site", "upgraded", 0),
           ("F6", "c15_path", "basic", 2), ("G6", "c14_market_stalls", "basic", 0), ("F4", "c21_the_vaults", "basic", 0), ("G7", "c13_workshops", "basic", 0),
           ("B7", "c10_eatery", "basic", 0), ("H6", "c12_apothecary", "basic", 0), ("B5", "c11_washhouse", "basic", 0) if False else ("B5", "c05_cabin", "basic", 0)]
    for h, t, side, st in lay:
        sc.tile(h, t, side, strain=st, supported=h in ("C5",))
    sc.steward("D6", "knight", 0.25, -0.2)
    sc.steward("F5", "warden", 0.25, -0.2)
    map_fig("fig-finale", sc, ["A4", "H7"], margin=3, aspect=1.75)

    # First placement: Sentinel on Mountains places a Mine Tunnel under the Token.
    sc = Scene()
    sc.tile("N6", "c02_mine_tunnel")
    sc.steward("N6", "sentinel", 0.25, -0.18)
    map_fig("fig-first", sc, ["M5", "N7"], margin=2, aspect=1.0)


# ---------------------------------------------------------- encounter board
def encounter_in_play():
    T = 8.0
    eb = board("02-encounter-board-v4", T)
    canvas = Image.new("RGBA", eb.size, (0, 0, 0, 0))
    canvas.alpha_composite(eb)
    back = tarot_back(T)
    for i in range(3):
        place(canvas, back, 11 + i * 0.25, 13 - i * 0.4, T, shadow=(0.8, 0.5))
    x0 = 6 + 80 + 7 + 10
    for i, nm in enumerate(["arrival-quiet-quest", "burden-old-wounds", "boon-a-little-time"]):
        place(canvas, enc(nm, T), x0 + i * 78 + 8, 13, T, shadow=(1.1, 0.6))
    save("fig-inplay", canvas.crop((0, 0, round(380 * T), canvas.height)).resize((2400, round(2400 * canvas.height / round(380 * T)))))


# ---------------------------------------------------------- components
def leather_bg(w_mm, h_mm, ppm):
    lb = Image.open(BOARDS / "04-tiles-board-v4-with-bleed.png").convert("RGBA")
    crop = lb.crop((round(20 * S.PPM), round(100 * S.PPM), round(20 * S.PPM) + round(w_mm * S.PPM), round(100 * S.PPM) + round(h_mm * S.PPM)))
    return crop.resize((round(w_mm * ppm), round(h_mm * ppm)), Image.Resampling.LANCZOS)


def components():
    T = 10.0
    # Tiles: Core basic and upgraded, Travel extension, Special front and back, Golden front and back.
    names = [("c06_cottage-basic", "Core Tile, basic side"), ("c06_cottage-upgraded", "Its upgraded side"),
             ("c16_street-basic", "Street (2 hexes)"), ("travel-extension-basic", "Travel extension"),
             ("special_the_root_weavers_respite", "Special Tile"), ("special-back-23", "Its numbered back"),
             ("golden_tile_the_golden_garden", "Golden Tile"), ("golden-back", "Golden back")]
    for nm, _ in names:
        im = tile_image(nm).resize((round(60 * T), round(51.96 * T)), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (im.width + 40, im.height + 50), (0, 0, 0, 0))
        edge = Image.new("RGBA", im.size, (52, 44, 34, 255)); edge.putalpha(im.getchannel("A"))
        sh, pad = _shadow(im.getchannel("A"), 8, 0.55)
        canvas.alpha_composite(sh, (20 - pad + 6, 16 - pad + 12))
        canvas.alpha_composite(edge, (22, 22))
        canvas.alpha_composite(im, (20, 16))
        canvas.save(OUT / f"tile-{nm}.webp")
    META["tiles"] = [{"file": f"tile-{n}.webp", "caption": c} for n, c in names]
    extra = ["c13_workshops-basic", "c14_market_stalls-basic", "c08_inn-basic", "c08_inn-upgraded",
             "golden_tile_the_golden_charter", "golden_tile_the_golden_hearth", "golden_tile_the_golden_river_gate", "golden_tile_the_golden_cairn"]
    names = names + [(n, "") for n in extra]
    for nm, _ in names[8:]:
        im = tile_image(nm).resize((round(60 * T), round(51.96 * T)), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (im.width + 40, im.height + 50), (0, 0, 0, 0))
        edge = Image.new("RGBA", im.size, (52, 44, 34, 255)); edge.putalpha(im.getchannel("A"))
        sh, pad = _shadow(im.getchannel("A"), 8, 0.55)
        canvas.alpha_composite(sh, (20 - pad + 6, 16 - pad + 12))
        canvas.alpha_composite(edge, (22, 22))
        canvas.alpha_composite(im, (20, 16))
        canvas.save(OUT / f"tile-{nm}.webp")

    # Cards: one of each, as printed.
    for nm in ["arrival-quiet-quest", "boon-a-little-time", "burden-old-wounds", "golden-scroll", "arrival-blade-to-herb", "arrival-cavalry", "boon-ancient-paths"]:
        enc(nm, 14).save(OUT / f"card-{nm}.webp")
    tarot_back(14).save(OUT / "card-encounter-back.webp")
    poker(BACK_GOLD, 14).save(OUT / "card-quest-back.webp")
    poker(BACK_SILVER, 14).save(OUT / "card-target-back.webp")
    for n in (5, 25, 18):
        poker(TARGET(n), 16).save(OUT / f"card-target-{n:02d}.webp")
    for n in (7, 1):
        poker(QUEST(n), 16).save(OUT / f"card-quest-{n:02d}.webp")

    # Tokens: black Strain, bronze Supported and timers, the six meeples, resources.
    TT = 14.0
    bg = leather_bg(150, 62, TT)
    rng = np.random.default_rng(11)
    for k in range(5):
        centre(bg, disc(12, STRAIN, TT, seed=k, grain=0.06, sheen=0.55), 12 + k * 7.5 + rng.uniform(-1, 1), 16 + (k % 2) * 9, TT, shadow=(0.7, 0.6), lift=(0.4, 0.8))
    for k in range(4):
        centre(bg, disc(12, BRONZE, TT, seed=k, sheen=0.6), 12 + k * 8 + rng.uniform(-1, 1), 44 + (k % 2) * 7, TT, shadow=(0.7, 0.6), lift=(0.4, 0.8))
    for i, sid in enumerate(["vanguard", "knight", "sentinel", "ranger", "warden", "quartermaster"]):
        m = _meeple(round(17 * TT), STEWARD_COLOURS[sid])
        centre(bg, m, 62 + (i % 3) * 15, 17 + (i // 3) * 26, TT, shadow=(0.8, 0.6), lift=(0.8, 1.0))
    for i, r in enumerate(["wood", "stone", "metal", "food", "herbs", "goods"]):
        centre(bg, disc(10, RES_COLOURS[r], TT, seed=i + 40, grain=0.05), 116 + (i % 2) * 14 + rng.uniform(-0.5, 0.5), 12 + (i // 2) * 16, TT, shadow=(0.6, 0.6), lift=(0.4, 0.7))
    save("fig-tokens", bg)

    # The four boards, small, for the component list.
    for nm in ["01-map-board-v4", "02-encounter-board-v4", "03-logistics-board-v4", "04-tiles-board-v4"]:
        im = Image.open(BOARDS / f"{nm}-preview.png").convert("RGB")
        im.thumbnail((1800, 1800))
        im.save(OUT / f"board-{nm[3:]}.jpg", quality=88)
    # Steward meeples one by one for the Stewards page.
    for sid in STEWARD_COLOURS:
        m = _meeple(round(17 * 14), STEWARD_COLOURS[sid])
        c = Image.new("RGBA", (m.width + 40, m.height + 40), (0, 0, 0, 0))
        sh, pad = _shadow(m.getchannel("A"), 6, 0.5)
        c.alpha_composite(sh, (20 - pad + 8, 20 - pad + 10)); c.alpha_composite(m, (20, 20))
        c.save(OUT / f"meeple-{sid}.webp", quality=90)


if __name__ == "__main__":
    which = sys.argv[3:] or ["setup", "map", "inplay", "components"]
    prev = OUT / "figures.json"
    if prev.exists():
        META.update(json.loads(prev.read_text()))
    if "components" in which: components()
    if "inplay" in which: encounter_in_play()
    if "map" in which: map_figures()
    if "setup" in which:
        setup_table()
        setup_table_alt()
    prev.write_text(json.dumps(META, indent=1))
