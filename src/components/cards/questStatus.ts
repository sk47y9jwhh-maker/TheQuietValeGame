import type { QuestHalf } from "../../data/questCards";
import type { QuestHalfResult } from "../../engine/quests";

export type QuestTone = "met" | "broken" | "on-track" | "open";

/** A short live reading of one half of a Quest Card, and its tone. */
export function questHalfStatus(half: QuestHalf, result: QuestHalfResult, ended: boolean): { label: string; tone: QuestTone } {
  if (result.status === "met") return { label: "Complete", tone: "met" };
  if (result.status === "broken") return { label: "Broken", tone: "broken" };
  if (ended) return { label: "Not met", tone: "open" };
  if (half.kind === "Vow") return result.onTrack ? { label: "Kept, on track", tone: "on-track" } : { label: "Kept so far", tone: "open" };
  if (half.check === "Final") return result.onTrack ? { label: "On track", tone: "on-track" } : { label: "Not yet", tone: "open" };
  return { label: "Open", tone: "open" };
}
