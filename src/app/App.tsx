import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
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
import {
  clearAllSaves,
  clearSavedGame,
  getBrowserHistoryIndex,
  pushBrowserUndoMarker,
  readSavedGame,
  readSavedSetup,
  resetBrowserHistoryAnchor,
  writeSavedGame,
  writeSavedSetup
} from "./persistence";

function createSetupSeed(): string {
  return `QV-${Date.now().toString(36).slice(-6).toUpperCase()}`;
}

const undoHistoryLimit = 40;

interface ResolutionShellProps {
  state: GameState;
  eyebrow: string;
  title: string;
  detail: string;
  children: ReactNode;
  onUseFaceUpBoon: (boonCardId: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
}

function ResolutionShell({
  state,
  eyebrow,
  title,
  detail,
  children,
  onUseFaceUpBoon,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onReset
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
      <TopBar
        state={state}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
        onReset={onReset}
      />
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
          onCompleteArrival={() => {}}
          onResolveBurden={() => {}}
        />
      </main>
    </div>
  );
}

export function App() {
  const [initialSavedGame] = useState(readSavedGame);
  const [initialSavedSetup] = useState(readSavedSetup);
  const [playerCount, setPlayerCount] = useState<PlayerCount>(
    initialSavedGame?.playerCount ?? initialSavedSetup?.playerCount ?? 1
  );
  const [stewardIds, setStewardIds] = useState(
    initialSavedGame?.stewardIds ??
      initialSavedSetup?.stewardIds ??
      stewards.slice(0, 1).map((steward) => steward.id)
  );
  const [encounterSeed, setEncounterSeed] = useState(
    initialSavedGame?.encounterSeed ?? initialSavedSetup?.encounterSeed ?? createSetupSeed
  );
  const [state, setState] = useState<GameState | null>(initialSavedGame?.state ?? null);
  const [undoStack, setUndoStack] = useState<GameState[]>([]);
  const [redoStack, setRedoStack] = useState<GameState[]>([]);
  const [selectedHexIds, setSelectedHexIds] = useState<string[]>([]);
  const [selectedTileId, setSelectedTileId] = useState(coreTiles[0].id);
  const [placementOrientation, setPlacementOrientation] = useState<HexDirection>(3);
  const [actionMode, setActionMode] = useState("place");
  const [mapContextMenu, setMapContextMenu] = useState<{
    hexId: string;
    x: number;
    y: number;
  } | null>(null);
  const stateRef = useRef<GameState | null>(state);
  const undoStackRef = useRef<GameState[]>(undoStack);
  const redoStackRef = useRef<GameState[]>(redoStack);
  const browserHistoryIndexRef = useRef(0);

  const normalizedStewards = useMemo(() => {
    const next = [...stewardIds];
    for (const steward of stewards) {
      if (next.length >= playerCount) break;
      if (!next.includes(steward.id)) next.push(steward.id);
    }
    return next.slice(0, playerCount);
  }, [playerCount, stewardIds]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    undoStackRef.current = undoStack;
  }, [undoStack]);

  useEffect(() => {
    redoStackRef.current = redoStack;
  }, [redoStack]);

  useEffect(() => {
    browserHistoryIndexRef.current = resetBrowserHistoryAnchor();
  }, []);

  useEffect(() => {
    if (state) {
      writeSavedGame({
        playerCount,
        stewardIds: normalizedStewards,
        encounterSeed,
        state
      });
      return;
    }

    writeSavedSetup({
      playerCount,
      stewardIds: normalizedStewards,
      encounterSeed
    });
    clearSavedGame();
  }, [encounterSeed, normalizedStewards, playerCount, state]);

  const pushUndoSnapshot = useCallback((previousState: GameState) => {
    setUndoStack((current) => {
      const next = [previousState, ...current].slice(0, undoHistoryLimit);
      undoStackRef.current = next;
      return next;
    });
    redoStackRef.current = [];
    setRedoStack([]);
    browserHistoryIndexRef.current += 1;
    pushBrowserUndoMarker(browserHistoryIndexRef.current);
  }, []);

  const commitKnownGameState = useCallback(
    (
      previousState: GameState,
      nextState: GameState,
      options: { undoable?: boolean } = {}
    ) => {
      if (nextState === previousState) return;
      if (options.undoable !== false) pushUndoSnapshot(previousState);
      setState(nextState);
    },
    [pushUndoSnapshot]
  );

