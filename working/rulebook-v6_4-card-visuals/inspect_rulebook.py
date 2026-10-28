from __future__ import annotations

import sys
from pathlib import Path

from docx import Document
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph


def iter_blocks(document: Document):
    for child in document.element.body.iterchildren():
        if child.tag == qn("w:p"):
            yield "P", Paragraph(child, document)
        elif child.tag == qn("w:tbl"):
            yield "T", Table(child, document)


def paragraph_flags(paragraph: Paragraph) -> str:
    xml = paragraph._p.xml
    flags = []
    if "w:br w:type=\"page\"" in xml:
        flags.append("PAGE_BREAK")
    if "w:pageBreakBefore" in xml:
        flags.append("PAGE_BEFORE")
    drawings = len(paragraph._p.xpath(".//w:drawing"))
    if drawings:
        flags.append(f"DRAWINGS={drawings}")
    return ",".join(flags) or "-"


def main() -> None:
    source = Path(sys.argv[1])
    document = Document(source)
    for index, (kind, block) in enumerate(iter_blocks(document)):
        if kind == "P":
            text = " ".join(block.text.split())
            if len(text) > 190:
                text = text[:187] + "..."
            print(
                f"{index:03d} P style={block.style.name!r} "
                f"flags={paragraph_flags(block)} text={text!r}"
            )
        else:
            preview = " | ".join(
                " ".join(cell.text.split())
                for row in block.rows[:2]
                for cell in row.cells
            )
            if len(preview) > 190:
                preview = preview[:187] + "..."
            print(
                f"{index:03d} T rows={len(block.rows)} cols={len(block.columns)} "
                f"preview={preview!r}"
            )


if __name__ == "__main__":
    main()
