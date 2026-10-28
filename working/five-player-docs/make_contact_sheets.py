from __future__ import annotations

import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw


def page_number(path: Path) -> int:
    match = re.search(r"(\d+)$", path.stem)
    if not match:
        raise ValueError(f"No page number in {path.name}")
    return int(match.group(1))


def build(source: Path, destination: Path) -> None:
    pages = sorted(source.glob("page-*.png"), key=page_number)
    if not pages:
        raise SystemExit(f"No rendered pages found in {source}")

    destination.mkdir(parents=True, exist_ok=True)
    gap = 18
    label_height = 34

    for sheet_index, offset in enumerate(range(0, len(pages), 4), start=1):
        batch = pages[offset : offset + 4]
        opened = [Image.open(path).convert("RGB") for path in batch]
        width = max(image.width for image in opened)
        height = max(image.height for image in opened)
        sheet = Image.new(
            "RGB",
            (width * 2 + gap * 3, (height + label_height) * 2 + gap * 3),
            "#d8d4ca",
        )
        draw = ImageDraw.Draw(sheet)

        for index, (path, page) in enumerate(zip(batch, opened)):
            row, column = divmod(index, 2)
            x = gap + column * (width + gap)
            y = gap + row * (height + label_height + gap)
            sheet.paste(page, (x, y + label_height))
            draw.rectangle((x, y, x + width, y + label_height), fill="#222222")
            draw.text((x + 10, y + 8), f"PAGE {page_number(path)}", fill="white")

        first = page_number(batch[0])
        last = page_number(batch[-1])
        sheet.save(destination / f"pages-{first:02d}-{last:02d}.png", optimize=True)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: make_contact_sheets.py SOURCE_DIR DESTINATION_DIR")
    build(Path(sys.argv[1]), Path(sys.argv[2]))
