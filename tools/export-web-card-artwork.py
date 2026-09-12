"""Derive web artwork without overwriting the artist's full-bleed exports."""
from pathlib import Path
import json
import shutil
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'src/assets/encounter-cards'
WEB = SOURCE / 'web'
PRINT = ROOT / 'output/card-versions/print'
WEB_COPY = ROOT / 'output/card-versions/web'
BLEED_MM = 3.0
CANVAS_MM = (76.2, 127.0)
for folder in (WEB, PRINT, WEB_COPY):
    folder.mkdir(parents=True, exist_ok=True)
records = []
for source in sorted(SOURCE.glob('*.png')):
    with Image.open(source) as image:
        width, height = image.size
        dx, dy = width * BLEED_MM / CANVAS_MM[0], height * BLEED_MM / CANVAS_MM[1]
        size = (round(width - 2 * dx), round(height - 2 * dy))
        web = image.resize(size, Image.Resampling.LANCZOS, box=(dx, dy, width - dx, height - dy))
        options = {'icc_profile': image.info['icc_profile']} if 'icc_profile' in image.info else {}
        web.save(WEB / source.name, optimize=True, **options)
    shutil.copy2(source, PRINT / source.name)
    shutil.copy2(WEB / source.name, WEB_COPY / source.name)
    records.append({'file': source.name, 'printPixels': [width, height], 'webPixels': list(size),
                    'printCanvasMm': list(CANVAS_MM), 'webFaceMm': [70.2, 121.0],
                    'bleedMmPerEdge': BLEED_MM, 'cropPixelsPerEdge': [dx, dy]})
(SOURCE / 'web/manifest.json').write_text(json.dumps(records, indent=2) + '\n')
print(f'Created {len(records)} web images and retained their full-bleed print copies.')
