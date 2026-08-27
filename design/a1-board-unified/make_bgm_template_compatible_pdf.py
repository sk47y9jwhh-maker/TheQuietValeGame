#!/usr/bin/env python3
"""Wrap a board upload image in the exact page box from BGM's live template."""

from __future__ import annotations

import argparse
from pathlib import Path
from tempfile import NamedTemporaryFile

from pypdf import PdfReader, PdfWriter
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("template", type=Path)
    parser.add_argument("image", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--title", required=True)
    parser.add_argument(
        "--preserve-template",
        action="store_true",
        help="Keep BGM's template page/resources and overlay opaque artwork.",
    )
    args = parser.parse_args()

    page = PdfReader(str(args.template)).pages[0]
    width_pt = float(page.mediabox.width)
    height_pt = float(page.mediabox.height)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary_output = (
        Path(
            NamedTemporaryFile(
                suffix=".pdf",
                dir=args.output.parent,
                delete=False,
            ).name
        )
        if args.preserve_template
        else args.output
    )
    pdf = canvas.Canvas(
        str(temporary_output),
        pagesize=(width_pt, height_pt),
        pageCompression=1,
        pdfVersion=(1, 4),
    )
    pdf.setTitle(args.title)
    pdf.setAuthor("The Quiet Vale project")
    pdf.setSubject(
        "BoardGamesMaker live-template-compatible board artwork"
    )
    pdf.drawImage(
        ImageReader(str(args.image)),
        0,
        0,
        width=width_pt,
        height=height_pt,
        preserveAspectRatio=False,
        mask="auto",
    )
    pdf.showPage()
    pdf.save()

    if args.preserve_template:
        template_reader = PdfReader(str(args.template))
        artwork_reader = PdfReader(str(temporary_output))
        writer = PdfWriter()
        # Clone the complete document so BGM's output-intent/optional-content
        # catalogue and named CMYK layer survive, not just the visible page.
        writer.clone_document_from_reader(template_reader)
        template_page = writer.pages[0]
        # The artwork is a full-page opaque image, so every template guide is
        # covered while the BGM page dictionary and resource structure remain.
        template_page.merge_page(artwork_reader.pages[0], over=True)
        writer.add_metadata(
            {
                "/Title": args.title,
                "/Author": "The Quiet Vale project",
                "/Subject": "Artwork placed on BGM's live generated template",
            }
        )
        with args.output.open("wb") as stream:
            writer.write(stream)
        temporary_output.unlink(missing_ok=True)

    written = PdfReader(str(args.output)).pages[0]
    if (
        abs(float(written.mediabox.width) - width_pt) > 0.001
        or abs(float(written.mediabox.height) - height_pt) > 0.001
    ):
        raise RuntimeError("Output page does not match the BGM template.")

    print(
        f"{args.output} - {width_pt:.3f} x {height_pt:.3f} pt"
    )


if __name__ == "__main__":
    main()
