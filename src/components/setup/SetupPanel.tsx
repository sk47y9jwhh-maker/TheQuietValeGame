import {
  BookOpen,
  Package,
  ScrollText,
  UserRound,
  X
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { getStartingWarehouseAmount } from "../../engine/setup";
import { resourceLabels, resources, warehouseCap } from "../../data/resources";
import { stewardById, stewards } from "../../data/stewards";
import { terrainLabels } from "../../data/map";
import { questCardByNumber } from "../../data/questCards";
import { QuestDrawn } from "../cards/QuestDrawn";
import {
  supportedPlayerCounts,
  type GoldenBoonData,
  type GoldenTileData,
  type PlayerCount
} from "../../engine/types";
import { BrandMark } from "../common/BrandMark";
import { RulesGuide } from "../panels/RulesGuide";

type ResourceFillStyle = CSSProperties & { "--resource-fill": string };

export interface SetupPanelProps {
  focusOnMount?: boolean;
  playerCount: PlayerCount;
  stewardIds: string[];
  questCardNumber?: number;
  selectedGoldenTileId?: string;
  selectedGoldenBoonId?: string;
  completedLedgerCount?: number;
  availableGoldenTiles?: GoldenTileData[];
  availableGoldenBoons?: GoldenBoonData[];
  onPlayerCountChange: (playerCount: PlayerCount) => void;
  onStewardChange: (seatIndex: number, stewardId: string) => void;
  onGoldenTileChange?: (tileId: string) => void;
  onGoldenBoonChange?: (boonId: string) => void;
  onStart: () => void;
}

function getResourceFillStyle(value: number): ResourceFillStyle {
  const fill = Math.max(0, Math.min(100, (value / warehouseCap) * 100));
  return { "--resource-fill": `${fill}%` };
}

export function SetupPanel({
  focusOnMount = false,
  playerCount,
  stewardIds,
  questCardNumber,
  selectedGoldenTileId = "",
  selectedGoldenBoonId = "",
  completedLedgerCount = 0,
  availableGoldenTiles = [],
  availableGoldenBoons = [],
  onPlayerCountChange,
  onStewardChange,
  onGoldenTileChange = () => {},
  onGoldenBoonChange = () => {},
  onStart
}: SetupPanelProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (focusOnMount) heading.current?.focus(); }, [focusOnMount]);
  const selectedStewards = stewardIds
    .slice(0, playerCount)
    .map((stewardId) => stewardById[stewardId])
    .filter(Boolean);
  const startingResources = getStartingWarehouseAmount(playerCount);
  const playerLabel = `${playerCount} Player${playerCount === 1 ? "" : "s"}`;
  const questCard = questCardNumber ? questCardByNumber[questCardNumber] : undefined;
  const selectedGoldenTile = availableGoldenTiles.find(
    (tile) => tile.id === selectedGoldenTileId
  );
  const selectedGoldenBoon = availableGoldenBoons.find(
    (boon) => boon.id === selectedGoldenBoonId
  );
  const [goldenOptionsOpen, setGoldenOptionsOpen] = useState(
    availableGoldenTiles.length > 0 ||
      availableGoldenBoons.length > 0 ||
      Boolean(selectedGoldenTileId || selectedGoldenBoonId)
  );
  const [rulesOpen, setRulesOpen] = useState(false);
  return (
    <div className="app-shell setup-shell">
      <header className="top-bar setup-top-bar">
        <div className="top-brand">
          <BrandMark />
          <div>
            <strong>The Quiet Vale</strong>
            <span>Seasons of Settlement</span>
          </div>
        </div>
        <div className="season-card">
          <div className="season-metrics">
            <span>
              <small>Season</small>
              <strong>I</strong>
            </span>
            <span>
              <small>Round</small>
              <strong>1/12</strong>
            </span>
          </div>
        </div>
        <div className="turn-chip">
          <div>
            <span>Stewards</span>
            <strong>{playerLabel}</strong>
          </div>
        </div>
        <div className="warehouse-strip setup-resource-strip" aria-label="Starting resources">
          <span className="warehouse-title">Start</span>
          {resources.map((resource) => (
            <span
              className="resource-pill"
              data-resource={resource}
              key={resource}
              style={getResourceFillStyle(startingResources)}
            >
              <small>{resourceLabels[resource]}</small>
              <strong>{startingResources}</strong>
              <span className="resource-fill" aria-hidden="true" />
            </span>
          ))}
        </div>
      </header>

      <main className="command-table setup-command-table">
        <section className="action-console setup-control-panel">
          <div className="turn-summary">
            <div>
              <p className="eyebrow">Step 1</p>
              <h2 ref={heading} tabIndex={-1}>New Game</h2>
            </div>
            <strong>{playerLabel}</strong>
          </div>

          <div className="segmented" aria-label="Player count">
            {supportedPlayerCounts.map((count) => (
              <button
                key={count}
                className={count === playerCount ? "selected" : ""}
                onClick={() => onPlayerCountChange(count)}
                type="button"
              >
                {count}P
              </button>
            ))}
          </div>

          <div className="setup-stewards">
            {Array.from({ length: playerCount }, (_, index) => (
              <label key={index}>
                Player {index + 1}
                <select
                  value={stewardIds[index]}
                  onChange={(event) => onStewardChange(index, event.target.value)}
                >
                  {stewards.map((steward) => (
                    <option
                      key={steward.id}
                      value={steward.id}
                      disabled={
                        stewardIds.includes(steward.id) &&
                        stewardIds[index] !== steward.id
                      }
                    >
                      {steward.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          {questCard && (
            <div className="setup-quest-card">
              <h2>This game’s Quest Card</h2>
              <QuestDrawn card={questCard} playerCount={playerCount} />
              <small>{completedLedgerCount} of 21 Quest Cards in the Steward’s Ledger.</small>
            </div>
          )}

          <details
            className="setup-golden-legacy"
            open={goldenOptionsOpen}
            onToggle={(event) => setGoldenOptionsOpen(event.currentTarget.open)}
          >
            <summary>
              <span>
                <strong>Golden Legacy</strong>
                <small>Optional setup</small>
              </span>
              <small>
                {availableGoldenTiles.length + availableGoldenBoons.length} unlocked
              </small>
            </summary>
            <div className="setup-golden-fields">
              <p>Choose up to one unlocked Golden Tile and one Golden Boon.</p>
              <label>
                Golden Tile
                <select
                  aria-label="Golden Tile"
                  value={selectedGoldenTileId}
                  onChange={(event) => onGoldenTileChange(event.target.value)}
                >
                  <option value="">No Golden Tile</option>
                  {availableGoldenTiles.map((tile) => (
                    <option key={tile.id} value={tile.id}>{tile.name}</option>
                  ))}
                </select>
                <small>
                  {selectedGoldenTile
                    ? `${selectedGoldenTile.placement?.text} ${selectedGoldenTile.effectText}`
                    : `${availableGoldenTiles.length} unlocked · ${completedLedgerCount}/21 Quest Cards in the Ledger`}
                </small>
              </label>
              <label>
                Golden Boon
                <select
                  aria-label="Golden Boon"
                  value={selectedGoldenBoonId}
                  onChange={(event) => onGoldenBoonChange(event.target.value)}
                >
                  <option value="">No Golden Boon</option>
                  {availableGoldenBoons.map((boon) => (
                    <option key={boon.id} value={boon.id}>{boon.name}</option>
                  ))}
                </select>
                <small>
                  {selectedGoldenBoon
                    ? selectedGoldenBoon.effectText
                    : `${availableGoldenBoons.length} unlocked · ${completedLedgerCount}/21 Quest Cards in the Ledger`}
                </small>
              </label>
            </div>
          </details>

          <button className="primary-action" onClick={onStart} type="button">
            Start Season I
          </button>
        </section>

        <section className="map-panel setup-overview-panel">
          <div className="setup-table-header">
            <p className="eyebrow">Command Table</p>
            <h1>The Quiet Vale</h1>
          </div>
          <div className="setup-step-board">
            <article className="setup-step-card active">
              <span>1</span>
              <strong>Choose Stewards</strong>
              <small>{selectedStewards.length} selected</small>
            </article>
            <article className="setup-step-card">
              <span>2</span>
              <strong>Place Starts</strong>
              <small>One token each</small>
            </article>
            <article className="setup-step-card">
              <span>3</span>
              <strong>Seed Encounters</strong>
              <small>Top, middle, bottom</small>
            </article>
            <article className="setup-step-card">
              <span>4</span>
              <strong>Reveal Round</strong>
              <small>Begin play</small>
            </article>
          </div>
          <div className="setup-overview-grid">
            <div className="detail-stack">
              <strong>Encounter Shuffle</strong>
              <span>Randomised automatically</span>
            </div>
            <div className="detail-stack">
              <strong>Starting Warehouse</strong>
              <span>{startingResources} of each resource</span>
            </div>
            <div className="detail-stack">
              <strong>Encounter Deal</strong>
              <span>4/4/4 cards per player</span>
            </div>
          </div>
        </section>

        <aside className="right-panel setup-roster-panel">
          <p className="eyebrow">Stewards Board</p>
          <h2>Stewards</h2>
          <div className="setup-roster-list">
            {selectedStewards.map((steward, index) => (
              <article className="mini-card" key={`${steward.id}-${index}`}>
                <div className="mini-card-heading">
                  <strong>{steward.name}</strong>
                  <span>Player {index + 1}</span>
                </div>
                <p>
                  Starts on{" "}
                  {steward.startingTerrains
                    .map((terrain) => terrainLabels[terrain])
                    .join(" or ")}
                </p>
                <p>{steward.powerText}</p>
              </article>
            ))}
          </div>
        </aside>
      </main>

      <footer
        className={`setup-progress-strip setup-rules-drawer ${rulesOpen ? "expanded" : ""}`}
        aria-label="Setup progress and game rules"
      >
        {rulesOpen && (
          <section className="tray-panel setup-rules-panel" id="setup-rules-panel" aria-label="Rules">
            <div className="tray-panel-header">
              <div>
                <p className="eyebrow">Before You Begin</p>
                <h2>Rules</h2>
              </div>
              <button
                aria-label="Close rules drawer"
                className="tray-close"
                onClick={() => setRulesOpen(false)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>
            <RulesGuide />
          </section>
        )}
        <div className="setup-progress-grid">
          <div className="setup-progress-item active">
            <UserRound size={17} />
            <strong>Stewards</strong>
            <span>{playerCount} chosen</span>
          </div>
          <div className="setup-progress-item">
            <Package size={17} />
            <strong>Warehouse</strong>
            <span>{startingResources} each</span>
          </div>
          <div className="setup-progress-item">
            <ScrollText size={17} />
            <strong>Encounters</strong>
            <span>seed ready</span>
          </div>
          <button
            aria-controls="setup-rules-panel"
            aria-expanded={rulesOpen}
            className={`setup-progress-item setup-rules-trigger ${rulesOpen ? "selected" : ""}`}
            onClick={() => setRulesOpen((current) => !current)}
            type="button"
          >
            <BookOpen size={17} />
            <strong>Rules</strong>
            <span>how to play</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
