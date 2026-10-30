import { isBoardTableExperience } from "../../app/experience";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, CheckCircle2 } from "lucide-react";
import { encounterById } from "../../data/encounters";
import { validateSeedingSelection } from "../../engine/gameActions";
import { selectCurrentPlayer } from "../../engine/selectors";
import type { EncounterData, GameState, Season } from "../../engine/types";
import { EncounterCard } from "../common/EncounterCard";
import { PrivateHandGate } from "../common/PrivateHandGate";
import { getArrivalRewardText, getBoonLifecycleText, getBurdenResolutionCurrentText, getEncounterTypeLabel, getSeasonText } from "../common/gameText";

type Slot = "top" | "middle" | "bottom";
type Selection = Record<Slot, string>;
const slots: Slot[] = ["top", "middle", "bottom"];
const labels = { top: "Top", middle: "Middle", bottom: "Bottom" };
const positions = { top: "Added to the front of the remaining deck.", middle: "Inserted into the centre of the remaining deck.", bottom: "Added after the remaining cards." };
const numerals = ["I", "II", "III"];
interface Props { state: GameState; onConfirm: (selection: Selection) => void }

export function TableSeeding(props: Props) {
  return <TableHand key={`${props.state.season}:${props.state.currentPlayerId}`} {...props} />;
}

function CardSummary({ card, season }: { card: EncounterData; season: Season }) {
  const effect = card.type === "arrival" ? card.requirementText : card.type === "goldenBoon" ? card.effectText : getSeasonText(card.effects, season);
  const detail = card.type === "arrival" ? getArrivalRewardText(card) : card.type === "boon" ? getBoonLifecycleText(card, season) : getBurdenResolutionCurrentText(card, season);
  return <div className="table-seed-effect"><p>{effect}</p>{detail && <small>{detail}</small>}</div>;
}

