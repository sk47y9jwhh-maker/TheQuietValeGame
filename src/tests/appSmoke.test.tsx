import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App";

describe("app smoke flow", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("defaults new games to solo play", () => {
    render(<App />);

    expect(screen.getAllByText("1 Player").length).toBeGreaterThan(0);
  });

  it("starts a seeded game and asks for Steward placement first", () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("Randomizer Seed"), {
      target: { value: "QV-SMOKE" }
    });
    fireEvent.click(screen.getByRole("button", { name: /start season i/i }));

    expect(screen.getByText("Setup")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vanguard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm vanguard start/i })).toBeEnabled();
  });

  it("declares one available Ledger Vow before setup", () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("Steward's Ledger Vow"), {
      target: { value: "LE-029" }
    });
    expect(screen.getByText(/No Arrival may expire/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /start season i/i }));

    const saved = JSON.parse(
      window.localStorage.getItem("quietVale.activeGame.v1") ?? "{}"
    );
    expect(saved.state.ledgerRun.declaredVowId).toBe("LE-029");
  });

  it("confirms the solo Steward start and shows the seeding screen", () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("Randomizer Seed"), {
      target: { value: "QV-SMOKE" }
    });
    fireEvent.click(screen.getByRole("button", { name: /start season i/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm vanguard start/i }));

    expect(screen.getByText("Season 1 Seeding")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vanguard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm seeding/i })).toBeEnabled();
  });

  it("advances from solo seeding to reveal", () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("Randomizer Seed"), {
      target: { value: "QV-SMOKE" }
    });
    fireEvent.click(screen.getByRole("button", { name: /start season i/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm vanguard start/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm seeding/i }));

    expect(screen.getByRole("heading", { name: /reveal encounters/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reveal encounters/i })).toBeEnabled();
  });

  it("restores an active saved game after reopening the app", () => {
    const first = render(<App />);

    fireEvent.change(screen.getByLabelText("Randomizer Seed"), {
      target: { value: "QV-SAVED" }
    });
    fireEvent.click(screen.getByRole("button", { name: /start season i/i }));
    expect(screen.getByRole("heading", { name: "Vanguard" })).toBeInTheDocument();

    first.unmount();
    render(<App />);

    expect(screen.getByRole("heading", { name: "Vanguard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset game/i })).toBeInTheDocument();
  });

  it("undoes the last committed game step", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /start season i/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm vanguard start/i }));

    expect(screen.getByText("Season 1 Seeding")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /undo last game step/i }));

    expect(screen.getByRole("heading", { name: "Vanguard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm vanguard start/i })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: /redo undone game step/i }));

    expect(screen.getByText("Season 1 Seeding")).toBeInTheDocument();
  });

  it("redoes a browser Back undo when browser Forward is used", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /start season i/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm vanguard start/i }));

    expect(screen.getByText("Season 1 Seeding")).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(
        new PopStateEvent("popstate", {
          state: { quietValeHistory: true, quietValeIndex: 0 }
        })
      );
    });

    expect(screen.getByRole("heading", { name: "Vanguard" })).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(
        new PopStateEvent("popstate", {
          state: { quietValeHistory: true, quietValeIndex: 1 }
        })
      );
    });

    expect(screen.getByText("Season 1 Seeding")).toBeInTheDocument();
  });

  it("resets the active saved game", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /start season i/i }));
    expect(screen.getByRole("heading", { name: "Vanguard" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /reset game/i }));

    expect(screen.getAllByText("1 Player").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /start season i/i })).toBeInTheDocument();
    expect(window.localStorage.getItem("quietVale.activeGame.v1")).toBeNull();
  });
});
