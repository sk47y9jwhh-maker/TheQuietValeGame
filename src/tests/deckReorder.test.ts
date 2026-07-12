import { describe, expect, it } from "vitest";
import {
  confirmDeckReorder,
  queueDeckReorderFromEffect
} from "../engine/deckReorder";
import { createNewGame } from "../engine/setup";

describe("deck reorder effects", () => {
  it("queues and confirms a reordered deck top", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.encounters.deck = ["card_a", "card_b", "card_c", "card_d"];

    const queued = queueDeckReorderFromEffect(
      state,
      "card",
      "Clear Nights and Plans",
      "Revealed Clear Nights and Plans",
      "Look at the top 3 cards of the Encounter Deck. Return them in any order.",
      3,
      "boon_clear_nights_make_for_clear_plans"
    );

    expect(queued.pendingDeckReorder?.cardIds).toEqual([
      "card_a",
      "card_b",
      "card_c"
    ]);

    const confirmed = confirmDeckReorder(queued, ["card_c", "card_a", "card_b"]);

    expect(confirmed.pendingDeckReorder).toBeNull();
    expect(confirmed.encounters.deck).toEqual(["card_c", "card_a", "card_b", "card_d"]);
  });

  it("rejects an order that does not match the peeked cards", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.encounters.deck = ["card_a", "card_b", "card_c"];
    const queued = queueDeckReorderFromEffect(
      state,
      "card",
      "Clear Nights and Plans",
      "Revealed Clear Nights and Plans",
      "Look at the top 2 cards of the Encounter Deck. Return them in any order.",
      2
    );

    const next = confirmDeckReorder(queued, ["card_a", "card_c"]);

    expect(next.pendingDeckReorder).not.toBeNull();
    expect(next.encounters.deck).toEqual(["card_a", "card_b", "card_c"]);
  });
});
