import { isPlayerExperience } from "../../app/experience";
import { LedgerHistory } from "./LedgerHistory";
import { PrivateHandGate } from "../common/PrivateHandGate";
import { TileArtwork } from "../common/TileArtwork";
import {
  BookMarked,
  CheckCircle2,
  History,
  Target,
  Trash2,
  Trophy,
  X
} from "lucide-react";
import { useState } from "react";
import { readLedgerCampaign } from "../../app/ledgerPersistence";
import { InspectIconButton } from "../common/InspectIconButton";
import { encounterById } from "../../data/encounters";
import { ledgerMilestones } from "../../data/ledger";
import { questCards } from "../../data/questCards";
import { evaluateQuest } from "../../engine/quests";
import { QuestCardView } from "../common/QuestCardView";
import { QuestCardMini } from "../cards/QuestCardMini";
import { coreTiles, goldenTileById, specialTiles } from "../../data/tiles";
import {
  countCompletedLedgerEntries,
  isGoldenMilestoneUnlocked,
  type LedgerCampaign
} from "../../engine/ledgerCampaign";
import { evaluateStewardObjectives } from "../../engine/scoring";
import { getLedgerRun } from "../../engine/ledger";
import { selectCurrentPlayer } from "../../engine/selectors";
import type { GameState } from "../../engine/types";
import { EncounterCard } from "../common/EncounterCard";
import { formatCategory, formatCost } from "../common/gameText";
import { RulesGuide } from "./RulesGuide";

type DrawerSection = "tiles" | "hand" | "specials" | "ledger" | "rules";
type LedgerView = "game" | "history" | "cards" | "unlocks" | "log";
const ledgerViews = [
  { id: "game", label: "This game", Icon: Target },
  { id: "history", label: "Settlements", Icon: History },
  { id: "cards", label: "Quest Cards", Icon: BookMarked },
  { id: "unlocks", label: "Unlocks", Icon: Trophy },
  { id: "log", label: "Game log", Icon: History }
] as const;

interface BottomDrawerProps {
  state: GameState;
  ledgerCampaign?: LedgerCampaign;
  onResetLedgerCampaign?: () => void;
  onTileInspect: (tileId: string) => void;
}

interface TileReferenceCardProps {
  tileId: string;
  className?: string;
  effect: string;
  meta: string;
  name: string;
  onInspect: () => void;
  placement: string;
  status: string;
}

