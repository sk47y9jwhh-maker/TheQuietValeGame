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
    expect(screen.getByText("1–5 players")).toBeInTheDocument();
    expect(screen.getByText("Set up once")).toBeInTheDocument();
    expect(screen.getByText("Example first turn")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Full rules" }));

    expect(screen.getByRole("heading", { name: "Components" })).toBeInTheDocument();
    expect(screen.getByText("Main Rulebook v6.5. Choose one of 18 chapters.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "2. Setup" }));
    expect(screen.getByText(/Start with 15 \/ 10 \/ 5 \/ 0 \/ 0/)).toBeInTheDocument();
    expect(screen.getByText(/At five players, select 20 cards of each standard type/)).toBeInTheDocument();

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

  it("shows the Quest Card drawn for the next game", () => {
    const campaign = createEmptyLedgerCampaign("SEED");
    writeLedgerCampaign(campaign);
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: `Show Quest Card ${campaign.deck[0]} full size` }));
    expect(screen.getByRole("article", { name: new RegExp(`^Quest Card ${campaign.deck[0]}:`) })).toBeInTheDocument();
    expect(screen.getByText("0 of 21 Quest Cards in the Steward’s Ledger.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Steward's Ledger Vow")).not.toBeInTheDocument();
  });

  it("configures a five-player game with five unique Stewards", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "5P" }));

    expect(screen.getAllByText("5 Players").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Player 5")).toHaveValue("warden");
    expect(screen.getByText("0 of each resource")).toBeInTheDocument();
  });

  it("starts the game with the drawn Quest Card", () => {
    const campaign = createEmptyLedgerCampaign("SEED");
    writeLedgerCampaign(campaign);
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /start season i/i }));

    const saved = JSON.parse(
      window.localStorage.getItem("quietVale.activeGame.v1") ?? "{}"
    );
    expect(saved.state.questRun.cardNumber).toBe(campaign.deck[0]);
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
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /start season i/i }));
    expect(screen.getByRole("heading", { name: "Vanguard" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /reset game/i }));
    fireEvent.click(screen.getByRole("button", { name: "Clear board and start over" }));

    expect(screen.getAllByText("1 Player").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /start season i/i })).toBeInTheDocument();
    expect(window.localStorage.getItem("quietVale.activeGame.v1")).toBeNull();
  });
});
