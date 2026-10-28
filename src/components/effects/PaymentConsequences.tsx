import { ArrowRight, CheckCircle2, PackageOpen } from "lucide-react";
import { encounterById } from "../../data/encounters";
import { resourceLabels, resources } from "../../data/resources";
import { specialTileById } from "../../data/tiles";
import type { GameState, PendingCostChoiceState, ResourceCost } from "../../engine/types";

interface PaymentConsequencesProps {
  state: GameState;
  pending: PendingCostChoiceState;
  cost: ResourceCost;
  actionCost: number;
}

export function PaymentConsequences({ state, pending, cost, actionCost }: PaymentConsequencesProps) {
  const changed = resources.filter((resource) => cost[resource] > 0);
  const card = pending.action.cardId ? encounterById[pending.action.cardId] : undefined;
  const actionsAfter = state.actionsRemaining - actionCost;

  return (
    <section className="payment-consequences" aria-label="Payment preview">
      <header>
        <p className="eyebrow">Before you confirm</p>
        <h2>{actionCost === 0 ? "No action spent" : `${actionCost} ${actionCost === 1 ? "action" : "actions"}`}</h2>
        <p>{actionsAfter >= 0
          ? `${state.actionsRemaining} available → ${actionsAfter} remaining`
          : `Need ${-actionsAfter} more ${actionsAfter === -1 ? "action" : "actions"}`}</p>
      </header>

      {changed.length > 0 ? (
        <dl className="payment-resource-changes" aria-live="polite" aria-atomic="true">
          {changed.map((resource) => {
            const before = state.warehouse[resource];
            const after = before - cost[resource];
            return (
              <div key={resource} className={after < 0 ? "payment-shortfall" : ""}>
                <dt>{resourceLabels[resource]}<small>Pay {cost[resource]}</small></dt>
                <dd>
                  <span><span className="payment-sr">Available: </span>{before}</span>
                  <ArrowRight size={16} aria-hidden="true" />
                  <strong>{after >= 0
                    ? <><span className="payment-sr">After payment: </span>{after}</>
                    : `Need ${-after} more`}</strong>
                </dd>
              </div>
            );
          })}
        </dl>
      ) : <p className="payment-free">No resources spent.</p>}

      {card?.type === "arrival" && (
        <div className="payment-outcome">
          <h3><PackageOpen size={18} aria-hidden="true" />Complete {card.name}</h3>
          <p>This Arrival leaves the active row.</p>
          <ul>{card.rewardSpecialTileIds.map((id) => (
            <li key={id}>Add 1 {specialTileById[id]?.name ?? "Special Tile"} to the available supply.</li>
          ))}</ul>
          <p>Building an unlocked tile is a separate action with its own placement rules and cost.</p>
        </div>
      )}
      {card?.type === "burden" && (
        <div className="payment-outcome">
          <h3><CheckCircle2 size={18} aria-hidden="true" />Resolve {card.name}</h3>
          <p>Discard this active Burden. Earlier Strain stays unless another effect removes it. Any triggered effects follow after payment.</p>
        </div>
      )}
      <p className="payment-commit-note">Nothing is spent until you confirm. Cancel keeps your actions, resources and payment effects.</p>
    </section>
  );
}
