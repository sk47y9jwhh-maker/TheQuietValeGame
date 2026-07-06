import {
  BookMarked,
  BookOpen,
  CheckCircle2,
  History,
  Layers,
  LockKeyhole,
  ScrollText,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  X
} from "lucide-react";
import { useState } from "react";
import {
  countCompletedLedgerEntries,
  isGoldenMilestoneUnlocked,
  readLedgerCampaign,
  type LedgerCampaign
} from "../../app/ledgerPersistence";
import { InspectIconButton } from "../common/InspectIconButton";
import { encounterById } from "../../data/encounters";
import {
  ledgerChronicles,
  ledgerEntries,
  ledgerMilestones,
  type LedgerChronicle
} from "../../data/ledger";
import { coreTiles, goldenTileById, specialTiles } from "../../data/tiles";
import { evaluateStewardObjectives } from "../../engine/scoring";
import { evaluateLedgerEntries, getLedgerRun } from "../../engine/ledger";
import { selectCurrentPlayer } from "../../engine/selectors";
import type { GameState } from "../../engine/types";
import { EncounterSeasonEffects } from "../common/EncounterSeasonEffects";
import { formatCategory, formatCost, getEncounterTypeLabel } from "../common/gameText";

type DrawerSection = "tiles" | "hand" | "specials" | "ledger" | "rules";
type LedgerView = "game" | "chronicles" | "unlocks" | "log";
type RulesView = "howTo" | "gameRules";

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

interface RuleReferenceCard {
  category: string;
  title: string;
  summary?: string;
  bullets: string[];
  note?: string;
}

