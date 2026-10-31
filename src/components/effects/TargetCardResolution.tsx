import { isBoardTableExperience, isPlayerExperience } from "../../app/experience";
import { TargetCardStepper } from "../table/TargetCardStepper";
import { targetCardById, targetCardFilterLabels, targetCardRulesText } from "../../data/targetCards";
import { selectTileName } from "../../engine/selectors";
import type { GameState, PendingEffectState, TargetCardSelectionDiagnostic } from "../../engine/types";
import { useState } from "react";
import { TargetCard } from "../common/TargetCard";
import { FlipCard } from "../cards/PokerCard";

type Diagnostic = TargetCardSelectionDiagnostic;

function targetLabel(diagnostic: Diagnostic, index: number) {
  return diagnostic.role === "primary" ? "Primary target" : diagnostic.role === "spread" ? "Linked target" : `Target ${index + 1}`;
}

function TargetNotes({ diagnostic, conditional = false }: { diagnostic: Diagnostic; conditional?: boolean }) {
  return <>
    {diagnostic.manualChoice && conditional && <p>Choose any eligible tile from the triggering effect’s current pool using this effect’s controls.</p>}
    {diagnostic.supportedWillPrevent && <small className="target-card-prevention">{conditional ? "If Strain is placed here, Supported prevents 1 after selection." : "Supported will prevent 1 Strain after selection."}</small>}
    {diagnostic.goldenGardenWillPrevent && <small className="target-card-prevention">{conditional ? "If Strain is placed here, the Golden Garden prevents 1 after selection." : "The Golden Garden will prevent 1 Strain after selection."}</small>}
    {diagnostic.printedFallbackUsed && conditional && <small>The effect’s printed fallback supplied this eligible pool.</small>}
    {diagnostic.alternatePrimaryWouldComplete && <small className="target-card-warning">Another primary could have completed every linked target. The card-selected primary is retained.</small>}
  </>;
}

function TargetTrace({ state, diagnostic, index, enhanced, revealKey }: {
  state: GameState; diagnostic: Diagnostic; index: number; enhanced: boolean; revealKey?: number;
}) {
  const card = targetCardById[diagnostic.cardId];
  const selectedTile = state.map.placedTiles.find(tile => tile.instanceId === diagnostic.selectedTileId);
  return <>
    {card && (revealKey === undefined
      ? <TargetCard card={card} />
      : <FlipCard kind="target" revealKey={`${card.id}-${revealKey}`} className="target-card-flip" sizes="280px"><TargetCard card={card} sizes="280px" /></FlipCard>)}
    <div className="target-card-runtime">
      <div className="target-card-diagnostic-heading">
        <strong>{targetLabel(diagnostic, index)}</strong>
        <span>{diagnostic.manualChoice ? "Open target" : diagnostic.direction ? `${diagnostic.direction} tie direction` : `Card ${diagnostic.cardId}`}</span>
      </div>
      <ol className="target-card-filter-results">
        {diagnostic.filters.map(filter => {
          const anyPreference = filter.preference === "Any";
          return <li className={anyPreference ? "neutral" : filter.applied ? "applied" : "ignored"} key={filter.filter}>
            <span>{targetCardFilterLabels[filter.filter]}: {filter.preference}</span>
            <strong>{anyPreference ? "Any" : filter.applied ? "Applied" : "Ignored"}</strong>
            <small>{filter.beforeCount} → {filter.afterCount} tiles</small>
          </li>;
        })}
      </ol>
      <div className="target-card-selection-result">
        {diagnostic.manualChoice ? <strong>Choose any eligible tile from the triggering effect’s current pool.</strong> : <>
          <strong>Selected: {selectedTile ? selectTileName(selectedTile) : diagnostic.selectedTileId}</strong>
          <span>{diagnostic.selectedHexIds.join(", ")}</span>
        </>}
        {diagnostic.plannedStrain !== undefined && diagnostic.plannedStrain > 0 && <span>{enhanced ? "Draw suggests" : "Receives"} {diagnostic.plannedStrain} Strain</span>}
        <small>
          Started with {diagnostic.originalEligibleCount} eligible tile{diagnostic.originalEligibleCount === 1 ? "" : "s"}. {diagnostic.directionRequired
            ? `The tie direction was required and left ${diagnostic.directionCandidateCount}.`
            : diagnostic.manualChoice ? "The card does not narrow or widen that eligible pool." : "The tie direction was not required."}
          {diagnostic.coordinateFallbackUsed ? " Map-coordinate fallback resolved the exact tie." : ""}
          {diagnostic.printedFallbackUsed ? " The effect’s printed fallback supplied this eligible pool." : ""}
        </small>
        {!enhanced && <TargetNotes diagnostic={diagnostic} />}
      </div>
    </div>
  </>;
}

