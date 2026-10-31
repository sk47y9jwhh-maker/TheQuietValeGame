"""Build the poker card back print files (gold and silver) from the artist's
Photoshop composite.

Usage, from this folder (needs ImageMagick 6, Python with Pillow, NumPy, SciPy):

    mkdir -p /tmp/cb/layers
    convert "card-back-master-v01.psd[0]" -compress none /tmp/cb/orig_cmyk.tif
    for i in 5 6 7 8 9; do convert "card-back-master-v01.psd[$i]" -colorspace sRGB /tmp/cb/layers/L$i.png; done
    python3 build-poker-print.py /tmp/cb /tmp/cb/layers print/card-back-poker

ImageMagick layer numbers: 5 compass (Bussola copia), 6 Corners, 7 Outer Frame,
8 Title, 9 Title copia. Only their transparency is used. ImageMagick cannot
render the PSD's effects, so all colour comes from layer 0, Photoshop's own
composite. Do not print from a Photopea composite: it does not match Photoshop.


Every pixel comes from the master's own CMYK composite. Steps: fill both
titles from the pattern one or two repeats away, cut a 464-row band through
the middle (two pattern repeats, so the hex lattice stays continuous),
re-paste the compass, widen the leather margin, scale to 1630 x 2220 px
(69 x 94 mm at 600 dpi), convert with FOGRA39 relative colorimetric (the
setting that reproduces the tarot print file exactly).
"""
import sys
import numpy as np
from PIL import Image, ImageCms
from scipy.ndimage import binary_dilation, gaussian_filter

S = sys.argv[1]           # scratch dir with orig_cmyk.tif
LAY = sys.argv[2]         # dir with extracted layer PNGs
OUT = sys.argv[3]         # output prefix

o = np.asarray(Image.open(f"{S}/orig_cmyk.tif")).astype(np.float64)
H, W, _ = o.shape


def layer_alpha(name, x0, y0):
    a = np.asarray(Image.open(f"{LAY}/{name}").convert("RGBA"))[:, :, 3]
    full = np.zeros((H, W), bool)
    h, w = a.shape
    ys, xs = slice(max(0, y0), min(H, y0 + h)), slice(max(0, x0), min(W, x0 + w))
    full[ys, xs] = a[ys.start - y0:ys.stop - y0, xs.start - x0:xs.stop - x0] > 4
    return full


corners = layer_alpha("L6.png", 182, 182)
frame = layer_alpha("L7.png", 143, 143)
corners_guard = binary_dilation(corners | frame, iterations=5)
compass = layer_alpha("L5.png", 567, 1167)


def disk(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r


def masked_blur(img, m, sigma):
    num = gaussian_filter(img * m[..., None], (sigma, sigma, 0))
    den = gaussian_filter(m.astype(float), sigma)[..., None]
    return num / np.maximum(den, 1e-6)


def fill_title(img, title_alpha, dy):
    mask = binary_dilation(title_alpha, structure=disk(48)) & ~corners_guard
    shifted = np.roll(img, -dy, axis=0)            # shifted[y] = img[y + dy]
    lo = img - shifted                                # includes the smooth glow difference
    detail = lo - gaussian_filter(lo, (25, 25, 0))    # what is left is title glow or leather grain
    effect = gaussian_filter(np.abs(detail).sum(2), 8) > 45
    ring = binary_dilation(mask, structure=disk(60)) & ~mask & ~corners_guard & ~effect
    diff = masked_blur(lo, ring, 45)                  # smooth brightness difference, filled in across the mask
    patch = shifted + diff
    soft = gaussian_filter(mask.astype(float), 3)[..., None]
    soft = np.clip(soft * 1.6, 0, 1) * binary_dilation(mask, iterations=6)[..., None]
    return img * (1 - soft) + patch * soft


img = o.copy()
img = fill_title(img, layer_alpha("L8.png", 505, 283), 464)       # top title, pattern from one repeat below
img = fill_title(img, layer_alpha("L9.png", 508, 2470), -464)     # bottom title, two repeats above

# Cut 464 rows centred on the card (rows 1268..1732), cross-fading 40 rows.
c0, c1, w = 1268, 1732, 20
ramp = np.linspace(0, 1, 2 * w)[:, None, None]
blend = img[c0 - w:c0 + w] * (1 - ramp) + img[c1 - w:c1 + w] * ramp
cut = np.concatenate([img[:c0 - w], blend, img[c1 + w:]], axis=0)
cut_comp = np.concatenate([compass[:c0 - w], np.zeros((2 * w, W), bool), compass[c1 + w:]], axis=0)

# Re-paste the compass whole, centred where the cut put the card's centre.
cm = binary_dilation(compass, iterations=3)
soft = gaussian_filter(cm.astype(float), 1.5)[..., None]
src = img[1167 - 20:1835 + 20]
sm = soft[1167 - 20:1835 + 20]
ty = 1167 - 20 - 232
cut[ty:ty + src.shape[0]] = cut[ty:ty + src.shape[0]] * (1 - sm) + src * sm

# Widen to the poker ratio: 1630/2220 of 2536 rows = 1862 columns.
Hc = cut.shape[0]
Wt = round(Hc * 1630 / 2220)
pad = (Wt - W) // 2
padR = Wt - W - pad
wide = np.concatenate([cut[:, pad - 1::-1][:, :pad], cut, cut[:, -1:-padR - 1:-1]], axis=1)

cm8 = np.clip(np.round(wide), 0, 255).astype(np.uint8)
big = Image.fromarray(cm8, "CMYK")
poker = big.resize((1630, 2220), Image.LANCZOS)

fog = ImageCms.ImageCmsProfile("/usr/share/texlive/texmf-dist/tex/generic/colorprofiles/FOGRA39L_coated.icc")
srgb = ImageCms.createProfile("sRGB")
tr = ImageCms.buildTransform(fog, srgb, "CMYK", "RGB", renderingIntent=ImageCms.Intent.RELATIVE_COLORIMETRIC)
rgb = ImageCms.applyTransform(poker, tr)
srgb_icc = ImageCms.ImageCmsProfile(srgb).tobytes()
rgb.save(f"{OUT}-gold-printerstudio-600dpi.png", dpi=(600, 600), icc_profile=srgb_icc)

# Silver: only the metal changes. Pixels with RGB chroma below 12 (leather, glow)
# stay exactly as they are, above 28 they turn fully silver, smooth in between.
g = np.asarray(rgb).astype(np.float64)
chroma = g.max(2) - g.min(2)
t = np.clip((chroma - 12) / (28 - 12), 0, 1)
w = (t * t * (3 - 2 * t))[..., None]
light = (g.max(2) + g.min(2)) / 2
light = light + (255 - light) * 0.06          # Hue/Saturation: saturation -100, lightness +6
silver = g * (1 - w) + np.repeat(light[..., None], 3, 2) * w
Image.fromarray(np.clip(np.round(silver), 0, 255).astype(np.uint8), "RGB").save(
    f"{OUT}-silver-printerstudio-600dpi.png", dpi=(600, 600), icc_profile=srgb_icc)
print("cut height", Hc, "widened to", Wt, "pad", pad, padR)
