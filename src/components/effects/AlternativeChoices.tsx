import { resourceLabels, resources } from "../../data/resources";
import type { AlternativeEffectRule } from "../../engine/manualEffects";
import type { EffectAdjustment, GameState, ResourceType } from "../../engine/types";

type MixedAlternative = Extract<AlternativeEffectRule, { kind: "pay_or_strain" | "pay_or_timer" }>;

export function AlternativeChoices({ state, rule, adjustment, suggested, onReplace }: {
  state: GameState; rule: MixedAlternative; adjustment: EffectAdjustment;
  suggested?: EffectAdjustment; onReplace: (adjustment: EffectAdjustment) => void;
}) {
  if (rule.requiredChoices === 0) return null;
  const payment = rule.resourceStep * rule.requiredChoices;
  const spent = rule.resources.reduce((total, resource) => total + Math.max(0, -(adjustment.resourceDeltas?.[resource] ?? 0)), 0);
  const targetCount = rule.kind === "pay_or_strain"
    ? Object.values(adjustment.tileStrainDeltas ?? {}).reduce((total, delta) => total + Math.max(0, delta), 0) / rule.strainPerChoice
    : Object.values(adjustment.arrivalTimerDeltas ?? {}).reduce((total, delta) => total + Math.max(0, -delta), 0) / rule.timerPerChoice;
  const chosen = spent / rule.resourceStep + targetCount;
  const suggestedTargets = rule.kind === "pay_or_strain" ? suggested?.tileStrainDeltas : suggested?.arrivalTimerDeltas;
  const hasSuggested = Object.values(suggestedTargets ?? {}).some((delta) => delta !== 0);
  const alternative = rule.kind === "pay_or_strain" ? "Strain" : "timer loss";
  function paymentSelected(resource: ResourceType) {
    return resources.every((candidate) => (adjustment.resourceDeltas?.[candidate] ?? 0) === (candidate === resource ? -payment : 0)) && targetCount === 0;
  }
  return <section className="alternative-choices" aria-label="Payment alternatives">
    <h3>Choose how to resolve</h3>
    <p>{rule.requiredChoices === 1 ? `Pay resources or use the eligible ${alternative} outcome.` : `Choose ${rule.requiredChoices} outcomes. You can combine payments and ${alternative} using the controls below.`} These shortcuts replace the current choices. Nothing is applied yet.</p>
    <div className="alternative-shortcuts">
      {rule.resources.map((resource) => <button type="button" key={resource} disabled={state.warehouse[resource] < payment} aria-pressed={paymentSelected(resource)} onClick={() => onReplace({ resourceDeltas: { [resource]: -payment } })}>
        Pay {payment} {resourceLabels[resource]}<small>{state.warehouse[resource] < payment ? `Need ${payment - state.warehouse[resource]} more` : rule.requiredChoices > 1 ? "Covers every outcome" : "No " + alternative}</small>
      </button>)}
      {hasSuggested && <button type="button" onClick={() => onReplace(rule.kind === "pay_or_strain" ? { tileStrainDeltas: suggestedTargets } : { arrivalTimerDeltas: suggestedTargets })}>Restore suggested {alternative}</button>}
      <button type="button" disabled={chosen === 0} onClick={() => onReplace({})}>Clear choices</button>
    </div>
    {chosen > rule.requiredChoices && <p className="alternative-over-budget" role="status">Too many outcomes selected. Reduce a payment or {alternative} choice, or use a replacement shortcut.</p>}
  </section>;
}
