import { EncounterCard } from "../common/EncounterCard";
import { getArrivalRewardText, getBoonLifecycleText, getBurdenResolutionCurrentText, getSeasonText } from "../common/gameText";
import { TileArtwork } from "../common/TileArtwork";
import { encounterById } from "../../data/encounters";
import { stewardById } from "../../data/stewards";
import { coreTileById, specialTileById } from "../../data/tiles";
import { resourceLabels, resources } from "../../data/resources";
import type { WatchSpotlight as Spotlight } from "../../app/watch/watchFrames";
import type { EncounterData, GameState, Season } from "../../engine/types";

const ahead: Record<string, string> = { Welcomed: "To welcome", "Set down for good": "To set down", Built: "To build", "Built with the Season power": "To build with the Season power", Upgraded: "To upgrade", Activated: "To activate", Used: "To use" };
const seasonName = ["", "I", "II", "III"];
const slotNote = (type: string | undefined) => type === "arrival" ? "Comes out early, while the Warehouse can pay" : type === "boon" ? "Comes out mid-Season, when there is more to boost" : type === "burden" ? "Kept back as late as it can be" : "";

/** The lines of a card that matter now, large enough to read. */
function lensLines(card: EncounterData, season: Season): [string, string][] {
  if (card.type === "arrival") return [["Cost", card.requirementText], ["Reward", getArrivalRewardText(card)]];
  if (card.type === "burden" || card.type === "boon") {
    const lines: [string, string][] = [[`Season ${seasonName[season]}`, getSeasonText(card.effects, season)]];
    const after = card.type === "burden" ? getBurdenResolutionCurrentText(card, season) : getBoonLifecycleText(card, season);
    if (after) lines.push([card.type === "burden" ? "Set down" : "Then", after]);
    return lines;
  }
  return [];
}

/** A tile's printed text that matters for this step, large enough to read. */
function tileLines(tileId: string, side: "basic" | "upgraded", verb: string): [string, string][] {
  const core = coreTileById[tileId];
  const face = core?.[side];
  const special = specialTileById[tileId];
  // The full Linked Production rule is long; its gist fits a close-up.
  const effect = (face?.effectText ?? special?.effectText ?? "").replace(/Passive: Linked Production\b.*$/s, "Linked Production: touching tiles of the same kind produce together, once a round.");
  const scores = (population: number, renown: number) => population || renown ? [population && `${population} Population`, renown && `${renown} Renown`].filter(Boolean).join(", ") : "";
  const lines: [string, string][] = [];
  if (verb.startsWith("Built") || verb.startsWith("Upgraded")) {
    const price = face ? resources.filter((resource) => (face.cost[resource] ?? 0) > 0).map((resource) => `${face.cost[resource]} ${resourceLabels[resource]}`).join(", ") : "";
    lines.push([verb.startsWith("Upgraded") ? "Upgrade cost" : "Cost", price || "Free"]);
  }
  if (effect) lines.push(["Does", effect]);
  const scored = face ? scores(face.population, face.renown) : special ? scores(special.population, special.renown) : "";
  if (scored) lines.push(["Scores", scored]);
  return lines;
}

const tileName = (tileId: string, side: "basic" | "upgraded") => coreTileById[tileId]?.[side].name ?? specialTileById[tileId]?.name ?? "Tile";

/**
 * The demo's close-up: the card or tile a step turns on, large enough to
 * read, beside the board. At the start of a Season it shows the seeding:
 * a Steward's three cards and where each goes in the Encounter Deck.
 */
export function WatchSpotlight({ spotlight, state, upcoming, frameKey }: { spotlight?: Spotlight; state: GameState; upcoming: boolean; frameKey: number }) {
  if (!spotlight) return null;
  if (spotlight.kind === "seed") {
    const steward = stewardById[state.players.find((player) => player.id === spotlight.player)?.stewardId ?? ""];
    const slots = [["Top", spotlight.top], ["Middle", spotlight.middle], ["Bottom", spotlight.bottom]] as const;
    return <section className="watch-seed" key={frameKey} aria-label="Seeding the Encounter Deck">
      <p className="watch-seed-title"><span>Season {seasonName[spotlight.season]}</span>{steward?.name ?? "A Steward"} seeds the Encounter Deck</p>
      <ol className="watch-seed-slots">{slots.map(([slot, cardId], index) => <li key={slot} style={{ ["--i" as string]: index }}>
        <p className="watch-seed-slot">{slot}</p>
        <div className="watch-seed-card">{encounterById[cardId] && <EncounterCard card={encounterById[cardId]} currentSeason={spotlight.season} size="mini" />}</div>
        <p className="watch-seed-note">{slotNote(encounterById[cardId]?.type)}</p>
      </li>)}</ol>
      <p className="watch-seed-secret">Seeding is secret at the table. The demo shows it so you can see the thinking.</p>
    </section>;
  }
  if (spotlight.kind === "card") {
    const card = encounterById[spotlight.cardId];
    if (!card) return null;
    const verb = upcoming ? ahead[spotlight.verb] ?? spotlight.verb : spotlight.verb;
    return <figure className={`watch-spot is-card is-${card.type}`} key={frameKey} aria-label={`${verb}: ${card.name}`}>
      <figcaption>{verb}</figcaption>
      <div className="watch-spot-card"><EncounterCard card={card} currentSeason={spotlight.season} size="compact" /></div>
      <dl className="watch-lens">{lensLines(card, spotlight.season).map(([label, text]) => <div key={label}><dt>{label}</dt><dd>{text}</dd></div>)}</dl>
      {spotlight.unlocks && <div className="watch-spot-unlock"><span>{upcoming ? "Would unlock" : "Unlocks"}</span><TileArtwork tileId={spotlight.unlocks} name={tileName(spotlight.unlocks, "basic")} board /><strong>{tileName(spotlight.unlocks, "basic")}</strong></div>}
    </figure>;
  }
  const verb = upcoming ? ahead[spotlight.verb] ?? spotlight.verb : spotlight.verb;
  const name = tileName(spotlight.tileId, spotlight.side);
  return <figure className="watch-spot is-tile" key={frameKey} aria-label={`${verb}: ${name}`}>
    <figcaption>{verb}{spotlight.linked ? <small>Linked: {spotlight.linked} tiles produce</small> : null}</figcaption>
    {spotlight.from && <div className="watch-spot-from"><TileArtwork tileId={spotlight.tileId} side="basic" name={tileName(spotlight.tileId, "basic")} board /><span aria-hidden="true">↓</span></div>}
    <div className="watch-spot-tile"><TileArtwork tileId={spotlight.tileId} side={spotlight.side} name={name} board /></div>
    <strong className="watch-spot-name">{name}</strong>
    <dl className="watch-lens">{tileLines(spotlight.tileId, spotlight.side, spotlight.verb).map(([label, text]) => <div key={label}><dt>{label}</dt><dd>{text}</dd></div>)}</dl>
  </figure>;
}
