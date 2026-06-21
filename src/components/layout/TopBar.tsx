import {
  CalendarDays,
  ListChecks,
  Package,
  Redo2,
  RotateCcw,
  Undo2,
  UserRound
} from "lucide-react";
import { resourceLabels, resources } from "../../data/resources";
import { stewardById } from "../../data/stewards";
import { selectAlerts, selectCurrentPlayer } from "../../engine/selectors";
import type { GameState } from "../../engine/types";
import { BrandMark } from "../common/BrandMark";

interface TopBarProps {
  state: GameState;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onReset?: () => void;
}

export function TopBar({
  state,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onReset
}: TopBarProps) {
  const currentPlayer = selectCurrentPlayer(state);
  const steward = stewardById[currentPlayer.stewardId];
  const alerts = selectAlerts(state);
  const hasAlerts = alerts.length > 0;
  const statusDetails = hasAlerts
    ? `Board status: ${alerts.join(" / ")}`
    : "Board status: all clear";
  const statusSummary = hasAlerts
    ? alerts.length > 1
      ? `${alerts.length} to watch`
      : alerts[0]
    : "All clear";

  return (
    <header className="top-bar">
      <div className="top-brand">
        <BrandMark />
        <div>
          <strong>The Quiet Vale</strong>
          <span>Stewards board</span>
        </div>
      </div>
      <div className="season-card">
        <CalendarDays size={18} />
        <div className="season-metrics">
          <span>
            <small>Season</small>
            <strong>{state.season}</strong>
          </span>
          <span>
            <small>Round</small>
            <strong>{state.round}/12</strong>
          </span>
        </div>
      </div>
      <div className="turn-chip">
        <UserRound size={18} />
        <div>
          <span>{steward.name}</span>
          <strong>{state.actionsRemaining} Actions</strong>
        </div>
      </div>
      <div className="warehouse-strip" aria-label="Warehouse resources">
        <span className="warehouse-title">
          <Package size={18} />
          Warehouse
        </span>
        {resources.map((resource) => (
          <span className="resource-pill" key={resource}>
            <small>{resourceLabels[resource]}</small>
            <strong>{state.warehouse[resource]}</strong>
          </span>
        ))}
      </div>
      <div className="top-actions" aria-label="Game controls">
        <button
          aria-label="Undo last game step"
          disabled={!canUndo}
          onClick={onUndo}
          title={canUndo ? "Undo last game step" : "Nothing to undo"}
          type="button"
        >
          <Undo2 size={17} />
        </button>
        <button
          aria-label="Redo undone game step"
          disabled={!canRedo}
          onClick={onRedo}
          title={canRedo ? "Redo undone game step" : "Nothing to redo"}
          type="button"
        >
          <Redo2 size={17} />
        </button>
        <button
          aria-label="Reset game"
          onClick={onReset}
          title="Reset game"
          type="button"
        >
          <RotateCcw size={17} />
        </button>
      </div>
      <button
        aria-label={statusDetails}
        className={`alerts-chip status-chip ${hasAlerts ? "has-status" : "is-stable"}`}
        title={statusDetails}
        type="button"
      >
        <ListChecks size={18} />
        <span className="status-label">Status</span>
        <span className="alerts-summary">{statusSummary}</span>
      </button>
    </header>
  );
}
