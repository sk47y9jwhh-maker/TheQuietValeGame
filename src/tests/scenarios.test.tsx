import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../app/App";
import { ExperienceRoot } from "../app/ExperienceRoot";
import ScenarioPreview from "../app/ScenarioPreview";
import { ScenarioLauncher } from "../app/ScenarioLauncher";
import { getStorageKey, experienceIds } from "../app/experience";
import { getScenario, scenarioIds } from "../app/scenarioCatalog";
import { clearAllSaves, readSavedGame, writeSavedGame } from "../app/persistence";
import { clearLedgerCampaign, readLedgerCampaign, writeLedgerCampaign } from "../app/ledgerPersistence";
import snapshots from "../app/scenarios.generated.json";
import type { PreviewSnapshot } from "../app/scenarioTypes";
import type { ScenarioId } from "../app/scenarioCatalog";
import { canUseStewardPower } from "../engine/gameActions";
import { calculateFinalScore } from "../engine/scoring";
import { resolvePendingEffect } from "../engine/manualEffects";

const scenarios = snapshots as unknown as Record<ScenarioId, PreviewSnapshot>;
beforeEach(() => { window.localStorage.clear(); window.history.replaceState(null, "", "/"); });
afterEach(() => window.history.replaceState(null, "", "/"));

describe("comparison fixtures and save boundaries", () => {
  it("keeps all scenario/design namespaces independent from normal and original progress", () => {
    const fixture = scenarios.settlement;
    const game = { ...fixture.setup, state: fixture.state! };
    writeSavedGame(game);
    writeLedgerCampaign(fixture.campaign);
    const originalGame = window.localStorage.getItem("quietVale.activeGame.v1");
    const originalLedger = window.localStorage.getItem("quietVale.stewardsLedger.v1");
    const keys = new Set<string>();
    for (const experience of experienceIds) {
      window.history.replaceState(null, "", `/?experience=${experience}`);
      writeSavedGame(game);
      const normalKey = getStorageKey("quietVale.activeGame.v1");
      const normalGame = window.localStorage.getItem(normalKey);
      for (const scenario of scenarioIds) {
        window.history.replaceState(null, "", `/?experience=${experience}&scenario=${scenario}`);
        const key = getStorageKey("quietVale.activeGame.v1");
        expect(keys.has(key)).toBe(false);
        keys.add(key);
        expect(readSavedGame()).toBeNull();
        writeSavedGame(game);
        writeLedgerCampaign(scenarios.returning.campaign);
        expect(readSavedGame()?.state.map.placedTiles).toHaveLength(6);
        clearAllSaves();
        clearLedgerCampaign();
        expect(readSavedGame()).toBeNull();
        expect(window.localStorage.getItem(normalKey)).toBe(normalGame);
      }
    }
    expect(keys.size).toBe(experienceIds.length * scenarioIds.length);
    expect(window.localStorage.getItem("quietVale.activeGame.v1")).toBe(originalGame);
    expect(window.localStorage.getItem("quietVale.stewardsLedger.v1")).toBe(originalLedger);
  });

  it.each(scenarioIds)("round-trips the %s fixture through the existing save format", (id) => {
    window.history.replaceState(null, "", `/?experience=tabletop&scenario=${id}`);
    const fixture = scenarios[id];
    if (fixture.state) {
      writeSavedGame({ ...fixture.setup, state: fixture.state });
      expect(readSavedGame()?.state).toEqual(fixture.state);
    }
    writeLedgerCampaign(fixture.campaign);
    expect(readLedgerCampaign()).toEqual(fixture.campaign);
  });

  it("contains a completed twelve-round game and a resolvable real pending choice", () => {
    expect(scenarios.finale.state?.phase).toBe("gameEnd");
    expect(scenarios.finale.state?.round).toBe(12);
    expect(scenarios.finale.state?.season).toBe(3);
    expect(scenarios.finale.state?.log.some((entry) => entry.message === "Round 12 complete. Final scoring is ready.")).toBe(true);
    expect(Number.isFinite(calculateFinalScore(scenarios.finale.state!).finalScore)).toBe(true);
    expect(resolvePendingEffect(scenarios.choice.state!).pendingEffects).toHaveLength(0);
    const exchange = resolvePendingEffect(scenarios.choice.state!, { resourceDeltas: { wood: -2, food: 2 } });
    expect(exchange.pendingEffects).toHaveLength(0);
    expect(exchange.warehouse.wood).toBe(11);
    expect(exchange.warehouse.food).toBe(12);
    expect(canUseStewardPower(scenarios["last-action"].state!, "player_1").ok).toBe(true);
  });

  it("rejects incomplete and unknown comparison links without mounting or saving a game", () => {
    expect(getScenario("?scenario=unknown")).toBeNull();
    window.history.replaceState(null, "", "/?experience=tabletop&scenario=unknown");
    render(<ExperienceRoot />);
    expect(screen.getByRole("heading", { name: "This comparison link is incomplete." })).toBeVisible();
    expect(window.localStorage.length).toBe(0);
  });
});

