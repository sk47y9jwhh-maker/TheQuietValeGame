import { AlertTriangle, CalendarDays, Package, UserRound } from "lucide-react";
import { resourceLabels, resources } from "../../data/resources";
import { stewardById } from "../../data/stewards";
import { selectAlerts, selectCurrentPlayer } from "../../engine/selectors";
import type { GameState } from "../../engine/types";
import { BrandMark } from "../common/BrandMark";

interface TopBarProps {
  state: GameState;
}

export function TopBar({ state }: TopBarProps) {
  const currentPlayer = selectCurrentPlayer(state);
  const steward = stewardById[currentPlayer.stewardId];
  const alerts = selectAlerts(state);
  const hasAlerts = alerts.length > 0;

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
      <button className={`alerts-chip ${hasAlerts ? "has-alerts" : ""}`} type="button">
        <AlertTriangle size={18} />
        {alerts.length ? alerts.join(" / ") : "No urgent alerts"}
      </button>
    </header>
  );
}
