import {
  BookMarked,
  CheckCircle2,
  History,
  LockKeyhole,
  Target,
  Trash2,
  Trophy,
  X
} from "lucide-react";
import { useState } from "react";
import { readLedgerCampaign } from "../../app/ledgerPersistence";
import { InspectIconButton } from "../common/InspectIconButton";
import { encounterById } from "../../data/encounters";
import {
  ledgerChronicles,
  ledgerEntries,
  ledgerMilestones,
  type LedgerChronicle
} from "../../data/ledger";
import { coreTiles, goldenTileById, specialTiles } from "../../data/tiles";
import { stewardById } from "../../data/stewards";
import {
  countCompletedLedgerEntries,
  isGoldenMilestoneUnlocked,
  type LedgerCampaign
} from "../../engine/ledgerCampaign";
import { evaluateStewardObjectives } from "../../engine/scoring";
import { evaluateLedgerEntries, getLedgerRun } from "../../engine/ledger";
import { selectCurrentPlayer } from "../../engine/selectors";
import type { GameState } from "../../engine/types";
import { EncounterSeasonEffects } from "../common/EncounterSeasonEffects";
import { formatCategory, formatCost, getEncounterTypeLabel } from "../common/gameText";
import { RulesGuide } from "./RulesGuide";

type DrawerSection = "tiles" | "hand" | "specials" | "ledger" | "rules";
type LedgerView = "game" | "chronicles" | "unlocks" | "log";

interface BottomDrawerProps {
  state: GameState;
  ledgerCampaign?: LedgerCampaign;
  onResetLedgerCampaign?: () => void;
  onTileInspect: (tileId: string) => void;
}

interface TileReferenceCardProps {
  className?: string;
  effect: string;
  meta: string;
  name: string;
  onInspect: () => void;
  placement: string;
  status: string;
}

function TileReferenceCard({
  className = "",
  effect,
  meta,
  name,
  onInspect,
  placement,
  status
}: TileReferenceCardProps) {
  return (
    <article className={`mini-card tile-mini-card ${className}`}>
      <div className="tile-mini-card-heading">
        <strong>{name}</strong>
        <div className="tile-mini-card-tools">
          <span>{status}</span>
          <InspectIconButton
            className="mini-card-inspect"
            label={`Inspect ${name}`}
            onClick={onInspect}
            size={14}
          />
        </div>
      </div>
      <p className="tile-mini-card-meta">{meta}</p>
      <p className="tile-mini-card-placement">
        <strong>Placement:</strong>
        <span>{placement}</span>
      </p>
      <p>{effect}</p>
    </article>
  );
}