function TableHand({ state, onConfirm }: Props) {
  const onBoardTable = isBoardTableExperience();
  const player = selectCurrentPlayer(state);
  const hand = state.encounters.handsByPlayerId[player.id] ?? [];
  const [selection, setSelection] = useState<Selection>({ top: "", middle: "", bottom: "" });
  const [activeSlot, setActiveSlot] = useState<Slot | null>("top");
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const readButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  const previous = useRef({ activeSlot, inspectedId });
  const inspected = inspectedId ? encounterById[inspectedId] : undefined;
  const count = slots.filter((slot) => selection[slot]).length;
  const validation = validateSeedingSelection(state, player.id, selection);
  const nextPlayer = state.players.find((candidate) => candidate.id !== player.id && !state.seasonSeededPlayerIds.includes(candidate.id));

  useEffect(() => {
    const backToCard = !inspectedId && previous.current.inspectedId && activeSlot === previous.current.activeSlot;
    const target = backToCard ? readButtons.current[previous.current.inspectedId!] : titleRef.current;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView?.({ block: "nearest" });
    previous.current = { activeSlot, inspectedId };
  }, [activeSlot, inspectedId]);

  function choose(cardId: string) {
    if (!activeSlot) return;
    const next = { ...selection, [activeSlot]: cardId };
    const assigned = slots.find((slot) => slot !== activeSlot && selection[slot] === cardId);
    if (assigned) next[assigned] = selection[activeSlot];
    setSelection(next);
    setInspectedId(null);
    setActiveSlot(slots.find((slot) => !next[slot]) ?? null);
  }

  function edit(slot: Slot) { setActiveSlot(slot); setInspectedId(null); }

  return <PrivateHandGate state={state}>
    <main className="table-seeding">
      <aside className="table-seed-plan" aria-label="Your seeding plan">
        <p className="eyebrow">Season {numerals[state.season - 1]} · Your hidden contribution</p>
        <h2>Shape what lies ahead.</h2>
        <p className="table-seed-progress" role="status">{count} of 3 cards chosen</p>
        <nav className="table-seed-slots" aria-label="Seeding positions">{slots.map((slot, index) => <button type="button" key={slot} aria-label={`${selection[slot] ? "Change" : "Choose"} ${labels[slot]} card`} aria-pressed={activeSlot === slot} onClick={() => edit(slot)}><span>{selection[slot] ? <Check size={16} aria-hidden="true" /> : index + 1} {labels[slot]}</span><strong>{encounterById[selection[slot]]?.name ?? "Choose a card"}</strong></button>)}</nav>
        {activeSlot && count === 3 && <button className="table-seed-review-link" type="button" onClick={() => { setActiveSlot(null); setInspectedId(null); }}>Review your three cards </button>}
        <details className="table-seed-help"><summary>How seeding works</summary><div><p>Choose three different cards. Each Steward adds a card to the top, middle and bottom in turn. Exact reveal rounds depend on the remaining deck and other players’ choices.</p><p>{hand.length > 3 ? `The ${hand.length - 3} cards you keep stay in your hand for later seasons.` : "These are your final three cards. Choose the order they enter the deck."}</p><p>Seeding does not play a card’s effect. It enters play when revealed. Your choices are saved when you confirm.</p></div></details>
      </aside>
      <section className="table-seed-hand" aria-label="Choose your hidden encounters">
        <header><p className="eyebrow">{inspected ? "Read the full card" : activeSlot ? `${labels[activeSlot]} of the Encounter Deck` : "Ready to seed"}</p><h1 ref={titleRef} tabIndex={-1}>{inspected ? inspected.name : activeSlot ? `Choose your ${activeSlot} card.` : "Review your three cards."}</h1><p>{inspected ? `Read the complete card before choosing. The current season is ${numerals[state.season - 1]}.` : activeSlot ? `${positions[activeSlot]} Read the Season ${numerals[state.season - 1]} effect, or open a card for every detail.` : "Change any position before confirming. These cards leave your hand together."}</p></header>
        {inspected ? <div className="table-seed-inspection"><button className="table-seed-back" type="button" onClick={() => setInspectedId(null)}><ArrowLeft size={17} aria-hidden="true" />Back to your hand</button><EncounterCard card={inspected} currentSeason={state.season} />{activeSlot && <button className="primary-action" type="button" onClick={() => choose(inspected.id)}>Seed {labels[activeSlot]}</button>}</div> : activeSlot ? <div className={onBoardTable ? "table-seed-hand-grid" : "table-seed-cards"}>{hand.map((cardId) => {
          const card = encounterById[cardId];
          if (!card) return null;
          const assigned = slots.find((slot) => selection[slot] === cardId);
          if (onBoardTable) return <article className={`table-seed-physical${assigned ? " is-assigned" : ""}`} key={cardId} aria-label={card.name}>
            <button type="button" className="table-seed-face" ref={(node) => { readButtons.current[cardId] = node; }} aria-label={`Read ${card.name}`} onClick={() => setInspectedId(cardId)}><EncounterCard card={card} currentSeason={state.season} size="compact" aria-hidden="true" />{assigned && <span className="table-seed-badge">{labels[assigned]}</span>}</button>
            <button type="button" className="table-seed-choose" aria-label={`Seed ${card.name} at ${activeSlot}`} aria-pressed={assigned === activeSlot} onClick={() => choose(cardId)}>{assigned && assigned !== activeSlot ? `Move to ${labels[activeSlot]}` : assigned ? `Keep at ${labels[activeSlot]}` : `Choose for ${labels[activeSlot]}`}</button>
          </article>;
          return <article className={`table-seed-card card-${card.type}`} key={cardId} aria-label={card.name}><p className="table-seed-type">{getEncounterTypeLabel(card)} · {card.type === "arrival" ? "Requirement" : `Season ${numerals[state.season - 1]}`}{assigned && <span>Chosen for {labels[assigned]}</span>}</p><h2>{card.name}</h2><CardSummary card={card} season={state.season} /><div className="table-seed-card-actions"><button ref={(node) => { readButtons.current[cardId] = node; }} type="button" aria-label={`Read ${card.name}`} onClick={() => setInspectedId(cardId)}>Read full card</button><button type="button" aria-label={`Seed ${card.name} at ${activeSlot}`} aria-pressed={assigned === activeSlot} onClick={() => choose(cardId)}>{assigned && assigned !== activeSlot ? "Move here" : assigned ? "Keep here" : `Choose ${labels[activeSlot]}`}</button></div></article>;
        })}</div> : <div className={onBoardTable ? "table-seed-review table-seed-review-cards" : "table-seed-review"}>{slots.map((slot) => {
          const card = encounterById[selection[slot]];
          if (onBoardTable) return <article className="table-seed-physical" key={slot} aria-label={`${labels[slot]}: ${card.name}`}>
            <p className="table-seed-slot-label">{labels[slot]}</p>
            <div className="table-seed-face"><EncounterCard card={card} currentSeason={state.season} size="compact" /></div>
            <button type="button" className="table-seed-choose" onClick={() => edit(slot)} aria-label={`Edit ${labels[slot]} choice`}>Change</button>
          </article>;
          return <article className={`table-seed-card card-${card.type}`} key={slot}><div className="table-seed-review-heading"><span>{labels[slot]}<small>{getEncounterTypeLabel(card)}</small></span><button type="button" onClick={() => edit(slot)} aria-label={`Edit ${labels[slot]} choice`}>Change</button></div><h2>{card.name}</h2><CardSummary card={card} season={state.season} /></article>;
        })}<div className="table-seed-confirm"><p>{nextPlayer ? `After confirming, pass the device to ${nextPlayer.name}.` : `After confirming, reveal Round ${state.round}’s encounters together.`}</p><button className="primary-action" disabled={!validation.ok} type="button" onClick={() => onConfirm(selection)}><CheckCircle2 size={18} aria-hidden="true" />Confirm Seeding</button>{!validation.ok && <p role="status">{validation.reasons.join(" ")}</p>}</div></div>}
      </section>
    </main>
  </PrivateHandGate>;
}
