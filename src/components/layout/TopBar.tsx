import {
  CalendarDays,
  Maximize2,
  Minimize2,
  Package,
  Redo2,
  RotateCcw,
  Undo2,
  UserRound
} from "lucide-react";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { resourceLabels, resources, warehouseCap } from "../../data/resources";
import { stewardById } from "../../data/stewards";
import { selectCurrentPlayer } from "../../engine/selectors";
import type { GameState } from "../../engine/types";
import { BrandMark } from "../common/BrandMark";

type ResourceFillStyle = CSSProperties & { "--resource-fill": string };
type BrowserFullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
};
type BrowserFullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

interface TopBarProps {
  state: GameState;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onReset?: () => void;
}

function getResourceFillStyle(value: number): ResourceFillStyle {
  const fill = Math.max(0, Math.min(100, (value / warehouseCap) * 100));
  return { "--resource-fill": `${fill}%` };
}

function getCompactPlayerName(name: string): string {
  return name.replace(/^Player\s+/i, "P");
}

function getFullscreenElement(): Element | null {
  const fullscreenDocument = document as BrowserFullscreenDocument;
  return document.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement ?? null;
}

function getFullscreenSupported(): boolean {
  const fullscreenDocument = document as BrowserFullscreenDocument;
  const fullscreenElement = document.documentElement as BrowserFullscreenElement;
  return Boolean(
    document.fullscreenEnabled ||
      fullscreenDocument.webkitFullscreenEnabled ||
      fullscreenElement.requestFullscreen ||
      fullscreenElement.webkitRequestFullscreen
  );
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
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function syncFullscreenState() {
      setFullscreenSupported(getFullscreenSupported());
      setIsFullscreen(Boolean(getFullscreenElement()));
    }

    syncFullscreenState();
    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener("webkitfullscreenchange", syncFullscreenState);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.removeEventListener("webkitfullscreenchange", syncFullscreenState);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const fullscreenDocument = document as BrowserFullscreenDocument;
    const fullscreenElement = document.documentElement as BrowserFullscreenElement;

    try {
      if (getFullscreenElement()) {
        const exitFullscreen =
          document.exitFullscreen?.bind(document) ??
          fullscreenDocument.webkitExitFullscreen?.bind(fullscreenDocument);
        await exitFullscreen?.();
        return;
      }

      const requestFullscreen =
        fullscreenElement.requestFullscreen?.bind(fullscreenElement) ??
        fullscreenElement.webkitRequestFullscreen?.bind(fullscreenElement);
      await requestFullscreen?.();
    } catch (error) {
      console.warn("Fullscreen request was blocked by the browser.", error);
    }
  }, []);

  return (
    <header className="top-bar">
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
          <span>
            {getCompactPlayerName(currentPlayer.name)} / {steward.name}
          </span>
          <strong>{state.actionsRemaining} Actions</strong>
        </div>
      </div>
      <div className="warehouse-strip" aria-label="Warehouse resources">
        <span className="warehouse-title">
          <Package size={18} />
          Warehouse
        </span>
        {resources.map((resource) => (
          <span
            className="resource-pill"
            data-resource={resource}
            key={resource}
            style={getResourceFillStyle(state.warehouse[resource])}
          >
            <small>{resourceLabels[resource]}</small>
            <strong>{state.warehouse[resource]}</strong>
            <span className="resource-fill" aria-hidden="true" />
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
        <button
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          disabled={!fullscreenSupported}
          onClick={toggleFullscreen}
          title={
            fullscreenSupported
              ? isFullscreen
                ? "Exit fullscreen"
                : "Enter fullscreen"
              : "Fullscreen is not available in this browser"
          }
          type="button"
        >
          {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
        </button>
      </div>
    </header>
  );
}
