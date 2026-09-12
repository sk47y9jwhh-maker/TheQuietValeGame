import { coreTileById } from "../../data/tiles";

export function tileArtworkUrl(tileId: string, side: "basic" | "upgraded" = "basic", options: { thumbnail?: boolean; extension?: boolean } = {}): string {
  const face = options.extension ? `travel-extension-${side}` : coreTileById[tileId] ? `${tileId}-${side}` : tileId;
  return `${import.meta.env.BASE_URL}tiles/${face}${options.thumbnail ? "-map" : ""}.webp`;
}

export function TileArtwork({ tileId, side = "basic", name, thumbnail = false }: { tileId: string; side?: "basic" | "upgraded"; name: string; thumbnail?: boolean }) {
  return <img className={`tile-artwork${thumbnail ? " tile-artwork-thumbnail" : ""}`} src={tileArtworkUrl(tileId, side, { thumbnail })} alt={thumbnail ? "" : `${name} tile face`} width={1418} height={1228} loading="lazy" decoding="async" />;
}
