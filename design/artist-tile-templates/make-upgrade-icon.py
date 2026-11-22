# Upgrade icon: a thin hex tile turning over under a clean brass arrow.
# Drawn to sit with the artist's icons, the cart wheel in particular: smooth arcs, a heavy black
# outer line and a thinner inner line, a brass band shaded with streaks that follow the curve.
#   python3 make-upgrade-icon.py [out.png]
import math, random, sys
import numpy as np
from PIL import Image, ImageDraw

S = 4                                   # supersampling
W, H = 300 * S, 270 * S
rng = random.Random(11)
INK = (22, 20, 18, 255)
BRASS = (205, 186, 140, 255)
BRASS_LIGHT = (240, 230, 200, 255)
BRASS_DARK = (150, 128, 84, 255)
PARCH = (240, 230, 198, 255)
EDGE = (176, 150, 104, 255)

img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(img)


def line(points, width, colour=INK, wobble=0.25):
    """A clean ink line with only a slight hand tremor."""
    pts = [(x + rng.uniform(-wobble, wobble) * S, y + rng.uniform(-wobble, wobble) * S) for x, y in points]
    d.line(pts, fill=colour, width=max(1, int(width * S)), joint="curve")
    r = width * S / 2
    for x, y in (pts[0], pts[-1]):
        d.ellipse([x - r, y - r, x + r, y + r], fill=colour)


def clipped(poly, draw_fn):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(layer))
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).polygon(poly, fill=255)
    img.alpha_composite(Image.composite(layer, Image.new("RGBA", (W, H), (0, 0, 0, 0)), mask))


# ---- the tile: a thin flat-top hex board, tipped up mid-turn -------------------------------
def project(p3, tilt, turn, cx, cy, sc):
    out = []
    ct, st, cr, sr = math.cos(tilt), math.sin(tilt), math.cos(turn), math.sin(turn)
    for x, y, z in p3:
        x1, z1 = x * cr + z * sr, -x * sr + z * cr
        y2, z2 = y * ct - z1 * st, y * st + z1 * ct
        out.append((cx + x1 * sc, cy + y2 * sc, z2))
    return out

R, T = 1.0, 0.075                        # a thin tile
hexp = [(R * math.cos(k * math.pi / 3), R * math.sin(k * math.pi / 3)) for k in range(6)]
tilt, turn = math.radians(58), math.radians(-16)
cx, cy, sc = W * 0.47, H * 0.71, 98 * S
top = project([(x, y, T / 2) for x, y in hexp], tilt, turn, cx, cy, sc)
bot = project([(x, y, -T / 2) for x, y in hexp], tilt, turn, cx, cy, sc)

d.ellipse([cx - 112 * S, cy + 44 * S, cx + 112 * S, cy + 66 * S], fill=(70, 58, 40, 55))   # soft shadow
sides = sorted(((sum(p[2] for p in (top[k], top[(k + 1) % 6], bot[(k + 1) % 6], bot[k])) / 4,
                 [top[k][:2], top[(k + 1) % 6][:2], bot[(k + 1) % 6][:2], bot[k][:2]]) for k in range(6)))
for _, quad in sides[3:]:
    d.polygon(quad, fill=EDGE)
    clipped(quad, lambda ld: [ld.line([(quad[0][0] + (quad[1][0] - quad[0][0]) * t, quad[0][1] + (quad[1][1] - quad[0][1]) * t - 6 * S),
                                        (quad[0][0] + (quad[1][0] - quad[0][0]) * t, quad[0][1] + (quad[1][1] - quad[0][1]) * t + 14 * S)],
                                       fill=(110, 88, 56, 200), width=int(1.3 * S)) for t in np.linspace(0.04, 0.96, 22)])
    line(quad + [quad[0]], 2.4)
topq = [p[:2] for p in top]
d.polygon(topq, fill=PARCH)
# soft shading streaks on the far half of the face
far = [topq[1], topq[2], topq[3], topq[4]]
clipped(topq, lambda ld: [ld.line([(topq[3][0] + i * 9 * S, topq[3][1] - 10 * S), (topq[3][0] + i * 9 * S + 60 * S, topq[3][1] + 60 * S)],
                                  fill=(200, 182, 138, 150), width=int(1.4 * S)) for i in range(0, 9)])
inner = project([(x * 0.8, y * 0.8, T / 2) for x, y in hexp], tilt, turn, cx, cy, sc)
line([p[:2] for p in inner] + [inner[0][:2]], 1.4, colour=(96, 80, 58, 255))
line(topq + [topq[0]], 3.6)

# ---- the arrow: a clean brass arc like the wheel rim, with a crisp head ------------------------
acx, acy = W * 0.5, H * 0.56
rx, ry = 118 * S, 92 * S                 # centre line of the band
band = 0.13                              # band half-width, as a fraction of the radius
a0, a1 = 196, 338                        # degrees, clockwise on screen (y down)

def at(a, k):
    r = math.radians(a)
    return (acx + rx * k * math.cos(r), acy + ry * k * math.sin(r))

angles = np.linspace(a0, a1, 90)
outer = [at(a, 1 + band) for a in angles]
inner_edge = [at(a, 1 - band) for a in angles]
band_poly = outer + inner_edge[::-1]
d.polygon(band_poly, fill=BRASS)
# streaks along the curve: light on the outer half, dark near the inner edge
def streaks(ld):
    for _ in range(26):
        k = rng.uniform(1 - band * 0.8, 1 + band * 0.8)
        s0 = rng.uniform(a0, a1 - 10); s1 = min(a1, s0 + rng.uniform(12, 45))
        light = k > 1 - band * 0.1
        ld.line([at(a, k) for a in np.linspace(s0, s1, 20)], fill=BRASS_LIGHT if light else BRASS_DARK,
                width=int(rng.uniform(1.2, 2.6) * S))
clipped(band_poly, streaks)

# arrow head at a1: a clean triangle pointing along the curve
r1 = math.radians(a1)
tan = (-rx * math.sin(r1), ry * math.cos(r1)); L = math.hypot(*tan); tan = (tan[0] / L, tan[1] / L)
base_o, base_i = at(a1, 1 + band * 2.1), at(a1, 1 - band * 2.1)
mid = at(a1, 1)
tip = (mid[0] + tan[0] * 46 * S, mid[1] + tan[1] * 46 * S)
head = [base_o, tip, base_i]
d.polygon(head, fill=BRASS)
clipped(head, lambda ld: [ld.line([(base_o[0] + (base_i[0] - base_o[0]) * t, base_o[1] + (base_i[1] - base_o[1]) * t), tip],
                                   fill=BRASS_LIGHT if t < 0.45 else BRASS_DARK, width=int(1.6 * S)) for t in np.linspace(0.1, 0.9, 7)])
# ink: heavy outer line, thinner inner line and a fine line just inside the outer edge (the wheel's double rim)
line(outer, 4.6)
line(inner_edge, 2.6)
line([at(a, 1 + band * 0.55) for a in angles[:-4]], 1.0, colour=(120, 100, 66, 255), wobble=0.1)
line([outer[0], inner_edge[0]], 3.0)                          # the tail, cut square
line([base_o, tip, base_i, base_o], 3.8)

out = img.resize((W // S, H // S), Image.Resampling.LANCZOS)
out = out.crop(out.getbbox())
out.save(sys.argv[1] if len(sys.argv) > 1 else "icon-Upgrade.png")
print(out.size)
