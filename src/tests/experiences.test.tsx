import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../app/App";
import { ExperienceRoot } from "../app/ExperienceRoot";
import { getExperience, getStorageKey } from "../app/experience";
import { readStoredJson, removeStoredItems, writeStoredJson } from "../app/browserStorage";
import { clearAllSaves, readSavedGame, writeSavedGame } from "../app/persistence";
import { encounterById } from "../data/encounters";
import { createNewGame } from "../engine/setup";
import { getPlayerGuidance } from "../components/layout/PlayerGuide";

beforeEach(() => { window.localStorage.clear(); window.history.replaceState(null, "", "/"); });
afterEach(() => window.history.replaceState(null, "", "/"));

describe("preview save boundaries", () => {
  it("keeps the original game and each preview independent, including cleanup", () => {
    const state = createNewGame(1, ["vanguard"]);
    writeSavedGame({ playerCount: 1, stewardIds: ["vanguard"], encounterSeed: "ORIGINAL", state });
    const original = window.localStorage.getItem("quietVale.activeGame.v1");
    window.history.replaceState(null, "", "/?experience=tabletop");
    expect(readSavedGame()).toBeNull();
    writeSavedGame({ playerCount: 1, stewardIds: ["vanguard"], encounterSeed: "TABLE", state });
    expect(readSavedGame()?.encounterSeed).toBe("TABLE");
    writeStoredJson("quietVale.stewardsLedger.v1", { preview: true });
    window.history.replaceState(null, "", "/?experience=classic");
    expect(readSavedGame()).toBeNull();
    expect(readStoredJson("quietVale.stewardsLedger.v1")).toBeNull();
    window.history.replaceState(null, "", "/?experience=tabletop");
    clearAllSaves();
    removeStoredItems("quietVale.stewardsLedger.v1");
    expect(readSavedGame()).toBeNull();
    expect(readStoredJson("quietVale.stewardsLedger.v1")).toBeNull();
    expect(window.localStorage.getItem("quietVale.activeGame.v1")).toBe(original);
  });

  it("rejects unknown experience identifiers without inventing save namespaces", () => {
    expect(getExperience("?experience=unknown")).toBeNull();
    expect(getStorageKey("test", null)).toBe("test");
    expect(getExperience("?experience=tabletop")).toBe("tabletop");
  });
});

describe("Living Table player flow", () => {
  it("offers only the recommended Living Table alongside the baseline", () => {
    render(<ExperienceRoot />);
    expect(screen.getByRole("link", { name: "Enter the Living Table" })).toHaveAttribute("href", "?experience=tabletop");
    expect(screen.getByRole("link", { name: "Open the baseline" })).toHaveAttribute("href", "?experience=classic");
    expect(screen.queryByRole("link", { name: /Pocket Vale/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Council Desk/ })).not.toBeInTheDocument();
  });

  it("supports choosing a group with unique Stewards before starting", () => {
    window.history.replaceState(null, "", "/?experience=tabletop");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "3 players" }));
    expect(screen.getByRole("button", { name: "3 players" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("combobox", { name: "Player 1 steward" })).toHaveValue("vanguard");
    expect(screen.getByRole("combobox", { name: "Player 2 steward" })).toHaveValue("knight");
    expect(screen.getByRole("combobox", { name: "Player 3 steward" })).toHaveValue("sentinel");
    fireEvent.change(screen.getByRole("combobox", { name: "Player 3 steward" }), { target: { value: "ranger" } });
    fireEvent.click(screen.getByRole("button", { name: "Begin your settlement" }));
    expect(readSavedGame()?.stewardIds).toEqual(["vanguard", "knight", "ranger"]);
    expect(screen.getByRole("region", { name: "Current step" })).toHaveTextContent("Choose your starting place");
    expect(window.localStorage.getItem("quietVale.activeGame.v1")).toBeNull();
  });

  it("guides a solo player through setup, seeding and the reveal dock", () => {
    window.history.replaceState(null, "", "/?experience=tabletop");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Begin your settlement" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Vanguard Start" }));
    expect(screen.getByRole("region", { name: "Current step" })).toHaveTextContent("Shape the season ahead");
    const hand = readSavedGame()!.state.encounters.handsByPlayerId.player_1;
    for (const [index, slot] of ["top", "middle", "bottom"].entries()) {
      fireEvent.click(screen.getByRole("button", { name: `Seed ${encounterById[hand[index]].name} at ${slot}` }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Confirm Seeding" }));
    expect(screen.getByRole("region", { name: "Current step" })).toHaveTextContent("See what the Vale brings");
    expect(screen.getByRole("button", { name: "Reveal Encounters" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Encounters 0" }));
    expect(screen.queryByRole("button", { name: "Reveal Encounters" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Encounters" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Actions →" }));
    expect(screen.getByRole("button", { name: "Reveal Encounters" })).toBeVisible();
  });

  it("prioritises required choices over normal turn advice", () => {
    const state = { ...createNewGame(1, ["vanguard"]), phase: "turns" as const, actionsRemaining: 0 };
    expect(getPlayerGuidance(state).title).toBe("Your Steward power is still available");
    state.players[0].stewardPowerUsesBySeason[1] = 1;
    expect(getPlayerGuidance(state).title).toBe("Ready to pass the turn");
    state.pendingEffects = [{ id: "pending" } as (typeof state.pendingEffects)[number]];
    expect(getPlayerGuidance(state).title).toBe("A choice to resolve");
  });
});

// A retired concept link must not fall through into the original save space.
describe("excluded layout links", () => {
  it.each(["council", "guided", "unknown"])("rejects %s without mounting a game", (experience) => {
    localStorage.setItem("quietVale.activeGame.v1", "original-save-sentinel");
    window.history.replaceState(null, "", `/?experience=${experience}`);
    render(<ExperienceRoot />);
    expect(screen.getByRole("heading", { name: "This layout is not included." })).toBeVisible();
    expect(localStorage.getItem("quietVale.activeGame.v1")).toBe("original-save-sentinel");
    expect(localStorage.length).toBe(1);
  });
});
