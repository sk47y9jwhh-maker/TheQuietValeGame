import { questCompletionRenown, type QuestCard, type QuestHalf, type QuestHalfKey } from "../../data/questCards";
import type { QuestHalfResult, QuestResult } from "../../engine/quests";
import { questHalfStatus } from "./questStatus";
import { CardFace, useFitScale } from "./PokerCard";

const players = [1, 2, 3, 4, 5];

function Strips({ half, playerCount }: { half: QuestHalf; playerCount?: number }) {
  const rows = [...half.strips, ...(half.keep ? [half.keep] : [])];
  if (!rows.length) return null;
  return <table className="qface-strip">
    <thead><tr className="qface-players"><th scope="row">Players</th>{players.map((count) => <td key={count} className={count === playerCount ? "is-now" : undefined}>{count}</td>)}</tr></thead>
    <tbody>{rows.map(([label, values]) => <tr key={label} className={label.startsWith("Keep it") ? "is-keep" : undefined}>
      <th scope="row">{label}</th>
      {values.map((value, index) => <td key={index} className={index + 1 === playerCount ? "is-now" : undefined}>{String(value)}</td>)}
    </tr>)}</tbody>
  </table>;
}

function Half({ card, which, playerCount, result, ended }: { card: QuestCard; which: QuestHalfKey; playerCount?: number; result?: QuestHalfResult; ended: boolean }) {
  const half = card[which];
  const fit = useFitScale<HTMLDivElement>([card.n, which]);
  const status = result ? questHalfStatus(half, result, ended) : undefined;
  return <section className={`qface-half is-${which}${status ? ` is-${status.tone}` : ""}`} aria-label={`${which === "top" ? "Top" : "Bottom"} half: ${half.name}`}>
    <div className="qface-label"><span className="qface-pips" aria-label={which === "top" ? "Easier" : "Harder"}>{which === "top" ? "●" : "●●"}</span>{half.kind}<span className="qface-gem" aria-hidden="true">◆</span>{half.check}</div>
    <div className="qface-fit" ref={fit.ref} style={fit.style}>
      <h3>{half.name}</h3>
      <p>{half.text}</p>
      <Strips half={half} playerCount={playerCount} />
    </div>
    {status && <span className={`qface-stamp status-${status.tone}`}>{status.label}</span>}
  </section>;
}

/**
 * A Quest Card as printed: the gold front, the theme, an easier top half and
 * a harder bottom half with their player-count strips. With a result, each
 * half carries its live reading, and the column for this player count is lit.
 */
export function QuestCardFace({ card, playerCount, result, ended = false, className = "", sizes }: {
  card: QuestCard; playerCount?: number; result?: QuestResult | null; ended?: boolean; className?: string; sizes?: string;
}) {
  return <CardFace kind="quest" as="article" sizes={sizes} className={`qface${result?.complete ? " is-complete" : ""} ${className}`.trim()} label={`Quest Card ${card.n}: ${card.theme}`}>
    <div className="qface-type">Quest</div>
    <div className="qface-title">{card.theme}</div>
    <Half card={card} which="top" playerCount={playerCount} result={result?.top} ended={ended} />
    <Half card={card} which="bottom" playerCount={playerCount} result={result?.bottom} ended={ended} />
    <div className="qface-foot">No. {card.n}. Complete either half for +{questCompletionRenown} Renown.</div>
  </CardFace>;
}
