import type { ReactNode } from "react";
import type { GameState } from "../../engine/types";
import { EncounterPanel } from "../panels/EncounterPanel";
import { TopBar } from "./TopBar";

interface ResolutionShellProps {
  state: GameState;
  eyebrow: string;
  title: string;
  detail: string;
  children: ReactNode;
  onUseFaceUpBoon: (boonCardId: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
}

export function ResolutionShell({
  state,
  eyebrow,
  title,
  detail,
  children,
  onUseFaceUpBoon,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onReset
}: ResolutionShellProps) {
  const queueItems = [
    ...(state.pendingGoldenEffect
      ? [{
          id: `golden_${state.pendingGoldenEffect.cardId}`,
          title: "Resolve Golden Boon",
          source: "Golden Legacy"
        }]
      : []),
    ...(state.pendingDeckReorder
      ? [{
          id: state.pendingDeckReorder.id,
          title: state.pendingDeckReorder.title,
          source: "Deck order"
        }]
      : []),
    ...(state.pendingCostChoice
      ? [{
          id: state.pendingCostChoice.id,
          title: state.pendingCostChoice.title,
          source: "Payment"
        }]
      : []),
    ...state.pendingEffects.map((effect) => ({
      id: effect.id,
      title: effect.title,
      source: effect.sourceName
    }))
  ];

  return (
    <div className="app-shell">
      <TopBar
        state={state}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
        onReset={onReset}
      />
      <main className="command-table resolution-table">
        <section className="action-console resolution-context-panel">
          <div className="turn-summary">
            <div>
              <p className="eyebrow">{eyebrow}</p>
              <h2>{title}</h2>
            </div>
            <strong>
              {queueItems.length} step{queueItems.length === 1 ? "" : "s"}
            </strong>
          </div>

          <div className="detail-stack resolution-summary-card">
            <strong>{queueItems[0]?.title ?? title}</strong>
            <p>{detail}</p>
          </div>

          <section className="resolution-queue">
            <p className="eyebrow">Resolution Queue</p>
            <div className="resolution-queue-list">
              {queueItems.length === 0 ? (
                <p className="muted">No pending effects.</p>
              ) : (
                queueItems.map((item, index) => (
                  <article
                    className={`resolution-queue-item ${index === 0 ? "active" : ""}`}
                    key={item.id}
                  >
                    <span>{index === 0 ? "Now" : `Next ${index}`}</span>
                    <strong>{item.title}</strong>
                    <small>{item.source}</small>
                  </article>
                ))
              )}
            </div>
          </section>
        </section>

        <section className="map-panel resolution-board">{children}</section>

        <EncounterPanel
          state={state}
          onUseFaceUpBoon={onUseFaceUpBoon}
          onCompleteArrival={() => {}}
          onResolveBurden={() => {}}
        />
      </main>
    </div>
  );
}
