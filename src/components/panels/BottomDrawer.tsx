import {
  BookOpen,
  Layers,
  List,
  ScrollText,
  Sparkles,
  X
} from "lucide-react";
import { useState } from "react";
import { encounterById } from "../../data/encounters";
import { coreTiles, specialTiles } from "../../data/tiles";
import { selectCurrentPlayer } from "../../engine/selectors";
import type { GameState } from "../../engine/types";
import { EncounterSeasonEffects } from "../common/EncounterSeasonEffects";
import { formatCategory, formatCost, getEncounterTypeLabel } from "../common/gameText";

type DrawerSection = "tiles" | "hand" | "specials" | "log" | "rules";

interface BottomDrawerProps {
  state: GameState;
}

const rules = [
  {
    title: "Round Flow",
    text: "Reveal Encounters, resolve reveal prompts, then each player takes a turn with 4 actions."
  },
  {
    title: "Burden Timing",
    text: "Burden effects apply when revealed and again at the start of each new Season while active."
  },
  {
    title: "Arrivals",
    text: "Arrivals enter with 3 timer tokens. Players may complete them on their turns by paying the requirement."
  },
  {
    title: "Strain",
    text: "A tile with 3 Strain is Overstrained. Supported prevents the next Strain that would be placed there."
  }
];

export function BottomDrawer({ state }: BottomDrawerProps) {
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
    { id: "rules", label: "Rules", detail: "reference", icon: BookOpen }
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
      className={`bottom-drawer ${activeSection ? "expanded" : ""}`}
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
                  <article
                    className="mini-card available unlocked-special-card"
                    key={tile.id}
                  >
                    <div className="mini-card-heading">
                      <strong>{tile.name}</strong>
                      <span>{remaining} ready</span>
                    </div>
                    <p>
                      Unlocked Special | {formatCategory(tile.category)}
                    </p>
                    <p>Placement: {tile.placement?.text ?? "No placement restriction."}</p>
                    <p>{tile.effectText}</p>
                  </article>
                );
              })}
              {coreTiles.map((tile) => {
                const remaining = state.tileSupply.core[tile.id] ?? 0;
                return (
                  <article
                    className={`mini-card ${remaining > 0 ? "available" : "locked"}`}
                    key={tile.id}
                  >
                    <div className="mini-card-heading">
                      <strong>{tile.basic.name}</strong>
                      <span>{remaining} left</span>
                    </div>
                    <p>
                      {formatCategory(tile.category)} | Cost {formatCost(tile.basic.cost)}
                    </p>
                    <p>Placement: {tile.placement?.text ?? "No placement restriction."}</p>
                    <p>{tile.basic.effectText}</p>
                  </article>
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
                  <article
                    className={`mini-card ${remaining > 0 ? "available" : "locked"}`}
                    key={tile.id}
                  >
                    <div className="mini-card-heading">
                      <strong>{tile.name}</strong>
                      <span>{remaining > 0 ? "Ready" : "Locked"}</span>
                    </div>
                    <p>{formatCategory(tile.category)} | {tile.unlockSource}</p>
                    <p>Placement: {tile.placement?.text ?? "No placement restriction."}</p>
                    <p>{tile.effectText}</p>
                  </article>
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
            <div className="rules-grid">
              {rules.map((rule) => (
                <article className="mini-card" key={rule.title}>
                  <strong>{rule.title}</strong>
                  <p>{rule.text}</p>
                </article>
              ))}
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