function TileReferenceCard({
  tileId,
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
      <TileArtwork tileId={tileId} name={name} board />
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
  const [viewedCardNumber, setViewedCardNumber] = useState<number | null>(null);
  const [storedLedgerCampaign] = useState(readLedgerCampaign);
  const ledgerCampaign = providedLedgerCampaign ?? storedLedgerCampaign;
  const currentPlayer = selectCurrentPlayer(state);
  const ledgerRun = getLedgerRun(state);
  const recordedGame = ledgerRun.recorded || ledgerCampaign.games.some((game) => game.id === ledgerRun.gameId);
  const visibleLedgerViews = ledgerViews.filter((view) => view.id !== "history" || isPlayerExperience());
  const ledgerPanel = { role: "tabpanel", id: "ledger-view-panel", "aria-labelledby": `ledger-view-${ledgerView}`, tabIndex: 0 };
  const quest = evaluateQuest(state);
  const stewardObjectives = evaluateStewardObjectives(state);
  const completedLedgerCount = countCompletedLedgerEntries(ledgerCampaign);
  const ledgerBox = new Set(ledgerCampaign.box);
  const viewedCard = viewedCardNumber ? questCards.find((card) => card.n === viewedCardNumber) : undefined;
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
      detail: `${completedLedgerCount}/21 Quest Cards`
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
                {activeSection === "ledger" ? "Campaign record" : "Reference"}
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
                    tileId={tile.id}
                    className="available unlocked-special-card"
                    effect={tile.effectText}
                    key={tile.id}
                    meta={`${formatCategory(tile.category)}, unlocked`}
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
                    tileId={tile.id}
                    className={remaining > 0 ? "available" : "locked"}
                    effect={tile.basic.effectText}
                    key={tile.id}
                    meta={`${formatCategory(tile.category)}, ${formatCost(tile.basic.cost) === "Free" ? "free to build" : `costs ${formatCost(tile.basic.cost)}`}`}
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
            <PrivateHandGate state={state}>
            <div className="tile-reference-grid cards">
              {hand.length === 0 && <p className="muted">No hidden Encounter cards.</p>}
              {hand.map((cardId) => {
                const card = encounterById[cardId];
                if (!card) return null;
                return (
                  <EncounterCard
                    card={card}
                    currentSeason={state.season}
                    key={cardId}
                    size="compact"
                  />
                );
              })}
            </div>
            </PrivateHandGate>
          )}
          {activeSection === "specials" && (
            <div className="tile-reference-grid compact-reference">
              {orderedSpecialTiles.map((tile) => {
                const remaining = state.tileSupply.special[tile.id] ?? 0;
                return (
                  <TileReferenceCard
                    tileId={tile.id}
                    className={remaining > 0 ? "available" : "locked"}
                    effect={tile.effectText}
                    key={tile.id}
                    meta={`${formatCategory(tile.category)}, from ${tile.unlockSource}`}
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
              <div className="ledger-view-tabs" role="tablist" aria-label="Ledger sections">
                {visibleLedgerViews.map(({ id, label, Icon }, index) => <button
                  aria-selected={ledgerView === id}
                  aria-controls="ledger-view-panel"
                  id={`ledger-view-${id}`}
                  className={ledgerView === id ? "selected" : ""}
                  key={id}
                  tabIndex={ledgerView === id ? 0 : -1}
                  onClick={() => setLedgerView(id)}
                  onKeyDown={(event) => {
                    const next = event.key === "Home" ? 0 : event.key === "End" ? visibleLedgerViews.length - 1 : event.key === "ArrowRight" ? (index + 1) % visibleLedgerViews.length : event.key === "ArrowLeft" ? (index - 1 + visibleLedgerViews.length) % visibleLedgerViews.length : null;
                    if (next === null) return;
                    event.preventDefault();
                    setLedgerView(visibleLedgerViews[next].id);
                    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button");
                    buttons?.[next].focus();
                  }}
                  role="tab"
                  type="button"
                >
                  <Icon size={15} aria-hidden="true" />{label}
                </button>)}
              </div>

              {ledgerView === "game" && (
                <div {...ledgerPanel} className="ledger-scroll-region">
                  <section className="ledger-campaign-summary">
                    <div>
                      <p className="eyebrow">Steward’s Ledger</p>
                      <strong>{completedLedgerCount} of 21 Quest Cards completed</strong>
                      <span>
                        Campaign progress is stored separately from this active game.
                      </span>
                    </div>
                    <div className="ledger-count-seal" aria-label={`${completedLedgerCount} Quest Cards complete`}>
                      <strong>{completedLedgerCount}</strong>
                      <span>/ 21</span>
                    </div>
                  </section>

                  <section className="ledger-quest-current" aria-label="This game's Quest Card">
                    {quest
                      ? <QuestCardView card={quest.card} playerCount={state.playerCount} result={quest} ended={state.phase === "gameEnd"} />
                      : <p>This game was started without a Quest Card. The next new settlement draws one.</p>}
                  </section>

                  <div className="ledger-section-heading">
                    <div>
                      <p className="eyebrow">Current game</p>
                      <h3>Steward objectives</h3>
                    </div>
                    <span>{stewardObjectives.filter((objective) => objective.met).length}/{stewardObjectives.length} {state.phase === "gameEnd" ? "met at the end" : "on track"}</span>
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
                              : state.phase === "gameEnd" ? "Not met" : "In progress"}
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
                    {recordedGame
                      ? "This game has been recorded in the Steward’s Ledger."
                      : state.phase === "gameEnd"
                        ? "Review and record this game from the final scoring panel."
                        : "The Quest Card is tracked automatically. A completed card goes into the Ledger when the finished game is recorded. A failed card goes to the bottom of the deck."}
                  </p>
                </div>
              )}

              {ledgerView === "history" && (
                <div {...ledgerPanel} className="ledger-scroll-region"><LedgerHistory campaign={ledgerCampaign} /></div>
              )}

              {ledgerView === "cards" && (
                <div {...ledgerPanel} className="ledger-scroll-region">
                  <div className="ledger-section-heading">
                    <div>
                      <p className="eyebrow">Steward’s Ledger</p>
                      <h3>Quest Cards</h3>
                    </div>
                    <span>{completedLedgerCount} in the Ledger · {ledgerCampaign.deck.length} in the deck</span>
                  </div>
                  {viewedCard && <div className="ledger-card-viewer" role="group" aria-label={`Reading Quest Card ${viewedCard.n}`}>
                    <QuestCardView card={viewedCard} playerCount={state.playerCount} result={quest?.card.n === viewedCard.n ? quest : undefined} ended={state.phase === "gameEnd"} sizes="320px" />
                    <div>
                      <p>{ledgerBox.has(viewedCard.n) ? "In the Steward’s Ledger. Replays count once." : quest?.card.n === viewedCard.n ? "This game’s Quest Card." : "Still in the Quest deck."}</p>
                      <button type="button" className="ledger-card-close" onClick={() => setViewedCardNumber(null)}>Close the card</button>
                    </div>
                  </div>}
                  {[
                    { title: "In the Steward’s Ledger", empty: "No Quest Cards completed yet. Complete either half of this game’s card to add it.", cards: questCards.filter((card) => ledgerBox.has(card.n)) },
                    { title: "In the Quest deck", empty: "Every card is in the Ledger. Completed cards now come round again.", cards: questCards.filter((card) => !ledgerBox.has(card.n)) }
                  ].map((group) => <section className="ledger-card-group" key={group.title} aria-label={group.title}>
                    <h4>{group.title} <span>{group.cards.length}</span></h4>
                    {group.cards.length === 0 ? <p className="ledger-card-empty">{group.empty}</p> : <ul className="ledger-card-grid">
                      {group.cards.map((card) => {
                        const inLedger = ledgerBox.has(card.n);
                        const current = quest?.card.n === card.n;
                        return <li key={card.n} className={`ledger-quest-card${inLedger ? " is-complete" : ""}${current ? " is-current" : ""}`}>
                          <button type="button" aria-pressed={viewedCardNumber === card.n} aria-label={`Quest Card ${card.n}, ${card.theme}. ${inLedger ? "In the Ledger" : current ? "This game" : "In the deck"}. Read the card`} onClick={() => setViewedCardNumber(viewedCardNumber === card.n ? null : card.n)}>
                            <QuestCardMini card={card} faceDown={!inLedger && !current} />
                            <span className="ledger-quest-caption"><small>No. {card.n}</small><strong>{card.theme}</strong></span>
                            {(inLedger || current) && <span className="ledger-status-chip">{inLedger ? <><CheckCircle2 size={12} aria-hidden="true" /> In the Ledger</> : "This game"}</span>}
                          </button>
                        </li>;
                      })}
                    </ul>}
                  </section>)}
                </div>
              )}

              {ledgerView === "unlocks" && (
                <div {...ledgerPanel} className="ledger-scroll-region">
                  <section className="ledger-campaign-summary unlock-summary">
                    <div>
                      <p className="eyebrow">Golden Milestones</p>
                      <strong>{completedLedgerCount} Quest Cards in the Ledger</strong>
                      <span>Each Quest Card counts once, whichever half completed it.</span>
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
                            <span>{milestone.threshold} Quest Cards</span>
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
                              : `Complete ${milestone.threshold} Quest Cards to unlock.`}
                          </footer>
                        </article>
                      );
                    })}
                  </div>
                  {onResetLedgerCampaign && (
                    <section className="ledger-reset-panel">
                      <div>
                        <strong>Reset the Steward’s Ledger</strong>
                        <span>
                          Clears completed Quest Cards, unlocks and game history, and reshuffles the deck.
                          The active game is kept.
                        </span>
                      </div>
                      <button onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); onResetLedgerCampaign(); }} type="button">
                        <Trash2 size={15} />
                        Reset Ledger Progress
                      </button>
                    </section>
                  )}
                </div>
              )}

              {ledgerView === "log" && (
                <div {...ledgerPanel} className="log-list tray-log-list ledger-scroll-region">
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
