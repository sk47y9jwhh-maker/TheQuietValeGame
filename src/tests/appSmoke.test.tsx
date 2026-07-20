import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App";
import { createEmptyLedgerCampaign, writeLedgerCampaign } from "../app/ledgerPersistence";

describe("app smoke flow", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("defaults new games to solo play", () => {
    render(<App />);

    expect(screen.getAllByText("1 Player").length).toBeGreaterThan(0);
  });

  it("opens the complete rules drawer before a game starts", () => {
    render(<App />);

    const rulesButton = screen.getByRole("button", { name: /rules how to play/i });
    expect(rulesButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(rulesButton);

    expect(rulesButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("heading", { name: "Rules" })).toBeInTheDocument();
    expect(screen.getByText("Learn to Play")).toBeInTheDocument();
    expect(screen.getByText("1–4 players")).toBeInTheDocument();
    expect(screen.getByText("Set up together")).toBeInTheDocument();
    expect(screen.getByText("Example first turn")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Full rules" }));

    expect(screen.getByRole("heading", { name: "The aim of the game" })).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "2. Choose Stewards and place starts" })
    );
    expect(screen.getByText(/Start with 15 of each resource for 1 player/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close rules drawer" }));

    expect(screen.queryByRole("heading", { name: "Rules" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start season i/i })).toBeInTheDocument();
  });

  it("starts with an automatic shuffle and asks for Steward placement first", () => {
    render(<App />);

    expect(screen.queryByLabelText("Randomizer Seed")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /shuffle/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /start season i/i }));

    expect(screen.getByText("Setup")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vanguard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm vanguard start/i })).toBeEnabled();
    const saved = JSON.parse(
      window.localStorage.getItem("quietVale.activeGame.v1") ?? "{}"
    );
    expect(saved.encounterSeed).toMatch(/^QV-[A-Z0-9]+$/);
  });

  it("shows how locked Ledger Vows become available", () => {
    render(<App />);

    expect(
      screen.getByText(
        "No Vows unlocked yet · first Vow unlocks at 25 completed entries · 0/50 entries complete"
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "No Roads Raised — unlocks at 25 entries" })
    ).toBeDisabled();
    expect(
      screen.getByRole("option", {
        name: "The Small Storehouse — unlocks at 34 entries · 3–4 players only"
      })
    ).toBeDisabled();
  });

  it("declares one available Ledger Vow before setup", () => {
    const campaign = createEmptyLedgerCampaign();
    for (let index = 1; index <= 40; index += 1) {
      const entryId = `test-${index}`;
      campaign.completions[entryId] = {
        entryId,
        completedOnce: true,
        completedPlayerCounts: []
      };
    }
    writeLedgerCampaign(campaign);
    render(<App />);

    fireEvent.change(screen.getByLabelText("Steward's Ledger Vow"), {
      target: { value: "LE-041" }
    });
    expect(screen.getByText(/Place no Travel Tiles/i)).toBeInTheDocument();
    expect(screen.getByText(/Vanguard’s Power.*would break No Roads Raised/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /start season i/i }));

    const saved = JSON.parse(
      window.localStorage.getItem("quietVale.activeGame.v1") ?? "{}"
    );
    expect(saved.state.ledgerRun.declaredVowId).toBe("LE-041");
  });

  it("confirms the solo Steward start and shows the seeding screen", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /start season i/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm vanguard start/i }));

    expect(screen.getByText("Season 1 Seeding")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vanguard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm seeding/i })).toBeEnabled();
  });

  it("advances from solo seeding to reveal", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /start season i/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm vanguard start/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm seeding/i }));

    expect(screen.getByRole("heading", { name: /reveal encounters/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reveal encounters/i })).toBeEnabled();
  });

  it("restores an active saved game after reopening the app", () => {
    const first = render(<App />);

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