const rules: RuleReferenceCard[] = [
  {
    category: "Overview",
    title: "Aim and campaign",
    summary: "Build one shared settlement and finish with the strongest combined score.",
    bullets: [
      "Play 12 rounds: Season I is rounds 1–4, Season II is 5–8, and Season III is 9–12.",
      "Card effects and Burden resolution costs use the current Season line.",
      "Final scoring happens after round 12."
    ]
  },
  {
    category: "Getting started",
    title: "Setup and seeding",
    bullets: [
      "Choose unique Stewards, then place each Steward on one of their allowed starting terrains.",
      "At each Season start, every player seeds one hidden Encounter at the top, middle, and bottom of the deck.",
      "Your first placed tile must include your Steward Token’s starting hex."
    ],
    note: "Encounter cards are freshly randomised when each new game starts."
  },
  {
    category: "Round structure",
    title: "Round flow",
    bullets: [
      "At a new Season, resolve active Burden effects before seeding.",
      "Reveal 1 Encounter per player and resolve the reveal queue in order.",
      "Each player takes one turn with up to 4 actions and may end early.",
      "At round end, reduce every active Arrival timer by 1, then advance the round."
    ]
  },
  {
    category: "Your turn",
    title: "Actions and free interactions",
    bullets: [
      "Place: spend 1 action and pay the shown Core Tile cost.",
      "Upgrade: spend 1 action and pay the upgraded cost of a reachable basic Core Tile.",
      "Activate: spend 1 action to use an eligible reachable tile’s production or activated effect.",
      "Complete an Arrival or resolve a Burden: spend 1 action and pay its requirement or current resolution cost.",
      "Using a face-up Boon, moving through Stables, and using a Steward Power do not spend an action unless their text says otherwise."
    ]
  },
  {
    category: "Settlement",
    title: "Placement and reach",
    bullets: [
      "After your first tile, new placements must connect to your Steward’s reachable settlement network.",
      "Your reachable network begins at the tile beneath your Steward and continues through adjacent, non-Overstrained tiles.",
      "Upgrading or activating a tile moves your Steward to it; placing moves the Steward to the new tile.",
      "Follow every printed terrain, adjacency, footprint, River/Water, and supply restriction shown by the tile picker."
    ],
    note: "Docks and the Ranger Power can create additional points of reach."
  },
  {
    category: "Settlement",
    title: "Strain and Supported",
    bullets: [
      "Tiles hold at most 3 Strain. At 3, a tile is Overstrained.",
      "Overstrained tiles cannot be activated or upgraded, break reachable connections, and contribute no Population, Renown, or passive scoring.",
      "Supported prevents the first Strain that would be placed on that tile during the round.",
      "Single-use Supported is then spent; printed or passive Supported can protect again next round.",
      "After rounds 4 and 8, each Overstrained tile spreads 1 Strain to an adjacent eligible tile when possible."
    ]
  },
  {
    category: "Encounters",
    title: "Boons, Arrivals, and Burdens",
    bullets: [
      "Boons resolve on reveal or remain face-up when their lifecycle says so. Face-up Boons show their remaining uses.",
      "Arrivals enter with 3 timer tokens. Complete one by spending 1 action and paying its requirement to unlock its Special Tile reward.",
      "An unresolved Arrival at 0 timers is discarded and places 1 Strain on an eligible placed tile.",
      "Burdens trigger when revealed, remain active, and trigger again at each later Season start until resolved.",
      "Resolve a Burden by spending 1 action and paying its Season-scaled resolution cost."
    ]
  },
  {
    category: "Golden Legacy",
    title: "Golden Tiles and Boons",
    bullets: [
      "Ledger milestones unlock Golden Tiles and Golden Boons for future games.",
      "During setup, choose up to one unlocked Golden Tile and one unlocked Golden Boon independently.",
      "Place the Golden Tile after Steward starts for 0 Actions, following its printed setup restriction.",
      "The Golden Boon is shuffled into the Encounter Deck, is never dealt to a hand, and grants a bonus reveal when drawn.",
      "Golden Tile scoring conditions are worth +5 Renown when achieved."
    ]
  },
  {
    category: "Steward’s Ledger",
    title: "Achievements, Vows, and Golden unlocks",
    bullets: [
      "Ledger Entries are persistent achievements awarded when a completed game is recorded; each named entry advances Golden unlocks only once.",
      "Entries marked by player count also keep separate 1P–4P prestige ticks, but those extra ticks do not advance the Golden milestones again.",
      "Some entries are locked until the shown number of named entries is complete. Locked entries cannot be earned early.",
      "A Vow must be declared before setup and only one may be attempted. Any effect from a Steward, Boon, or Golden source can break it if it performs the forbidden action.",
      "During-game timing entries are tracked automatically, including Arrival timers, same-round Burden answers, recovery, and Ranger-enabled terrain actions.",
      "Golden Tiles and Golden Boons unlock at 5, 12, 18, 25, and 32 completed named entries."
    ],
    note: "Open Ledger → Chronicles to read every requirement and see live progress."
  },
  {
    category: "Stewards",
    title: "Powers and objectives",
    bullets: [
      "Each Steward Power is normally available once per Season.",
      "Vanguard, Knight, and Sentinel prepare a benefit for the next matching placement or upgrade.",
      "Ranger creates temporary reach for the current turn; Quartermaster exchanges resources and may aid an Arrival.",
      "Warden is offered reactively when a Burden is revealed. The Burden remains active even if its reveal effect is prevented.",
      "Each completed Steward objective is worth +15 Renown at final scoring."
    ]
  },
  {
    category: "Payments",
    title: "Warehouse and prepared effects",
    bullets: [
      "All players spend from and add to the shared Warehouse.",
      "When a Boon or tile passive can modify a payment, the game offers those choices before anything is spent.",
      "Prepared Effects on the Stewards Board show discounts, zero-action benefits, and remaining uses.",
      "A cancelled payment spends neither resources nor actions."
    ]
  },
  {
    category: "End game",
    title: "Final scoring",
    bullets: [
      "Add Population and Renown from every non-Overstrained tile, including eligible passive bonuses.",
      "Add +15 Renown for each Steward objective achieved.",
      "Add +5 Renown for each placed Golden Tile whose scoring condition is achieved.",
      "Lose 6 Renown for each active Burden and 3 Renown for every Strain token on the map.",
      "Final score = Population + Renown after all bonuses and penalties."
    ],
    note: "Use the End screen breakdown to audit the playtest result."
  }
];

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
  const [rulesView, setRulesView] = useState<RulesView>("howTo");
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
    { id: "tiles", label: "Tiles", detail: `${coreRemaining} core left`, icon: Layers },
    { id: "hand", label: "Hand", detail: `${hand.length} hidden`, icon: ScrollText },
    { id: "specials", label: "Specials", detail: `${readySpecialTiles.length} ready`, icon: Sparkles },
    {
      id: "ledger",
      label: "Ledger",
      detail: `${completedLedgerCount}/50 complete`,
      icon: BookMarked
    },
    { id: "rules", label: "Rules", detail: "guide & rules", icon: BookOpen }
  ] satisfies Array<{
    id: DrawerSection;
    label: string;
    detail: string;
    icon: typeof Layers;
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
                            {entry.requiredSteward && <span>{entry.requiredSteward}</span>}
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
            <div className="rules-guide">
              <section className="rules-quick-start" aria-label="Current game and quick start">
                <div>
                  <p className="eyebrow">Playtester Guide</p>
                  <strong>Build together. Resolve every prompt. Keep Strain under control.</strong>
                </div>
                <div className="rules-status-row" aria-label="Current game status">
                  <span>Season {state.season}</span>
                  <span>Round {state.round}/12</span>
                  <span>{state.actionsRemaining} actions left</span>
                </div>
              </section>
              <nav className="rules-view-tabs" aria-label="Guide sections" role="tablist">
                <button
                  aria-selected={rulesView === "howTo"}
                  className={rulesView === "howTo" ? "selected" : ""}
                  onClick={() => setRulesView("howTo")}
                  role="tab"
                  type="button"
                >
                  How to use
                </button>
                <button
                  aria-selected={rulesView === "gameRules"}
                  className={rulesView === "gameRules" ? "selected" : ""}
                  onClick={() => setRulesView("gameRules")}
                  role="tab"
                  type="button"
                >
                  Game rules
                </button>
              </nav>

              {rulesView === "howTo" && (
                <div className="how-to-guide">
                  <section className="how-to-flow" aria-labelledby="first-game-flow-title">
                    <div>
                      <p className="eyebrow">First game in 60 seconds</p>
                      <strong id="first-game-flow-title">Follow the screen from left to right</strong>
                    </div>
                    <ol>
                      <li>Resolve any prompt</li>
                      <li>Choose an action</li>
                      <li>Follow the highlights</li>
                      <li>Confirm the choice</li>
                      <li>End your turn</li>
                    </ol>
                  </section>

                  <div className="how-to-grid">
                    <article className="mini-card how-to-card">
                      <span className="how-to-step-number">1</span>
                      <div>
                        <strong>Start with the action buttons</strong>
                        <p>
                          Use Place, Upgrade, Activate, Interact, or Power in the left panel.
                          You can also right-click a map hex to open its available quick actions;
                          on a touch device, use the standard action buttons. Unavailable choices
                          stay visible and explain what is missing. End finishes your turn early.
                        </p>
                      </div>
                    </article>

                    <article className="mini-card how-to-card">
                      <span className="how-to-step-number">2</span>
                      <div>
                        <strong>Place or upgrade a tile</strong>
                        <p>
                          Choose a tile, then select one of the highlighted map hexes. Check the
                          preview, cost, and any discounts before confirming. The eye button opens
                          the tile’s full reference.
                        </p>
                      </div>
                    </article>

                    <article className="mini-card how-to-card">
                      <span className="how-to-step-number">3</span>
                      <div>
                        <strong>Finish multi-part placements</strong>
                        <p>
                          Street and Track need a starting hex and a direction. Stables need two
                          separate highlighted hexes; they do not need to touch, but each must
                          connect legally. The prompt shows what still needs choosing.
                        </p>
                      </div>
                    </article>

                    <article className="mini-card how-to-card">
                      <span className="how-to-step-number">4</span>
                      <div>
                        <strong>Resolve prompts before continuing</strong>
                        <p>
                          Boons, Burdens, payments, and other effects open a focused choice. Select
                          the full amount or one complete alternative, review exactly where changes
                          will land, then apply. A no-effect result still needs acknowledging.
                        </p>
                      </div>
                    </article>

                    <article className="mini-card how-to-card">
                      <span className="how-to-step-number">5</span>
                      <div>
                        <strong>Use the Stewards Board and bottom drawer</strong>
                        <p>
                          The right board holds face-up Boons, prepared effects, Arrivals, and
                          Burdens. The bottom drawer contains tile references, your hidden hand,
                          unlocked Specials, Ledger progress, and these guides.
                        </p>
                      </div>
                    </article>

                    <article className="mini-card how-to-card">
                      <span className="how-to-step-number">6</span>
                      <div>
                        <strong>Undo, leave, and resume safely</strong>
                        <p>
                          Use the top-right undo and redo controls for recent actions. The current
                          game and Steward’s Ledger save automatically in this browser, so you can
                          close the page and return later. Clearing browser storage removes them.
                        </p>
                      </div>
                    </article>
                  </div>

                  <aside className="how-to-help-note">
                    <strong>If a choice looks blocked:</strong>
                    <span>
                      Read the reason beside it, then check actions, resources, tile supply,
                      settlement reach, terrain, Strain, and whether another prompt is waiting.
                    </span>
                  </aside>
                </div>
              )}

              {rulesView === "gameRules" && (
                <div className="rules-grid">
                  {rules.map((rule) => (
                    <article className="mini-card rule-reference-card" key={rule.title}>
                      <span className="rule-category">{rule.category}</span>
                      <strong>{rule.title}</strong>
                      {rule.summary && <p className="rule-summary">{rule.summary}</p>}
                      <ul>
                        {rule.bullets.map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                      {rule.note && <small className="rule-note">{rule.note}</small>}
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <div className="tray-tabs" role="tablist" aria-label="Reference sections">
        {trayItems.map((item) => {
          const Icon = item.icon;
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
              <Icon size={17} />
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </button>
          );
        })}
      </div>
    </footer>
  );
}
