import type { QuestCard, QuestHalf, QuestHalfKey } from "../../data/questCards";
import { questCompletionRenown } from "../../data/questCards";
import type { QuestHalfResult, QuestResult } from "../../engine/quests";

export type QuestTone = "met" | "broken" | "on-track" | "open";

/** A short live reading of one half, and its tone. */
export function questHalfStatus(half: QuestHalf, result: QuestHalfResult, ended: boolean): { label: string; tone: QuestTone } {
  if (result.status === "met") return { label: "Complete", tone: "met" };
  if (result.status === "broken") return { label: "Broken", tone: "broken" };
  if (ended) return { label: "Not met", tone: "open" };
  if (half.kind === "Vow") return result.onTrack ? { label: "Kept, on track", tone: "on-track" } : { label: "Kept so far", tone: "open" };
  if (half.check === "Final") return result.onTrack ? { label: "On track", tone: "on-track" } : { label: "Not yet", tone: "open" };
  return { label: "Open", tone: "open" };
}

function QuestHalfView({ half, which, playerCount, result, ended }: {
  half: QuestHalf; which: QuestHalfKey; playerCount: number; result?: QuestHalfResult; ended: boolean;
}) {
  const status = result ? questHalfStatus(half, result, ended) : undefined;
  const lines = [...half.strips, ...(half.keep ? [half.keep] : [])];
  return (
    <section className={`quest-half quest-half-${which}${status ? ` is-${status.tone}` : ""}`} aria-label={`${which === "top" ? "Top" : "Bottom"} half: ${half.name}`}>
      <div className="quest-half-head">
        <span className="quest-half-kind">{which === "top" ? "Easier" : "Harder"} · {half.kind} · {half.check}</span>
        {status && <span className={`quest-half-status status-${status.tone}`}>{status.label}</span>}
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
      <QuestHalfView half={card.top} which="top" playerCount={playerCount} result={result?.top} ended={ended} />
      <QuestHalfView half={card.bottom} which="bottom" playerCount={playerCount} result={result?.bottom} ended={ended} />
    </article>
  );
}
