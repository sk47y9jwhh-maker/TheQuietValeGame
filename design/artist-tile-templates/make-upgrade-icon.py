# Upgrade icon: a hex tile turning over, with a sweeping arrow. Hand-inked style to match the artist's icons.
import math, random, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
S = 4                      # supersample
W, H = 300 * S, 280 * S
rng = random.Random(7)
INK = (24, 22, 20, 255)
PARCH = (238, 226, 190, 255)
PARCH_SHADE = (214, 196, 150, 255)
EDGE = (150, 120, 78, 255)
BRASS = (201, 176, 120, 255)
BRASS_DARK = (160, 132, 82, 255)

img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

def jitter(p, a=1.6):
    return (p[0] + rng.uniform(-a, a) * S, p[1] + rng.uniform(-a, a) * S)

def rough(points, width=4.2, passes=2, closed=False, colour=INK, wobble=1.4):
    pts = list(points) + ([points[0]] if closed else [])
    for k in range(passes):
        dense = []
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
            n = max(2, int(math.hypot(x2 - x1, y2 - y1) / (10 * S)))
            for i in range(n):
                t = i / n
                dense.append(jitter((x1 + (x2 - x1) * t, y1 + (y2 - y1) * t), wobble))
        dense.append(jitter(pts[-1], wobble))
        w = width * S * (1 if k == 0 else 0.55)
        d.line(dense, fill=colour, width=int(w), joint="curve")

def hatch(poly, spacing=7, angle=55, width=1.6, colour=INK, density=1.0):
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).polygon(poly, fill=255)
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    a = math.radians(angle)
    dx, dy = math.cos(a), math.sin(a)
    span = int(math.hypot(W, H))
    for off in range(-span, span, int(spacing * S)):
        if rng.random() > density:
            continue
        cx, cy = W / 2 + -dy * off, H / 2 + dx * off
        p1 = (cx - dx * span, cy - dy * span); p2 = (cx + dx * span, cy + dy * span)
        ld.line([jitter(p1, 2), jitter(p2, 2)], fill=colour, width=int(width * S))
    img.alpha_composite(Image.composite(layer, Image.new("RGBA", (W, H), (0, 0, 0, 0)), mask))

def project(points3, tilt, turn, cx, cy, scale):
    out = []
    ct, st, cr, sr = math.cos(tilt), math.sin(tilt), math.cos(turn), math.sin(turn)
    for x, y, z in points3:
        # turn about the y axis (the flip), then tilt towards the viewer
        x1, z1 = x * cr + z * sr, -x * sr + z * cr
        y2, z2 = y * ct - z1 * st, y * st + z1 * ct
        out.append((cx + x1 * scale, cy + y2 * scale, z2))
    return out

# A flat-top hex slab, lying in the x/y plane, thickness along z.
R, T = 1.0, 0.2
hexpts = [(R * math.cos(k * math.pi / 3), R * math.sin(k * math.pi / 3)) for k in range(6)]
top3 = [(x, y, T / 2) for x, y in hexpts]
bot3 = [(x, y, -T / 2) for x, y in hexpts]
tilt, turn = math.radians(52), math.radians(-30)
cx, cy, sc = W * 0.5, H * 0.64, 100 * S
top = project(top3, tilt, turn, cx, cy, sc)
bot = project(bot3, tilt, turn, cx, cy, sc)

# Shadow on the table
d.ellipse([cx - 120 * S, cy + 58 * S, cx + 120 * S, cy + 86 * S], fill=(60, 50, 35, 70))
# Side faces facing the viewer (z of the face centre)
sides = []
for k in range(6):
    j = (k + 1) % 6
    quad = [top[k][:2], top[j][:2], bot[j][:2], bot[k][:2]]
    depth = (top[k][2] + top[j][2] + bot[j][2] + bot[k][2]) / 4
    sides.append((depth, quad))
sides.sort()
for depth, quad in sides[3:]:
    d.polygon(quad, fill=EDGE)
    hatch(quad, spacing=5, angle=100, width=1.4, density=0.9)
    rough(quad, width=3.4, closed=True)
# Top face: parchment, a hatched shade on its far side
topq = [p[:2] for p in top]
d.polygon(topq, fill=PARCH)
far = [topq[3], topq[4], topq[5], ((topq[5][0] + topq[3][0]) / 2, (topq[5][1] + topq[3][1]) / 2)]
d.polygon(topq, fill=PARCH)
hatch([topq[2], topq[3], topq[4], ((topq[4][0] + topq[1][0]) / 2, (topq[4][1] + topq[1][1]) / 2)], spacing=9, angle=40, width=1.3, colour=(120, 100, 70, 170), density=0.85)
# an inner frame line, like the printed tiles
inner = project([(x * 0.78, y * 0.78, T / 2) for x, y in hexpts], tilt, turn, cx, cy, sc)
rough([p[:2] for p in inner], width=1.8, closed=True, passes=1, colour=(90, 75, 55, 255), wobble=0.9)
rough(topq, width=4.6, closed=True)

# The turning arrow: a tapering arc over the tile, left to right, head turning down.
acx, acy, rx, ry = W * 0.5, H * 0.56, 118 * S, 96 * S
a0, a1 = 195, 335
def at(a, rxk, ryk):
    r = math.radians(a); return (acx + rx * rxk * math.cos(r), acy + ry * ryk * math.sin(r))
outer = [at(a, 1.04 + 0.07 * (a - a0) / (a1 - a0), 1.05 + 0.08 * (a - a0) / (a1 - a0)) for a in np.linspace(a0, a1, 60)]
innerA = [at(a, 0.96 - 0.07 * (a - a0) / (a1 - a0), 0.95 - 0.08 * (a - a0) / (a1 - a0)) for a in np.linspace(a1, a0, 60)]
band = outer + innerA
d.polygon(band, fill=BRASS)
hatch(band, spacing=6, angle=-30, width=1.2, colour=(110, 85, 45, 200), density=0.7)
r = math.radians(a1)
tan = (-rx * math.sin(r), ry * math.cos(r)); L = math.hypot(*tan); tan = (tan[0] / L, tan[1] / L)
mo, mi = outer[-1], innerA[0]
mid = ((mo[0] + mi[0]) / 2, (mo[1] + mi[1]) / 2)
nx, ny = mo[0] - mi[0], mo[1] - mi[1]
hw = 1.9
head = [(mid[0] + nx * hw / 2 * 1.0, mid[1] + ny * hw / 2), (mid[0] + tan[0] * 58 * S, mid[1] + tan[1] * 58 * S), (mid[0] - nx * hw / 2, mid[1] - ny * hw / 2)]
d.polygon(head, fill=BRASS)
hatch(head, spacing=6, angle=-30, width=1.2, colour=(110, 85, 45, 200), density=0.7)
rough(outer, width=4.4)
rough(innerA, width=4.4)
rough([innerA[-1], outer[0]], width=4.4)
rough(head, width=4.6, closed=True)

out = img.resize((W // S, H // S), Image.Resampling.LANCZOS)
bbox = out.getbbox(); out = out.crop(bbox)
out.save(sys.argv[1] if len(sys.argv) > 1 else "icon-Upgrade.png")
print(out.size)
