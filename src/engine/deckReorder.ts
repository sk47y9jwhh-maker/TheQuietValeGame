import type {
  GameState,
  PendingDeckReorderState,
  PendingEffectSourceType
} from "./types";

export function queueDeckReorder(
  state: GameState,
  count: number,
  input: Omit<PendingDeckReorderState, "id" | "cardIds">
): GameState {
  if (count <= 0) return state;

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
  count: number,
  sourceId?: string,
  options: Pick<PendingDeckReorderState, "canSkip" | "skipLabel" | "mode"> = {}
): GameState {
  return queueDeckReorder(state, count, {
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
  orderedCardIds: string[],
  bottomCardId?: string
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

  let nextDeck: string[];
  if (pending.mode === "moveOneToBottom") {
    const originalOrder = pending.cardIds;
    if (!bottomCardId) {
      if (
        orderedCardIds.some(
          (cardId, index) => cardId !== originalOrder[index]
        )
      ) {
        return state;
      }
      nextDeck = [...state.encounters.deck];
    } else {
      if (!originalOrder.includes(bottomCardId)) return state;
      const expectedTop = originalOrder.filter(
        (cardId) => cardId !== bottomCardId
      );
      const proposedTop = orderedCardIds.slice(0, -1);
      if (
        orderedCardIds.at(-1) !== bottomCardId ||
        expectedTop.length !== proposedTop.length ||
        expectedTop.some((cardId, index) => cardId !== proposedTop[index])
      ) {
        return state;
      }
      nextDeck = [
        ...proposedTop,
        ...state.encounters.deck.slice(pending.cardIds.length),
        bottomCardId
      ];
    }
  } else {
    nextDeck = [
      ...orderedCardIds,
      ...state.encounters.deck.slice(pending.cardIds.length)
    ];
  }

  return {
    ...state,
    pendingDeckReorder: null,
    encounters: {
      ...state.encounters,
      deck: nextDeck
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