export function TargetCardResolution({ state, effect }: { state: GameState; effect: PendingEffectState }) {
  // Each opening of a draw's explanation turns its card over from the silver back.
  const [openings, setOpenings] = useState<Record<string, number>>({});
  if (!effect.targetCardPrepared) return null;
  const enhanced = isPlayerExperience();
  const diagnostics = effect.targetCardDiagnostics ?? [];
  // Nothing was drawn: one quiet line instead of a whole panel.
  if (enhanced && !diagnostics.length) return <p className="target-draw-none">No tile can take Strain from this, so no Target Card is drawn.</p>;
  return (
    <section className={`target-card-resolution ${enhanced ? "target-draw-review" : ""}`} aria-label="Target Card resolution">
      <div className="target-card-resolution-heading">
        <div>
          <p className="eyebrow">{effect.targetCardManualChoice ? "Player targeting" : "Automatic targeting"}</p>
          <h3>{enhanced ? "Targets from the draw" : "Target Card result"}</h3>
        </div>
        <span>{diagnostics.length} card{diagnostics.length === 1 ? "" : "s"} drawn</span>
      </div>
      {diagnostics.length ? (
        <div className={enhanced ? "target-draw-list" : "target-card-diagnostic-list"}>
          {diagnostics.map((diagnostic, index) => {
            if (!enhanced) return <article className="target-card-diagnostic" key={diagnostic.id}><TargetTrace state={state} diagnostic={diagnostic} index={index} enhanced={false} /></article>;
            const tile = state.map.placedTiles.find(tile => tile.instanceId === diagnostic.selectedTileId);
            return (
              <article className="target-draw" key={diagnostic.id}>
                <details onToggle={(event) => { if (event.currentTarget.open) setOpenings((count) => ({ ...count, [diagnostic.id]: (count[diagnostic.id] ?? 0) + 1 })); }}>
                  <summary>
                    <span className="target-draw-summary">
                      <span className="target-draw-position">{targetLabel(diagnostic, index)}</span>
                      <strong>{diagnostic.manualChoice ? "Open: choose a tile" : `${tile ? selectTileName(tile) : diagnostic.selectedTileId}, ${diagnostic.selectedHexIds.join(", ")}`}</strong>
                      {diagnostic.plannedStrain !== undefined && diagnostic.plannedStrain > 0 && <span className="target-draw-strain">Draw suggests +{diagnostic.plannedStrain} Strain</span>}
                      <span className="target-draw-explain">Why card {String(diagnostic.cardId).padStart(2, "0")}</span>
                    </span>
                  </summary>
                  <div className="target-draw-explanation"><TargetTrace state={state} diagnostic={diagnostic} index={index} enhanced revealKey={openings[diagnostic.id] ?? 0} /></div>
                </details>
                <div className="target-draw-notes"><TargetNotes diagnostic={diagnostic} conditional />{isBoardTableExperience() && <TargetCardStepper state={state} effect={effect} index={index} />}</div>
              </article>
            );
          })}
        </div>
      ) : <p className="muted">No eligible Strain target was available, so no Target Card was drawn.</p>}
      {enhanced && diagnostics.length > 0 && <p className="target-draw-caution">{effect.targetCardManualChoice ? "An Open card needs your choice from the eligible tiles. Check the effect preview before confirming." : "The draw selected these targets. Payments or prevention can change the outcome. Check the effect preview before confirming."}</p>}
      <details className="target-card-rules"><summary>How Target Cards work</summary><p>{targetCardRulesText}</p></details>
    </section>
  );
}
