#!/usr/bin/env python3
"""Make quest-front-background-clean-600dpi.png from the Quest front background.

Removes the compass medallion, the three baked-in dividers and the gold glow
bands, so the renderer can draw dividers and glows (moved up) itself.

The parchment is split into its shading (low frequency) and its grain and
ink (high frequency):
- shading is rebuilt as one even, symmetrical field: the colour across the
  card is measured on plain parchment, and the soft darkening at the foot is
  kept and mirrored to the head, so no light or patch is left where the
  medallion and glows were;
- grain and ink (corner ornaments, frame edge) are kept from the original,
  except under the medallion and dividers, where plain grain is borrowed.
"""
import sys
import cv2
import numpy as np
from PIL import Image, ImageDraw

src, out = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
H, W = im.shape[:2]

# Parchment area inside the gold frame (corners chamfered).
x0, x1, y0, y1, ch = 167, 1463, 164, 2086, 46
pm = Image.new("L", (W, H), 0)
ImageDraw.Draw(pm).polygon([(x0 + ch, y0), (x1 - ch, y0), (x1, y0 + ch), (x1, y1 - ch), (x1 - ch, y1), (x0 + ch, y1), (x0, y1 - ch), (x0, y0 + ch)], fill=255)
paper = np.asarray(pm) > 0

def masked_blur(img, mask, sigma):
    w = mask.astype(np.float32)
    num = cv2.GaussianBlur(img * w[..., None], (0, 0), sigma)
    den = cv2.GaussianBlur(w, (0, 0), sigma)[..., None]
    return num / np.maximum(den, 1e-4)

# Things to remove outright (their grain is replaced too).
m = Image.new("L", (W, H), 0)
d = ImageDraw.Draw(m)
d.ellipse((815 - 228, 372 - 228, 815 + 228, 372 + 228), fill=255)       # medallion
for y in (677, 919, 1452):                                               # dividers
    d.rectangle((195, y - 34, 1435, y + 34), fill=255)
for box in ((250, 690, 1380, 910), (360, 925, 1270, 1055), (360, 1455, 1270, 1585), (540, 215, 1090, 640)):
    d.ellipse(box, fill=255)                                             # glows and top light
remove = cv2.dilate(np.asarray(m), np.ones((9, 9), np.uint8)) > 0
# Ink (ornament lines) must not darken the shading estimate.
lum = im @ np.array([0.299, 0.587, 0.114], np.float32)
ink = cv2.dilate((lum < 170).astype(np.uint8), np.ones((7, 7), np.uint8)) > 0

# Shading and grain of the original, measured only on parchment.
sig = 22
low = masked_blur(im, paper & ~remove & ~ink, sig)
# Grain and ink as a brightness ratio, so lines stay a neutral dark and do
# not pick up a colour cast from the shading they used to sit on.
L = lambda x: x @ np.array([0.299, 0.587, 0.114], np.float32)
hf = np.clip(L(im) / np.maximum(L(low), 1), 0, 1.6)

# Plain-grain substitute for the removed areas.
patch = im[1080:1420, 300:1330]
phf = L(patch) / np.maximum(L(cv2.GaussianBlur(patch, (0, 0), sig)), 1)
reps_y, reps_x = H // phf.shape[0] + 2, W // phf.shape[1] + 2
row = np.concatenate([phf if i % 2 == 0 else phf[:, ::-1] for i in range(reps_x)], axis=1)
tile = np.concatenate([row if j % 2 == 0 else row[::-1] for j in range(reps_y)], axis=0)[:H, :W]
ra = cv2.GaussianBlur(remove.astype(np.float32), (0, 0), 12)
hf = hf * (1 - ra) + tile * ra

# New shading: colour across the card from plain rows, made symmetrical ...
band = masked_blur(im, paper & ~remove & ~ink, 60)
col = band[1100:1400].mean(axis=0)                    # (W, 3)
col = (col + col[::-1]) / 2
# ... and the darkening at the foot, mirrored to the head.
mid = band[1100:1400, 400:1230].mean(axis=(0, 1))
foot = band[:, 400:1230].mean(axis=1) / mid           # (H, 3) ratio per row
ratio = np.ones((H, 3), np.float32)
start = 1750
ratio[start:] = np.minimum(foot[start:], 1.0)
for y in range(start, y1 + 1):
    t = y1 - y                                       # distance from the foot edge
    if y0 + t < H:
        ratio[y0 + t] = ratio[y]
ratio[:y0] = ratio[y0]
ratio = cv2.GaussianBlur(ratio[:, None, :], (0, 0), sigmaX=0.1, sigmaY=10)[:, 0, :]
shade = col[None, :, :] * ratio[:, None, :]

new = shade * hf[..., None]
pa = cv2.GaussianBlur(paper.astype(np.float32), (0, 0), 1.2)[..., None]
outim = im * (1 - pa) + new * pa
Image.fromarray(np.clip(outim, 0, 255).astype(np.uint8)).save(out, dpi=(600, 600))
print("wrote", out)
