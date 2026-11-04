#!/usr/bin/env python3
"""Twin Settlements map: the printed map with the West Vale and East Vale
tinted. The West Vale is the land west of the river's western channel (the
land joined to A1 without crossing water); the East Vale is all other land."""
import sys, math
from pathlib import Path
from PIL import Image, ImageDraw
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[0] / "rulebook-v6_9"))
import scene as S

ROWS = """M M M ~ . . W W W . . A A A
. . . ~ . . . . . . . . . .
H H . . ~ ~ . . . . . . . H
H . . . ~ R ~ ~ . . . . H H
. . . . ~ R R . ~ ~ . . . .
A A . . ~ . . . . . ~ ~ . M
A . . . ~ . . . . . . ~ M M
. W . . ~ ~ . . . . . . ~ ~
W W . . . . ~ ~ . R R R . .""".splitlines()
terr = {}
for r, line in enumerate(ROWS, 1):
    for c, t in enumerate(line.split()):
        terr[f"{chr(65 + c)}{r}"] = t
west, todo = set(), ["A1"]
while todo:
    h = todo.pop()
    if h in west or terr[h] == "~":
        continue
    west.add(h)
    todo += S.neighbours(h)
east = {h for h, t in terr.items() if t != "~" and h not in west}
print("west", len(west), "east", len(east), sorted(west))

sc = S.Scene()
img = sc.img.convert("RGBA")
ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
d = ImageDraw.Draw(ov)
R = S.HEX_R * S.PPM
for hs, col in ((west, (64, 120, 160, 70)), (east, (176, 120, 50, 62))):
    for h in hs:
        cx, cy = S.board_px(h)
        pts = [(cx + R * math.cos(math.radians(60 * k)), cy + R * math.sin(math.radians(60 * k))) for k in range(6)]
        d.polygon(pts, fill=col)
img.alpha_composite(ov)
b = round(S.BLEED * S.PPM)
# crop to the map area only (board leather margin trimmed)
x0, y0 = S.board_px("A1"); x1, y1 = S.board_px("N9")
box = (int(x0 - R - 6 * S.PPM), int(y0 - R), int(x1 + R + 6 * S.PPM), int(y1 + R))
out = img.crop(box).convert("RGB")
out.thumbnail((2600, 2600))
out.save(HERE / "assets/twin-map.jpg", quality=88)
cw = box[2] - box[0]; ch = box[3] - box[1]
import json
lab = {k: ((S.board_px(k)[0] - box[0]) / cw, (S.board_px(k)[1] - box[1]) / ch) for k in ("B5", "J3", "D5", "F5")}
json.dump(lab, open(HERE / "assets/twin-map.json", "w"))
print(out.size)
