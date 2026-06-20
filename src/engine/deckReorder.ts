import type {
  GameState,
  PendingDeckReorderState,
  PendingEffectSourceType
} from "./types";

export function parseDeckPeekCount(effectText: string): number | null {
  const match = effectText.match(/look at the top\s+(\d+)\s+cards?/i);
  return match ? Number(match[1]) : null;
}

export function queueDeckReorder(
  state: GameState,
  input: Omit<PendingDeckReorderState, "id" | "cardIds">
): GameState {
  const count = parseDeckPeekCount(input.effectText);
  if (!count) return state;

  return {
    ...state,
    pendingDeckReorder: {
      ...input,
      id: `deck_order_${state.log.length + state.pendingEffects.length + 1}_${Date.now()}`,
      cardIds: state.encounters.deck.slice(0, count)
    }
  };
}

export function queueDeckReorderFromEffect(
  state: GameState,
  sourceType: PendingEffectSourceType,
  sourceName: string,
  title: string,
  effectText: string,
  sourceId?: string,
  options: Pick<PendingDeckReorderState, "canSkip" | "skipLabel"> = {}
): GameState {
  return queueDeckReorder(state, {
    sourceType,
    sourceId,
    sourceName,
    title,
    effectText,
    ...options
  });
}

export function confirmDeckReorder(
  state: GameState,
  orderedCardIds: string[]
): GameState {
  const pending = state.pendingDeckReorder;
  if (!pending) return state;

  const original = [...pending.cardIds].sort();
  const proposed = [...orderedCardIds].sort();
  if (
    original.length !== proposed.length ||
    original.some((cardId, index) => cardId !== proposed[index])
  ) {
    return state;
  }

  return {
    ...state,
    pendingDeckReorder: null,
    encounters: {
      ...state.encounters,
      deck: [...orderedCardIds, ...state.encounters.deck.slice(pending.cardIds.length)]
    },
    log: [
      {
        id: `log_${state.log.length + 1}_${Date.now()}`,
        round: state.round,
        message: `Returned ${orderedCardIds.length} Encounter Card(s) after ${pending.sourceName}.`
      },
      ...state.log
    ].slice(0, 80)
  };
}

export function skipDeckReorder(state: GameState): GameState {
  const pending = state.pendingDeckReorder;
  if (!pending || !pending.canSkip) return state;

  return {
    ...state,
    pendingDeckReorder: null,
    log: [
      {
        id: `log_${state.log.length + 1}_${Date.now()}`,
        round: state.round,
        message: `Skipped effect: ${pending.title}.`
      },
      ...state.log
    ].slice(0, 80)
  };
}
