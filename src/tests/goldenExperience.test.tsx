import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App";
import { readSavedGame } from "../app/persistence";
import { GoldenTilePlacementPanel } from "../components/setup/GoldenTilePlacementPanel";
import { GoldenEffectPanel } from "../components/effects/GoldenEffectPanel";
import { encounterById } from "../data/encounters";
import { goldenTiles } from "../data/tiles";
import { createNewGame } from "../engine/setup";
import { commitStewardPlacement } from "../engine/gameActions";
import { getGoldenTileSetupLegalHexIds, resolveGoldenScroll } from "../engine/golden";
import { createEmptyLedgerCampaign } from "../app/ledgerPersistence";
import type { PreviewSnapshot } from "../app/scenarioTypes";
import snapshots from "../app/scenarios.generated.json";

beforeEach(() => { localStorage.clear(); window.history.replaceState(null, "", "/?experience=tabletop"); });
afterEach(() => { vi.restoreAllMocks(); window.history.replaceState(null, "", "/"); });
function setup(tileId = goldenTiles[0].id) {
  let state = createNewGame(2, ["vanguard", "knight"], { encounterSeed: "QV-GOLDEN-UI", selectedGoldenTileId: tileId });
  for (const player of state.players) state = commitStewardPlacement(state, player.id, player.stewardHexId);
  return state;
}
const scroll = snapshots["golden-scroll"] as unknown as PreviewSnapshot;
const callbacks = { onResolveBell: vi.fn(), onResolveSignet: vi.fn() };

