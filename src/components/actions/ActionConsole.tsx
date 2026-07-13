import {
  BadgeCheck,
  Hammer,
  Handshake,
  Play,
  Shield,
  Sparkles,
  SquarePlus
} from "lucide-react";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { InspectIconButton } from "../common/InspectIconButton";
import { EffectPrompt } from "../effects/EffectPrompt";
import { encounterById } from "../../data/encounters";
import { stewardById } from "../../data/stewards";
import { coreTiles } from "../../data/tiles";
import { formatCost, getBurdenResolutionCurrentText } from "../common/gameText";
import { hexDirectionLabels, hexDirections } from "../../engine/hex";
import {
  getActivatableTileIds,
  canCompleteArrival,
  canUseStewardPower,
  canCancelPendingBurdenWithWarden,
  canResolveBurden,
  getLinkedProductionTileIds,
  getStableMoveDestinationTileIds,
  getUsableFaceUpBoonIds,
  getUpgradeableTileIds
} from "../../engine/gameActions";
import {
  getTileFootprintKind,
  getTileFootprintSize,
  getLegalPlacementHexes
} from "../../engine/placementRules";
import { calculateFinalScore } from "../../engine/scoring";
import { evaluateLedgerEntries, getLedgerRun } from "../../engine/ledger";
import type { LedgerCampaign } from "../../engine/ledgerCampaign";
import {
  selectCurrentPlayer,
  selectEncounterName,
  selectTileName
} from "../../engine/selectors";
import { getConfirmPlacementDraft, getPlaceTileChoices } from "./placeTileChoices";
import type {
  EffectAdjustment,
  GameState,
  HexDirection,
  TilePlacementDraft
} from "../../engine/types";

interface ActionConsoleProps {
  state: GameState;
  selectedTileId: string;
  selectedHexIds: string[];
  placementOrientation: HexDirection;
  actionMode: string;
  onModeChange: (mode: string) => void;
  onSelectedTileChange: (tileId: string) => void;
  onTileInspect: (tileId: string) => void;
  onPlacementOrientationChange: (orientation: HexDirection) => void;
  onConfirmPlace: (placementDraft: TilePlacementDraft, tileId?: string) => void;
  onUpgrade: (placedTileId: string) => void;
  onActivate: (placedTileId: string) => void;
  onCompleteArrival: (arrivalCardId: string) => void;
  onResolveBurden: (burdenCardId: string) => void;
  onUseFaceUpBoon: (boonCardId: string) => void;
  onStableMove: (destinationTileId: string) => void;
  onUseStewardPower: () => void;
  onCancelPendingBurdenWithWarden: () => void;
  onResolvePendingEffect: (adjustment: EffectAdjustment) => void;
  onSkipPendingEffect: () => void;
  onReveal: () => void;
  onEndTurn: () => void;
  onEndRound: () => void;
  ledgerCampaign?: LedgerCampaign;
  onRecordLedgerGame?: () => void;
}

const actions = [
  { id: "place", label: "Place", ariaLabel: "Place Tile", icon: SquarePlus },
  { id: "upgrade", label: "Upgrade", ariaLabel: "Upgrade Tile", icon: Hammer },
  { id: "activate", label: "Activate", ariaLabel: "Activate Tile", icon: Play },
  { id: "interact", label: "Interact", ariaLabel: "Interact", icon: Handshake },
  { id: "power", label: "Power", ariaLabel: "Use Steward Power", icon: Sparkles },
  { id: "end", label: "End", ariaLabel: "End Turn", icon: BadgeCheck }
];

const stewardPowerTiming: Record<string, string> = {
  vanguard: "Prepare before placing a Travel Tile.",
  knight: "Prepare before placing a Housing Tile.",
  sentinel: "Prepare before upgrading a Core Tile.",
  ranger: "Use before a tile action that needs a new point of reach.",
  warden: "Offered automatically when a Burden is revealed.",
  quartermaster: "Use during your turn to exchange resources and aid an Arrival."
};

const stewardPowerButtonLabel: Record<string, string> = {
  vanguard: "Prepare Free Travel Placement",
  knight: "Prepare Free Housing Placement",
  sentinel: "Prepare Free Core Upgrade",
  ranger: "Choose Temporary Reach",
  quartermaster: "Exchange Resources"
};

function formatInteractBlockers(reasons: string[]): string {
  return reasons
    .map((reason) =>
      reason.replace(/^Cannot (?:complete Arrival|resolve Burden):\s*/i, "")
    )
    .join(" ");
}

