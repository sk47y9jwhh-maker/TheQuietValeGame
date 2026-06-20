import { type ReactNode, useEffect, useMemo, useState } from "react";
import { ActionConsole } from "../components/actions/ActionConsole";
import {
  getDefaultPlaceTileId,
  getPlacementDraftForHex,
  getPlaceTileChoices
} from "../components/actions/placeTileChoices";
import { CostChoicePanel } from "../components/effects/CostChoicePanel";
import { DeckReorderPanel } from "../components/effects/DeckReorderPanel";
import { EffectPrompt } from "../components/effects/EffectPrompt";
import { TopBar } from "../components/layout/TopBar";
import { HexMap } from "../components/map/HexMap";
import { BottomDrawer } from "../components/panels/BottomDrawer";
import { EncounterPanel } from "../components/panels/EncounterPanel";
import { SeedingPanel } from "../components/seeding/SeedingPanel";
import { SetupPanel } from "../components/setup/SetupPanel";
import { StewardPlacementPanel } from "../components/setup/StewardPlacementPanel";
import { stewards } from "../data/stewards";
import { coreTiles } from "../data/tiles";
import {
  activateTile,
  cancelCostChoice,
  canStartUpgradeTile,
  canCancelPendingBurdenWithWarden,
  cancelPendingBurdenWithWarden,
  commitStewardPlacement,
  confirmCostChoice,
  completeArrival,
  commitSeasonSeeding,
  endCurrentTurn,
  getActivatableTileIds,
  moveStewardViaStables,
  placeTile,
  resolveEndRound,
  revealEncounters,
  resolveBurden,
  upgradeTile,
  useFaceUpBoon,
  useStewardPower
} from "../engine/gameActions";
import { confirmDeckReorder, skipDeckReorder } from "../engine/deckReorder";
import { resolvePendingEffect, skipPendingEffect } from "../engine/manualEffects";
import { getTileFootprintKind } from "../engine/placementRules";
import { getPlacedTileAtHex } from "../engine/reachability";
import { createNewGame } from "../engine/setup";
import { selectCurrentPlayer, selectTileName } from "../engine/selectors";
import type { GameState, HexDirection, PlayerCount, TilePlacementDraft } from "../engine/types";

function createSetupSeed(): string {
  return `QV-${Date.now().toString(36).slice(-6).toUpperCase()}`;
}

interface ResolutionShellProps {
  state: GameState;
  eyebrow: string;
  title: string;
  detail: string;
  children: ReactNode;
  onUseFaceUpBoon: (boonCardId: string) => void;
}

function ResolutionShell({
  state,
  eyebrow,
  title,
  detail,
  children,
  onUseFaceUpBoon
}: ResolutionShellProps) {
  const queueItems = [
    ...(state.pendingDeckReorder
      ? [
          {
            id: state.pendingDeckReorder.id,
            title: state.pendingDeckReorder.title,
            source: "Deck order"
          }
        ]
      : []),
    ...(state.pendingCostChoice
      ? [
          {
            id: state.pendingCostChoice.id,
            title: state.pendingCostChoice.title,
            source: "Payment"
          }
        ]
      : []),
    ...state.pendingEffects.map((effect) => ({
      id: effect.id,
      title: effect.title,
      source: effect.sourceName
    }))
  ];

  return (
    <div className="app-shell">
      <TopBar state={state} />
      <main className="command-table resolution-table">
        <section className="action-console resolution-context-panel">
          <div className="turn-summary">
            <div>
              <p className="eyebrow">{eyebrow}</p>
              <h2>{title}</h2>
            </div>
            <strong>
              {queueItems.length} step{queueItems.length === 1 ? "" : "s"}
            </strong>
          </div>

          <div className="detail-stack resolution-summary-card">
            <strong>{queueItems[0]?.title ?? title}</strong>
            <p>{detail}</p>
          </div>

          <section className="resolution-queue">
            <p className="eyebrow">Resolution Queue</p>
            <div className="resolution-queue-list">
              {queueItems.length === 0 ? (
                <p className="muted">No pending effects.</p>
              ) : (
                queueItems.map((item, index) => (
                  <article
                    className={`resolution-queue-item ${index === 0 ? "active" : ""}`}
                    key={item.id}
                  >
                    <span>{index === 0 ? "Now" : `Next ${index}`}</span>
                    <strong>{item.title}</strong>
                    <small>{item.source}</small>
                  </article>
                ))
              )}
            </div>
          </section>
        </section>

        <section className="map-panel resolution-board">
          {children}
        </section>

        <EncounterPanel
          state={state}
          selectedHexIds={[]}
          selectedTileId={coreTiles[0].id}
          placementOrientation={3}
          actionMode="inspect"
          onUseFaceUpBoon={onUseFaceUpBoon}
        />
      </main>
      <BottomDrawer state={state} />
    </div>
  );
}

