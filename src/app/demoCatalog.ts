/**
 * The demo scenes, in the order an audience should see them. The ribbon's
 * scene list, its previous and next buttons, the end of each walkthrough and
 * the home page all read from here.
 */
import type { ScenarioId } from "./scenarioCatalog";

export const demoGroups: { title: string; ids: ScenarioId[] }[] = [
  { title: "Start here", ids: ["guided"] },
  { title: "Decisions", ids: ["decide-arrival", "decide-time", "decide-protect", "decide-boon", "decide-special", "decide-guild", "decide-warden"] },
  { title: "Moments from a game", ids: ["showcase-chain", "showcase-season", "showcase-late"] }
];

export const demoOrder: ScenarioId[] = demoGroups.flatMap((group) => group.ids);
export const demoHref = (id: ScenarioId, extra = "") => `?experience=table&scenario=${id}${extra}`;
export const demoNeighbours = (id: ScenarioId) => {
  const index = demoOrder.indexOf(id);
  return { index, previous: index > 0 ? demoOrder[index - 1] : undefined, next: index >= 0 && index < demoOrder.length - 1 ? demoOrder[index + 1] : undefined };
};
