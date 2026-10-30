import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App";
import ScenarioPreview from "../app/ScenarioPreview";
import { readStoredJsonResult, removeStoredItems, writeStoredJson } from "../app/browserStorage";
import { getStorageKey } from "../app/experience";
import { readSavedGame, writeSavedGame } from "../app/persistence";
import { readLedgerCampaign } from "../app/ledgerPersistence";
import snapshots from "../app/scenarios.generated.json";
import type { PreviewSnapshot } from "../app/scenarioTypes";
import { recordLedgerGame } from "../engine/ledger";
import { encounterById } from "../data/encounters";

const settlement = snapshots.settlement as unknown as PreviewSnapshot;
const finale = snapshots.finale as unknown as PreviewSnapshot;
const gameKey = "quietVale.activeGame.v1";
const ledgerKey = "quietVale.stewardsLedger.v1";
const quota = () => new DOMException("Test save store is full", "QuotaExceededError");
const blocked = () => new DOMException("Test storage unavailable", "SecurityError");
function failWrite(key: string) {
  const original = Storage.prototype.setItem;
  return vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, name, value) {
    if (name === getStorageKey(key)) throw quota();
    original.call(this, name, value);
  });
}
function activateLumber() {
  fireEvent.click(screen.queryByRole("button", { name: "Activate Tile" }) ?? screen.getByRole("button", { name: "Produce & activate" }));
  fireEvent.click(screen.getByRole("button", { name: "Activate Lumber Yard" }));
}
beforeEach(() => { localStorage.clear(); window.history.replaceState(null, "", "/?experience=tabletop&scenario=settlement"); });
afterEach(() => { vi.restoreAllMocks(); window.history.replaceState(null, "", "/"); });

describe("explicit browser storage results", () => {
  it("distinguishes an empty store, corrupt JSON, a full store and unavailable access", () => {
    expect(readStoredJsonResult(gameKey)).toEqual({ ok: true, value: null });
    localStorage.setItem(getStorageKey(gameKey), "{broken");
    expect(readStoredJsonResult(gameKey)).toEqual({ ok: false, problem: "unreadable" });
    const write = failWrite(gameKey);
    expect(writeStoredJson(gameKey, { example: 1 })).toEqual({ ok: false, problem: "full" });
    write.mockRestore();
    const getter = vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw blocked(); });
    expect(readStoredJsonResult(gameKey)).toEqual({ ok: false, problem: "unavailable" });
    expect(writeStoredJson(gameKey, {})).toEqual({ ok: false, problem: "unavailable" });
    expect(removeStoredItems(gameKey)).toEqual({ ok: false, problem: "unavailable" });
    getter.mockRestore();
  });
});

