import { mapArtworkLayers, mapCells, mapLayout } from "../../data/map";
import type { TileCategory } from "../../engine/types";

export const hexRadius = mapLayout.hexRadius;
export const hexHeight = mapLayout.hexHeight;

export function hexCenter(cell: { col: string; row: number }): { x: number; y: number } {
  const colIndex = cell.col.charCodeAt(0) - 65;
  return {
    x: hexRadius + colIndex * hexRadius * 1.5 + mapLayout.originX,
    y: hexHeight / 2 + (cell.row - 1) * hexHeight + (colIndex % 2 ? hexHeight / 2 : 0) + mapLayout.originY
  };
}

export function hexPoints(cx: number, cy: number, radius = hexRadius): string {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 180) * (60 * index);
    return `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`;
  }).join(" ");
}

export const boardCells = mapCells.map((cell) => ({ cell, ...hexCenter(cell) }));
export const boardCellById = new Map(boardCells.map((entry) => [entry.cell.id, entry]));

const underlay = mapArtworkLayers.find((layer) => layer.kind === "underlay" && layer.src);
/** The painted map's own extent, so "fit" shows the whole painting. */
export const boardBounds = underlay
  ? { x: underlay.frame.x, y: underlay.frame.y, width: underlay.frame.width, height: underlay.frame.height }
  : { x: 0, y: 0, width: mapLayout.width, height: mapLayout.height };

export const categoryColors: Record<TileCategory, string> = {
  resource: "#4e6748",
  housing: "#9a5b3c",
  travel: "#7a6f58",
  merchant: "#8a6d2b",
  crafting: "#4f6b7a",
  social: "#7a4f6b",
  wellbeing: "#3f7a6e",
  special: "#26221b"
};

export const categoryNames: Record<TileCategory, string> = {
  resource: "Resource",
  housing: "Housing",
  travel: "Travel",
  merchant: "Merchant",
  crafting: "Crafting",
  social: "Social",
  wellbeing: "Wellbeing",
  special: "Special"
};

/** Steward pawn colours, in seat order. Each also shows the Steward's initial. */
export const seatColors = ["#9a5b3c", "#4f6b7a", "#6b7a3f", "#7a4f6b", "#3f7a6e"];

/** Stroke icons drawn in a 24-unit box. */
const iconPaths = {
  wheat: "M12 22V8M12 8c-3 0-5-2-5-5 3 0 5 2 5 5zm0 0c3 0 5-2 5-5-3 0-5 2-5 5zM12 14c-3 0-5-2-5-5M12 14c3 0 5-2 5-5",
  tree: "M12 3l6 9h-4l4 6H6l4-6H6zM12 18v4",
  mine: "M3 20l6-11 4 6 2-3 6 8zM14 5l3 3M17 4l-3 4",
  leaf: "M5 19c0-9 6-14 15-14 0 9-5 15-14 15M5 19l7-7",
  ruin: "M4 20h16M6 20V10h3v10M15 20V8h3v12M9 13h6",
  house: "M4 11l8-7 8 7v9H4zM10 20v-5h4v5",
  road: "M8 21L11 3M16 21L13 3M12 7v2M12 13v2M12 18v2",
  bridge: "M3 16c4-6 14-6 18 0M3 16v3M21 16v3M8 12v7M16 12v7",
  stall: "M3 9l2-5h14l2 5M3 9h18v3H3zM5 12v8h14v-8",
  tools: "M14 4l6 6-3 3-6-6zM11 7L3 15l3 3 8-8",
  cup: "M6 4h12l-1 9a5 5 0 01-10 0zM12 18v3M8 21h8",
  heart: "M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z",
  star: "M12 2l2.6 6.4L21 9l-5 4.4L17.5 21 12 17.3 6.5 21 8 13.4 3 9l6.4-.6z",
  shield: "M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"
};
export type IconName = keyof typeof iconPaths;
export function iconPath(name: IconName): string {
  return iconPaths[name];
}

export function tileIcon(tileId: string, category: TileCategory): IconName {
  if (tileId.startsWith("c01_")) return "tree";
  if (tileId.startsWith("c02_")) return "mine";
  if (tileId.startsWith("c03_")) return "leaf";
  if (tileId.startsWith("c04_")) return "wheat";
  if (tileId.includes("salvage")) return "ruin";
  if (tileId.includes("bridge")) return "bridge";
  switch (category) {
    case "housing": return "house";
    case "travel": return "road";
    case "merchant": return "stall";
    case "crafting": return "tools";
    case "social": return "cup";
    case "wellbeing": return "heart";
    case "special": return "star";
    default: return "wheat";
  }
}

/** Split a tile name into at most two short lines for a map token. */
export function tokenLines(name: string, maxChars = 11): string[] {
  if (name.length <= maxChars) return [name];
  const words = name.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxChars || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= 2) return lines;
  return [lines[0], `${lines.slice(1).join(" ").slice(0, maxChars - 1)}…`];
}
