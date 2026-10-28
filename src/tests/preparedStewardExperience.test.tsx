import { StrictMode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App";
import { readSavedGame } from "../app/persistence";
import type { PreviewSnapshot } from "../app/scenarioTypes";
import snapshots from "../app/scenarios.generated.json";
import { getPreparedStewardPower } from "../components/actions/preparedActions";
import { EncounterPanel } from "../components/panels/EncounterPanel";
import { UpgradeChoices } from "../components/actions/UpgradeChoices";
import { TurnHandoffPreview } from "../components/actions/TurnHandoffPreview";
import { RoundEndPreview } from "../components/actions/RoundEndPreview";
import { previewTileAction } from "../components/actions/actionForecast";
import { getBoonActionPreview } from "../engine/boonModifiers";
import { endCurrentTurn, placeTile, resolveEndRound, upgradeTile, useStewardPower } from "../engine/gameActions";
import { getLegalPlacementHexes } from "../engine/placementRules";
import { createNewGame } from "../engine/setup";
import type { GameState, PlacedTile } from "../engine/types";

const sentinel = snapshots["sentinel-upgrade"] as unknown as PreviewSnapshot;
const saved = () => readSavedGame()!.state;
const fresh = () => structuredClone(sentinel.state!);
beforeEach(() => { localStorage.clear(); window.history.replaceState(null, "", "/?experience=tabletop&scenario=sentinel-upgrade"); });
afterEach(() => { vi.restoreAllMocks(); window.history.replaceState(null, "", "/"); });

function tile(instanceId: string, hex: string, side: "basic" | "upgraded" = "basic"): PlacedTile {
  return { instanceId, tileId: "c15_path", kind: "core", side, hexIds: [hex], strain: 0, support: { passive: false, singleUse: false, preventedThisRound: false } };
}
function ownershipState(stewardId: string): GameState {
  const state = createNewGame(2, [stewardId, "ranger"]);
  return { ...state, phase: "turns", actionsRemaining: 0,
    players: state.players.map((player) => ({ ...player, stewardHexId: "G1", hasPlacedFirstTile: true })),
    map: { placedTiles: [tile("target", "G1"), tile("other-target", "F1"), tile("neighbor", "H1", "upgraded")] } };
}
function matchingAction(state: GameState, stewardId: string, upgradeTarget = "target") {
  if (stewardId === "sentinel") return upgradeTile(state, state.currentPlayerId, upgradeTarget);
  const tileId = stewardId === "knight" ? "c05_cabin" : "c15_path";
  const hex = getLegalPlacementHexes(state, state.currentPlayerId, tileId)[0];
  expect(hex).toBeTruthy();
  return placeTile(state, state.currentPlayerId, tileId, { anchorHexId: hex });
}

describe("prepared Steward ownership", () => {
  it.each(["vanguard", "knight", "sentinel"])("keeps %s's preparation for its owner after a handoff", (stewardId) => {
    const prepared = useStewardPower(ownershipState(stewardId), "player_1");
    const id = getPreparedStewardPower(prepared)!.modifier.id;
    const nextTurn = endCurrentTurn(prepared);
    expect(nextTurn.currentPlayerId).toBe("player_2");
    expect(getPreparedStewardPower(nextTurn)).toBeNull();
    const foreignAction = matchingAction(nextTurn, stewardId, "other-target");
    expect(foreignAction).not.toBe(nextTurn);
    expect(foreignAction.actionsRemaining).toBe(3);
    expect(foreignAction.boonModifiers.some((modifier) => modifier.id === id)).toBe(true);
    const laterTurn = { ...foreignAction, currentPlayerId: "player_1", round: 2, actionsRemaining: 0 };
    const ownAction = matchingAction(laterTurn, stewardId);
    expect(ownAction).not.toBe(laterTurn);
    expect(ownAction.actionsRemaining).toBe(0);
    expect(ownAction.boonModifiers.some((modifier) => modifier.id === id)).toBe(false);
    expect(ownAction.players[0].stewardPowerUsesBySeason[1]).toBe(1);
  });

  it("labels another Steward's prepared effect with its owner after handoff", () => {
    const state = endCurrentTurn(useStewardPower(ownershipState("sentinel"), "player_1"));
    render(<EncounterPanel state={state} onUseFaceUpBoon={vi.fn()} />);
    expect(screen.getByRole("region", { name: "Prepared effects" })).toHaveTextContent("Sentinel only · This Season");
  });

  it("keeps ordinary Boons shared and ignores exhausted preparations", () => {
    const state = useStewardPower(ownershipState("vanguard"), "player_1");
    const modifier = state.boonModifiers[0];
    const foreign = { ...endCurrentTurn(state), boonModifiers: [{ ...modifier, sourceType: "boon" as const }] };
    const target = { action: "place" as const, category: "travel" as const, kind: "core" as const, baseCost: { wood: 0, stone: 0, metal: 0, food: 0, herbs: 0, goods: 0 } };
    expect(getBoonActionPreview(foreign, target).actionCost).toBe(0);
    expect(getBoonActionPreview({ ...foreign, boonModifiers: [{ ...foreign.boonModifiers[0], remainingUses: 0 }] }, target).actionCost).toBe(1);
  });

  it("keeps preparation over a normal round and expires it at the Season boundary", () => {
    const prepared = useStewardPower(ownershipState("sentinel"), "player_1");
    const roundEnd = endCurrentTurn(endCurrentTurn(prepared));
    expect(resolveEndRound(roundEnd).boonModifiers.some((modifier) => modifier.sourceCardId === "sentinel")).toBe(true);
    const seasonEnd = resolveEndRound({ ...roundEnd, round: 4 });
    expect(seasonEnd.season).toBe(2);
    expect(seasonEnd.boonModifiers.some((modifier) => modifier.sourceCardId === "sentinel")).toBe(false);
  });
});

describe("prepared Sentinel player experience", () => {
  it.each(["tabletop"])("opens and focuses real upgrade choices without spending resources in %s", async (experience) => {
    window.history.replaceState(null, "", `/?experience=${experience}&scenario=sentinel-upgrade`);
    render(<StrictMode><App initialPreview={sentinel} /></StrictMode>);
    fireEvent.click(screen.getByRole("button", { name: "Use Steward Power" }));
    expect(screen.getByText("1 Core upgrade available after preparation")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Prepare 0-action upgrade" }));
    expect(saved().actionsRemaining).toBe(0);
    expect(saved().warehouse).toEqual(sentinel.state!.warehouse);
    expect(saved().map).toEqual(sentinel.state!.map);
    expect(saved().players[0].stewardPowerUsesBySeason[1]).toBe(1);
    const upgrades = screen.getByRole("region", { name: "Core upgrades" });
    expect(upgrades).toBeVisible();
    expect(within(upgrades).getByLabelText("Action preview")).toHaveTextContent("No action spent");
    expect(upgrades).toHaveTextContent("Improved Path gains Supported");
    await waitFor(() => expect(upgrades).toHaveFocus());
    expect(screen.getByRole("button", { name: "Upgrade Path" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Undo last game step" }));
    expect(getPreparedStewardPower(saved())).toBeNull();
    expect(saved().players[0].stewardPowerUsesBySeason[1] ?? 0).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Redo undone game step" }));
    expect(getPreparedStewardPower(saved())).not.toBeNull();
    expect(screen.getByRole("region", { name: "Core upgrades" })).toBeVisible();
  });

  it("charges the previewed resources, grants Supported and restores the exact step through Undo, Redo and reload", () => {
    const view = render(<StrictMode><App initialPreview={sentinel} /></StrictMode>);
    fireEvent.click(screen.getByRole("button", { name: "Use Steward Power" }));
    fireEvent.click(screen.getByRole("button", { name: "Prepare 0-action upgrade" }));
    const prepared = saved();
    const path = prepared.map.placedTiles.find((candidate) => candidate.tileId === "c15_path")!;
    const forecast = previewTileAction(prepared, "player_1", { type: "upgrade", placedTileId: path.instanceId });
    expect(forecast.resources).toEqual([expect.objectContaining({ resource: "stone", before: 13, after: 11 })]);
    fireEvent.click(screen.getByRole("button", { name: "Upgrade Path" }));
    const upgraded = saved();
    expect(upgraded.warehouse.stone).toBe(11);
    expect(upgraded.actionsRemaining).toBe(0);
    expect(upgraded.map.placedTiles.find((candidate) => candidate.instanceId === path.instanceId)).toMatchObject({ side: "upgraded", support: { singleUse: true } });
    expect(getPreparedStewardPower(upgraded)).toBeNull();
    expect(upgraded.players[0].stewardHexId).toBe("B1");
    fireEvent.click(screen.getByRole("button", { name: "Undo last game step" }));
    expect(saved().map).toEqual(prepared.map);
    expect(getPreparedStewardPower(saved())).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Redo undone game step" }));
    expect(saved().map).toEqual(upgraded.map);
    view.unmount();
    render(<StrictMode><App initialPreview={sentinel} /></StrictMode>);
    expect(saved().map).toEqual(upgraded.map);
    expect(saved().warehouse).toEqual(upgraded.warehouse);
    expect(getPreparedStewardPower(saved())).toBeNull();
  });

  it("explains unavailable upgrades without inventing an action-cost blocker", () => {
    const state = useStewardPower(fresh(), "player_1");
    state.map.placedTiles[1].strain = 3;
    state.warehouse.stone = 0;
    render(<UpgradeChoices state={state} selectedHexIds={[]} onUpgrade={vi.fn()} onInspect={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "No upgrade available now" })).toBeVisible();
    fireEvent.click(screen.getByText("Unavailable upgrades (1)"));
    expect(screen.getByText("this tile is Overstrained.")).toBeVisible();
    expect(screen.getByText("missing 2 stone.")).toBeVisible();
    expect(screen.queryByText("no actions remaining.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upgrade Path" })).toBeDisabled();
  });

  it("distinguishes a missing ordinary action from an available prepared upgrade", () => {
    const state = fresh();
    const view = render(<UpgradeChoices state={state} selectedHexIds={[]} onUpgrade={vi.fn()} onInspect={vi.fn()} />);
    expect(screen.queryByText(/still apply to a 0-action upgrade/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Unavailable upgrades (1)"));
    expect(screen.getByText("no actions remaining.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Upgrade Path" })).toBeDisabled();
    view.rerender(<UpgradeChoices state={useStewardPower(state, "player_1")} selectedHexIds={[]} onUpgrade={vi.fn()} onInspect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Upgrade Path" })).toBeEnabled();
    expect(screen.queryByText("no actions remaining.")).not.toBeInTheDocument();
  });

  it("explains an unreachable tile and distinguishes a board with no basic Core Tiles", () => {
    const state = useStewardPower(fresh(), "player_1");
    state.map.placedTiles[1].hexIds = ["N9"];
    const view = render(<UpgradeChoices state={state} selectedHexIds={[]} onUpgrade={vi.fn()} onInspect={vi.fn()} />);
    fireEvent.click(screen.getByText("Unavailable upgrades (1)"));
    expect(screen.getByText("this tile is not reachable.")).toBeVisible();
    state.map.placedTiles[1].side = "upgraded";
    view.rerender(<UpgradeChoices state={{ ...state }} selectedHexIds={[]} onUpgrade={vi.fn()} onInspect={vi.fn()} />);
    expect(screen.getByText(/Build a basic Core Tile first/)).toBeVisible();
  });

  it("allows an honestly labelled preparation for later when nothing can upgrade", () => {
    const state = fresh();
    state.map.placedTiles[1].strain = 3;
    render(<App initialPreview={{ ...sentinel, state }} />);
    fireEvent.click(screen.getByRole("button", { name: "Use Steward Power" }));
    expect(screen.getByText("No Core upgrade available now")).toBeVisible();
    expect(screen.getByText(/You may still prepare for a later turn/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Prepare 0-action upgrade" }));
    expect(getPreparedStewardPower(saved())).not.toBeNull();
    expect(screen.getByRole("heading", { name: "No upgrade available now" })).toBeVisible();
  });
});

describe("prepared placement navigation and timing", () => {

  it("warns only at a Season boundary and never promises a further power after round twelve", () => {
    const state = useStewardPower(fresh(), "player_1");
    const view = render(<TurnHandoffPreview state={state} />);
    expect(screen.getByText(/prepared Steward power stays yours for a later turn/)).toBeVisible();
    view.rerender(<RoundEndPreview state={state} />);
    expect(screen.queryByRole("heading", { name: "Unused Steward preparations end" })).not.toBeInTheDocument();
    view.rerender(<RoundEndPreview state={{ ...state, round: 4 }} />);
    expect(screen.getByText(/Sentinel: unused preparations expire/)).toBeVisible();
    view.rerender(<RoundEndPreview state={{ ...state, round: 12, season: 3 }} />);
    expect(screen.getByText(/Sentinel: the game ends/)).toBeVisible();
    expect(screen.queryByText(/New Season powers/)).not.toBeInTheDocument();
  });
});
