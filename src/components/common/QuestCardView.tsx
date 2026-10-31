import type { QuestCard, QuestHalf, QuestHalfKey } from "../../data/questCards";
import { questCompletionRenown } from "../../data/questCards";
import type { QuestHalfStatus, QuestResult } from "../../engine/quests";

const statusLabel = (half: QuestHalf, status: QuestHalfStatus, ended: boolean): string => {
  if (status === "met") return "Complete";
  if (status === "broken") return "Broken";
  if (ended) return "Not met";
  if (half.kind === "Vow") return "Kept so far";
  return half.check === "Final" ? "Checked at game end" : "Open";
};

function QuestHalfView({ half, which, playerCount, status, ended }: {
  half: QuestHalf; which: QuestHalfKey; playerCount: number; status?: QuestHalfStatus; ended: boolean;
}) {
  const lines = [...half.strips, ...(half.keep ? [half.keep] : [])];
  return (
    <section className={`quest-half quest-half-${which}${status ? ` is-${status}` : ""}`} aria-label={`${which === "top" ? "Top" : "Bottom"} half: ${half.name}`}>
      <div className="quest-half-head">
        <span className="quest-half-kind">{which === "top" ? "Easier" : "Harder"} · {half.kind} · {half.check}</span>
        {status && <span className={`quest-half-status status-${status}`}>{statusLabel(half, status, ended)}</span>}
      </div>
      <strong className="quest-half-name">{half.name}</strong>
      <p>{half.text}</p>
      {lines.length > 0 && (
        <dl className="quest-half-targets">
          {lines.map(([label, values]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{String(values[playerCount - 1])}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

/** A Quest Card as the table sees it, with targets for this player count. */
export function QuestCardView({ card, playerCount, result, ended = false, compact = false }: {
  card: QuestCard; playerCount: number; result?: QuestResult | null; ended?: boolean; compact?: boolean;
}) {
  return (
    <article className={`quest-card-view${compact ? " is-compact" : ""}${result?.complete ? " is-complete" : ""}`} aria-label={`Quest Card ${card.n}: ${card.theme}`}>
      <header>
        <span className="quest-card-number">Quest Card No. {card.n}</span>
        <strong className="quest-card-theme">{card.theme}</strong>
        <small>Complete either half for +{questCompletionRenown} Renown. Targets for {playerCount} player{playerCount === 1 ? "" : "s"}.</small>
      </header>
      <QuestHalfView half={card.top} which="top" playerCount={playerCount} status={result?.top.status} ended={ended} />
      <QuestHalfView half={card.bottom} which="bottom" playerCount={playerCount} status={result?.bottom.status} ended={ended} />
    </article>
  );
}
