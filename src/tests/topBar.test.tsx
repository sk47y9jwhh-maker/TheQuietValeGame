import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TopBar } from "../components/layout/TopBar";
import { createNewGame } from "../engine/setup";

const originalFullscreenEnabled = Object.getOwnPropertyDescriptor(
  document,
  "fullscreenEnabled"
);
const originalFullscreenElement = Object.getOwnPropertyDescriptor(
  document,
  "fullscreenElement"
);
const originalExitFullscreen = Object.getOwnPropertyDescriptor(
  document,
  "exitFullscreen"
);
const originalRequestFullscreen = Object.getOwnPropertyDescriptor(
  document.documentElement,
  "requestFullscreen"
);

function restoreDescriptor(
  target: object,
  key: string,
  descriptor: PropertyDescriptor | undefined
) {
  if (descriptor) {
    Object.defineProperty(target, key, descriptor);
    return;
  }

  delete (target as Record<string, unknown>)[key];
}

describe("top bar", () => {
  afterEach(() => {
    restoreDescriptor(document, "fullscreenEnabled", originalFullscreenEnabled);
    restoreDescriptor(document, "fullscreenElement", originalFullscreenElement);
    restoreDescriptor(document, "exitFullscreen", originalExitFullscreen);
    restoreDescriptor(
      document.documentElement,
      "requestFullscreen",
      originalRequestFullscreen
    );
  });

  it("toggles fullscreen from the top controls", async () => {
    let fullscreenElement: Element | null = null;
    const requestFullscreen = vi.fn(() => {
      fullscreenElement = document.documentElement;
      document.dispatchEvent(new Event("fullscreenchange"));
      return Promise.resolve();
    });
    const exitFullscreen = vi.fn(() => {
      fullscreenElement = null;
      document.dispatchEvent(new Event("fullscreenchange"));
      return Promise.resolve();
    });

    Object.defineProperty(document, "fullscreenEnabled", {
      configurable: true,
      value: true
    });
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => fullscreenElement
    });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: exitFullscreen
    });
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: requestFullscreen
    });

    render(<TopBar state={{ ...createNewGame(1, ["vanguard"]), phase: "turns" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Enter fullscreen" }));

    expect(requestFullscreen).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Exit fullscreen" })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "Exit fullscreen" }));

    expect(exitFullscreen).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Enter fullscreen" })).toBeInTheDocument()
    );
  });
});
