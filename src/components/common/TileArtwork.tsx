import { coreTileById } from "../../data/tiles";

export function tileArtworkUrl(tileId: string, side: "basic" | "upgraded" = "basic", options: { thumbnail?: boolean; board?: boolean; extension?: boolean } = {}): string {
  const face = options.extension ? `travel-extension-${side}` : coreTileById[tileId] ? `${tileId}-${side}` : tileId;
  // -map: 360px for the board at normal zoom; -board: 720px for close zoom; none: the full print file.
  return `${import.meta.env.BASE_URL}tiles/${face}${options.thumbnail ? "-map" : options.board ? "-board" : ""}.webp`;
}

export function TileArtwork({ tileId, side = "basic", name, thumbnail = false, board = false }: { tileId: string; side?: "basic" | "upgraded"; name: string; thumbnail?: boolean; board?: boolean }) {
  return <img className={`tile-artwork${thumbnail ? " tile-artwork-thumbnail" : ""}`} src={tileArtworkUrl(tileId, side, { thumbnail, board })} alt={thumbnail ? "" : `${name} tile face`} width={1418} height={1228} loading="lazy" decoding="async" />;
}