describe("deliberate Golden placement", () => {
  it.each(goldenTiles)("offers exactly the engine's legal coordinates for $name", (tile) => {
    const state = setup(tile.id);
    const confirm = vi.fn();
    render(<GoldenTilePlacementPanel state={state} onConfirm={confirm} onSkip={() => {}} />);
    expect(screen.getByRole("heading", { name: `Place ${tile.name}` })).toHaveFocus();
    const legal = getGoldenTileSetupLegalHexIds(state);
    const list = screen.getByRole("combobox", { name: "Golden Tile space" });
    expect(within(list).getAllByRole("option").map((option) => (option as HTMLOptionElement).value)).toEqual(legal);
    expect(screen.getByText("0 actions · No resources")).toBeVisible();
    fireEvent.change(list, { target: { value: legal[legal.length - 1] } });
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(legal[legal.length - 1]);
    fireEvent.click(screen.getByRole("button", { name: `Place ${tile.name}` }));
    expect(confirm).toHaveBeenCalledWith(legal[legal.length - 1]);
  });

  it("uses one map Tab stop, browses legal choices without committing and shows Steward starts", () => {
    const state = setup();
    const confirm = vi.fn();
    render(<GoldenTilePlacementPanel state={state} onConfirm={confirm} onSkip={() => {}} />);
    const map = screen.getByRole("group", { name: "The Golden Charter placement map" });
    const options = within(map).getAllByRole("button");
    const current = options.find((option) => option.getAttribute("aria-pressed") === "true")!;
    fireEvent.keyDown(current, { key: "End" });
    expect(options[options.length - 1]).toHaveFocus();
    expect(options[options.length - 1]).toHaveAttribute("aria-pressed", "true");
    expect(options.filter((option) => option.tabIndex === 0)).toHaveLength(1);
    fireEvent.keyDown(options[options.length - 1], { key: "ArrowRight" });
    expect(options[0]).toHaveFocus();
    expect(confirm).not.toHaveBeenCalled();
    expect(within(map).getByRole("button", { name: /G1, Woodland, legal, Vanguard starts here/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zoom Golden map" }));
    expect(screen.getByRole("button", { name: "Fit Golden map" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Fit Golden map" }));
    expect(screen.getByRole("button", { name: "Fit Golden map" })).toBeDisabled();
  });

  it("explains an unavailable choice and still permits skipping", () => {
    const state = setup();
    state.map.placedTiles = getGoldenTileSetupLegalHexIds(state).map((id) => ({ instanceId: `full-${id}`, tileId: goldenTiles[0].id, kind: "special", side: "special", hexIds: [id], strain: 0, support: { passive: false, singleUse: false, preventedThisRound: false } }));
    const skip = vi.fn();
    render(<GoldenTilePlacementPanel state={state} onConfirm={vi.fn()} onSkip={skip} />);
    expect(screen.getByRole("combobox", { name: "Golden Tile space" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Place The Golden Charter" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("No legal space available");
    fireEvent.click(screen.getByRole("button", { name: "Play without this Golden Tile" }));
    expect(skip).toHaveBeenCalledOnce();
  });

  it("commits with no resource/action/token cost, and supports undo and skipping through App", () => {
    const state = setup();
    render(<App initialPreview={{ state, campaign: createEmptyLedgerCampaign(), setup: { playerCount: 2, stewardIds: ["vanguard", "knight"], encounterSeed: "QV-GOLDEN-UI" } }} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Golden Tile space" }), { target: { value: "G2" } });
    expect(readSavedGame()?.state.map.placedTiles).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Place The Golden Charter" }));
    const placed = readSavedGame()!.state;
    expect(placed.map.placedTiles[0].hexIds).toEqual(["G2"]);
    expect(placed.actionsRemaining).toBe(state.actionsRemaining);
    expect(placed.warehouse).toEqual(state.warehouse);
    expect(placed.players).toEqual(state.players);
    expect(screen.getByRole("heading", { name: "Pass to Player 1." })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Undo last game step" }));
    expect(readSavedGame()?.state.phase).toBe("goldenSetup");
    expect(readSavedGame()?.state.map.placedTiles).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Play without this Golden Tile" }));
    expect(readSavedGame()?.state.goldenSetup.tileSkipped).toBe(true);
    expect(readSavedGame()?.state.phase).toBe("seeding");
  });
});

describe("private Golden Scroll handoff", () => {
  it.each(["tabletop"])("reveals one owner at a time in %s and applies choices only after review", (experience) => {
    window.history.replaceState(null, "", `/?experience=${experience}`);
    const state = scroll.state!;
    const original = JSON.stringify(state);
    const resolve = vi.fn();
    const firstCard = encounterById[state.encounters.handsByPlayerId.player_1[0]].name;
    const otherCard = encounterById[state.encounters.handsByPlayerId.player_2[0]].name;
    render(<GoldenEffectPanel state={state} onResolveScroll={resolve} {...callbacks} />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("article", { name: firstCard })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reveal Vanguard’s hand" }));
    expect(screen.getByRole("group", { name: "Vanguard’s private hand" })).toHaveFocus();
    expect(screen.queryByRole("article", { name: otherCard })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: `Exchange ${firstCard}` }));
    fireEvent.click(screen.getByRole("button", { name: "Hide hand" }));
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reveal Vanguard’s hand" }));
    expect(screen.getByRole("checkbox", { name: `Exchange ${firstCard}` })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Confirm 1 for exchange" }));
    expect(screen.getByRole("heading", { name: "Pass to Player 2." })).toHaveFocus();
    expect(screen.queryByRole("article", { name: firstCard })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reveal Knight’s hand" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep my whole hand" }));
    expect(screen.getByRole("heading", { name: "Ready to exchange?" })).toHaveFocus();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(resolve).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Review Vanguard’s choice" }));
    expect(screen.getByRole("button", { name: "Reveal Vanguard’s hand" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reveal Vanguard’s hand" }));
    expect(screen.getByRole("checkbox", { name: `Exchange ${firstCard}` })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Confirm 1 for exchange" }));
    fireEvent.click(screen.getByRole("button", { name: "Resolve Golden Scroll" }));
    expect(resolve).toHaveBeenCalledWith({ player_1: [state.encounters.handsByPlayerId.player_1[0]], player_2: [] });
    expect(JSON.stringify(state)).toBe(original);
  });

  it("resolves, saves and undoes the real engine-generated choice without leaking a restored hand", () => {
    window.history.replaceState(null, "", "/?experience=tabletop&scenario=golden-scroll");
    render(<App initialPreview={scroll} />);
    expect(screen.getByRole("heading", { name: "Pass to Player 1." })).toHaveFocus();
    const state = scroll.state!;
    const cardId = state.encounters.handsByPlayerId.player_1[0];
    fireEvent.click(screen.getByRole("button", { name: "Reveal Vanguard’s hand" }));
    fireEvent.click(screen.getByRole("checkbox", { name: `Exchange ${encounterById[cardId].name}` }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm 1 for exchange" }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal Knight’s hand" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep my whole hand" }));
    expect(readSavedGame()?.state).toEqual(state);
    fireEvent.click(screen.getByRole("button", { name: "Resolve Golden Scroll" }));
    const expected = resolveGoldenScroll(state, { player_1: [cardId], player_2: [] });
    expect(readSavedGame()?.state.encounters).toEqual(expected.encounters);
    expect(readSavedGame()?.state.pendingGoldenEffect).toBeNull();
    expect(readSavedGame()?.state.warehouse).toEqual(state.warehouse);
    fireEvent.click(screen.getByRole("button", { name: "Undo last game step" }));
    expect(readSavedGame()?.state.pendingGoldenEffect?.kind).toBe("scroll");
    expect(readSavedGame()?.state.encounters.handsByPlayerId).toEqual(state.encounters.handsByPlayerId);
    expect(screen.getByRole("button", { name: "Reveal Vanguard’s hand" })).toBeVisible();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Redo undone game step" }));
    expect(readSavedGame()?.state.pendingGoldenEffect).toBeNull();
    expect(readSavedGame()?.state.encounters).toEqual(expected.encounters);
  });
});


describe("Golden resolution boundaries", () => {
  it("lets a solo player with no standard cards decline the Scroll without exposing or exchanging Golden cards", () => {
    const state = { ...scroll.state!, playerCount: 1 as const, players: scroll.state!.players.slice(0, 1), encounters: { ...scroll.state!.encounters, handsByPlayerId: { player_1: ["golden_boon_the_golden_bell"] } } };
    const resolve = vi.fn();
    render(<GoldenEffectPanel state={state} onResolveScroll={resolve} {...callbacks} />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByText("No standard cards in this hand. You can continue without an exchange.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Keep my whole hand" }));
    fireEvent.click(screen.getByRole("button", { name: "Resolve Golden Scroll" }));
    expect(resolve).toHaveBeenCalledWith({ player_1: [] });
  });

  it("adds the actual Bell Arrival with three timers for free, then undoes without charging its later completion cost", () => {
    const bell = snapshots["golden-bell"] as unknown as PreviewSnapshot;
    const state = bell.state!;
    if (state.pendingGoldenEffect?.kind !== "bell") throw new Error("Expected a generated Bell reveal.");
    const id = state.pendingGoldenEffect.arrivalCardIds[0];
    const arrival = encounterById[id];
    render(<App initialPreview={bell} />);
    expect(screen.getByRole("article", { name: `Revealed Arrival: ${arrival.name}` })).toHaveTextContent("3 timer tokens · Add now for free");
    expect(screen.getByText("To complete later")).toBeVisible();
    expect(readSavedGame()?.state.encounters.activeArrivals.some((card) => card.cardId === id)).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Place this Arrival" }));
    expect(readSavedGame()?.state.encounters.activeArrivals).toContainEqual({ cardId: id, timerTokens: 3 });
    expect(readSavedGame()?.state.pendingGoldenEffect).toBeNull();
    expect(readSavedGame()?.state.pendingEffects).toEqual(state.pendingEffects);
    expect(readSavedGame()?.state.warehouse).toEqual(state.warehouse);
    expect(readSavedGame()?.state.actionsRemaining).toBe(state.actionsRemaining);
    fireEvent.click(screen.getByRole("button", { name: "Undo last game step" }));
    expect(readSavedGame()?.state.pendingGoldenEffect?.kind).toBe("bell");
    expect(readSavedGame()?.state.encounters.activeArrivals).toEqual(state.encounters.activeArrivals);
  });
});
