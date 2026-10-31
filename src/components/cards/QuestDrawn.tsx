import { useState } from "react";
import { questCompletionRenown, type QuestCard } from "../../data/questCards";
import { QuestCardFace } from "./QuestCardFace";
import { QuestCardMini } from "./QuestCardMini";
import { FlipCard } from "./PokerCard";

/**
 * The Quest Card drawn for the next game, as setup shows it: the card turns
 * over from its gold back, both halves are summarised with this player
 * count's targets, and the full card opens on request.
 */
export function QuestDrawn({ card, playerCount }: { card: QuestCard; playerCount: number }) {
  const [open, setOpen] = useState(false);
  return <div className="quest-drawn">
    <div className="quest-drawn-row">
      <button type="button" className="quest-drawn-card" aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} Quest Card ${card.n} full size`} onClick={() => setOpen((value) => !value)}>
        <FlipCard kind="quest" revealKey={card.n} sizes="120px" delay={450}><QuestCardMini card={card} /></FlipCard>
      </button>
      <div className="quest-drawn-text">
        <p className="quest-drawn-reward">Complete either half for +{questCompletionRenown} Renown</p>
        <ul>
          {(["top", "bottom"] as const).map((which) => {
            const half = card[which];
            const targets = [...half.strips, ...(half.keep ? [half.keep] : [])].map(([label, values]) => `${label} ${values[playerCount - 1]}`);
            return <li key={which}>
              <span className="quest-drawn-which">{which === "top" ? "Easier" : "Harder"} · {half.kind}</span>
              <strong>{half.name}</strong>
              {targets.length > 0 && <small>{targets.join(" · ")}</small>}
            </li>;
          })}
        </ul>
        <button type="button" className="quest-drawn-more" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? "Hide the card" : "Read the card"}</button>
      </div>
    </div>
    {open && <QuestCardFace card={card} playerCount={playerCount} className="quest-drawn-face" sizes="300px" />}
  </div>;
}
