/**
 * The game's own hand-drawn symbols, from the artist's tile templates: the six
 * resources, Population, Renown and the tile types. They sit beside words,
 * never instead of them, so they are hidden from assistive technology.
 */
export type GameIconName =
  | "wood" | "stone" | "metal" | "food" | "herbs" | "goods"
  | "population" | "renown"
  | "type-resource" | "type-housing" | "type-travel" | "type-merchant" | "type-crafting" | "type-social" | "type-wellbeing" | "type-golden";

export const gameIconUrl = (name: GameIconName) => `${import.meta.env.BASE_URL}icons/${name}.webp`;

/** A tile category's icon. Special tiles have no type of their own. */
export const categoryIcon = (category: string): GameIconName | undefined =>
  (["resource", "housing", "travel", "merchant", "crafting", "social", "wellbeing"].includes(category) ? `type-${category}` : undefined) as GameIconName | undefined;

export function GameIcon({ name, className = "" }: { name: GameIconName; className?: string }) {
  return <img className={`game-icon ${className}`.trim()} src={gameIconUrl(name)} alt="" aria-hidden="true" decoding="async" />;
}
