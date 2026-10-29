import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Short definitions of the game's own words, taken from the printed rules
 * (v6.8 review rulebook, as summarised in the in-app rules guide). Each one
 * names the rulebook page so a player can check the full rule.
 */
export const glossary = {
  strain: { term: "Strain", page: "16–17", text: "Damage from hardship, shown as dots under a tile. A tile still works at 1 or 2 Strain. Each Strain token costs 10 points at the end of the game." },
  overstrained: { term: "Overstrained", page: "16–18", text: "A tile with 3 Strain. It cannot be activated or upgraded, gives no passive effects, does not connect the settlement and scores nothing. When a tile becomes Overstrained, it spreads 1 Strain to a neighbour." },
  supported: { term: "Supported", page: "16–17", text: "Protection that prevents 1 Strain before Overstrain is checked. Passive Supported refreshes each round while its condition holds. Single-use Supported is spent when it prevents Strain. They do not stack." },
  linked: { term: "Linked Production", page: "10–11", text: "The first time you activate a production tile in a round, every matching non-Overstrained tile directly next to it produces too, for the same single action. It does not carry on along a chain." },
  reach: { term: "Reach", page: "12–13", text: "Tiles you can act on and empty spaces you can build on. Reach starts from your Steward and follows connected, non-Overstrained tiles." },
  arrival: { term: "Arrival", page: "14–16", text: "Newcomers asking to join. An Arrival enters with 3 timers and loses one each round end. Spend an Interact action and pay its requirement to complete it and unlock its Special Tile. If its timers run out, it fails, places 1 Strain and costs 10 points." },
  burden: { term: "Burden", page: "14–16", text: "A hardship. It applies its current-Season effect when revealed, stays active and applies again at the start of Seasons II and III. Resolve it with an Interact action and its resolution cost. Each active Burden costs 10 points at the end." },
  boon: { term: "Boon", page: "14–16", text: "Good fortune. Most Boons resolve at once. Some stay face up for a number of uses or a duration. Using a kept Boon costs no action unless it says so." },
  targetCard: { term: "Target Card", page: "18–19", text: "Strain goes where the Target Card sends it. From the tiles the effect allows, the card prefers a tile class, side, number of neighbours and Strain level in turn, skipping any preference no tile meets, then breaks ties by direction." },
  stewardPower: { term: "Steward Power", page: "19–20", text: "Each Steward's once-per-Season ability, printed on its card. Every Steward also has an Objective worth +15 Renown if met at the end." },
  population: { term: "Population", page: "21", text: "The people your settlement houses: printed on tiles and added by some passive effects. Overstrained tiles add none." },
  renown: { term: "Renown", page: "21", text: "Your settlement's standing: printed on tiles, added by arrangements, Steward Objectives (+15 each) and Golden Tiles (+5 each). Penalties are taken from it." },
  warehouse: { term: "Warehouse", page: "10–11", text: "The six resources every Steward shares: Wood, Stone, Metal, Food, Herbs and Goods. Each is normally capped at 15, and anything over the cap is lost." },
  interact: { term: "Interact", page: "8–10", text: "The action used to complete an Arrival or resolve a Burden. Unlike Place, Upgrade and Activate, it does not move your Steward." }
} as const;

export type TermId = keyof typeof glossary;

/** A game word that opens its definition when tapped. */
export function Term({ id, children }: { id: TermId; children?: ReactNode }) {
  const entry = glossary[id];
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const panelId = useId();
  const wrap = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event: PointerEvent) => { if (!wrap.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  return <span className="term" ref={wrap} onKeyDown={(event) => { if (event.key === "Escape" && open) { event.stopPropagation(); setOpen(false); } }}>
    <button type="button" className="term-word" aria-expanded={open} aria-controls={panelId} onClick={(event) => {
      event.stopPropagation();
      // Keep the definition on screen wherever the word sits (rails and popovers clip).
      const rect = event.currentTarget.getBoundingClientRect();
      const width = Math.min(300, window.innerWidth * 0.8);
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      setPlace(rect.bottom + 170 > window.innerHeight ? { left, bottom: window.innerHeight - rect.top + 6 } : { left, top: rect.bottom + 6 });
      setOpen((value) => !value);
    }}>{children ?? entry.term}</button>
    {open && <span className="term-panel" id={panelId} role="note" style={place ? { left: place.left, top: place.top, bottom: place.bottom } : undefined}><strong>{entry.term}</strong><span>{entry.text}</span><small>Rulebook p. {entry.page}</small></span>}
  </span>;
}
