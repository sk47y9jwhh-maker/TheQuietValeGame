import { isBoardTableExperience, isPlayerExperience } from "../../app/experience";
import { PaymentConsequences } from "./PaymentConsequences";
import { Check, X } from "lucide-react";
import { resourceLabels, resources } from "../../data/resources";
import {
  applyCostChoice,
  getSelectedActionCost,
  validateCostChoiceSelection
} from "../../engine/passiveCosts";
import { canAfford } from "../../engine/resources";
import type {
  CostChoiceSelection,
  GameState,
  PendingCostChoiceState,
  ResourceCost,
  ResourceType
} from "../../engine/types";
import { useEffect, useMemo, useState } from "react";

interface CostChoicePanelProps {
  state: GameState;
  pending: PendingCostChoiceState;
  onConfirm: (selection: CostChoiceSelection) => void;
  onCancel: () => void;
}

export function CostChoicePanel({
  state,
  pending,
  onConfirm,
  onCancel
}: CostChoicePanelProps) {
  const enhanced = isPlayerExperience();
  const isBurdenResolution = pending.action.type === "burden";
  const hasMarketExchange = pending.options.some(
    (option) => option.kind === "market"
  );
  const paymentPrompt = isBurdenResolution
    ? hasMarketExchange
      ? "A Merchant exchange is available below. Choose whether to use it, then confirm this payment to resolve the Burden."
      : "Confirm this payment to resolve the Burden."
    : pending.options.length > 0
      ? hasMarketExchange
        ? "A Merchant exchange is available below. Choose whether to use it before confirming this payment."
        : "Review prepared and passive effects before paying the cost."
      : "Confirm this payment before spending the action.";
  const confirmLabel = enhanced && pending.action.type === "arrival" ? "Complete Arrival"
    : enhanced && isBurdenResolution ? "Resolve Burden"
    : isBurdenResolution ? "Confirm Payment and Resolve" : "Confirm Payment";
  const defaultMarketChoices = Object.fromEntries(
    pending.options
      .filter((option) => option.kind === "market")
      .map((option) => [option.id, option.resourceChoices?.[0] ?? "wood"])
  ) as Record<string, ResourceType>;
  const defaultDiscountChoices = Object.fromEntries(
    pending.options
      .filter((option) => option.kind === "discount" && option.resourceChoices?.length)
      .map((option) => [option.id, option.resourceChoices?.[0] ?? "wood"])
  ) as Record<string, ResourceType>;
  const defaultSurchargeChoices = Object.fromEntries(
    pending.options
      .filter((option) => option.kind === "surcharge" && option.resourceChoices?.length)
      .map((option) => [option.id, option.resourceChoices?.[0] ?? "wood"])
  ) as Record<string, ResourceType>;
  const requiredIds = pending.options.filter((option) => option.required).map((option) => option.id);
  // On the board-first table, when the cost can only be met with one particular
  // Merchant exchange, start with that exchange chosen. The player can still
  // change it or turn it off before confirming.
  const covering = isBoardTableExperience() ? findCoveringExchange(state, pending, requiredIds, defaultMarketChoices, defaultDiscountChoices, defaultSurchargeChoices) : null;
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>(
    covering ? [...requiredIds, covering.optionId] : requiredIds
  );
  const [marketResourceByOptionId, setMarketResourceByOptionId] =
    useState<Record<string, ResourceType>>(covering ? { ...defaultMarketChoices, [covering.optionId]: covering.resource } : defaultMarketChoices);
  const [discountResourceByOptionId, setDiscountResourceByOptionId] =
    useState<Record<string, ResourceType>>(defaultDiscountChoices);
  const [surchargeResourceByOptionId, setSurchargeResourceByOptionId] =
    useState<Record<string, ResourceType>>(defaultSurchargeChoices);

  useEffect(() => {
    setSelectedOptionIds(covering ? [...requiredIds, covering.optionId] : requiredIds);
    setMarketResourceByOptionId(covering ? { ...defaultMarketChoices, [covering.optionId]: covering.resource } : defaultMarketChoices);
    setDiscountResourceByOptionId(defaultDiscountChoices);
    setSurchargeResourceByOptionId(defaultSurchargeChoices);
  }, [pending.id]);

  const selection = useMemo(
    () => ({
      selectedOptionIds,
      marketResourceByOptionId,
      discountResourceByOptionId,
      ...(Object.keys(surchargeResourceByOptionId).length > 0
        ? { surchargeResourceByOptionId }
        : {})
    }),
    [
      discountResourceByOptionId,
      marketResourceByOptionId,
      selectedOptionIds,
      surchargeResourceByOptionId
    ]
  );
  const adjustedCost = applyCostChoice(
    state,
    pending.baseCost,
    pending.options,
    selection
  );
  const adjustedActionCost = getSelectedActionCost(
    pending.actionCost,
    pending.options,
    selection
  );
  const flexibleOptions = enhanced ? pending.options.filter((option) =>
    option.id.startsWith("burden-flex:") && option.kind === "substitute" &&
    option.substituteFrom === "goods" && option.resourceChoices?.[0] === "food"
  ) : [];
  const flexibleIds = new Set(flexibleOptions.map((option) => option.id));
  const foodParts = flexibleOptions.filter((option) => selectedOptionIds.includes(option.id)).length;
  const canConfirm =
    validateCostChoiceSelection(pending.options, selection) &&
    canAfford(state.warehouse, adjustedCost) &&
    state.actionsRemaining >= adjustedActionCost;

  function selectExclusiveRefresh(
    current: string[],
    optionId: string
  ): string[] {
    const option = pending.options.find((candidate) => candidate.id === optionId);
    if (!option?.boonModifierId) {
      return current.includes(optionId) ? current : [...current, optionId];
    }

    return [
      ...current.filter((candidateId) => {
        const candidate = pending.options.find(
          (pendingOption) => pendingOption.id === candidateId
        );
        return candidate?.boonModifierId !== option.boonModifierId;
      }),
      optionId
    ];
  }

  function toggleOption(optionId: string) {
    if (pending.options.find((option) => option.id === optionId)?.required) return;
    setSelectedOptionIds((current) =>
      current.includes(optionId)
        ? current.filter((candidate) => candidate !== optionId)
        : selectExclusiveRefresh(current, optionId)
    );
  }

  function chooseMarketResource(optionId: string, resource: ResourceType | "") {
    if (resource) {
      setMarketResourceByOptionId((current) => ({
        ...current,
        [optionId]: resource
      }));
    }

    setSelectedOptionIds((current) => {
      if (resource) {
        return selectExclusiveRefresh(current, optionId);
      }
      if (pending.options.find((option) => option.id === optionId)?.required) {
        return current;
      }
      return current.filter((candidate) => candidate !== optionId);
    });
  }

  return (
    <section className="cost-choice-screen">
      <div className="seeding-header">
        <p className="eyebrow">{enhanced ? "Payment review" : "Payment Choice"}</p>
        <h1>{pending.title}</h1>
        <p>{paymentPrompt}</p>
      </div>

      {enhanced && <PaymentConsequences state={state} pending={pending} cost={adjustedCost} actionCost={adjustedActionCost} />}
      {enhanced ? <details className="payment-base-cost"><summary>Base resource cost</summary><CostLine label="Before payment effects" cost={pending.baseCost} /></details> : <div className="cost-summary">
        <CostLine label="Base Cost" cost={pending.baseCost} />
        <CostLine label="Adjusted Cost" cost={adjustedCost} />
        <div className="cost-line">
          <strong>Action Cost</strong>
          <span>{adjustedActionCost === 1 ? "1 Action" : `${adjustedActionCost} Actions`}</span>
        </div>
      </div>}

      {flexibleOptions.length > 0 && <section className="payment-flexible-mix" aria-label="Food and Goods payment">
        <h2>Choose your Food/Goods mix</h2>
        <p>Choose the base mix. Other payment effects apply to the total shown above.</p>
        <label>Food in this payment
          <select value={foodParts} onChange={(event) => {
            const count = Number(event.target.value);
            setSelectedOptionIds((current) => [...current.filter((id) => !flexibleIds.has(id)), ...flexibleOptions.slice(0, count).map((option) => option.id)]);
          }}>
            {Array.from({ length: flexibleOptions.length + 1 }, (_, count) => <option key={count} value={count}>{count} Food + {flexibleOptions.length - count} Goods</option>)}
          </select>
        </label>
      </section>}

      <div className="cost-option-list">
        {!enhanced && pending.options.length === 0 && (
          <article className="cost-option">
            <p>No passive payment effects are available for this action.</p>
          </article>
        )}
        {pending.options.filter((option) => !flexibleIds.has(option.id)).map((option) => {
          const selected = selectedOptionIds.includes(option.id);
          const marketResource = marketResourceByOptionId[option.id];
          return (
            <article
              className={`cost-option ${option.kind === "market" ? "market-cost-option" : ""} ${
                selected ? "selected" : ""
              }`}
              key={option.id}
            >
              {option.kind === "market" ? (
                <div className="cost-option-heading market-cost-option-heading">
                  <span>
                    <small>Merchant exchange available</small>
                    {option.sourceName}
                  </span>
                  <strong>{getOptionLabel(option)}</strong>
                </div>
              ) : (
                <button
                  aria-pressed={selected}
                  onClick={() => toggleOption(option.id)}
                  type="button"
                >
                  <span>{option.sourceName}</span>
                  <strong>{getOptionLabel(option)}</strong>
                </button>
              )}
              <p>{option.effectText}</p>
              {option.required && <small>Applies automatically.</small>}
              {option.boonModifierId && (
                <small>Carts refresh — choose at most one eligible passive.</small>
              )}
              {option.kind === "discount" &&
                option.resourceChoices?.length &&
                selected && (
                  <label>
                    Discount
                    <select
                      value={discountResourceByOptionId[option.id]}
                      onChange={(event) =>
                        setDiscountResourceByOptionId((current) => ({
                          ...current,
                          [option.id]: event.target.value as ResourceType
                        }))
                      }
                    >
                      {(option.resourceChoices ?? []).map((resource) => (
                        <option key={resource} value={resource}>
                          {resourceLabels[resource]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              {option.kind === "surcharge" &&
                option.resourceChoices?.length &&
                selected && (
                  <label>
                    Additional resource
                    <select
                      value={surchargeResourceByOptionId[option.id]}
                      onChange={(event) =>
                        setSurchargeResourceByOptionId((current) => ({
                          ...current,
                          [option.id]: event.target.value as ResourceType
                        }))
                      }
                    >
                      {(option.resourceChoices ?? []).map((resource) => (
                        <option key={resource} value={resource}>
                          {resourceLabels[resource]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              {option.kind === "market" && (
                <label className="market-exchange-control">
                  <span>Exchange 1 Goods for</span>
                  <select
                    aria-label={`${option.sourceName}: exchange 1 Goods for`}
                    value={selected ? marketResource ?? "" : ""}
                    onChange={(event) =>
                      chooseMarketResource(
                        option.id,
                        event.target.value as ResourceType | ""
                      )
                    }
                  >
                    <option disabled={option.required} value="">
                      Do not use this exchange
                    </option>
                    {(option.resourceChoices ?? []).map((resource) => (
                      <option key={resource} value={resource}>
                        {option.marketRate === 2 ? "Up to 2 " : "1 "}
                        {resourceLabels[resource]}
                      </option>
                    ))}
                  </select>
                  <small
                    aria-live="polite"
                    className={`market-exchange-status ${
                      selected ? "is-active" : ""
                    }`}
                  >
                    {selected
                      ? "Selected — the adjusted cost above includes this exchange."
                      : "Optional — choose a resource to apply the exchange."}
                  </small>
                </label>
              )}
            </article>
          );
        })}
      </div>

      {covering && selectedOptionIds.includes(covering.optionId) && marketResourceByOptionId[covering.optionId] === covering.resource && <p className="cost-covering-note" role="status">The {covering.sourceName} exchange is chosen to cover the missing {resourceLabels[covering.resource]}: 1 Goods is spent as 1 {resourceLabels[covering.resource]}. Change it above if you prefer.</p>}
      {!canConfirm && (enhanced ? <div className="failure-note" role="status">
        {!validateCostChoiceSelection(pending.options, selection) && <p>Choose a valid combination of payment effects.</p>}
        {state.actionsRemaining < adjustedActionCost && <p>Not enough actions. Review any effect that can waive the action cost, or cancel.</p>}
        {resources.filter((resource) => adjustedCost[resource] > state.warehouse[resource]).map((resource) => <p key={resource}>Need {adjustedCost[resource] - state.warehouse[resource]} more {resourceLabels[resource]}. Change the payment effects or cancel.</p>)}
      </div> : <p className="failure-note">The adjusted cost is still not payable.</p>)}

      <div className="cost-choice-actions">
        <button className="secondary-action" onClick={onCancel} type="button">
          <X size={18} />
          Cancel
        </button>
        <button
          className="primary-action"
          disabled={!canConfirm}
          onClick={() => onConfirm(selection)}
          type="button"
        >
          <Check size={18} />
          {confirmLabel}
        </button>
      </div>
    </section>
  );
}

function CostLine({ label, cost }: { label: string; cost: ResourceCost }) {
  return (
    <div className="cost-line">
      <strong>{label}</strong>
      <span>
        {resources
          .filter((resource) => cost[resource] > 0)
          .map((resource) => `${cost[resource]} ${resourceLabels[resource]}`)
          .join(", ") || "Free"}
      </span>
    </div>
  );
}

function getOptionLabel(option: PendingCostChoiceState["options"][number]): string {
  if (option.waivesAction) return "0 Actions";
  if (option.kind === "zero") return "0 resources";
  if (option.kind === "surcharge") return `+${option.amount ?? 0} resource`;
  if (option.kind === "substitute") {
    const from = option.substituteFrom
      ? resourceLabels[option.substituteFrom]
      : "resource";
    const to = option.resourceChoices?.[0]
      ? resourceLabels[option.resourceChoices[0]]
      : "resource";
    return `Use 1 ${to} instead of 1 ${from}`;
  }
  if (option.kind === "market") {
    return option.marketRate === 2
      ? "Trade 1 Goods for up to 2 resources"
      : "Trade 1 Goods for 1 resource";
  }
  return `-${option.amount ?? 0} resources`;
}

/** The single Merchant exchange that makes an otherwise unaffordable cost payable, if there is exactly one. */
function findCoveringExchange(
  state: GameState,
  pending: PendingCostChoiceState,
  requiredIds: string[],
  market: Record<string, ResourceType>,
  discount: Record<string, ResourceType>,
  surcharge: Record<string, ResourceType>
): { optionId: string; resource: ResourceType; sourceName: string } | null {
  const base = { selectedOptionIds: requiredIds, marketResourceByOptionId: market, discountResourceByOptionId: discount, ...(Object.keys(surcharge).length ? { surchargeResourceByOptionId: surcharge } : {}) };
  if (canAfford(state.warehouse, applyCostChoice(state, pending.baseCost, pending.options, base))) return null;
  const found: { optionId: string; resource: ResourceType; sourceName: string }[] = [];
  for (const option of pending.options.filter((candidate) => candidate.kind === "market")) {
    for (const resource of option.resourceChoices ?? []) {
      const selection = { ...base, selectedOptionIds: [...requiredIds, option.id], marketResourceByOptionId: { ...market, [option.id]: resource } };
      if (validateCostChoiceSelection(pending.options, selection) && canAfford(state.warehouse, applyCostChoice(state, pending.baseCost, pending.options, selection))) {
        found.push({ optionId: option.id, resource, sourceName: option.sourceName });
      }
    }
  }
  return found.length === 1 ? found[0] : null;
}
