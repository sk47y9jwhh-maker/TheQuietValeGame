import { getPreparedStewardPower } from "../components/actions/preparedActions";
import { goldenVialId } from "../components/actions/GoldenVialNotice";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from "react";
import { SaveNotice } from "../components/common/SaveNotice";
import { saveSession } from "./saveSession";
import type { StorageResult } from "./browserStorage";
import { ConfirmationDialog } from "../components/common/ConfirmationDialog";
import { ActionConsole } from "../components/actions/ActionConsole";
import {
  getDefaultPlaceTileId,
  getPlacementDraftForHex,
  getPlaceTileChoices
} from "../components/actions/placeTileChoices";
import { CostChoicePanel } from "../components/effects/CostChoicePanel";
import { DeckReorderPanel } from "../components/effects/DeckReorderPanel";
import { EffectPrompt } from "../components/effects/EffectPrompt";
import { GoldenEffectPanel } from "../components/effects/GoldenEffectPanel";
import { TopBar } from "../components/layout/TopBar";
import { ResolutionShell } from "../components/layout/ResolutionShell";
import { HexMap } from "../components/map/HexMap";
import { TileInspectModal } from "../components/map/TileInspectModal";
import { BottomDrawer } from "../components/panels/BottomDrawer";
import { EncounterPanel } from "../components/panels/EncounterPanel";
import { SeedingPanel } from "../components/seeding/SeedingPanel";
import { SetupPanel } from "../components/setup/SetupPanel";
import { TabletopWelcome } from "../components/setup/TabletopWelcome";
import { TabletopLayout } from "../components/layout/TabletopLayout";
import { TableSeeding } from "../components/seeding/TableSeeding";
import { isBoardTableExperience, isPlayerExperience } from "./experience";
import { TableChrome, TableScreen } from "../components/table/TableScreen";
import { describeAutomaticStep, isAutomaticEffect, revealedCardIds } from "../components/table/automaticSteps";
import { StewardPlacementPanel } from "../components/setup/StewardPlacementPanel";
import { GoldenTilePlacementPanel } from "../components/setup/GoldenTilePlacementPanel";
import { stewards } from "../data/stewards";
import { goldenBoons } from "../data/encounters";
import { isVowAvailableForPlayerCount, ledgerEntries, ledgerMilestones } from "../data/ledger";
import { coreTiles, goldenTiles } from "../data/tiles";
import {
  activateTile,
  cancelCostChoice,
  canStartUpgradeTile,
  canCancelPendingBurdenWithWarden,
  cancelPendingBurdenWithWarden,
  commitStewardPlacement,
  confirmCostChoice,
  completeArrival,
  reviewArrivalCompletion,
  commitSeasonSeeding,
  endCurrentTurn,
  getActivatableTileIds,
  placeTile,
  resolveEndRound,
  revealEncounters,
  resolveBurden,
  upgradeTile,
  useFaceUpBoon,
  useStewardPower
} from "../engine/gameActions";
import { confirmDeckReorder, skipDeckReorder } from "../engine/deckReorder";
import {
  preparePendingEffectQueueHead,
  refreshPendingEffectForCurrentState,
  resolvePendingEffect,
  skipPendingEffect
} from "../engine/manualEffects";
import { getTileFootprintKind } from "../engine/placementRules";
import { getPlacedTileAtHex } from "../engine/reachability";
import { createNewGame } from "../engine/setup";
import { getLedgerRun, recordLedgerGame, trackLedgerTransition } from "../engine/ledger";
import {
  countCompletedLedgerEntries,
  createEmptyLedgerCampaign
} from "../engine/ledgerCampaign";
import {
  placeGoldenTileForSetup,
  resolveGoldenBell,
  resolveGoldenScroll,
  resolveGoldenSignet,
  skipGoldenTileForSetup
} from "../engine/golden";
import { selectCurrentPlayer, selectTileName } from "../engine/selectors";
import type { GameState, HexDirection, PlayerCount, TilePlacementDraft } from "../engine/types";
import {
  getBrowserHistoryIndex,
  pushBrowserUndoMarker,
  readSavedGameResult,
  readSavedSetupResult,
  resetBrowserHistoryAnchor
} from "./persistence";
import {
  readLedgerCampaignResult
} from "./ledgerPersistence";
import type { PreviewSnapshot } from "./scenarioTypes";
import { fitContextMenuToViewport } from "./contextMenuPosition";

function createSetupSeed(): string {
  return `QV-${Date.now().toString(36).slice(-6).toUpperCase()}`;
}

const undoHistoryLimit = 40;

