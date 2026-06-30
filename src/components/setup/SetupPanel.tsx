import {
  CalendarDays,
  Package,
  RefreshCw,
  ScrollText,
  UserRound
} from "lucide-react";
import type { CSSProperties } from "react";
import { getStartingWarehouseAmount } from "../../engine/setup";
import { resourceLabels, resources, warehouseCap } from "../../data/resources";
import { stewardById, stewards } from "../../data/stewards";
import { terrainLabels } from "../../data/map";
import type { LedgerEntry } from "../../data/ledger";
import type { PlayerCount } from "../../engine/types";
import { BrandMark } from "../common/BrandMark";

type ResourceFillStyle = CSSProperties & { "--resource-fill": string };

interface SetupPanelProps {
  playerCount: PlayerCount;
  stewardIds: string[];
  encounterSeed: string;
  declaredVowId?: string;
  completedLedgerCount?: number;
  availableVows?: LedgerEntry[];
  onPlayerCountChange: (playerCount: PlayerCount) => void;
  onStewardChange: (seatIndex: number, stewardId: string) => void;
  onEncounterSeedChange: (seed: string) => void;
  onDeclaredVowChange?: (entryId: string) => void;
  onShuffleSeed: () => void;
  onStart: () => void;
}

function getResourceFillStyle(value: number): ResourceFillStyle {
  const fill = Math.max(0, Math.min(100, (value / warehouseCap) * 100));
  return { "--resource-fill": `${fill}%` };
}

export function SetupPanel({
  playerCount,
  stewardIds,
  encounterSeed,
  declaredVowId = "",
  completedLedgerCount = 0,
  availableVows = [],
  onPlayerCountChange,
  onStewardChange,
  onEncounterSeedChange,
  onDeclaredVowChange = () => {},
  onShuffleSeed,
  onStart
}: SetupPanelProps) {
  const selectedStewards = stewardIds
    .slice(0, playerCount)
    .map((stewardId) => stewardById[stewardId])
    .filter(Boolean);
  const startingResources = getStartingWarehouseAmount(playerCount);
  const playerLabel = `${playerCount} Player${playerCount === 1 ? "" : "s"}`;
  const declaredVow = availableVows.find((entry) => entry.id === declaredVowId);

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
          <CalendarDays size={18} />
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
          <UserRound size={18} />
          <div>
            <span>Stewards</span>
            <strong>{playerLabel}</strong>
          </div>
        </div>
        <div className="warehouse-strip setup-resource-strip" aria-label="Starting resources">
          <span className="warehouse-title">
            <Package size={18} />
            Start
          </span>
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
              <h2>New Game</h2>
            </div>
            <strong>{playerLabel}</strong>
          </div>

          <div className="segmented" aria-label="Player count">
            {([1, 2, 3, 4] as PlayerCount[]).map((count) => (
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

          <label className="setup-seed">
            Randomizer Seed
            <div>
              <input
                value={encounterSeed}
                onChange={(event) => onEncounterSeedChange(event.target.value)}
              />
              <button onClick={onShuffleSeed} type="button">
                <RefreshCw size={17} />
                Shuffle
              </button>
            </div>
          </label>

          <label className="setup-vow-select">
            Steward’s Ledger Vow
            <select
              aria-label="Steward's Ledger Vow"
              value={declaredVowId}
              onChange={(event) => onDeclaredVowChange(event.target.value)}
            >
              <option value="">No Vow this game</option>
              {availableVows.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
            <small>
              {declaredVow
                ? declaredVow.requirement
                : `Optional · one Vow per game · ${completedLedgerCount}/50 entries complete`}
            </small>
          </label>

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
              <strong>Randomizer Seed</strong>
              <span>{encounterSeed}</span>
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

      <footer className="setup-progress-strip" aria-label="Setup progress">
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
        </div>
      </footer>
    </div>
  );
}
