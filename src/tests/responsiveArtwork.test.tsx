import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EncounterCard } from "../components/common/EncounterCard";
import { arrivals, boons, burdens, goldenBoons } from "../data/encounters";
import manifest from "../assets/encounter-cards/web/responsive/manifest.json";

const cards = [arrivals[0], boons[0], burdens[0], goldenBoons[0]];
const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

describe("approved responsive encounter artwork", () => {
  it("ships verified derivatives with untouched source/print files", () => {
    for (const entry of Object.values(manifest.entries)) {
      expect(sha256(entry.source.path)).toBe(entry.source.sha256);
      expect(sha256(entry.print.path)).toBe(entry.print.sha256);
      for (const variant of entry.variants) {
        expect(sha256(variant.path), variant.path).toBe(variant.sha256);
        expect(variant.width).toBeLessThanOrEqual(entry.source.width);
        expect(Math.abs(variant.width / variant.height - entry.source.width / entry.source.height)).toBeLessThan(.001);
      }
    }
    // A frame sits behind live text, so it must arrive with it: about 30 KB at 1x and 100 KB at 2x.
    expect(Object.values(manifest.entries).reduce((sum, entry) => sum + entry.variants[0].bytes, 0)).toBeLessThan(150_000);
    expect(Object.values(manifest.entries).reduce((sum, entry) => sum + entry.variants[1].bytes, 0)).toBeLessThan(450_000);
  });

  it.each(cards)("serves responsive web art and live text for $type, keeping print on the original full-bleed file", (card) => {
    const view = render(<EncounterCard card={card} />);
    const image = view.container.querySelector("img")!;
    const entry = manifest.entries[card.type];
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("decoding", "async");
    expect(image.getAttribute("src")).toContain("-420.webp");
    for (const variant of entry.variants) expect(image.getAttribute("srcset")).toContain(`${variant.width}w`);
    expect(image).toHaveAttribute("width", String(entry.source.width));
    expect(view.container.querySelector("h3")).toHaveTextContent(card.name);
    view.rerender(<EncounterCard card={card} outputMode="print" />);
    expect(image).toHaveAttribute("src", expect.stringContaining(entry.print.path.replace("src", "")));
    expect(image).not.toHaveAttribute("srcset");
    expect(image).not.toHaveAttribute("sizes");
    expect(image).toHaveAttribute("loading", "eager");
    expect(Number(image.width) / Number(image.height)).toBe(.6);
  });
});
