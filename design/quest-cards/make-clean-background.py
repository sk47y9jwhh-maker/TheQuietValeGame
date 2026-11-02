#!/usr/bin/env python3
"""Make quest-front-background-clean-600dpi.png from the Quest front background:
removes the compass medallion, the three baked-in dividers and the three gold
glow bands, so the renderer can place dividers and glows (moved up) itself.

Removal keeps the parchment's own texture: the low-frequency colour is filled
in from the surroundings (inpainting at 1/8 scale) and the fine grain is
borrowed from a plain patch of the same parchment.
"""
import sys
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

src, out = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
H, W = im.shape[:2]
m = Image.new("L", (W, H), 0)
d = ImageDraw.Draw(m)
d.ellipse((815 - 205, 372 - 205, 815 + 205, 372 + 205), fill=255)      # medallion
for y in (677, 919, 1452):                                              # dividers
    d.rectangle((215, y - 26, 1415, y + 26), fill=255)
d.ellipse((250, 690, 1380, 910), fill=255)                               # title glow
d.ellipse((380, 930, 1250, 1050), fill=255)                              # top label glow
d.ellipse((380, 1462, 1250, 1580), fill=255)                             # bottom label glow
explicit = np.asarray(m) > 0
# The glows spread beyond those shapes as a soft yellow cast: flag warm,
# saturated pixels in the upper card too (the lower vignette is kept).
# Only round the removed glows (y 640-1600); the top light and the corner
# ornaments are kept.
warm = (im[..., 0] - im[..., 2]) > 44
warm[:640] = False
warm[1600:] = False
warm[:, :185] = False
warm[:, W - 185:] = False
mask = explicit | warm
mask = cv2.dilate(mask.astype(np.uint8), np.ones((41, 41), np.uint8)) > 0
inner = np.zeros((H, W), bool); inner[640:1650, 185:W - 185] = True
inner[165:640, 470:W - 470] = True      # between the top corner ornaments
mask &= inner
inner = np.zeros((H, W), bool); inner[160:2080, 175:W - 175] = True

# Low frequency: normalised blur of the clean parchment only.
clean_zone = np.zeros((H, W), bool); clean_zone[160:2080, 250:W - 250] = True
wgt = (~mask & clean_zone).astype(np.float32)
num = cv2.GaussianBlur(im * wgt[..., None], (0, 0), 90)
den = cv2.GaussianBlur(wgt, (0, 0), 90)[..., None]
low = num / np.maximum(den, 1e-3)

# High frequency: the grain of a plain patch, mirrored to cover the card.
patch = im[1090:1400, 300:1330]
hf = patch - cv2.GaussianBlur(patch, (0, 0), 14)
reps_y, reps_x = H // hf.shape[0] + 2, W // hf.shape[1] + 2
row = np.concatenate([hf if i % 2 == 0 else hf[:, ::-1] for i in range(reps_x)], axis=1)
tile = np.concatenate([row if j % 2 == 0 else row[::-1] for j in range(reps_y)], axis=0)[:H, :W]

fill = low + tile
# Full replacement inside the mask, feathered only outwards.
grown = cv2.dilate(mask.astype(np.uint8), np.ones((61, 61), np.uint8)).astype(np.float32)
alpha = np.maximum(cv2.GaussianBlur(grown, (0, 0), 22), mask.astype(np.float32))
alpha = np.clip(alpha * 1.4, 0, 1)
alpha[~inner] = 0
alpha = alpha[..., None]
outim = im * (1 - alpha) + fill * alpha
Image.fromarray(np.clip(outim, 0, 255).astype(np.uint8)).save(out, dpi=(600, 600))
print("wrote", out)
