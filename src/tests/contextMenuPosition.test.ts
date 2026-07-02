import { describe, expect, it } from "vitest";
import { fitContextMenuToViewport } from "../app/contextMenuPosition";

describe("map context menu positioning", () => {
  it("keeps a menu below an upper hex when there is room", () => {
    expect(fitContextMenuToViewport(300, 100, 220, 280, 1280, 720)).toEqual({
      left: 300,
      top: 108
    });
  });

  it("flips a menu above a lower hex", () => {
    const position = fitContextMenuToViewport(300, 680, 220, 280, 1280, 720);

    expect(position).toEqual({ left: 300, top: 392 });
    expect(position.top + 280).toBeLessThanOrEqual(712);
  });

  it("clamps the menu inside the horizontal viewport edges", () => {
    expect(fitContextMenuToViewport(1260, 100, 220, 280, 1280, 720).left).toBe(1052);
    expect(fitContextMenuToViewport(-20, 100, 220, 280, 1280, 720).left).toBe(8);
  });

  it("pins an oversized menu to the safe top edge", () => {
    expect(fitContextMenuToViewport(300, 680, 220, 900, 1280, 720).top).toBe(8);
  });
});