describe("comparison controls", () => {
  it.each(experienceIds)("starts %s welcome with the advertised common encounter deal", (experience) => {
    window.history.replaceState(null, "", `/?experience=${experience}&scenario=welcome`);
    render(<ScenarioPreview experience={experience} scenarioId="welcome" />);

    fireEvent.click(screen.getByRole("button", { name: experience === "classic" ? "Start Season I" : "Begin your settlement" }));
    expect(readSavedGame()?.encounterSeed).toBe(scenarios.welcome.setup.encounterSeed);
    expect(readSavedGame()?.state.encounters.handsByPlayerId).toEqual(scenarios.handoff.state!.encounters.handsByPlayerId);
  });

  it("opens the selected situation in every design", () => {
    render(<ScenarioLauncher />);
    fireEvent.change(screen.getByRole("combobox", { name: "Choose a situation" }), { target: { value: "choice" } });
    expect(screen.getByRole("link", { name: "Compare Living Table" })).toHaveAttribute("href", "?experience=tabletop&scenario=choice");
    expect(screen.getByRole("link", { name: "Compare baseline" })).toHaveAttribute("href", "?experience=classic&scenario=choice");
    expect(screen.getByText("The Quartermaster’s resource exchange is waiting for a decision.")).toBeVisible();
  });

  it("resumes changes and restarts only the active demo", () => {
    window.history.replaceState(null, "", "/?experience=tabletop&scenario=settlement");
    const first = render(<ScenarioPreview experience="tabletop" scenarioId="settlement" />);
    fireEvent.click(screen.getByRole("button", { name: "Activate Tile" }));
    fireEvent.click(screen.getByRole("button", { name: "Activate Lumber Yard" }));
    expect(readSavedGame()?.state.actionsRemaining).toBe(3);
    first.unmount();
    render(<ScenarioPreview experience="tabletop" scenarioId="settlement" />);
    expect(readSavedGame()?.state.actionsRemaining).toBe(3);
    fireEvent.click(screen.getByRole("button", { name: "Restart demo" }));
    expect(readSavedGame()?.state.actionsRemaining).toBe(4);
    expect(readSavedGame()?.state.warehouse.wood).toBe(8);
    expect(screen.getByText("This demo is back at its starting position.")).toBeVisible();
    expect(window.localStorage.getItem("quietVale.preview.tabletop.quietVale.activeGame.v1")).toBeNull();
  });

  it("keeps sample campaign progress after reload and a deliberate Ledger reset", () => {
    window.history.replaceState(null, "", "/?experience=tabletop&scenario=returning");
    const first = render(<ScenarioPreview experience="tabletop" scenarioId="returning" />);
    expect(Object.keys(readLedgerCampaign().completions)).toHaveLength(5);
    first.unmount();
    writeLedgerCampaign({ ...scenarios.returning.campaign, completions: {} });
    render(<ScenarioPreview experience="tabletop" scenarioId="returning" />);
    expect(Object.keys(readLedgerCampaign().completions)).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Restart demo" }));
    expect(Object.keys(readLedgerCampaign().completions)).toHaveLength(5);
  });

  it("keeps a partially chosen Quartermaster exchange editable until it balances", () => {
    window.history.replaceState(null, "", "/?experience=tabletop&scenario=choice");
    render(<ScenarioPreview experience="tabletop" scenarioId="choice" />);
    fireEvent.click(screen.getByRole("button", { name: "Decrease Wood adjustment" }));
    expect(screen.getByRole("button", { name: "Use Quartermaster Power" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Decrease Wood adjustment" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase Food adjustment" }));
    expect(screen.getByRole("button", { name: "Use Quartermaster Power" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Increase Food adjustment" }));
    fireEvent.click(screen.getByRole("button", { name: "Use Quartermaster Power" }));
    expect(readSavedGame()?.state.pendingEffects).toHaveLength(0);
    expect(readSavedGame()?.state.warehouse.wood).toBe(11);
    expect(readSavedGame()?.state.warehouse.food).toBe(12);
    expect(screen.getByRole("region", { name: "Current step" })).toHaveTextContent("Your settlement, your next move");
  });

  it("records the final score only in the demo Ledger", () => {
    window.history.replaceState(null, "", "/?experience=tabletop&scenario=finale");
    render(<ScenarioPreview experience="tabletop" scenarioId="finale" />);
    expect(screen.getByRole("heading", { name: "Final Scoring" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Record Completed Game" }));
    expect(readLedgerCampaign().games).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Recorded in Ledger" })).toBeDisabled();
    expect(window.localStorage.getItem("quietVale.stewardsLedger.v1")).toBeNull();
    expect(window.localStorage.getItem("quietVale.preview.tabletop.quietVale.stewardsLedger.v1")).toBeNull();
  });
});

describe("free actions after the normal allowance", () => {
  it.each(experienceIds)("keeps the Vanguard power and free placement accessible in %s", (experience) => {
    window.history.replaceState(null, "", `/?experience=${experience}&scenario=last-action`);
    render(<App initialPreview={scenarios["last-action"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Use Steward Power" }));
    // The board-first table prepares the free placement as soon as the power is used.
    if (experience !== "table") fireEvent.click(screen.getByRole("button", { name: experience === "classic" ? "Prepare Free Travel Placement" : "Prepare 0-action Travel" }));
    if (experience === "table") {
      // The board-first table starts from the space: tap it, then choose the tile.
      fireEvent.click(screen.getByRole("button", { name: /^F2, empty Grasslands/ }));
      fireEvent.click(screen.getByRole("button", { name: /^Path\b/ }));
    } else {
      if (experience === "classic") fireEvent.click(screen.getByRole("button", { name: "Place Tile" }));
      fireEvent.click(screen.getByRole("option", { name: /^Path Travel Core/ }));
      fireEvent.click(screen.getByRole("button", { name: "F2, Grasslands" }));
      fireEvent.click(screen.getByRole("button", { name: "Place Path" }));
    }
    expect(readSavedGame()?.state.actionsRemaining).toBe(0);
    expect(readSavedGame()?.state.map.placedTiles).toHaveLength(4);
    expect(readSavedGame()?.state.map.placedTiles[3].hexIds).toEqual(["F2"]);
  });
});
