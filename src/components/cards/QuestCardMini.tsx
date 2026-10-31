import type { QuestCard } from "../../data/questCards";
import { CardBack, CardFace } from "./PokerCard";

/** A small Quest Card for a collection: the face's title, or the gold back when face down. */
export function QuestCardMini({ card, faceDown = false }: { card: QuestCard; faceDown?: boolean }) {
  if (faceDown) return <CardBack kind="quest" className="qmini" sizes="120px" />;
  return <CardFace kind="quest" className="qmini qface" sizes="120px">
    <div className="qface-type">Quest</div>
    <div className="qface-title">{card.theme}</div>
    <div className="qmini-number">No. {card.n}</div>
  </CardFace>;
}
