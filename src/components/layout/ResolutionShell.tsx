import { useEffect, useRef, type ReactNode } from "react";
import { isPlayerExperience } from "../../app/experience";
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

  const playerExperience = isPlayerExperience();
  const widePlan = playerExperience && (state.pendingGoldenEffect?.kind === "signet" || Boolean(state.pendingEffects[0]?.allowTemporaryReachPlayerId));
  const encounters = <EncounterPanel state={state} onUseFaceUpBoon={onUseFaceUpBoon} onCompleteArrival={() => {}} onResolveBurden={() => {}} />;
  const titleRef = useRef<HTMLHeadingElement>(null);
  const focusKey = queueItems[0]?.id ?? state.phase;
  // The Scroll manages focus between private owners and its shared review.
  // A parent focus effect must not take focus back from that handoff on mount.
  const hasPrivateHandoff = state.pendingGoldenEffect?.kind === "scroll";
  useEffect(() => {
    if (isPlayerExperience() && !hasPrivateHandoff) titleRef.current?.focus();
  }, [focusKey, hasPrivateHandoff]);

  const queueContent = (
    <div className="resolution-queue-list">
      {queueItems.length === 0 ? (
        <p className="muted">No pending effects.</p>
      ) : queueItems.map((item, index) => (
        <article
          className={`resolution-queue-item ${index === 0 ? "active" : ""}`}
          key={item.id}
        >
          <span>{index === 0 ? "Now" : `Next ${index}`}</span>
          <strong>{item.title}</strong>
          <small>{item.source}</small>
        </article>
      ))}
    </div>
  );

  return (
    <div className="app-shell resolution-shell">
      <TopBar
        state={state}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
        onReset={onReset}
      />
      <main className={`command-table resolution-table ${playerExperience ? "resolution-focus-table" : ""} ${widePlan ? "resolution-plan-table" : ""}`}>
        <section className="action-console resolution-context-panel">
          <div className="turn-summary">
            <div>
              <p className="eyebrow">{eyebrow}</p>
              <h2 ref={titleRef} tabIndex={-1}>{title}</h2>
            </div>
            <strong>
              {queueItems.length} step{queueItems.length === 1 ? "" : "s"}
            </strong>
          </div>

          {!playerExperience && <div className="detail-stack resolution-summary-card">
            <strong>{queueItems[0]?.title ?? title}</strong>
            <p>{detail}</p>
          </div>}

          {playerExperience ? (
            <details className="resolution-references" key={`references_${focusKey}`}>
              <summary>Table references</summary>
              <details className="resolution-queue-preview">
                <summary>View resolution order ({queueItems.length} {queueItems.length === 1 ? "step" : "steps"})</summary>
                {queueContent}
              </details>
              <details className="resolution-encounter-review"><summary>Review active encounters</summary>{encounters}</details>
              <details className="resolution-step-help"><summary>Help with this step</summary><p>{detail}</p></details>
            </details>
          ) : (
            <section className="resolution-queue"><p className="eyebrow">Resolution Queue</p>{queueContent}</section>
          )}
        </section>

        <section className="map-panel resolution-board">{children}</section>

        {!playerExperience && encounters}
      </main>
    </div>
  );
}