export function ActionConsole({
  state,
  selectedTileId,
  selectedHexIds,
  placementOrientation,
  actionMode,
  onModeChange,
  onSelectedTileChange,
  onTileInspect,
  onPlacementOrientationChange,
  onConfirmPlace,
  onUpgrade,
  onActivate,
  onCompleteArrival,
  onResolveBurden,
  onUseFaceUpBoon,
  onStableMove,
  onUseStewardPower,
  onCancelPendingBurdenWithWarden,
  onResolvePendingEffect,
  onSkipPendingEffect,
  onReveal,
  onEndTurn,
  onEndRound,
  ledgerCampaign,
  onRecordLedgerGame
}: ActionConsoleProps) {
  const tileChoiceListRef = useRef<HTMLDivElement>(null);
  const currentPlayer = selectCurrentPlayer(state);
  const ledgerRun = getLedgerRun(state);
  const ledgerEvaluations = ledgerCampaign ? evaluateLedgerEntries(state, ledgerCampaign) : [];
  const recordedGame = ledgerRun.recorded
    ? ledgerCampaign?.games.find((game) => game.id === ledgerRun.gameId)
    : undefined;
  const recordedEntryIds = new Set(recordedGame?.completedEntryIds ?? []);
  const newRecordEntryIds = new Set(
    recordedGame?.newRecordEntryIds ?? recordedGame?.completedEntryIds ?? []
  );
  const ledgerAchievements = recordedGame
    ? ledgerEvaluations.filter((evaluation) => recordedEntryIds.has(evaluation.entry.id))
    : ledgerEvaluations.filter((evaluation) => evaluation.eligible && evaluation.met);
  const newLedgerAchievements = recordedGame
    ? ledgerEvaluations.filter((evaluation) => newRecordEntryIds.has(evaluation.entry.id))
    : ledgerAchievements.filter((evaluation) => {
        const completion = ledgerCampaign?.completions[evaluation.entry.id];
        return !completion || (
          evaluation.entry.playerCountPrestige &&
          !completion.completedPlayerCounts?.includes(state.playerCount)
        );
      });
  const placementDraft: TilePlacementDraft = {
    anchorHexId: selectedHexIds[0],
    orientation: placementOrientation,
    secondaryHexIds: selectedHexIds.slice(1)
  };
  const placeableTiles = getPlaceTileChoices(
    state,
    currentPlayer.id,
    selectedHexIds,
    placementOrientation,
    selectedTileId
  );
  const footprintKind = getTileFootprintKind(selectedTileId);
  const footprintSize = getTileFootprintSize(selectedTileId);
  const legalHexes = getLegalPlacementHexes(
    state,
    currentPlayer.id,
    selectedTileId,
    placementDraft
  );
  const confirmPlacementDraft = getConfirmPlacementDraft(
    state,
    currentPlayer.id,
    selectedTileId,
    selectedHexIds,
    placementOrientation
  );
  const canPlaceSelected = Boolean(confirmPlacementDraft);
  const getTileConfirmDraft = (tileId: string) =>
    getConfirmPlacementDraft(
      state,
      currentPlayer.id,
      tileId,
      selectedHexIds,
      placementOrientation
    );
  const selectTileWithKeyboard = (
    event: KeyboardEvent<HTMLDivElement>,
    tileId: string
  ) => {
    if (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar") {
      return;
    }
    event.preventDefault();
    onSelectedTileChange(tileId);
  };
  const upgradeableIds = getUpgradeableTileIds(state, currentPlayer.id);
  const activatableIds = getActivatableTileIds(state, currentPlayer.id);
  const arrivalInteractions = state.encounters.activeArrivals.map((arrival) => ({
    cardId: arrival.cardId,
    validation: canCompleteArrival(state, arrival.cardId)
  }));
  const burdenInteractions = state.encounters.activeBurdens.map((burdenCardId) => ({
    cardId: burdenCardId,
    validation: canResolveBurden(state, burdenCardId)
  }));
  const usableBoonIds = getUsableFaceUpBoonIds(state);
  const stableMoveDestinationIds = getStableMoveDestinationTileIds(
    state,
    currentPlayer.id
  );
  const finalScore = calculateFinalScore(state);
  const pendingEffect = state.pendingEffects[0];
  const steward = stewardById[currentPlayer.stewardId];
  const stewardPowerUses =
    currentPlayer.stewardPowerUsesBySeason[state.season] ?? 0;
  const stewardPowerUsed = stewardPowerUses > 0;
  const stewardPowerValidation = canUseStewardPower(state, currentPlayer.id);
  const stewardPowerPrepared = state.boonModifiers.some(
    (modifier) =>
      modifier.sourceType === "steward" &&
      modifier.sourceCardId === currentPlayer.stewardId &&
      modifier.remainingUses > 0
  );
  const stewardPowerReactive = currentPlayer.stewardId === "warden";
  const stewardPowerStatus = stewardPowerPrepared
    ? "Prepared"
    : stewardPowerUsed
      ? "Used this Season"
      : stewardPowerReactive
        ? "Ready on Burden reveal"
        : stewardPowerValidation.ok
          ? "Ready now"
          : "Unavailable now";
  const stewardPowerTone = stewardPowerPrepared
    ? "is-prepared"
    : !stewardPowerUsed && (stewardPowerReactive || stewardPowerValidation.ok)
      ? "is-ready"
      : "is-spent";

  useEffect(() => {
    if (
      actionMode !== "place" ||
      footprintKind !== "line" ||
      confirmPlacementDraft?.orientation === undefined ||
      confirmPlacementDraft.orientation === placementOrientation
    ) {
      return;
    }
    onPlacementOrientationChange(confirmPlacementDraft.orientation);
  }, [
    actionMode,
    confirmPlacementDraft?.orientation,
    footprintKind,
    onPlacementOrientationChange,
    placementOrientation
  ]);

  useEffect(() => {
    if (actionMode !== "place" || footprintKind !== "line") return;
    if (tileChoiceListRef.current) tileChoiceListRef.current.scrollTop = 0;
  }, [actionMode, footprintKind, selectedTileId]);

  if (pendingEffect) {
    return (
      <aside className="action-console">
        <EffectPrompt
          state={state}
          effect={pendingEffect}
          onApply={onResolvePendingEffect}
          onSkip={onSkipPendingEffect}
          canCancelWithWarden={canCancelPendingBurdenWithWarden(state).ok}
          onCancelWithWarden={onCancelPendingBurdenWithWarden}
        />
      </aside>
    );
  }

  if (state.phase === "reveal") {
    return (
      <aside className="action-console">
        <p className="eyebrow">Round {state.round}</p>
        <h2>Reveal Encounters</h2>
        <p className="muted">
          Reveal {state.playerCount} standard Encounter Card
          {state.playerCount === 1 ? "" : "s"}.
        </p>
        <button className="primary-action" onClick={onReveal} type="button">
          Reveal Encounters
        </button>
      </aside>
    );
  }

  if (state.phase === "endRound") {
    return (
      <aside className="action-console">
        <p className="eyebrow">End of Round</p>
        <h2>Resolve Consequences</h2>
        <p className="muted">
          Arrival timers tick down. Expired Arrivals are discarded unresolved.
        </p>
        <button className="primary-action" onClick={onEndRound} type="button">
          Resolve End Round
        </button>
      </aside>
    );
  }

  if (state.phase === "gameEnd") {
    return (
      <aside className="action-console">
        <p className="eyebrow">Game End</p>
        <h2>Final Scoring</h2>
        <div className="score-block">
          <span>Population {finalScore.population}</span>
          <span>Passive Population {finalScore.passivePopulation}</span>
          <span>Printed Renown {finalScore.printedRenown}</span>
          <span>Passive Renown {finalScore.passiveRenown}</span>
          <span>Steward Objectives {finalScore.stewardObjectiveRenown}</span>
          <span>Golden Tile Renown {finalScore.goldenRenown}</span>
          <span>Burden Penalty -{finalScore.burdenPenalty}</span>
          <span>
            Failed Arrival Penalty -{finalScore.failedArrivalPenalty}
            {finalScore.failedArrivals > 0
              ? ` (${finalScore.failedArrivals} failed)`
              : ""}
          </span>
          <span>Strain Penalty -{finalScore.strainPenalty}</span>
          <strong>Final Score {finalScore.finalScore}</strong>
        </div>
        {ledgerCampaign && (
          <section className="ledger-end-review">
            <div className="ledger-end-review-heading">
              <div>
                <p className="eyebrow">Steward’s Ledger</p>
                <h3>{ledgerRun.recorded ? "Game recorded" : "Ledger review"}</h3>
              </div>
              <strong>{newLedgerAchievements.length} new records</strong>
            </div>
            <p>
              {ledgerAchievements.length} eligible Ledger {ledgerAchievements.length === 1 ? "Entry" : "Entries"} completed this game.
            </p>
            {newLedgerAchievements.length > 0 && (
              <div className="ledger-end-entry-list">
                {newLedgerAchievements.map((evaluation) => (
                  <span key={evaluation.entry.id}>
                    <small>{evaluation.entry.id}</small>
                    <strong>{evaluation.entry.name}</strong>
                  </span>
                ))}
              </div>
            )}
            <button
              className="primary-action"
              disabled={ledgerRun.recorded}
              onClick={onRecordLedgerGame}
              type="button"
            >
              {ledgerRun.recorded ? "Recorded in Ledger" : "Record Completed Game"}
            </button>
          </section>
        )}
      </aside>
    );
  }

  return (
    <aside className="action-console turn-console">
      <button
        className={`steward-power-summary ${stewardPowerTone}`}
        onClick={() => onModeChange("power")}
        type="button"
      >
        <Sparkles size={18} />
        <span>
          <strong>{steward?.name ?? currentPlayer.stewardId} Power</strong>
          <small>{stewardPowerStatus}</small>
        </span>
        <span className="steward-power-season">Season {state.season}</span>
      </button>
      <div className="action-grid">
        {actions.map((action) => {
          const Icon = action.icon;
          const powerClass =
            action.id === "power" && stewardPowerTone !== "is-spent"
              ? stewardPowerTone
              : "";
          return (
            <button
              aria-label={action.ariaLabel}
              key={action.id}
              className={`${actionMode === action.id ? "selected" : ""} ${powerClass}`.trim()}
              onClick={() => onModeChange(action.id)}
              type="button"
            >
              <Icon size={18} />
              {action.label}
            </button>
          );
        })}
      </div>

      {actionMode === "place" && (
        <section className="flow-card placement-flow">
          <div className="placement-action-header">
            <div className="flow-heading">
              <Shield size={18} />
              <h3>Place Tile</h3>
            </div>
          </div>
          <div className="placement-status-line">
            <span>
              <strong>{legalHexes.length}</strong> legal spaces
            </span>
            {!canPlaceSelected && footprintKind === "single" && (
              <span>Choose a tile and hex</span>
            )}
            {!canPlaceSelected && footprintKind === "line" && (
              <span>Choose a starting hex and direction</span>
            )}
            {footprintKind === "detached" && (
              <span>
                <strong>
                  {selectedHexIds.length}/{footprintSize}
                </strong>{" "}
                selected
              </span>
            )}
          </div>
          {footprintKind === "line" && (
            <div className="placement-guidance placement-direction-prompt">
              <div>
                <strong>Choose the tile’s direction</strong>
                <span>
                  Select a starting hex, then choose the direction Street or Track extends.
                </span>
              </div>
              <div className="orientation-grid compact" aria-label="Tile orientation">
                {hexDirections.map((direction) => (
                  <button
                    key={direction}
                    className={placementOrientation === direction ? "selected" : ""}
                    onClick={() => onPlacementOrientationChange(direction)}
                    type="button"
                  >
                    {hexDirectionLabels[direction]}
                  </button>
                ))}
              </div>
            </div>
          )}
          {footprintKind === "detached" && (
            <div className="placement-guidance stables-placement-prompt" aria-live="polite">
              <div>
                <strong>
                  {selectedHexIds.length === 0
                    ? "Choose the first Stable"
                    : selectedHexIds.length === 1
                      ? "Choose the second Stable"
                      : "Both Stables selected"}
                </strong>
                <span>
                  Choose two separate gold-outlined spaces. They do not need to be adjacent,
                  but each must connect to the reachable settlement network.
                </span>
              </div>
              <div className="stables-placement-steps">
                <span className={selectedHexIds[0] ? "complete" : "current"}>
                  <strong>1</strong> First Stable: {selectedHexIds[0] ?? "select on map"}
                </span>
                <span className={selectedHexIds[1] ? "complete" : "current"}>
                  <strong>2</strong> Second Stable: {selectedHexIds[1] ?? "select on map"}
                </span>
              </div>
            </div>
          )}
          <div className="tile-choice-field">
            <span className="field-label">Choose a tile</span>
            <div
              aria-label="Choose a tile"
              className="tile-choice-list"
              ref={tileChoiceListRef}
              role="listbox"
            >
              {placeableTiles.map((tile) => {
                const tileConfirmDraft = getTileConfirmDraft(tile.id);
                const readyToPlace = Boolean(tileConfirmDraft);
                const statusLabel = tile.placeableNow
                  ? readyToPlace
                    ? "Placeable"
                    : "Select hex"
                  : tile.blockedReasons[0] ?? "Blocked";

                return (
                  <div
                    aria-selected={selectedTileId === tile.id}
                    className={[
                      "tile-choice-row",
                      tile.placeableNow ? "is-viable" : "is-blocked",
                      readyToPlace ? "is-ready" : "",
                      selectedTileId === tile.id ? "selected" : ""
                    ].join(" ")}
                    key={tile.id}
                    onClick={() => onSelectedTileChange(tile.id)}
                    onKeyDown={(event) => selectTileWithKeyboard(event, tile.id)}
                    role="option"
                    tabIndex={0}
                  >
                    <span className="tile-choice-main">
                      <strong>{tile.name}</strong>
                      <small>
                        {tile.meta} | Cost {tile.costLabel}
                      </small>
                      <small>Supply {tile.copiesAvailable}/{tile.copiesRequired}</small>
                    </span>
                    <span className="tile-choice-actions">
                      <span
                        className={`tile-choice-status ${
                          tile.placeableNow ? "available" : "blocked"
                        }`}
                      >
                        {statusLabel}
                      </span>
                      <InspectIconButton
                        className="tile-choice-inspect"
                        label={`Inspect ${tile.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onTileInspect(tile.id);
                        }}
                      />
                      {readyToPlace && (
                        <button
                          aria-label={`Place ${tile.name}`}
                          className="tile-choice-place"
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectedTileChange(tile.id);
                            if (!tileConfirmDraft) return;
                            if (tileConfirmDraft.orientation !== undefined) {
                              onPlacementOrientationChange(tileConfirmDraft.orientation);
                            }
                            onConfirmPlace(tileConfirmDraft, tile.id);
                          }}
                          type="button"
                        >
                          Place
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {actionMode === "upgrade" && (
        <section className="flow-card">
          <div className="flow-heading">
            <Hammer size={18} />
            <h3>Upgrade Tile</h3>
          </div>
          {upgradeableIds.length === 0 ? (
            <p className="muted">No reachable affordable basic Core Tiles can upgrade.</p>
          ) : (
            <div className="flow-list">
              {upgradeableIds.map((placedTileId) => {
                const tile = state.map.placedTiles.find(
                  (candidate) => candidate.instanceId === placedTileId
                );
                return (
                  <button
                    key={placedTileId}
                    onClick={() => onUpgrade(placedTileId)}
                    type="button"
                  >
                    <strong>Upgrade {tile ? selectTileName(tile) : placedTileId}</strong>
                    {tile?.kind === "core" && (
                      <span>
                        Cost {formatCost(coreTiles.find((core) => core.id === tile.tileId)?.upgraded.cost ?? {
                          wood: 0,
                          stone: 0,
                          metal: 0,
                          food: 0,
                          herbs: 0,
                          goods: 0
                        })}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {actionMode === "activate" && (
        <section className="flow-card">
          <div className="flow-heading">
            <Play size={18} />
            <h3>Activate Tile</h3>
          </div>
          <p className="muted">
            Passive effects—including Shrines and cost reductions—trigger automatically
            when their condition is met. All immediately adjacent matching Resource
            producers activate together for one action.
          </p>
          {activatableIds.length === 0 ? (
            <p className="muted">No reachable activated effects are available.</p>
          ) : (
            <div className="flow-list">
              {activatableIds.map((placedTileId) => {
                const tile = state.map.placedTiles.find(
                  (candidate) => candidate.instanceId === placedTileId
                );
                const linkedTileIds = getLinkedProductionTileIds(state, placedTileId);
                const linkedTiles = state.map.placedTiles.filter((candidate) =>
                  linkedTileIds.includes(candidate.instanceId)
                );
                return (
                  <button
                    key={placedTileId}
                    onClick={() => onActivate(placedTileId)}
                    type="button"
                  >
                    <strong>Activate {tile ? selectTileName(tile) : placedTileId}</strong>
                    {linkedTiles.length > 0 && (
                      <span>
                        Also activates {linkedTiles.map(selectTileName).join(", ")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {actionMode === "interact" && (
        <section className="flow-card">
          <div className="flow-heading">
            <Handshake size={18} />
            <h3>Interact</h3>
          </div>
          {arrivalInteractions.length === 0 &&
          burdenInteractions.length === 0 &&
          usableBoonIds.length === 0 &&
          stableMoveDestinationIds.length === 0 ? (
            <p className="muted">
              No active Boon, Arrival, or Burden is currently interactable.
            </p>
          ) : (
            <div className="flow-list">
              {stableMoveDestinationIds.map((placedTileId) => {
                const tile = state.map.placedTiles.find(
                  (candidate) => candidate.instanceId === placedTileId
                );
                return (
                  <button
                    key={placedTileId}
                    onClick={() => onStableMove(placedTileId)}
                    type="button"
                  >
                    Move to {tile ? selectTileName(tile) : placedTileId} via Stables
                  </button>
                );
              })}
              {usableBoonIds.map((boonCardId) => (
                <button
                  key={boonCardId}
                  onClick={() => onUseFaceUpBoon(boonCardId)}
                  type="button"
                >
                  <strong>Interact with {selectEncounterName(boonCardId)}</strong>
                  <span>Boon: choose whether to use it on the next screen.</span>
                </button>
              ))}
              {arrivalInteractions.map(({ cardId: arrivalCardId, validation }) => {
                const card = encounterById[arrivalCardId];
                return (
                  <button
                    key={arrivalCardId}
                    className={!validation.ok ? "is-blocked" : ""}
                    disabled={!validation.ok}
                    onClick={() => onCompleteArrival(arrivalCardId)}
                    type="button"
                  >
                    <strong>Interact with {selectEncounterName(arrivalCardId)}</strong>
                    {card?.type === "arrival" && (
                      <span>Requirement: {card.requirementText}</span>
                    )}
                    {!validation.ok && (
                      <span className="missing-cost">
                        {formatInteractBlockers(validation.reasons)}
                      </span>
                    )}
                  </button>
                );
              })}
              {burdenInteractions.map(({ cardId: burdenCardId, validation }) => (
                <button
                  key={burdenCardId}
                  className={!validation.ok ? "is-blocked" : ""}
                  disabled={!validation.ok}
                  onClick={() => onResolveBurden(burdenCardId)}
                  type="button"
                >
                  <strong>Interact with {selectEncounterName(burdenCardId)}</strong>
                  <span>
                    {getBurdenResolutionCurrentText(
                      encounterById[burdenCardId],
                      state.season
                    ) ?? "Resolution cost unavailable."}
                  </span>
                  {!validation.ok && (
                    <span className="missing-cost">
                      {formatInteractBlockers(validation.reasons)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {actionMode === "power" && (
        <section className={`flow-card steward-power-card ${stewardPowerTone}`}>
          <div className="flow-heading">
            <Sparkles size={18} />
            <h3>Steward Power</h3>
            <strong className="steward-power-state">{stewardPowerStatus}</strong>
          </div>
          <p className="steward-power-timing">
            {stewardPowerTiming[currentPlayer.stewardId]}
          </p>
          <p>{steward?.powerText}</p>
          {!stewardPowerValidation.ok && !stewardPowerReactive && !stewardPowerPrepared && (
            <ul className="failure-list">
              {stewardPowerValidation.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
          {stewardPowerReactive ? (
            <p className="steward-power-reactive-note">
              When a Burden is revealed, its effect screen will offer the Warden
              option before the Burden applies.
            </p>
          ) : stewardPowerPrepared ? (
            <p className="steward-power-reactive-note">
              This power is prepared. Take the matching tile action to use it.
            </p>
          ) : (
            <button
              className="primary-action"
              disabled={!stewardPowerValidation.ok}
              onClick={onUseStewardPower}
              type="button"
            >
              {stewardPowerButtonLabel[currentPlayer.stewardId] ?? "Use Steward Power"}
            </button>
          )}
        </section>
      )}

      {actionMode === "end" && (
        <section className="flow-card">
          <div className="flow-heading">
            <BadgeCheck size={18} />
            <h3>End Turn</h3>
          </div>
          <p className="muted">Unused actions are lost.</p>
          <button className="primary-action" onClick={onEndTurn} type="button">
            End {currentPlayer.name}'s Turn
          </button>
        </section>
      )}
    </aside>
  );
}
