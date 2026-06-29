import {
  BookOpen,
  Layers,
  List,
  ScrollText,
  Sparkles,
  X
} from "lucide-react";
import { useState } from "react";
import { InspectIconButton } from "../common/InspectIconButton";
import { encounterById } from "../../data/encounters";
import { coreTiles, specialTiles } from "../../data/tiles";
import { selectCurrentPlayer } from "../../engine/selectors";
import type { GameState } from "../../engine/types";
import { EncounterSeasonEffects } from "../common/EncounterSeasonEffects";
import { formatCategory, formatCost, getEncounterTypeLabel } from "../common/gameText";

type DrawerSection = "tiles" | "hand" | "specials" | "log" | "rules";

interface BottomDrawerProps {
  state: GameState;
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
    note: "The Randomizer Seed recreates the same setup for repeat playtests."
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

export function BottomDrawer({ state, onTileInspect }: BottomDrawerProps) {
  const [activeSection, setActiveSection] = useState<DrawerSection | null>(null);
  const currentPlayer = selectCurrentPlayer(state);
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
    { id: "log", label: "Log", detail: `${state.log.length} entries`, icon: List },
    { id: "rules", label: "Rules", detail: "quick guide", icon: BookOpen }
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
      }`.trim()}
      aria-label="Game reference tray"
    >
      {activeSection && activeItem && (
        <section className="tray-panel" aria-label={activeItem.label}>
          <div className="tray-panel-header">
            <div>
              <p className="eyebrow">Reference</p>
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
          {activeSection === "log" && (
            <div className="log-list tray-log-list">
              {state.log.length === 0 && <p>No log entries yet.</p>}
              {state.log.map((entry) => (
                <p key={entry.id}>{entry.message}</p>
              ))}
            </div>
          )}
          {activeSection === "rules" && (
            <div className="rules-guide">
              <section className="rules-quick-start" aria-label="Current game and quick start">
                <div>
                  <p className="eyebrow">Playtester Quick Guide</p>
                  <strong>Build together. Resolve every prompt. Keep Strain under control.</strong>
                </div>
                <div className="rules-status-row" aria-label="Current game status">
                  <span>Season {state.season}</span>
                  <span>Round {state.round}/12</span>
                  <span>{state.actionsRemaining} actions left</span>
                </div>
              </section>
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
