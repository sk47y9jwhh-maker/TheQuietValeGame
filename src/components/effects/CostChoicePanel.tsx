import { Check, X } from "lucide-react";
import { resourceLabels, resources } from "../../data/resources";
import { applyCostChoice } from "../../engine/passiveCosts";
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
  const confirmLabel = isBurdenResolution
    ? "Confirm Payment and Resolve"
    : "Confirm Payment";
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
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>(
    pending.options.filter((option) => option.required).map((option) => option.id)
  );
  const [marketResourceByOptionId, setMarketResourceByOptionId] =
    useState<Record<string, ResourceType>>(defaultMarketChoices);
  const [discountResourceByOptionId, setDiscountResourceByOptionId] =
    useState<Record<string, ResourceType>>(defaultDiscountChoices);

  useEffect(() => {
    setSelectedOptionIds(
      pending.options.filter((option) => option.required).map((option) => option.id)
    );
    setMarketResourceByOptionId(defaultMarketChoices);
    setDiscountResourceByOptionId(defaultDiscountChoices);
  }, [pending.id]);

  const selection = useMemo(
    () => ({
      selectedOptionIds,
      marketResourceByOptionId,
      discountResourceByOptionId
    }),
    [discountResourceByOptionId, marketResourceByOptionId, selectedOptionIds]
  );
  const adjustedCost = applyCostChoice(
    state,
    pending.baseCost,
    pending.options,
    selection
  );
  const canConfirm = canAfford(state.warehouse, adjustedCost);

  function toggleOption(optionId: string) {
    if (pending.options.find((option) => option.id === optionId)?.required) return;
    setSelectedOptionIds((current) =>
      current.includes(optionId)
        ? current.filter((candidate) => candidate !== optionId)
        : [...current, optionId]
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
        return current.includes(optionId) ? current : [...current, optionId];
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
        <p className="eyebrow">Payment Choice</p>
        <h1>{pending.title}</h1>
        <p>{paymentPrompt}</p>
      </div>

      <div className="cost-summary">
        <CostLine label="Base Cost" cost={pending.baseCost} />
        <CostLine label="Adjusted Cost" cost={adjustedCost} />
      </div>

      <div className="cost-option-list">
        {pending.options.length === 0 && (
          <article className="cost-option">
            <p>No passive payment effects are available for this action.</p>
          </article>
        )}
        {pending.options.map((option) => {
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
              {option.required && <small>Required prepared effect.</small>}
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

      {!canConfirm && (
        <p className="failure-note">The adjusted cost is still not payable.</p>
      )}

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
  if (option.kind === "zero") return "0 resources";
  if (option.kind === "market") {
    return option.marketRate === 2
      ? "Trade 1 Goods for up to 2 resources"
      : "Trade 1 Goods for 1 resource";
  }
  return `-${option.amount ?? 0} resources`;
}
