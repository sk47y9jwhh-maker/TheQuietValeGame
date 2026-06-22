import {
  BadgeCheck,
  Eye,
  Hammer,
  Handshake,
  Play,
  Shield,
  Sparkles,
  SquarePlus
} from "lucide-react";
import { useEffect, type KeyboardEvent } from "react";
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
}

const actions = [
  { id: "place", label: "Place", ariaLabel: "Place Tile", icon: SquarePlus },
  { id: "upgrade", label: "Upgrade", ariaLabel: "Upgrade Tile", icon: Hammer },
  { id: "activate", label: "Activate", ariaLabel: "Activate Tile", icon: Play },
  { id: "interact", label: "Interact", ariaLabel: "Interact", icon: Handshake },
  { id: "power", label: "Power", ariaLabel: "Use Steward Power", icon: Sparkles },
  { id: "end", label: "End", ariaLabel: "End Turn", icon: BadgeCheck }
];

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
  onEndRound
}: ActionConsoleProps) {
  const currentPlayer = selectCurrentPlayer(state);
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
          <span>Burden Penalty -{finalScore.burdenPenalty}</span>
          <span>Strain Penalty -{finalScore.strainPenalty}</span>
          <strong>Final Score {finalScore.finalScore}</strong>
        </div>
      </aside>
    );
  }

  return (
    <aside className="action-console turn-console">
      <div className="action-grid">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              aria-label={action.ariaLabel}
              key={action.id}
              className={actionMode === action.id ? "selected" : ""}
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
            {!canPlaceSelected && <span>Choose a tile and hex</span>}
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
          )}
          <div className="tile-choice-field">
            <span className="field-label">Choose a tile</span>
            <div
              aria-label="Choose a tile"
              className="tile-choice-list"
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
                      <button
                        aria-label={`Inspect ${tile.name}`}
                        className="tile-choice-inspect"
                        onClick={(event) => {
                          event.stopPropagation();
                          onTileInspect(tile.id);
                        }}
                        title={`Inspect ${tile.name}`}
                        type="button"
                      >
                        <Eye size={15} />
                      </button>
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
          {activatableIds.length === 0 ? (
            <p className="muted">No reachable activated effects are available.</p>
          ) : (
            <div className="flow-list">
              {activatableIds.map((placedTileId) => {
                const tile = state.map.placedTiles.find(
                  (candidate) => candidate.instanceId === placedTileId
                );
                return (
                  <button
                    key={placedTileId}
                    onClick={() => onActivate(placedTileId)}
                    type="button"
                  >
                    <strong>Activate {tile ? selectTileName(tile) : placedTileId}</strong>
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
        <section className="flow-card">
          <div className="flow-heading">
            <Sparkles size={18} />
            <h3>Steward Power</h3>
          </div>
          <p>
            <strong>
              {steward?.name ?? currentPlayer.stewardId}{" "}
              {stewardPowerUsed ? "Power Used This Season" : "Power Available"}
            </strong>
          </p>
          <p className="muted">{steward?.powerText}</p>
          {!stewardPowerValidation.ok && (
            <ul className="failure-list">
              {stewardPowerValidation.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
          <button
            className="primary-action"
            disabled={!stewardPowerValidation.ok}
            onClick={onUseStewardPower}
            type="button"
          >
            Use Steward Power
          </button>
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
