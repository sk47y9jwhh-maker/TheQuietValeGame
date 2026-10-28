import { useMemo, useState } from "react";
import { targetCardById, targetCardFilterLabels } from "../../data/targetCards";
import { getValidEffectStrainTargets } from "../../engine/manualEffects";
import { selectTileName } from "../../engine/selectors";
import { traceTargetSelection, type TargetSelectionTrace } from "../../engine/targetCards";
import type { GameState, PendingEffectState, TargetCardSelectionDiagnostic } from "../../engine/types";
import { useBoardChoices } from "./boardChoices";

interface Step { caption: string; tileIds: string[]; final?: boolean }

const directionNames: Record<string, string> = { NE: "north-east", E: "east", SE: "south-east", SW: "south-west", W: "west", NW: "north-west" };

/**
 * Rebuilds the draw for one target from the effect's own pool and checks it
 * against the recorded result. Only an exact match is shown, so the
 * walkthrough can never disagree with what the engine did.
 */
function rebuild(state: GameState, effect: PendingEffectState, diagnostics: TargetCardSelectionDiagnostic[], index: number): TargetSelectionTrace | null {
  const diagnostic = diagnostics[index];
  const card = targetCardById[diagnostic.cardId];
  if (!card || diagnostic.manualChoice || diagnostic.role === "spread") return null;
  const sourceTile = effect.sourceType === "tile" && effect.sourceId ? state.map.placedTiles.find((tile) => tile.instanceId === effect.sourceId) : undefined;
  const taken = new Set(diagnostics.slice(0, index).map((earlier) => earlier.selectedTileId));
  const pool = getValidEffectStrainTargets(state, effect.ruleId, sourceTile).filter((tile) => !taken.has(tile.instanceId));
  const trace = traceTargetSelection(state, pool, card);
  if (!trace || trace.selected !== diagnostic.selectedTileId || trace.eligible.length !== diagnostic.originalEligibleCount) return null;
  const countsMatch = diagnostic.filters.every((filter, position) => trace.filters[position]?.remaining.length === filter.afterCount);
  return countsMatch ? trace : null;
}

function stepsFor(state: GameState, trace: TargetSelectionTrace, diagnostic: TargetCardSelectionDiagnostic): Step[] {
  const card = targetCardById[diagnostic.cardId];
  const name = (id: string) => { const tile = state.map.placedTiles.find((candidate) => candidate.instanceId === id); return tile ? `${selectTileName(tile)} (${tile.hexIds.join(", ")})` : id; };
  const steps: Step[] = [{ caption: `Card ${String(diagnostic.cardId).padStart(2, "0")} is drawn. ${trace.eligible.length} tile${trace.eligible.length === 1 ? " is" : "s are"} eligible for this effect.`, tileIds: trace.eligible }];
  let before = trace.eligible.length;
  for (const filter of trace.filters) {
    if (filter.any) continue;
    const label = targetCardFilterLabels[filter.filter];
    steps.push({
      caption: filter.applied
        ? `${label}: ${filter.preference}. ${before === filter.remaining.length ? `All ${before} match, so none drop out.` : `${before} → ${filter.remaining.length}.`}`
        : `${label}: ${filter.preference}. No eligible tile matches, so this preference is skipped.`,
      tileIds: filter.remaining
    });
    before = filter.remaining.length;
  }
  if (before > 1 && card?.direction) {
    steps.push({
      caption: trace.tied.length > 1
        ? `Still ${before} tied. The furthest ${directionNames[card.direction] ?? card.direction} leaves ${trace.tied.length}, so map order decides.`
        : `Still ${before} tied. The tile furthest ${directionNames[card.direction] ?? card.direction} wins.`,
      tileIds: trace.tied
    });
  }
  steps.push({ caption: `${name(trace.selected)} is chosen${diagnostic.plannedStrain ? ` for +${diagnostic.plannedStrain} Strain` : ""}.`, tileIds: [trace.selected], final: true });
  return steps;
}

export function TargetCardStepper({ state, effect, index }: { state: GameState; effect: PendingEffectState; index: number }) {
  const diagnostics = effect.targetCardDiagnostics ?? [];
  const diagnostic = diagnostics[index];
  const trace = useMemo(() => diagnostic ? rebuild(state, effect, diagnostics, index) : null, [diagnostic, diagnostics, effect, index, state]);
  const steps = useMemo(() => trace && diagnostic ? stepsFor(state, trace, diagnostic) : [], [diagnostic, state, trace]);
  const [step, setStep] = useState<number | null>(null);
  const current = step === null ? null : steps[step];
  useBoardChoices(`focus:target_${diagnostic?.id ?? index}`, current ? current.tileIds.flatMap((tileId) => {
    const tile = state.map.placedTiles.find((candidate) => candidate.instanceId === tileId);
    return tile ? [{ key: tileId, hexIds: tile.hexIds, label: current.final ? "Chosen by the Target Card" : "Still in the running", selected: Boolean(current.final), badge: current.final ? (diagnostic?.plannedStrain ? `+${diagnostic.plannedStrain}` : "◎") : undefined, fixed: true, onTap: () => {} }] : [];
  }) : []);
  if (steps.length < 2) return null;
  if (!current || step === null) return <button type="button" className="target-step-open" onClick={() => setStep(0)}>Watch the card choose on the board</button>;
  return <div className="target-stepper" role="group" aria-label="How the Target Card chose">
    <p aria-live="polite"><span>Step {step + 1} of {steps.length}</span>{current.caption}</p>
    <div>
      <button type="button" onClick={() => setStep(step === 0 ? null : step - 1)}>{step === 0 ? "Close" : "Back"}</button>
      {step < steps.length - 1
        ? <button type="button" className="is-primary" onClick={() => setStep(step + 1)}>Next</button>
        : <button type="button" className="is-primary" onClick={() => setStep(null)}>Done</button>}
    </div>
  </div>;
}