export function App({ initialPreview, simulateSaveFailure = false }: { initialPreview?: PreviewSnapshot; simulateSaveFailure?: boolean } = {}) {
  const [initialStorage] = useState(() => ({ game: readSavedGameResult(), setup: readSavedSetupResult(), campaign: readLedgerCampaignResult() }));
  const initialSavedGame = initialStorage.game.ok ? initialStorage.game.value : null;
  const initialSavedSetup = initialStorage.setup.ok ? initialStorage.setup.value : null;
  const initialCampaign = (initialStorage.campaign.ok ? initialStorage.campaign.value : null) ?? initialPreview?.campaign ?? createEmptyLedgerCampaign();
  const loadProblem = [initialStorage.game, initialStorage.setup, initialStorage.campaign].find((result) => !result.ok);
  const [saveResult, setSaveResult] = useState<StorageResult>({ ok: true });
  const [saveAttempt, setSaveAttempt] = useState(0);
  const [saveNoticeHeight, setSaveNoticeHeight] = useState(0);
  const [playerCount, setPlayerCount] = useState<PlayerCount>(
    initialSavedGame?.playerCount ?? initialSavedSetup?.playerCount ?? initialPreview?.setup.playerCount ?? 1
  );
  const [stewardIds, setStewardIds] = useState(
    initialSavedGame?.stewardIds ??
      initialSavedSetup?.stewardIds ?? initialPreview?.setup.stewardIds ??
      stewards.slice(0, 1).map((steward) => steward.id)
  );
  const [encounterSeed, setEncounterSeed] = useState(
    initialSavedGame?.encounterSeed ?? initialSavedSetup?.encounterSeed ?? initialPreview?.setup.encounterSeed ?? createSetupSeed
  );
  const [declaredVowId, setDeclaredVowId] = useState(
    initialSavedGame?.declaredVowId ?? initialSavedSetup?.declaredVowId ?? ""
  );
  const [selectedGoldenTileId, setSelectedGoldenTileId] = useState(
    initialSavedGame?.selectedGoldenTileId ?? initialSavedSetup?.selectedGoldenTileId ?? ""
  );
  const [selectedGoldenBoonId, setSelectedGoldenBoonId] = useState(
    initialSavedGame?.selectedGoldenBoonId ?? initialSavedSetup?.selectedGoldenBoonId ?? ""
  );
  const [ledgerCampaign, setLedgerCampaign] = useState(initialCampaign);
  const [state, setState] = useState<GameState | null>(() => {
    const restored = initialSavedGame?.state ?? (initialSavedSetup ? null : initialPreview?.state ?? null);
    // The campaign is authoritative if a previous multi-key save stopped after
    // clearing the Ledger but before the board's cached recording flag updated.
    return restored?.ledgerRun?.recorded && initialStorage.campaign.ok && !initialCampaign.games.some((game) => game.id === restored.ledgerRun!.gameId)
      ? { ...restored, ledgerRun: { ...restored.ledgerRun, recorded: false } }
      : restored;
  });
  const [pendingReset, setPendingReset] = useState<"game" | "ledger" | null>(null);
  const [tableNotice, setTableNotice] = useState<string[]>([]);
  const [newCards, setNewCards] = useState<{ round: number; ids: Set<string> }>({ round: 0, ids: new Set() });
  const [undoStack, setUndoStack] = useState<GameState[]>([]);
  const [redoStack, setRedoStack] = useState<GameState[]>([]);
  const [selectedHexIds, setSelectedHexIds] = useState<string[]>([]);
  const [boardSelectionVersion, setBoardSelectionVersion] = useState(0);
  const [selectedTileId, setSelectedTileId] = useState(coreTiles[0].id);
  const [placementOrientation, setPlacementOrientation] = useState<HexDirection>(3);
  const [actionMode, setActionMode] = useState("place");
  const [inspectedPlacedTileId, setInspectedPlacedTileId] = useState<string | null>(null);
  const [inspectedTileId, setInspectedTileId] = useState<string | null>(null);
  const [mapContextMenu, setMapContextMenu] = useState<{
    hexId: string;
    x: number;
    y: number;
  } | null>(null);
  const [mapContextMenuPosition, setMapContextMenuPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const mapContextMenuRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<GameState | null>(state);
  const undoStackRef = useRef<GameState[]>(undoStack);
  const redoStackRef = useRef<GameState[]>(redoStack);
  const browserHistoryIndexRef = useRef(0);
  const focusSetupOnMount = useRef(false);

  const normalizedStewards = useMemo(() => {
    const next = [...stewardIds];
    for (const steward of stewards) {
      if (next.length >= playerCount) break;
      if (!next.includes(steward.id)) next.push(steward.id);
    }
    return next.slice(0, playerCount);
  }, [playerCount, stewardIds]);

  const ledgerSetupOptions = useMemo(() => {
    const completedCount = countCompletedLedgerEntries(ledgerCampaign);
    const isMilestoneUnlocked = (index: number) =>
      completedCount >= ledgerMilestones[index].threshold ||
      (ledgerCampaign.grandfatheredGoldenMilestoneCount ?? 0) > index;
    const vowEntries = ledgerEntries.filter((entry) => entry.declaredVow);
    const isVowUnlocked = (entry: (typeof vowEntries)[number]) =>
      completedCount >= entry.unlockAt &&
      isVowAvailableForPlayerCount(entry.id, playerCount);

    return {
      completedCount,
      availableVows: vowEntries.filter(isVowUnlocked),
      lockedVows: vowEntries.filter((entry) => !isVowUnlocked(entry)),
      availableGoldenTiles: goldenTiles.filter((_tile, index) =>
        isMilestoneUnlocked(index)
      ),
      availableGoldenBoons: goldenBoons.filter((_boon, index) =>
        isMilestoneUnlocked(index)
      )
    };
  }, [ledgerCampaign, playerCount]);

  useEffect(() => {
    if (!isVowAvailableForPlayerCount(declaredVowId || undefined, playerCount)) {
      setDeclaredVowId("");
    }
  }, [declaredVowId, playerCount]);

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
    if (loadProblem) {
      setSaveResult(loadProblem);
      return;
    }
    setSaveResult(saveSession({
      state,
      campaign: ledgerCampaign,
      setup: {
        playerCount,
        stewardIds: normalizedStewards,
        encounterSeed,
        declaredVowId: state ? state.ledgerRun?.declaredVowId : declaredVowId || undefined,
        selectedGoldenTileId: state ? state.goldenSetup.selectedTileId : selectedGoldenTileId || undefined,
        selectedGoldenBoonId: state ? state.goldenSetup.selectedBoonId : selectedGoldenBoonId || undefined
      }
    }, simulateSaveFailure));
  }, [declaredVowId, encounterSeed, normalizedStewards, playerCount, selectedGoldenBoonId, selectedGoldenTileId, state, ledgerCampaign, saveAttempt, simulateSaveFailure, loadProblem]);

  const pushUndoSnapshot = useCallback((previousState: GameState) => {
    const next = [previousState, ...undoStackRef.current].slice(0, undoHistoryLimit);
    undoStackRef.current = next;
    setUndoStack(next);
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
      const trackedState = trackLedgerTransition(previousState, nextState);
      if (options.undoable !== false) pushUndoSnapshot(previousState);
      stateRef.current = trackedState;
      setState(trackedState);
    },
    [pushUndoSnapshot]
  );

  const commitGameState = useCallback(
    (
      updater: (current: GameState) => GameState,
      options: { undoable?: boolean } = {}
    ) => {
      // Commits include history and Ledger effects. Keep them outside React's
      // replayable state updater so StrictMode cannot record a decision twice.
      const current = stateRef.current;
      if (!current) return;
      commitKnownGameState(current, updater(current), options);
    },
    [commitKnownGameState]
  );

  useEffect(() => {
    if (
      !state ||
      !state.pendingEffects[0] ||
      state.pendingEffects[0].targetCardPrepared
    ) return;
    commitGameState(
      (current) => preparePendingEffectQueueHead(current),
      { undoable: false }
    );
  }, [commitGameState, state?.pendingEffects]);

  // Board-first table: steps with nothing to decide happen by themselves and
  // are reported in a short notice. They are not separate Undo steps, so Undo
  // returns to before the player's last real decision.
  useEffect(() => {
    if (!state || !isBoardTableExperience()) return;
    if (state.pendingCostChoice || state.pendingDeckReorder || state.pendingGoldenEffect) return;
    const head = state.pendingEffects[0];
    if (head) {
      if (preparePendingEffectQueueHead(state) !== state) return;
      const effect = refreshPendingEffectForCurrentState(state, head);
      if (!isAutomaticEffect(state, effect)) return;
      const message = describeAutomaticStep(effect);
      commitGameState((current) => resolvePendingEffect(current, {}), { undoable: false });
      if (message) setTableNotice((lines) => [...lines, message].slice(-3));
      return;
    }
    if (state.phase === "endRound") {
      commitGameState((current) => resolveEndRound(current), { undoable: false });
      return;
    }
    if (state.phase === "reveal") {
      const before = state;
      const after = revealEncounters(before);
      if (after === before) return;
      commitKnownGameState(before, after, { undoable: false });
      const ids = revealedCardIds(before, after);
      setNewCards({ round: after.round, ids: new Set(ids.map((entry) => entry.id)) });
      setTableNotice([`Round ${after.round}${after.round % 4 === 1 ? ` · Season ${["", "I", "II", "III"][after.season]} begins` : ""}. ${ids.length ? `Revealed ${ids.map((entry) => entry.name).join(", ")}.` : "No new encounters."}`]);
    }
  }, [commitGameState, commitKnownGameState, state]);

  useEffect(() => {
    if (tableNotice.length === 0) return undefined;
    const timer = setTimeout(() => setTableNotice([]), 9000);
    return () => clearTimeout(timer);
  }, [tableNotice]);

  const resetInteractionForState = useCallback((nextState: GameState) => {
    setSelectedHexIds([]);
    const prepared = isPlayerExperience() ? getPreparedStewardPower(nextState) : null;
    const matchingTile = prepared?.mode === "place"
      ? getPlaceTileChoices(nextState, nextState.currentPlayerId, [], placementOrientation).find((tile) => tile.category === prepared.category && tile.placeableNow)
      : undefined;
    setSelectedTileId(matchingTile?.id ?? getDefaultPlaceTileId(nextState, nextState.currentPlayerId, [], placementOrientation));
    setActionMode(prepared?.mode ?? "place");
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
      setPendingReset(null);
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
    if (state) setPendingReset("game");
  }

  function resetGame() {
    focusSetupOnMount.current = true;
    setPendingReset(null);
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
    setDeclaredVowId("");
    setSelectedGoldenTileId("");
    setSelectedGoldenBoonId("");
    setSelectedHexIds([]);
    setSelectedTileId(coreTiles[0].id);
    setPlacementOrientation(3);
    setActionMode("place");
    setMapContextMenu(null);
  }

  function handleRecordLedgerGame() {
    if (!state || state.phase !== "gameEnd") return;
    const result = recordLedgerGame(state, ledgerCampaign);
    if (result.campaign === ledgerCampaign) return;
    setLedgerCampaign(result.campaign);
    stateRef.current = result.state;
    setState(result.state);
  }

  function handleResetLedgerCampaign() {
    setPendingReset("ledger");
  }

  function resetLedgerCampaign() {
    setPendingReset(null);
    const emptyCampaign = createEmptyLedgerCampaign();
    setLedgerCampaign(emptyCampaign);
    // Recording belongs to the campaign, so retained boards must not claim a
    // cleared result is still recorded — including boards reached by Undo/Redo.
    const unrecord = (snapshot: GameState): GameState => snapshot.ledgerRun?.recorded
      ? { ...snapshot, ledgerRun: { ...snapshot.ledgerRun, recorded: false } }
      : snapshot;
    stateRef.current = stateRef.current ? unrecord(stateRef.current) : null;
    undoStackRef.current = undoStackRef.current.map(unrecord);
    redoStackRef.current = redoStackRef.current.map(unrecord);
    setState(stateRef.current);
    setUndoStack(undoStackRef.current);
    setRedoStack(redoStackRef.current);
    if (!state) {
      setSelectedGoldenTileId("");
      setSelectedGoldenBoonId("");
    }
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
    const isDetached = actionMode === "place" && getTileFootprintKind(selectedTileId) === "detached";
    const next = !isDetached ? [hexId]
      : selectedHexIds.includes(hexId) ? selectedHexIds.filter((selectedId) => selectedId !== hexId)
      : selectedHexIds.length >= 2 ? [hexId] : [...selectedHexIds, hexId];
    setSelectedHexIds(next);
    // A deliberate selection also counts when the same hex was already selected.
    // Keep a detached footprint on the board until both spaces are chosen.
    if (!isDetached || next.length === 2) setBoardSelectionVersion((version) => version + 1);
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

  useLayoutEffect(() => {
    const menu = mapContextMenuRef.current;
    if (!mapContextMenu || !menu) {
      setMapContextMenuPosition(null);
      return undefined;
    }
    const anchor = mapContextMenu;
    const menuElement = menu;

    function placeMenu() {
      const rect = menuElement.getBoundingClientRect();
      const next = fitContextMenuToViewport(
        anchor.x,
        anchor.y,
        rect.width,
        rect.height,
        window.innerWidth,
        window.innerHeight
      );
      setMapContextMenuPosition((current) =>
        current?.left === next.left && current.top === next.top ? current : next
      );
    }

    placeMenu();
    window.addEventListener("resize", placeMenu);
    return () => window.removeEventListener("resize", placeMenu);
  }, [mapContextMenu]);

  useEffect(() => {
    if (
      !state ||
      state.phase !== "turns" ||
      state.actionsRemaining !== 0 ||
      state.pendingEffects.length > 0 ||
      state.pendingGoldenEffect ||
      state.pendingDeckReorder ||
      state.pendingCostChoice
    ) {
      return;
    }

    // Restored preparations still have a useful action after the ordinary four.
    const prepared = isPlayerExperience() ? getPreparedStewardPower(state) : null;
    if (prepared?.mode === "place") {
      const tile = getPlaceTileChoices(state, state.currentPlayerId, [], placementOrientation).find((choice) => choice.category === prepared.category && choice.placeableNow);
      if (tile) setSelectedTileId(tile.id);
    }
    setActionMode(prepared?.mode ?? "end");
  }, [
    state?.actionsRemaining,
    state?.pendingCostChoice,
    state?.pendingDeckReorder,
    state?.pendingEffects.length,
    state?.pendingGoldenEffect,
    state?.phase
  ]);

  function withConfirmation(content: ReactNode) {
    const recorded = state && (state.ledgerRun?.recorded || ledgerCampaign.games.some((game) => game.id === getLedgerRun(state).gameId));
    const completed = state?.phase === "gameEnd";
    return <div className="save-boundary" style={{ "--save-notice-height": `${saveNoticeHeight}px` } as CSSProperties}>
      <SaveNotice result={saveResult} loadProtected={Boolean(loadProblem)} simulated={simulateSaveFailure} onRetry={() => setSaveAttempt((attempt) => attempt + 1)} onHeightChange={setSaveNoticeHeight} />
      {content}{pendingReset && <ConfirmationDialog
      title={pendingReset === "ledger" ? "Clear this Ledger’s progress?" : completed ? "Begin another settlement?" : "Start this settlement over?"}
      cancelLabel={pendingReset === "ledger" ? "Keep Ledger progress" : completed ? "Keep reviewing" : "Keep playing"}
      confirmLabel={pendingReset === "ledger" ? "Clear Ledger progress" : completed ? "Begin new settlement" : "Clear board and start over"}
      destructive={pendingReset === "ledger" || !completed}
      onCancel={() => setPendingReset(null)}
      onConfirm={pendingReset === "ledger" ? resetLedgerCampaign : resetGame}
    >{pendingReset === "ledger" ? <>
      <p>This clears {countCompletedLedgerEntries(ledgerCampaign)} completed Ledger entries, {ledgerCampaign.games.length} recorded settlement{ledgerCampaign.games.length === 1 ? "" : "s"}, prestige records and Golden unlocks.</p>
      <p>The active game and its recent Undo/Redo steps are kept. {completed && "You can record this completed settlement again afterward."}</p>
      <p><strong>Cleared campaign progress cannot be restored with Undo.</strong></p>
    </> : <>
      {completed && !recorded && <p><strong>This completed game has not been recorded in the Ledger.</strong> Keep reviewing to record it first.</p>}
      <p>The current saved board and recent Undo/Redo history will be cleared. Recorded Ledger progress is kept.</p>
      <p>You’ll return to setup. This cannot be undone.</p>
    </>}</ConfirmationDialog>}</div>;
  }

  if (!state) {
    const SetupExperience = isPlayerExperience() ? TabletopWelcome : SetupPanel;
    return withConfirmation(
      <SetupExperience
        focusOnMount={focusSetupOnMount.current}
        playerCount={playerCount}
        stewardIds={normalizedStewards}
        declaredVowId={declaredVowId}
        selectedGoldenTileId={selectedGoldenTileId}
        selectedGoldenBoonId={selectedGoldenBoonId}
        completedLedgerCount={ledgerSetupOptions.completedCount}
        availableVows={ledgerSetupOptions.availableVows}
        lockedVows={ledgerSetupOptions.lockedVows}
        availableGoldenTiles={ledgerSetupOptions.availableGoldenTiles}
        availableGoldenBoons={ledgerSetupOptions.availableGoldenBoons}
        onPlayerCountChange={handlePlayerCountChange}
        onStewardChange={handleStewardChange}
        onDeclaredVowChange={setDeclaredVowId}
        onGoldenTileChange={setSelectedGoldenTileId}
        onGoldenBoonChange={setSelectedGoldenBoonId}
        onStart={() => {
          // Comparisons keep their advertised deal. Ordinary games still get a fresh seed.
          const nextSeed = initialPreview?.setup.encounterSeed ?? createSetupSeed();
          setEncounterSeed(nextSeed);
          undoStackRef.current = [];
          redoStackRef.current = [];
          setUndoStack([]);
          setRedoStack([]);
          browserHistoryIndexRef.current = resetBrowserHistoryAnchor();
          setSelectedHexIds([]);
          setActionMode("place");
          setState(
            createNewGame(playerCount, normalizedStewards, {
              encounterSeed: nextSeed,
              declaredVowId: declaredVowId || undefined,
              selectedGoldenTileId: selectedGoldenTileId || undefined,
              selectedGoldenBoonId: selectedGoldenBoonId || undefined
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
    if (isPlayerExperience() && boonCardId === goldenVialId && state) {
      const next = useFaceUpBoon(state, boonCardId);
      commitKnownGameState(state, next);
      if (next !== state) {
        const choices = getPlaceTileChoices(next, next.currentPlayerId, [], placementOrientation);
        const travel = choices.find((tile) => tile.kind === "core" && tile.category === "travel" && tile.placeableNow) ?? choices.find((tile) => tile.kind === "core" && tile.category === "travel" && tile.hasEnoughSupply);
        setSelectedHexIds([]);
        if (travel) setSelectedTileId(travel.id);
        setActionMode("place");
      }
    } else commitGameState((current) => useFaceUpBoon(current, boonCardId));
  }

  function handleUseStewardPower() {
    const current = stateRef.current;
    if (!current) return;
    const next = useStewardPower(current, current.currentPlayerId);
    commitKnownGameState(current, next);
    if (isPlayerExperience() && next !== current) reviewPreparedStewardPower(next);
  }

  function reviewPreparedStewardPower(next: GameState) {
    const prepared = getPreparedStewardPower(next);
    if (prepared) {
      setSelectedHexIds([]);
      if (prepared.mode === "place") {
        const choices = getPlaceTileChoices(next, next.currentPlayerId, [], placementOrientation);
        const tile = choices.find((choice) => choice.category === prepared.category && choice.placeableNow)
          ?? choices.find((choice) => choice.category === prepared.category && choice.hasEnoughSupply);
        if (tile) setSelectedTileId(tile.id);
      }
      setActionMode(prepared.mode);
    }
  }

  function handleCompleteArrival(arrivalCardId: string) {
    commitGameState((current) => isPlayerExperience() ? reviewArrivalCompletion(current, arrivalCardId) : completeArrival(current, arrivalCardId));
  }

  function handleResolveBurden(burdenCardId: string) {
    commitGameState((current) => resolveBurden(current, burdenCardId));
  }

  if (state.pendingGoldenEffect) {
    return withConfirmation(
      <ResolutionShell
        state={state}
        eyebrow="Golden Boon"
        title="Resolve Golden Legacy"
        detail="Golden Boons resolve immediately for free before normal Encounter effects continue."
        onUseFaceUpBoon={handleUseFaceUpBoon}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onReset={handleResetGame}
      >
        <GoldenEffectPanel
          state={state}
          onResolveBell={(arrivalCardId) =>
            commitGameState((current) => resolveGoldenBell(current, arrivalCardId))
          }
          onResolveScroll={(choices) =>
            commitGameState((current) => resolveGoldenScroll(current, choices))
          }
          onResolveSignet={(placements) =>
            commitGameState((current) => resolveGoldenSignet(current, placements))
          }
        />
      </ResolutionShell>
    );
  }

  if (state.pendingDeckReorder) {
    return withConfirmation(
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
          onConfirm={(orderedCardIds, bottomCardId) =>
            commitGameState((current) =>
              confirmDeckReorder(current, orderedCardIds, bottomCardId)
            )
          }
          onSkip={() => commitGameState((current) => skipDeckReorder(current))}
        />
      </ResolutionShell>
    );
  }

  // On the board-first table, payments and effects during play are settled
  // beside the board, so their tile choices can be made on the board itself.
  const tableResolves = isBoardTableExperience() && (
    state.phase === "turns" || state.phase === "reveal" || state.phase === "endRound" ||
    (state.phase === "seeding" && Boolean(state.pendingEffects[0] || state.pendingCostChoice))
  );
  const costChoicePanel = state.pendingCostChoice ? (
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
  ) : null;
  const headEffect = state.pendingEffects[0] ? refreshPendingEffectForCurrentState(state, state.pendingEffects[0]) : null;
  const effectPanel = headEffect ? (
        <EffectPrompt
          state={state}
          effect={headEffect}
          onApply={(adjustment) =>
            commitGameState((current) => resolvePendingEffect(current, adjustment))
          }
          onSkip={() => commitGameState((current) => skipPendingEffect(current))}
          canCancelWithWarden={canCancelPendingBurdenWithWarden(state).ok}
          onCancelWithWarden={() =>
            commitGameState((current) => cancelPendingBurdenWithWarden(current))
          }
        />
  ) : null;

  if (state.pendingCostChoice && !tableResolves) {
    return withConfirmation(
      <ResolutionShell
        state={state}
        eyebrow="Resolution"
        title={isPlayerExperience() ? "Review payment" : "Confirm Payment"}
        detail="Review the action and resource costs, choose any available payment effects, then confirm. Cancel keeps your resources and actions."
        onUseFaceUpBoon={handleUseFaceUpBoon}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onReset={handleResetGame}
      >
        {costChoicePanel}
      </ResolutionShell>
    );
  }

  if (headEffect && !tableResolves) {
    const pendingEffect = headEffect;
    return withConfirmation(
      <ResolutionShell
        state={state}
        eyebrow={state.phase === "seeding" ? "Season transition" : pendingEffect.sourceType === "card" ? "Encounter resolution" : "Resolution"}
        title="Resolve Effect"
        detail="Read the card or tile effect, make any required choices, then apply or skip where allowed."
        onUseFaceUpBoon={handleUseFaceUpBoon}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onReset={handleResetGame}
      >
        {effectPanel}
      </ResolutionShell>
    );
  }

  if (state.phase === "seeding" && isBoardTableExperience() && !tableResolves) {
    return withConfirmation(
      <div className="app-shell board-table-shell">
        <TableChrome state={state} canUndo={undoStack.length > 0} canRedo={redoStack.length > 0} onUndo={handleUndo} onRedo={handleRedo} onReset={handleResetGame}>
          <TableSeeding
            state={state}
            onConfirm={(selection) =>
              commitGameState((current) =>
                commitSeasonSeeding(current, current.currentPlayerId, selection)
              )
            }
          />
        </TableChrome>
      </div>
    );
  }

  if (state.phase === "seeding" && !tableResolves) {
    const SeedingExperience = isPlayerExperience() ? TableSeeding : SeedingPanel;
    return withConfirmation(
      <div className="app-shell">
        <TopBar
          state={state}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onReset={handleResetGame}
        />
        <SeedingExperience
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

  if (state.phase === "goldenSetup") {
    return withConfirmation(
      <div className="app-shell">
        <TopBar
          state={state}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onReset={handleResetGame}
        />
        <GoldenTilePlacementPanel
          state={state}
          onConfirm={(hexId) =>
            commitGameState((current) => placeGoldenTileForSetup(current, hexId))
          }
          onSkip={() => commitGameState((current) => skipGoldenTileForSetup(current))}
        />
      </div>
    );
  }

  if (state.phase === "setup") {
    return withConfirmation(
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

  function inspectPlacedTile(placedTileId: string) {
    setInspectedPlacedTileId(placedTileId);
    setInspectedTileId(null);
  }

  function inspectTileDefinition(tileId: string) {
    setInspectedTileId(tileId);
    setInspectedPlacedTileId(null);
  }

  function closeTileInspector() {
    setInspectedPlacedTileId(null);
    setInspectedTileId(null);
  }

  if (isBoardTableExperience() && state.phase !== "gameEnd") {
    const clearNotice = () => setTableNotice([]);
    return withConfirmation(
      <div className="app-shell board-table-shell">
        <TableScreen
          state={state}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          newCardIds={newCards.round === state.round ? newCards.ids : new Set()}
          notice={tableNotice.length ? tableNotice.join(" ") : null}
          onDismissNotice={clearNotice}
          handlers={{
            activate: (placedTileId) => { clearNotice(); commitGameState((current) => activateTile(current, current.currentPlayerId, placedTileId)); },
            upgrade: (placedTileId) => { clearNotice(); commitGameState((current) => upgradeTile(current, current.currentPlayerId, placedTileId)); },
            place: (tileId, draft) => { clearNotice(); commitGameState((current) => placeTile(current, current.currentPlayerId, tileId, draft)); },
            completeArrival: (cardId) => { clearNotice(); commitGameState((current) => completeArrival(current, cardId)); },
            resolveBurden: (cardId) => { clearNotice(); handleResolveBurden(cardId); },
            useBoon: (cardId) => { clearNotice(); handleUseFaceUpBoon(cardId); },
            useStewardPower: () => { clearNotice(); handleUseStewardPower(); },
            endTurn: () => { clearNotice(); commitGameState((current) => endCurrentTurn(current)); },
            reveal: () => commitGameState((current) => revealEncounters(current)),
            endRound: () => commitGameState((current) => resolveEndRound(current)),
            inspectPlaced: inspectPlacedTile,
            undo: () => { clearNotice(); handleUndo(); },
            redo: () => { clearNotice(); handleRedo(); },
            reset: handleResetGame
          }}
          tray={<BottomDrawer state={state} ledgerCampaign={ledgerCampaign} onResetLedgerCampaign={handleResetLedgerCampaign} onTileInspect={inspectTileDefinition} />}
          resolution={state.pendingCostChoice ? {
            key: state.pendingCostChoice.id,
            eyebrow: "Payment",
            title: state.pendingCostChoice.title,
            steps: 1 + state.pendingEffects.length,
            content: costChoicePanel
          } : headEffect ? {
            key: headEffect.id,
            eyebrow: headEffect.ruleId === "system:overstrain-spread" ? "Overstrain chain" : headEffect.sourceType === "card" ? "Encounter" : headEffect.sourceType === "tile" ? "Tile effect" : "Resolution",
            title: headEffect.title,
            steps: state.pendingEffects.length,
            content: effectPanel,
            sourceTileId: headEffect.sourceType === "tile" ? headEffect.sourceId : undefined,
            link: headEffect.ruleId === "system:overstrain-spread" && headEffect.sourceId
              ? { fromTileId: headEffect.sourceId, toTileId: headEffect.targetCardTargetTileIds?.[0] }
              : undefined
          } : null}
        />
        <TileInspectModal state={state} placedTileId={inspectedPlacedTileId} tileId={inspectedTileId} onClose={closeTileInspector} />
      </div>
    );
  }

  return withConfirmation(
    <div className="app-shell">
      <TopBar
        state={state}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onReset={handleResetGame}
      />
      <TabletopLayout
        actionMode={actionMode}
        onModeChange={setActionMode}
        onReviewPreparedPower={() => reviewPreparedStewardPower(state)}
        state={state}
        selectionKey={`${selectedTileId}:${selectedHexIds.join(",")}:${actionMode}`}
        boardSelectionKey={String(boardSelectionVersion)}
        actions={
          <ActionConsole
            state={state}
            ledgerCampaign={ledgerCampaign}
            onRecordLedgerGame={handleRecordLedgerGame}
            onNewGame={resetGame}
            selectedTileId={selectedTileId}
            selectedHexIds={selectedHexIds}
            placementOrientation={placementOrientation}
            actionMode={actionMode}
            onModeChange={setActionMode}
            onSelectedTileChange={handleTileChange}
            onTileInspect={inspectTileDefinition}
            onPlacedTileInspect={inspectPlacedTile}
            onPlacementOrientationChange={setPlacementOrientation}
            onConfirmPlace={(resolvedPlacementDraft, tileId = selectedTileId) => {
              if (!resolvedPlacementDraft.anchorHexId) return;
              commitTilePlacement(
                state,
                currentPlayer.id,
                tileId,
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
            onUseFaceUpBoon={handleUseFaceUpBoon}
            onUseStewardPower={handleUseStewardPower}
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
        }
        board={
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
            onTileInspect={inspectPlacedTile}
          />
        }
        encounters={
          <EncounterPanel
            state={state}
            onUseFaceUpBoon={(boonCardId) =>
              handleUseFaceUpBoon(boonCardId)
            }
            onCompleteArrival={handleCompleteArrival}
            onResolveBurden={handleResolveBurden}
          />
        }
      >
        {mapContextMenu && (
          <div
            className="context-menu map-context-menu"
            onClick={(event) => event.stopPropagation()}
            ref={mapContextMenuRef}
            role="menu"
            style={{
              left: mapContextMenuPosition?.left ?? mapContextMenu.x,
              top: mapContextMenuPosition?.top ?? mapContextMenu.y
            }}
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
                onClick={() => {
                  inspectPlacedTile(contextTile.instanceId);
                  setMapContextMenu(null);
                }}
                type="button"
              >
                Inspect {selectTileName(contextTile)}
              </button>
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
      </TabletopLayout>
      <TileInspectModal
        state={state}
        placedTileId={inspectedPlacedTileId}
        tileId={inspectedTileId}
        onClose={closeTileInspector}
      />
      <BottomDrawer
        state={state}
        ledgerCampaign={ledgerCampaign}
        onResetLedgerCampaign={handleResetLedgerCampaign}
        onTileInspect={inspectTileDefinition}
      />
    </div>
  );
}
