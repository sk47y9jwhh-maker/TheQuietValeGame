import type { QuestCard } from "../../data/questCards";
import type { QuestResult } from "../../engine/quests";
import { QuestCardFace } from "../cards/QuestCardFace";

export { questHalfStatus, type QuestTone } from "../cards/questStatus";

/**
 * A Quest Card for reading: the printed card face, with each half's live
 * reading stamped on it and this game's player count lit in the strips.
 */
export function QuestCardView({ card, playerCount, result, ended = false, className = "", sizes }: {
  card: QuestCard; playerCount: number; result?: QuestResult | null; ended?: boolean; compact?: boolean; className?: string; sizes?: string;
}) {
  return <QuestCardFace card={card} playerCount={playerCount} result={result} ended={ended} className={`quest-card-view ${className}`.trim()} sizes={sizes} />;
}