describe("saving without losing the current session", () => {
  it.each(["tabletop", "classic"])("keeps playing and retries the latest undo result in %s", (experience) => {
    window.history.replaceState(null, "", `/?experience=${experience}&scenario=settlement`);
    const view = render(<App initialPreview={settlement} />);
    const original = readSavedGame()!.state;
    const failure = failWrite(gameKey);
    activateLumber();
    expect(screen.getByRole("alert", { name: "Local save status" })).toHaveTextContent("not saved");
    expect(readSavedGame()?.state).toEqual(original);

    fireEvent.click(screen.getByRole("button", { name: "Activate Lumber Yard" }));
    fireEvent.click(screen.getByRole("button", { name: "Undo last game step" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
    expect(screen.getByRole("alert", { name: "Local save status" })).toBeVisible();
    failure.mockRestore();
    fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
    expect(screen.getByRole("status", { name: "Local save status" })).toHaveTextContent("confirmed progress is saved");
    expect(readSavedGame()?.state.warehouse.wood).toBe(10);
    expect(readSavedGame()?.state.actionsRemaining).toBe(3);
    fireEvent.click(screen.getByRole("button", { name: "Continue playing" }));
    expect(screen.queryByRole("status", { name: "Local save status" })).not.toBeInTheDocument();
    view.unmount();
    render(<App initialPreview={settlement} />);
    expect(readSavedGame()?.state.warehouse.wood).toBe(10);
  });

  it("preserves an unconfirmed private seeding draft through a failed and successful retry", () => {
    const handoff = snapshots.handoff as unknown as PreviewSnapshot;
    const failure = failWrite(ledgerKey);
    render(<App initialPreview={handoff} />);
    const card = encounterById[handoff.state!.encounters.handsByPlayerId.player_1[0]];
    fireEvent.click(screen.getByRole("button", { name: "Reveal Vanguard’s hand" }));
    fireEvent.click(screen.getByRole("button", { name: `Seed ${card.name} at top` }));
    fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
    expect(screen.getByRole("button", { name: "Change Top card" })).toHaveTextContent(card.name);
    failure.mockRestore();
    fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
    expect(screen.getByRole("button", { name: "Change Top card" })).toHaveTextContent(card.name);
    expect(readSavedGame()?.state).toEqual(handoff.state);
  });

  it("reports a failed reset removal and retries the reset instead of resurrecting an older move", () => {
    const view = render(<App initialPreview={settlement} />);
    const remove = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw blocked(); });
    fireEvent.click(screen.getByRole("button", { name: "Reset game" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear board and start over" }));
    expect(screen.getByRole("heading", { name: "Gather your Stewards." })).toBeVisible();
    expect(readSavedGame()?.state).toEqual(settlement.state);
    expect(screen.getByRole("alert", { name: "Local save status" })).toBeVisible();
    remove.mockRestore();
    fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
    expect(readSavedGame()).toBeNull();
    view.unmount();
    render(<App initialPreview={settlement} />);
    expect(screen.getByRole("heading", { name: "Gather your Stewards." })).toBeVisible();
    expect(readSavedGame()).toBeNull();
  });

  it("stores the Ledger before a board can claim its new result is recorded", () => {
    render(<App initialPreview={finale} />);
    const failure = failWrite(ledgerKey);
    fireEvent.click(screen.getByRole("button", { name: "Record this game" }));
    expect(readLedgerCampaign().games).toHaveLength(0);
    expect(readSavedGame()?.state.ledgerRun?.recorded).toBe(false);
    expect(screen.getByRole("alert", { name: "Local save status" })).toBeVisible();
    failure.mockRestore();
    fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
    expect(readLedgerCampaign().games).toHaveLength(1);
    expect(readSavedGame()?.state.ledgerRun?.recorded).toBe(true);
  });

  it("recovers from a cleared Ledger followed by a failed board write on the next load", () => {
    const recorded = recordLedgerGame(finale.state!, finale.campaign);
    const preview = { ...finale, state: recorded.state, campaign: recorded.campaign };
    const view = render(<App initialPreview={preview} />);
    const failure = failWrite(gameKey);
    fireEvent.click(screen.getByRole("tab", { name: /^Ledger/ }));
    fireEvent.click(screen.getByRole("tab", { name: "Unlocks" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset Ledger Progress" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear Ledger progress" }));
    expect(readLedgerCampaign().games).toHaveLength(0);
    expect(readSavedGame()?.state.ledgerRun?.recorded).toBe(true);
    view.unmount();
    failure.mockRestore();
    render(<App initialPreview={preview} />);
    expect(screen.getByRole("button", { name: "Record this game" })).toBeEnabled();
    expect(readSavedGame()?.state.ledgerRun?.recorded).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Record this game" }));
    expect(readLedgerCampaign().games).toHaveLength(1);
  });
});

describe("unreadable saves remain protected", () => {
  it.each([
    [gameKey, "{broken"],
    [gameKey, "null"],
    [gameKey, JSON.stringify({ version: 4, state: {} })],
    ["quietVale.setup.v1", JSON.stringify({ version: 999 })],
    [ledgerKey, JSON.stringify({ games: "invalid" })]
  ])("does not overwrite invalid stored data in %s", (key, raw) => {
    localStorage.setItem(getStorageKey(key), raw);
    const write = vi.spyOn(Storage.prototype, "setItem");
    const remove = vi.spyOn(Storage.prototype, "removeItem");
    render(<App initialPreview={settlement} />);
    expect(screen.getByRole("alert", { name: "Local save status" })).toHaveTextContent("Existing saved data has been kept unchanged");
    activateLumber();
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(localStorage.getItem(getStorageKey(key))).toBe(raw);
    expect(screen.queryByRole("button", { name: "Retry save" })).not.toBeInTheDocument();
  });

  it("keeps inaccessible saved data and recovers the original game after access returns and the app reloads", () => {
    writeSavedGame({ ...settlement.setup, state: settlement.state! });
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw blocked(); });
    const write = vi.spyOn(Storage.prototype, "setItem");
    const view = render(<App />);
    expect(screen.getByRole("alert", { name: "Local save status" })).toHaveTextContent("could not be loaded");
    expect(write).not.toHaveBeenCalled();
    get.mockRestore();
    view.unmount();
    render(<App />);
    expect(screen.queryByRole("alert", { name: "Local save status" })).not.toBeInTheDocument();
    expect(readSavedGame()?.state).toEqual(settlement.state);
  });
});

it("labels the isolated comparison simulation, resumes saving, and keeps real namespaces separate", () => {
  const untouched = "quietVale.preview.tabletop.quietVale.activeGame.v1";
  localStorage.setItem(untouched, "untouched ordinary table");
  render(<ScenarioPreview experience="tabletop" scenarioId="settlement" />);
  fireEvent.click(screen.getByRole("checkbox", { name: "Simulate a full save store", hidden: true }));
  expect(screen.getByRole("alert", { name: "Local save status" })).toHaveTextContent("Comparison simulation");
  activateLumber();
  expect(readSavedGame()?.state.warehouse.wood).toBe(8);
  fireEvent.click(screen.getByRole("checkbox", { name: "Simulate a full save store", hidden: true }));
  expect(readSavedGame()?.state.warehouse.wood).toBe(10);
  expect(localStorage.getItem(untouched)).toBe("untouched ordinary table");
});


it("keeps a live demo on a failed restart, shows the failure, and retries after storage returns", () => {
  render(<ScenarioPreview experience="tabletop" scenarioId="settlement" />);
  activateLumber();
  const current = readSavedGame()!.state;
  const remove = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw blocked(); });
  fireEvent.click(screen.getByRole("button", { name: "Restart demo" }));
  expect(screen.getByRole("alert")).toHaveTextContent("could not be restarted");
  expect(readSavedGame()?.state).toEqual(current);
  expect(screen.getByRole("button", { name: "Undo last game step" })).toBeEnabled();
  remove.mockRestore();
  fireEvent.click(screen.getByRole("button", { name: "Restart demo" }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(readSavedGame()?.state).toEqual(settlement.state);
  expect(screen.getByRole("button", { name: "Undo last game step" })).toBeDisabled();
});
