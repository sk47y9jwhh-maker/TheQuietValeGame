import { useState } from "react";
import { questCompletionRenown, type QuestHalf } from "../../data/questCards";
import { evaluateQuest, type QuestHalfResult } from "../../engine/quests";
import type { GameState } from "../../engine/types";
import { questHalfStatus } from "../common/QuestCardView";
import { Term } from "./Term";

function Half({ half, which, result, playerCount, open }: { half: QuestHalf; which: "top" | "bottom"; result: QuestHalfResult; playerCount: number; open: boolean }) {
  const status = questHalfStatus(half, result, false);
  const targets = [...half.strips, ...(half.keep ? [half.keep] : [])];
  return <li className={`rail-quest-half is-${status.tone}`}>
    <div className="rail-quest-line">
      <span className="rail-quest-which">{which === "top" ? "Easier" : "Harder"}</span>
      <strong>{half.name}</strong>
      <span className={`rail-quest-status status-${status.tone}`}>{status.label}</span>
    </div>
    {open && <>
      <p>{half.text}</p>
      <p className="rail-quest-targets">{half.kind} · {half.check}{targets.map(([label, values]) => <span key={label}> · {label} <b>{String(values[playerCount - 1])}</b></span>)}</p>
    </>}
  </li>;
}

/** The game's Quest Card in the side panel: both halves at a glance, the full card on request. */
export function RailQuest({ state }: { state: GameState }) {
  const [open, setOpen] = useState(false);
  const quest = evaluateQuest(state);
  if (!quest) return null;
  const { card } = quest;
  return <section className={`rail-quest${quest.complete ? " is-complete" : ""}`} aria-label={`Quest Card ${card.n}: ${card.theme}`}>
    <header>
      <div><span><Term id="questCard">Quest Card</Term> No. {card.n}</span><h2>{card.theme}</h2></div>
      <span className="rail-quest-reward">{quest.complete ? `+${questCompletionRenown} earned` : `+${questCompletionRenown}`}</span>
    </header>
    <ul>
      <Half half={card.top} which="top" result={quest.top} playerCount={state.playerCount} open={open} />
      <Half half={card.bottom} which="bottom" result={quest.bottom} playerCount={state.playerCount} open={open} />
    </ul>
    <button type="button" className="rail-quest-more" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? "Show less" : "Read the card"}</button>
  </section>;
}