export function App() {
  const [playerCount, setPlayerCount] = useState<PlayerCount>(2);
  const [stewardIds, setStewardIds] = useState(
    stewards.slice(0, 2).map((steward) => steward.id)
  );
  const [encounterSeed, setEncounterSeed] = useState(createSetupSeed);
  const [state, setState] = useState<GameState | null>(null);
  const [selectedHexIds, setSelectedHexIds] = useState<string[]>([]);
  const [selectedTileId, setSelectedTileId] = useState(coreTiles[0].id);
  const [placementOrientation, setPlacementOrientation] = useState<HexDirection>(3);
  const [actionMode, setActionMode] = useState("place");
  const [mapContextMenu, setMapContextMenu] = useState<{
    hexId: string;
    x: number;
    y: number;
  } | null>(null);

  const normalizedStewards = useMemo(() => {
    const next = [...stewardIds];
    for (const steward of stewards) {
      if (next.length >= playerCount) break;
      if (!next.includes(steward.id)) next.push(steward.id);
    }
    return next.slice(0, playerCount);
  }, [playerCount, stewardIds]);

  function handlePlayerCountChange(nextCount: PlayerCount) {
    setPlayerCount(nextCount);
    setStewardIds((current) => {
      const next = [...current];
      for (const steward of stewards) {
        if (next.length >= nextCount) break;
        if (!next.includes(steward.id)) next.push(steward.id);
      }
      return next.slice(0, nextCount);
    });
  }

  function handleStewardChange(seatIndex: number, stewardId: string) {
    setStewardIds((current) => {
      const next = [...current];
      next[seatIndex] = stewardId;
      return next;
    });
  }

  function handleTileChange(tileId: string) {
    setSelectedTileId(tileId);
    setSelectedHexIds((current) =>
      getTileFootprintKind(tileId) === "detached" ? current.slice(0, 2) : current.slice(0, 1)
    );
    setMapContextMenu(null);
  }

  function handleHexSelect(hexId: string) {
    setMapContextMenu(null);
    if (actionMode !== "place" || getTileFootprintKind(selectedTileId) !== "detached") {
      setSelectedHexIds([hexId]);
      return;
    }

    setSelectedHexIds((current) => {
      if (current.includes(hexId)) return current.filter((selectedId) => selectedId !== hexId);
      if (current.length >= 2) return [hexId];
      return [...current, hexId];
    });
  }

  useEffect(() => {
    if (!mapContextMenu) return undefined;

    function closeMenu() {
      setMapContextMenu(null);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }

    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mapContextMenu]);

  useEffect(() => {
    if (
      !state ||
      state.phase !== "turns" ||
      state.actionsRemaining !== 0 ||
      state.pendingEffects.length > 0 ||
      state.pendingDeckReorder ||
      state.pendingCostChoice ||
      actionMode === "end"
    ) {
      return;
    }

    setActionMode("end");
  }, [
    actionMode,
    state?.actionsRemaining,
    state?.pendingCostChoice,
    state?.pendingDeckReorder,
    state?.pendingEffects.length,
    state?.phase
  ]);

  if (!state) {
    return (
      <SetupPanel
        playerCount={playerCount}
        stewardIds={normalizedStewards}
        encounterSeed={encounterSeed}
        onPlayerCountChange={handlePlayerCountChange}
        onStewardChange={handleStewardChange}
        onEncounterSeedChange={setEncounterSeed}
        onShuffleSeed={() => setEncounterSeed(createSetupSeed())}
        onStart={() =>
          setState(
            createNewGame(playerCount, normalizedStewards, {
              encounterSeed
            })
          )
        }
      />
    );
  }

  function resetPlacementSelection(
    nextState: GameState,
    playerId: string,
    avoidTileId?: string
  ) {
    setSelectedHexIds([]);
    setSelectedTileId(
      getDefaultPlaceTileId(nextState, playerId, [], placementOrientation, avoidTileId)
    );
  }

  function handleUseFaceUpBoon(boonCardId: string) {
    setState((current) => (current ? useFaceUpBoon(current, boonCardId) : current));
  }

  if (state.pendingDeckReorder) {
    return (
      <ResolutionShell
        state={state}
        eyebrow="Resolution"
        title="Order Encounter Deck"
        detail="Review the revealed deck information and confirm the order before the table advances."
        onUseFaceUpBoon={handleUseFaceUpBoon}
      >
        <DeckReorderPanel
          pending={state.pendingDeckReorder}
          season={state.season}
          onConfirm={(orderedCardIds) =>
            setState((current) =>
              current ? confirmDeckReorder(current, orderedCardIds) : current
            )
          }
          onSkip={() =>
            setState((current) => (current ? skipDeckReorder(current) : current))
          }
        />
      </ResolutionShell>
    );
  }

  if (state.pendingCostChoice) {
    return (
      <ResolutionShell
        state={state}
        eyebrow="Resolution"
        title="Confirm Payment"
        detail="Choose any passive payment effects, then confirm or cancel before spending the action."
        onUseFaceUpBoon={handleUseFaceUpBoon}
      >
        <CostChoicePanel
          state={state}
          pending={state.pendingCostChoice}
          onConfirm={(selection) => {
            const nextState = confirmCostChoice(state, selection);
            setState(nextState);
            if (nextState.map.placedTiles.length > state.map.placedTiles.length) {
              resetPlacementSelection(
                nextState,
                state.pendingCostChoice?.action.playerId ?? nextState.currentPlayerId,
                state.pendingCostChoice?.action.tileId
              );
            }
          }}
          onCancel={() =>
            setState((current) => (current ? cancelCostChoice(current) : current))
          }
        />
      </ResolutionShell>
    );
  }

  if (state.pendingEffects[0]) {
    const pendingEffect = state.pendingEffects[0];
    return (
      <ResolutionShell
        state={state}
        eyebrow={pendingEffect.sourceType === "card" ? "Encounter Reveal" : "Resolution"}
        title="Resolve Effect"
        detail="Read the card or tile effect, make any required choices, then apply or skip where allowed."
        onUseFaceUpBoon={handleUseFaceUpBoon}
      >
        <EffectPrompt
          state={state}
          effect={pendingEffect}
          onApply={(adjustment) =>
            setState((current) =>
              current ? resolvePendingEffect(current, adjustment) : current
            )
          }
          onSkip={() =>
            setState((current) => (current ? skipPendingEffect(current) : current))
          }
          canCancelWithWarden={canCancelPendingBurdenWithWarden(state).ok}
          onCancelWithWarden={() =>
            setState((current) =>
              current ? cancelPendingBurdenWithWarden(current) : current
            )
          }
        />
      </ResolutionShell>
    );
  }

  if (state.phase === "seeding") {
    return (
      <div className="app-shell">
        <TopBar state={state} />
        <SeedingPanel
          state={state}
          onConfirm={(selection) =>
            setState((current) =>
              current
                ? commitSeasonSeeding(current, current.currentPlayerId, selection)
                : current
            )
          }
        />
        <BottomDrawer state={state} />
      </div>
    );
  }

  if (state.phase === "setup") {
    return (
      <div className="app-shell">
        <TopBar state={state} />
        <StewardPlacementPanel
          state={state}
          onConfirm={(hexId) =>
            setState((current) =>
              current
                ? commitStewardPlacement(current, current.currentPlayerId, hexId)
                : current
            )
          }
        />
        <BottomDrawer state={state} />
      </div>
    );
  }

  const currentPlayer = selectCurrentPlayer(state);
  const placementDraft: TilePlacementDraft = {
    anchorHexId: selectedHexIds[0],
    orientation: placementOrientation,
    secondaryHexIds: selectedHexIds.slice(1)
  };
  const contextTile = mapContextMenu
    ? getPlacedTileAtHex(state, mapContextMenu.hexId)
    : undefined;
  const contextActivatableIds = getActivatableTileIds(state, currentPlayer.id);
  const canActivateContextTile =
    Boolean(contextTile) && contextActivatableIds.includes(contextTile?.instanceId ?? "");
  const contextUpgradeValidation = contextTile
    ? canStartUpgradeTile(state, currentPlayer.id, contextTile.instanceId)
    : null;
  const canUpgradeContextTile = Boolean(contextUpgradeValidation?.ok);
  const contextPlaceTileOptions = mapContextMenu
    ? getPlaceTileChoices(
        state,
        currentPlayer.id,
        [mapContextMenu.hexId],
        placementOrientation
      )
        .flatMap((tile) => {
          const placementDraft = getPlacementDraftForHex(
            state,
            currentPlayer.id,
            tile.id,
            mapContextMenu.hexId,
            placementOrientation
          );
          return placementDraft
            ? [
                {
                  ...tile,
                  placementDraft,
                  requiresRotation: getTileFootprintKind(tile.id) === "line"
                }
              ]
            : [];
        })
    : [];

  function commitTilePlacement(
    currentState: GameState,
    playerId: string,
    tileId: string,
    draft: TilePlacementDraft
  ) {
    const nextState = placeTile(currentState, playerId, tileId, draft);
    setState(nextState);
    if (nextState.map.placedTiles.length > currentState.map.placedTiles.length) {
      resetPlacementSelection(nextState, playerId, tileId);
    }
  }

  function stageTilePlacementInPanel(
    tileId: string,
    hexId: string,
    draft: TilePlacementDraft
  ) {
    setSelectedTileId(tileId);
    setSelectedHexIds([hexId]);
    if (draft.orientation !== undefined) {
      setPlacementOrientation(draft.orientation);
    }
    setActionMode("place");
    setMapContextMenu(null);
  }

  return (
    <div className="app-shell">
      <TopBar state={state} />
      <main className="command-table">
        <ActionConsole
          state={state}
          selectedTileId={selectedTileId}
          selectedHexIds={selectedHexIds}
          placementOrientation={placementOrientation}
          actionMode={actionMode}
          onModeChange={setActionMode}
          onSelectedTileChange={handleTileChange}
          onPlacementOrientationChange={setPlacementOrientation}
          onConfirmPlace={(resolvedPlacementDraft) => {
            if (!resolvedPlacementDraft.anchorHexId) return;
            commitTilePlacement(
              state,
              currentPlayer.id,
              selectedTileId,
              resolvedPlacementDraft
            );
          }}
          onUpgrade={(placedTileId) =>
            setState((current) =>
              current ? upgradeTile(current, currentPlayer.id, placedTileId) : current
            )
          }
          onActivate={(placedTileId) =>
            setState((current) =>
              current ? activateTile(current, currentPlayer.id, placedTileId) : current
            )
          }
          onCompleteArrival={(arrivalCardId) =>
            setState((current) =>
              current ? completeArrival(current, arrivalCardId) : current
            )
          }
          onResolveBurden={(burdenCardId) =>
            setState((current) =>
              current ? resolveBurden(current, burdenCardId) : current
            )
          }
          onUseFaceUpBoon={(boonCardId) =>
            setState((current) =>
              current ? useFaceUpBoon(current, boonCardId) : current
            )
          }
          onStableMove={(destinationTileId) =>
            setState((current) =>
              current
                ? moveStewardViaStables(current, currentPlayer.id, destinationTileId)
                : current
            )
          }
          onUseStewardPower={() =>
            setState((current) =>
              current ? useStewardPower(current, currentPlayer.id) : current
            )
          }
          onCancelPendingBurdenWithWarden={() =>
            setState((current) =>
              current ? cancelPendingBurdenWithWarden(current) : current
            )
          }
          onResolvePendingEffect={(adjustment) =>
            setState((current) =>
              current ? resolvePendingEffect(current, adjustment) : current
            )
          }
          onSkipPendingEffect={() =>
            setState((current) => (current ? skipPendingEffect(current) : current))
          }
          onReveal={() => {
            setActionMode("place");
            setState((current) => (current ? revealEncounters(current) : current));
          }}
          onEndTurn={() => {
            setActionMode("place");
            setState((current) => (current ? endCurrentTurn(current) : current));
          }}
          onEndRound={() =>
            setState((current) => (current ? resolveEndRound(current) : current))
          }
        />
        <HexMap
          state={state}
          selectedTileId={selectedTileId}
          actionMode={actionMode}
          selectedHexIds={selectedHexIds}
          placementOrientation={placementOrientation}
          onHexSelect={handleHexSelect}
          onHexContextMenu={(hexId, point) =>
            setMapContextMenu({ hexId, x: point.x, y: point.y })
          }
        />
        <EncounterPanel
          state={state}
          selectedHexIds={selectedHexIds}
          selectedTileId={selectedTileId}
          placementOrientation={placementOrientation}
          actionMode={actionMode}
          onUseFaceUpBoon={(boonCardId) =>
            handleUseFaceUpBoon(boonCardId)
          }
        />
        {mapContextMenu && (
          <div
            className="context-menu map-context-menu"
            onClick={(event) => event.stopPropagation()}
            role="menu"
            style={{ left: mapContextMenu.x, top: mapContextMenu.y }}
          >
            <span className="context-menu-caption">Map actions</span>
            <strong>
              {mapContextMenu.hexId}
              {contextTile ? ` | ${selectTileName(contextTile)}` : ""}
            </strong>
            {contextPlaceTileOptions.length > 0 && (
              <div className="context-menu-section">
                <span className="context-menu-caption">Place here</span>
                <div className="context-menu-list">
                  {contextPlaceTileOptions.map((tile) => (
                    <button
                      className="place-option"
                      key={tile.id}
                      onClick={() => {
                        if (tile.requiresRotation) {
                          stageTilePlacementInPanel(
                            tile.id,
                            mapContextMenu.hexId,
                            tile.placementDraft
                          );
                          return;
                        }

                        setActionMode("place");
                        setMapContextMenu(null);
                        commitTilePlacement(
                          state,
                          currentPlayer.id,
                          tile.id,
                          tile.placementDraft
                        );
                      }}
                      type="button"
                    >
                      <strong>{tile.name}</strong>
                      <small>
                        Cost {tile.costLabel}
                        {tile.requiresRotation ? " | Confirm rotation" : ""}
                      </small>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {contextTile && (
              <button
                disabled={!canUpgradeContextTile}
                title={contextUpgradeValidation?.reasons[0]}
                onClick={() => {
                  const tileId = contextTile.instanceId;
                  setSelectedHexIds([mapContextMenu.hexId]);
                  setActionMode("upgrade");
                  setMapContextMenu(null);
                  setState((current) =>
                    current
                      ? upgradeTile(current, currentPlayer.id, tileId)
                      : current
                  );
                }}
                type="button"
              >
                Upgrade {selectTileName(contextTile)}
              </button>
            )}
            {contextTile && (
              <button
                disabled={!canActivateContextTile}
                title={
                  canActivateContextTile
                    ? undefined
                    : "This tile cannot activate right now."
                }
                onClick={() => {
                  const tileId = contextTile.instanceId;
                  setSelectedHexIds([mapContextMenu.hexId]);
                  setActionMode("activate");
                  setMapContextMenu(null);
                  setState((current) =>
                    current ? activateTile(current, currentPlayer.id, tileId) : current
                  );
                }}
                type="button"
              >
                Activate {selectTileName(contextTile)}
              </button>
            )}
          </div>
        )}
      </main>
      <BottomDrawer state={state} />
      <nav className="mobile-nav" aria-label="Mobile sections">
        {["Map", "Action", "Encounters", "Hand", "Tiles"].map((item) => (
          <button key={item} type="button">
            {item}
          </button>
        ))}
      </nav>
    </div>
  );
}
