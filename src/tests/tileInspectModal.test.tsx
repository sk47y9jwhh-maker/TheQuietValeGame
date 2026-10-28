import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { describe, expect, it } from "vitest";
import { TileInspectModal } from "../components/map/TileInspectModal";
import { createNewGame } from "../engine/setup";

describe("tile inspector", () => {
  it("keeps keyboard focus inside the dialog and restores the opener on Escape", () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return <><button onClick={() => setOpen(true)}>Inspect tile</button><button>Outside action</button><TileInspectModal state={createNewGame(1, ["vanguard"])} tileId={open ? "c01_lumber_yard" : null} onClose={() => setOpen(false)} /></>;
    }
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Inspect tile" });
    const outside = screen.getByRole("button", { name: "Outside action" });
    opener.focus();
    fireEvent.click(opener);
    const close = screen.getByRole("button", { name: "Close tile inspection" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(close).toHaveFocus();
    outside.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("isolates a nested inspector from every surrounding branch in StrictMode", () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return <div>
        <header><button>Header action</button></header>
        <main>
          <aside><button>Other decision</button></aside>
          <section>
            <button onClick={() => setOpen(true)}>Open nested inspector</button>
            <TileInspectModal state={createNewGame(1, ["vanguard"])} tileId={open ? "c01_lumber_yard" : null} onClose={() => setOpen(false)} />
          </section>
        </main>
        <footer><button>Reference tray</button></footer>
      </div>;
    }
    const view = render(<StrictMode><Harness /></StrictMode>);
    const opener = screen.getByRole("button", { name: "Open nested inspector" });
    const background = ["Header action", "Other decision", "Open nested inspector", "Reference tray"].map(name => ({ name, button: screen.getByRole("button", { name }) }));
    opener.focus(); fireEvent.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Lumber Yard" });
    expect(dialog.closest("[inert], [aria-hidden='true']")).toBeNull();
    for (const { name, button } of background) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
      expect(button.closest("[inert]")).not.toBeNull();
    }
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(screen.getByRole("button", { name: "Close tile inspection" }), { key: "Escape" });
    expect(opener).toHaveFocus();
    expect(view.container.querySelector("[inert], [aria-hidden='true']")).toBeNull();
    expect(screen.getByRole("button", { name: "Reference tray" })).toBeVisible();
    expect(document.body.style.overflow).toBe("");
  });

  it("restores existing background attributes and scroll settings when unmounted while open", () => {
    const prehidden = document.createElement("aside");
    prehidden.setAttribute("aria-hidden", "true"); prehidden.setAttribute("inert", "");
    const exposed = document.createElement("aside"); exposed.setAttribute("aria-hidden", "false");
    document.body.append(prehidden, exposed);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "auto";
    const view = render(<TileInspectModal state={createNewGame(1, ["vanguard"])} tileId="c01_lumber_yard" onClose={() => {}} />);
    try {
      expect(exposed).toHaveAttribute("inert");
      expect(exposed).toHaveAttribute("aria-hidden", "true");
      view.unmount();
      expect(prehidden).toHaveAttribute("inert");
      expect(prehidden).toHaveAttribute("aria-hidden", "true");
      expect(exposed).not.toHaveAttribute("inert");
      expect(exposed).toHaveAttribute("aria-hidden", "false");
      expect(document.body.style.overflow).toBe("auto");
    } finally { view.unmount(); prehidden.remove(); exposed.remove(); document.body.style.overflow = overflow; }
  });

  it("shows Linked Production on both sides of a Core Resource Tile", () => {
    const state = createNewGame(1, ["vanguard"]);

    render(
      <TileInspectModal
        state={state}
        tileId="c01_lumber_yard"
        onClose={() => {}}
      />
    );

    expect(screen.getByRole("heading", { name: "Lumber Yard" })).toBeInTheDocument();
    expect(screen.getByText("Supply 4/4")).toBeInTheDocument();
    const effectTexts = screen.getAllByText(/Passive: Linked Production/);
    expect(effectTexts).toHaveLength(2);
    expect(effectTexts[0]).toHaveTextContent(
      /every immediately adjacent, non-Overstrained producer from the same tile stack/i
    );
    expect(effectTexts[0]).toHaveTextContent(
      /Later activations that round produce only from the chosen tile/i
    );
  });
});