  const commitGameState = useCallback(
    (
      updater: (current: GameState) => GameState,
      options: { undoable?: boolean } = {}
    ) => {
      setState((current) => {
        if (!current) return current;
        const nextState = updater(current);
        if (nextState === current) return current;
        if (options.undoable !== false) pushUndoSnapshot(current);
        return nextState;
      });
    },
    [pushUndoSnapshot]
  );

  const resetInteractionForState = useCallback((nextState: GameState) => {
    setSelectedHexIds([]);
    setSelectedTileId(
      getDefaultPlaceTileId(
        nextState,
        nextState.currentPlayerId,
        [],
        placementOrientation
      )
    );
    setActionMode("place");
    setMapContextMenu(null);
  }, [placementOrientation]);

  const handleUndo = useCallback(() => {
    const currentState = stateRef.current;
    const previousState = undoStackRef.current[0];
    if (!currentState || !previousState) return false;

    const nextUndoStack = undoStackRef.current.slice(1);
    const nextRedoStack = [currentState, ...redoStackRef.current].slice(0, undoHistoryLimit);
    undoStackRef.current = nextUndoStack;
    redoStackRef.current = nextRedoStack;
    stateRef.current = previousState;
    setUndoStack(nextUndoStack);
    setRedoStack(nextRedoStack);
    setState(previousState);
    resetInteractionForState(previousState);
    return true;
  }, [resetInteractionForState]);

  const handleRedo = useCallback(() => {
    const currentState = stateRef.current;
    const nextState = redoStackRef.current[0];
    if (!currentState || !nextState) return false;

    const nextRedoStack = redoStackRef.current.slice(1);
    const nextUndoStack = [currentState, ...undoStackRef.current].slice(0, undoHistoryLimit);
    redoStackRef.current = nextRedoStack;
    undoStackRef.current = nextUndoStack;
    stateRef.current = nextState;
    setRedoStack(nextRedoStack);
    setUndoStack(nextUndoStack);
    setState(nextState);
    resetInteractionForState(nextState);
    return true;
  }, [resetInteractionForState]);

  useEffect(() => {
    function handleBrowserNavigation(event: PopStateEvent) {
      if (!stateRef.current) return;

      const nextIndex = getBrowserHistoryIndex(event);
      if (nextIndex === null) return;

      const currentIndex = browserHistoryIndexRef.current;
      if (nextIndex < currentIndex) {
        handleUndo();
      } else if (nextIndex > currentIndex) {
        handleRedo();
      }
      browserHistoryIndexRef.current = nextIndex;
    }

    window.addEventListener("popstate", handleBrowserNavigation);
    return () => window.removeEventListener("popstate", handleBrowserNavigation);
  }, [handleRedo, handleUndo]);