export function BottomDrawer({
  state,
  ledgerCampaign: providedLedgerCampaign,
  onResetLedgerCampaign,
  onTileInspect
}: BottomDrawerProps) {
  const [activeSection, setActiveSection] = useState<DrawerSection | null>(null);
  const [ledgerView, setLedgerView] = useState<LedgerView>("game");
  const [ledgerChronicle, setLedgerChronicle] = useState<LedgerChronicle>(
    ledgerChronicles[1]
  );
  const [storedLedgerCampaign] = useState(readLedgerCampaign);
  const ledgerCampaign = providedLedgerCampaign ?? storedLedgerCampaign;
  const currentPlayer = selectCurrentPlayer(state);
  const ledgerRun = getLedgerRun(state);
  const ledgerEvaluations = evaluateLedgerEntries(state, ledgerCampaign);
  const ledgerEvaluationById = new Map(
    ledgerEvaluations.map((evaluation) => [evaluation.entry.id, evaluation])
  );
  const declaredVow = ledgerRun.declaredVowId
    ? ledgerEvaluationById.get(ledgerRun.declaredVowId)
    : undefined;
  const stewardObjectives = evaluateStewardObjectives(state);
  const completedLedgerCount = countCompletedLedgerEntries(ledgerCampaign);
  const completedLedgerIds = new Set(Object.keys(ledgerCampaign.completions));
  const visibleLedgerEntries = ledgerEntries.filter(
    (entry) => entry.chronicle === ledgerChronicle
  );
  const hand = state.encounters.handsByPlayerId[currentPlayer.id] ?? [];
  const coreRemaining = coreTiles.reduce(
    (total, tile) => total + (state.tileSupply.core[tile.id] ?? 0),
    0
  );
  const readySpecialTiles = specialTiles.filter(
    (tile) => (state.tileSupply.special[tile.id] ?? 0) > 0
  );
  const orderedSpecialTiles = [
    ...readySpecialTiles,
    ...specialTiles.filter((tile) => (state.tileSupply.special[tile.id] ?? 0) <= 0)
  ];
  const trayItems = [
    { id: "tiles", label: "Tiles", detail: `${coreRemaining} core left` },
    { id: "hand", label: "Hand", detail: `${hand.length} hidden` },
    { id: "specials", label: "Specials", detail: `${readySpecialTiles.length} ready` },
    {
      id: "ledger",
      label: "Ledger",
      detail: `${completedLedgerCount}/50 complete`
    },
    { id: "rules", label: "Rules", detail: "guide & rules" }
  ] satisfies Array<{
    id: DrawerSection;
    label: string;
    detail: string;
  }>;
  const activeItem = trayItems.find((item) => item.id === activeSection);

  function toggleSection(section: DrawerSection) {
    setActiveSection((current) => (current === section ? null : section));
  }

  return (
    <footer
      className={`bottom-drawer ${activeSection ? "expanded" : ""} ${
        activeSection === "rules" ? "rules-expanded" : ""
      } ${
        activeSection === "ledger" ? "ledger-expanded" : ""
      }`.trim()}
      aria-label="Game reference tray"
    >
      {activeSection && activeItem && (
        <section className="tray-panel" aria-label={activeItem.label}>
          <div className="tray-panel-header">
            <div>
              <p className="eyebrow">
                {activeSection === "ledger" ? "Campaign Record" : "Reference"}
              </p>
              <h2>{activeItem.label}</h2>
            </div>
            <button
              aria-label="Close reference tray"
              className="tray-close"
              onClick={() => setActiveSection(null)}
              type="button"
            >
              <X size={18} />
            </button>
          </div>
          {activeSection === "tiles" && (
            <div className="tile-reference-grid compact-reference">
              {readySpecialTiles.map((tile) => {
                const remaining = state.tileSupply.special[tile.id] ?? 0;
                return (
                  <TileReferenceCard
                    className="available unlocked-special-card"
                    effect={tile.effectText}
                    key={tile.id}
                    meta={`Unlocked Special | ${formatCategory(tile.category)}`}
                    name={tile.name}
                    onInspect={() => onTileInspect(tile.id)}
                    placement={tile.placement?.text ?? "No placement restriction."}
                    status={`${remaining} ready`}
                  />
                );
              })}
              {coreTiles.map((tile) => {
                const remaining = state.tileSupply.core[tile.id] ?? 0;
                return (
                  <TileReferenceCard
                    className={remaining > 0 ? "available" : "locked"}
                    effect={tile.basic.effectText}
                    key={tile.id}
                    meta={`${formatCategory(tile.category)} | Cost ${formatCost(tile.basic.cost)}`}
                    name={tile.basic.name}
                    onInspect={() => onTileInspect(tile.id)}
                    placement={tile.placement?.text ?? "No placement restriction."}
                    status={`${remaining} left`}
                  />
                );
              })}
            </div>
          )}
          {activeSection === "hand" && (
            <div className="tile-reference-grid cards">
              {hand.length === 0 && <p className="muted">No hidden Encounter cards.</p>}
              {hand.map((cardId) => {
                const card = encounterById[cardId];
                if (!card) return null;
                return (
                  <article className={`mini-card card-${card.type}`} key={cardId}>
                    <div className="mini-card-heading">
                      <strong>{card.name}</strong>
                      <span className={`encounter-type-banner compact card-${card.type}`}>
                        {getEncounterTypeLabel(card)}
                      </span>
                    </div>
                    {card.flavorText && <p>{card.flavorText}</p>}
                    <EncounterSeasonEffects card={card} currentSeason={state.season} />
                  </article>
                );
              })}
            </div>
          )}
          {activeSection === "specials" && (
            <div className="tile-reference-grid compact-reference">
              {orderedSpecialTiles.map((tile) => {
                const remaining = state.tileSupply.special[tile.id] ?? 0;
                return (
                  <TileReferenceCard
                    className={remaining > 0 ? "available" : "locked"}
                    effect={tile.effectText}
                    key={tile.id}
                    meta={`${formatCategory(tile.category)} | ${tile.unlockSource}`}
                    name={tile.name}
                    onInspect={() => onTileInspect(tile.id)}
                    placement={tile.placement?.text ?? "No placement restriction."}
                    status={remaining > 0 ? "Ready" : "Locked"}
                  />
                );
              })}
            </div>
          )}
          {activeSection === "ledger" && (
            <div className="ledger-shell">
              <nav className="ledger-view-tabs" aria-label="Ledger sections">
                <button
                  aria-selected={ledgerView === "game"}
                  className={ledgerView === "game" ? "selected" : ""}
                  onClick={() => setLedgerView("game")}
                  role="tab"
                  type="button"
                >
                  <Target size={15} />
                  This Game
                </button>
                <button
                  aria-selected={ledgerView === "chronicles"}
                  className={ledgerView === "chronicles" ? "selected" : ""}
                  onClick={() => setLedgerView("chronicles")}
                  role="tab"
                  type="button"
                >
                  <BookMarked size={15} />
                  Chronicles
                </button>
                <button
                  aria-selected={ledgerView === "unlocks"}
                  className={ledgerView === "unlocks" ? "selected" : ""}
                  onClick={() => setLedgerView("unlocks")}
                  role="tab"
                  type="button"
                >
                  <Trophy size={15} />
                  Unlocks
                </button>
                <button
                  aria-selected={ledgerView === "log"}
                  className={ledgerView === "log" ? "selected" : ""}
                  onClick={() => setLedgerView("log")}
                  role="tab"
                  type="button"
                >
                  <History size={15} />
                  Game Log
                </button>
              </nav>

              {ledgerView === "game" && (
                <div className="ledger-scroll-region">
                  <section className="ledger-campaign-summary">
                    <div>
                      <p className="eyebrow">Steward’s Ledger</p>
                      <strong>{completedLedgerCount} of 50 named entries completed</strong>
                      <span>
                        Campaign progress is stored separately from this active game.
                      </span>
                    </div>
                    <div className="ledger-count-seal" aria-label={`${completedLedgerCount} entries complete`}>
                      <strong>{completedLedgerCount}</strong>
                      <span>/ 50</span>
                    </div>
                  </section>

                  <section className={`ledger-vow-summary ${declaredVow ? "has-vow" : "no-vow"}`}>
                    <div>
                      <p className="eyebrow">Declared Vow</p>
                      <strong>{declaredVow?.entry.name ?? "No Vow declared"}</strong>
                      <span>
                        {declaredVow
                          ? declaredVow.entry.requirement
                          : "A Vow may only be chosen before setup begins."}
                      </span>
                    </div>
                    {declaredVow && (
                      <span className={`ledger-status-chip ${declaredVow.unavailableReason ? "is-failed" : ""}`}>
                        {declaredVow.unavailableReason
                          ? "Vow broken"
                          : declaredVow.met
                            ? "On track"
                            : "In progress"}
                      </span>
                    )}
                    {declaredVow && (
                      <small>{declaredVow.unavailableReason ?? declaredVow.progressLabel}</small>
                    )}
                  </section>

                  <div className="ledger-section-heading">
                    <div>
                      <p className="eyebrow">Current Game</p>
                      <h3>Steward objectives</h3>
                    </div>
                    <span>{stewardObjectives.filter((objective) => objective.met).length}/{stewardObjectives.length} on track</span>
                  </div>

                  <div className="ledger-objective-grid">
                    {stewardObjectives.map((objective) => (
                      <article
                        className={`ledger-objective-card ${objective.met ? "is-met" : "is-progress"}`}
                        key={objective.playerId}
                      >
                        <header>
                          <div>
                            <span>{objective.playerName}</span>
                            <strong>{objective.stewardName}</strong>
                          </div>
                          <span className="ledger-status-chip">
                            {objective.met
                              ? state.phase === "gameEnd"
                                ? "Achieved"
                                : "On track"
                              : "In progress"}
                          </span>
                        </header>
                        <p>{objective.objectiveText}</p>
                        <div className="ledger-progress-row">
                          <div className="ledger-progress-track" aria-hidden="true">
                            <span
                              style={{
                                width: `${Math.min(100, (objective.current / objective.target) * 100)}%`
                              }}
                            />
                          </div>
                          <strong>+{objective.reward} Renown</strong>
                        </div>
                        <small>
                          <strong>{objective.progressLabel}.</strong> {objective.detail}
                        </small>
                      </article>
                    ))}
                  </div>

                  <p className="ledger-foundation-note">
                    {ledgerRun.recorded
                      ? "This game has been recorded in the campaign Ledger."
                      : state.phase === "gameEnd"
                        ? "Review and record this game from the Final Scoring panel."
                        : "Progress is tracked automatically. Entries are awarded when the completed game is recorded."}
                  </p>
                </div>
              )}

              {ledgerView === "chronicles" && (
                <div className="ledger-chronicles-layout">
                  <nav className="ledger-chronicle-nav" aria-label="Ledger Chronicles">
                    {ledgerChronicles.map((chronicle) => {
                      const complete = ledgerEntries.filter(
                        (entry) =>
                          entry.chronicle === chronicle && completedLedgerIds.has(entry.id)
                      ).length;
                      const total = ledgerEntries.filter(
                        (entry) => entry.chronicle === chronicle
                      ).length;
                      return (
                        <button
                          aria-pressed={ledgerChronicle === chronicle}
                          className={ledgerChronicle === chronicle ? "selected" : ""}
                          key={chronicle}
                          onClick={() => setLedgerChronicle(chronicle)}
                          type="button"
                        >
                          <span>{chronicle}</span>
                          <strong>{complete}/{total}</strong>
                        </button>
                      );
                    })}
                  </nav>

                  <div className="ledger-entry-list ledger-scroll-region">
                    <div className="ledger-section-heading">
                      <div>
                        <p className="eyebrow">Chronicle</p>
                        <h3>{ledgerChronicle}</h3>
                      </div>
                      <span>{visibleLedgerEntries.length} entries</span>
                    </div>
                    {visibleLedgerEntries.map((entry) => {
                      const completion = ledgerCampaign.completions[entry.id];
                      const complete = completedLedgerIds.has(entry.id);
                      const locked = completedLedgerCount < entry.unlockAt;
                      return (
                        <article
                          className={`ledger-entry-card ${complete ? "is-complete" : ""} ${locked ? "is-locked" : ""}`}
                          key={entry.id}
                        >
                          <header>
                            <div>
                              <span>{entry.id} · {entry.entryType}</span>
                              <strong>{entry.name}</strong>
                            </div>
                            <span className="ledger-status-chip">
                              {complete ? (
                                <><CheckCircle2 size={13} /> Complete</>
                              ) : locked ? (
                                <><LockKeyhole size={13} /> {entry.unlockAt} required</>
                              ) : entry.declaredVow ? (
                                "Declare as Vow"
                              ) : (
                                "Available"
                              )}
                            </span>
                          </header>
                          <p>{entry.requirement}</p>
                          <small className="ledger-entry-progress">
                            {ledgerEvaluationById.get(entry.id)?.unavailableReason ??
                              ledgerEvaluationById.get(entry.id)?.progressLabel}
                          </small>
                          <footer>
                            <span>{entry.scope}</span>
                            <span>{entry.pacingBand}</span>
                            {entry.requiredSteward && (
                              <span>{stewardById[entry.requiredSteward]?.name ?? entry.requiredSteward}</span>
                            )}
                            {entry.declaredVow && <span>One Vow per game</span>}
                          </footer>
                          {entry.playerCountPrestige && (
                            <div className="ledger-prestige-row" aria-label="Player count records">
                              {[1, 2, 3, 4].map((count) => (
                                <span
                                  className={completion?.completedPlayerCounts?.includes(count) ? "complete" : ""}
                                  key={count}
                                >
                                  {count}P
                                </span>
                              ))}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}

              {ledgerView === "unlocks" && (
                <div className="ledger-scroll-region">
                  <section className="ledger-campaign-summary unlock-summary">
                    <div>
                      <p className="eyebrow">Golden Milestones</p>
                      <strong>{completedLedgerCount} completed entries</strong>
                      <span>Each named entry counts once; additional player-count boxes are prestige records.</span>
                    </div>
                    <Trophy size={30} />
                  </section>
                  <div className="ledger-unlock-grid">
                    {ledgerMilestones.map((milestone, milestoneIndex) => {
                      const unlocked = isGoldenMilestoneUnlocked(
                        ledgerCampaign,
                        milestoneIndex,
                        milestone.threshold
                      );
                      const goldenTile = goldenTileById[milestone.goldenTileId];
                      const goldenBoon = encounterById[milestone.goldenBoonId];
                      return (
                        <article
                          className={`ledger-unlock-card ${unlocked ? "is-unlocked" : ""}`}
                          key={milestone.threshold}
                        >
                          <header>
                            <span>{milestone.threshold} entries</span>
                            <strong>{unlocked ? "Unlocked" : `${Math.max(0, milestone.threshold - completedLedgerCount)} to go`}</strong>
                          </header>
                          <div>
                            <span>Golden Tile</span>
                            <strong>{milestone.goldenTile}</strong>
                            <small>{goldenTile?.effectText ?? milestone.goldenTileTheme}</small>
                          </div>
                          <div>
                            <span>Golden Boon</span>
                            <strong>{milestone.goldenBoon}</strong>
                            <small>
                              {goldenBoon?.type === "goldenBoon"
                                ? goldenBoon.effectText
                                : milestone.goldenBoonTheme}
                            </small>
                          </div>
                          <footer>
                            {unlocked
                              ? "Available in Golden Legacy setup. Choose up to one Tile and one Boon."
                              : `Complete ${milestone.threshold} named Ledger entries to unlock.`}
                          </footer>
                        </article>
                      );
                    })}
                  </div>
                  {onResetLedgerCampaign && (
                    <section className="ledger-reset-panel">
                      <div>
                        <strong>Reset campaign Ledger</strong>
                        <span>
                          Clears completed entries, prestige records, unlocks, and game history.
                          The active game is kept.
                        </span>
                      </div>
                      <button onClick={onResetLedgerCampaign} type="button">
                        <Trash2 size={15} />
                        Reset Ledger Progress
                      </button>
                    </section>
                  )}
                </div>
              )}

              {ledgerView === "log" && (
                <div className="log-list tray-log-list ledger-scroll-region">
                  {state.log.length === 0 && <p>No log entries yet.</p>}
                  {state.log.map((entry) => (
                    <p key={entry.id}>
                      <span>Round {entry.round}</span>
                      {entry.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
          {activeSection === "rules" && (
            <RulesGuide
              gameStatus={{
                actionsRemaining: state.actionsRemaining,
                round: state.round,
                season: state.season
              }}
            />
          )}
        </section>
      )}

      <div className="tray-tabs" role="tablist" aria-label="Reference sections">
        {trayItems.map((item) => {
          const selected = activeSection === item.id;
          return (
            <button
              aria-selected={selected}
              className={`tray-summary-item ${selected ? "selected" : ""}`}
              key={item.id}
              onClick={() => toggleSection(item.id)}
              role="tab"
              type="button"
            >
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </button>
          );
        })}
      </div>
    </footer>
  );
}