  function handleResetGame() {
    if (
      state &&
      !window.confirm("Reset this game? This clears the saved game and starts over.")
    ) {
      return;
    }

    clearAllSaves();
    undoStackRef.current = [];
    redoStackRef.current = [];
    stateRef.current = null;
    setUndoStack([]);
    setRedoStack([]);
    browserHistoryIndexRef.current = resetBrowserHistoryAnchor();
    setState(null);
    setPlayerCount(1);
    setStewardIds(stewards.slice(0, 1).map((steward) => steward.id));
    setEncounterSeed(createSetupSeed());
    setSelectedHexIds([]);
    setSelectedTileId(coreTiles[0].id);
    setPlacementOrientation(3);
    setActionMode("place");
    setMapContextMenu(null);
  }

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
        onStart={() => {
          undoStackRef.current = [];
          redoStackRef.current = [];
          setUndoStack([]);
          setRedoStack([]);
          browserHistoryIndexRef.current = resetBrowserHistoryAnchor();
          setSelectedHexIds([]);
          setActionMode("place");
          setState(
            createNewGame(playerCount, normalizedStewards, {
              encounterSeed
            })
          );
        }}
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
    commitGameState((current) => useFaceUpBoon(current, boonCardId));
  }

  function handleCompleteArrival(arrivalCardId: string) {
    commitGameState((current) => completeArrival(current, arrivalCardId));
  }

  function handleResolveBurden(burdenCardId: string) {
    commitGameState((current) => resolveBurden(current, burdenCardId));
  }

  if (state.pendingDeckReorder) {
    return (
      <ResolutionShell
        state={state}
        eyebrow="Resolution"
        title="Order Encounter Deck"
        detail="Review the revealed deck information and confirm the order before the table advances."
        onUseFaceUpBoon={handleUseFaceUpBoon}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onReset={handleResetGame}
      >
        <DeckReorderPanel
          pending={state.pendingDeckReorder}
          season={state.season}
          onConfirm={(orderedCardIds) =>
            commitGameState((current) => confirmDeckReorder(current, orderedCardIds))
          }
          onSkip={() => commitGameState((current) => skipDeckReorder(current))}
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
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onReset={handleResetGame}
      >
        <CostChoicePanel
          state={state}
          pending={state.pendingCostChoice}
          onConfirm={(selection) => {
            const nextState = confirmCostChoice(state, selection);
            commitKnownGameState(state, nextState);
            if (nextState.map.placedTiles.length > state.map.placedTiles.length) {
              resetPlacementSelection(
                nextState,
                state.pendingCostChoice?.action.playerId ?? nextState.currentPlayerId,
                state.pendingCostChoice?.action.tileId
              );
            }
          }}
          onCancel={() => commitGameState((current) => cancelCostChoice(current))}
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
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onReset={handleResetGame}
      >
        <EffectPrompt
          state={state}
          effect={pendingEffect}
          onApply={(adjustment) =>
            commitGameState((current) => resolvePendingEffect(current, adjustment))
          }
          onSkip={() => commitGameState((current) => skipPendingEffect(current))}
          canCancelWithWarden={canCancelPendingBurdenWithWarden(state).ok}
          onCancelWithWarden={() =>
            commitGameState((current) => cancelPendingBurdenWithWarden(current))
          }
        />
      </ResolutionShell>
    );
  }

  if (state.phase === "seeding") {
    return (
      <div className="app-shell">
        <TopBar
          state={state}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onReset={handleResetGame}
        />
        <SeedingPanel
          state={state}
          onConfirm={(selection) =>
            commitGameState((current) =>
              commitSeasonSeeding(current, current.currentPlayerId, selection)
            )
          }
        />
      </div>
    );
  }

  if (state.phase === "setup") {
    return (
      <div className="app-shell">
        <TopBar
          state={state}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onReset={handleResetGame}
        />
        <StewardPlacementPanel
          state={state}
          onConfirm={(hexId) =>
            commitGameState((current) =>
              commitStewardPlacement(current, current.currentPlayerId, hexId)
            )
          }
        />
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
    commitKnownGameState(currentState, nextState);
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
      <TopBar
        state={state}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onReset={handleResetGame}
      />
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
            commitGameState((current) =>
              upgradeTile(current, currentPlayer.id, placedTileId)
            )
          }
          onActivate={(placedTileId) =>
            commitGameState((current) =>
              activateTile(current, currentPlayer.id, placedTileId)
            )
          }
          onCompleteArrival={(arrivalCardId) =>
            handleCompleteArrival(arrivalCardId)
          }
          onResolveBurden={(burdenCardId) =>
            handleResolveBurden(burdenCardId)
          }
          onUseFaceUpBoon={(boonCardId) =>
            commitGameState((current) => useFaceUpBoon(current, boonCardId))
          }
          onStableMove={(destinationTileId) =>
            commitGameState((current) =>
              moveStewardViaStables(current, currentPlayer.id, destinationTileId)
            )
          }
          onUseStewardPower={() =>
            commitGameState((current) => useStewardPower(current, currentPlayer.id))
          }
          onCancelPendingBurdenWithWarden={() =>
            commitGameState((current) => cancelPendingBurdenWithWarden(current))
          }
          onResolvePendingEffect={(adjustment) =>
            commitGameState((current) =>
              resolvePendingEffect(current, adjustment)
            )
          }
          onSkipPendingEffect={() =>
            commitGameState((current) => skipPendingEffect(current))
          }
          onReveal={() => {
            setActionMode("place");
            commitGameState((current) => revealEncounters(current));
          }}
          onEndTurn={() => {
            setActionMode("place");
            commitGameState((current) => endCurrentTurn(current));
          }}
          onEndRound={() =>
            commitGameState((current) => resolveEndRound(current))
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
          onCompleteArrival={handleCompleteArrival}
          onResolveBurden={handleResolveBurden}
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
                  commitGameState((current) =>
                    upgradeTile(current, currentPlayer.id, tileId)
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
                  commitGameState((current) =>
                    activateTile(current, currentPlayer.id, tileId)
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
    </div>
  );
}
