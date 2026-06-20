import { mapById, mapColumns } from "../data/map";
import type { HexDirection } from "./types";

export const hexDirections = [0, 1, 2, 3, 4, 5] as const;

export const hexDirectionLabels: Record<HexDirection, string> = {
  0: "NW",
  1: "SW",
  2: "N",
  3: "S",
  4: "NE",
  5: "SE"
};

const directionDeltas: Record<0 | 1, Record<HexDirection, [number, number]>> = {
  0: {
    0: [-1, -1],
    1: [0, -1],
    2: [-1, 0],
    3: [1, 0],
    4: [-1, 1],
    5: [0, 1]
  },
  1: {
    0: [0, -1],
    1: [1, -1],
    2: [-1, 0],
    3: [1, 0],
    4: [0, 1],
    5: [1, 1]
  }
};

export function getHexNeighborInDirection(
  hexId: string,
  direction: HexDirection
): string | null {
  const cell = mapById[hexId];
  if (!cell) return null;

  const colIndex = mapColumns.indexOf(cell.col);
  const [rowDelta, colDelta] = directionDeltas[(colIndex % 2) as 0 | 1][direction];
  const nextCol = mapColumns[colIndex + colDelta];
  const nextRow = cell.row + rowDelta;

  if (!nextCol || nextRow < 1 || nextRow > 9) return null;
  const nextId = `${nextCol}${nextRow}`;
  return mapById[nextId] ? nextId : null;
}

export function getHexNeighbors(hexId: string): string[] {
  return hexDirections
    .map((direction) => getHexNeighborInDirection(hexId, direction))
    .filter((id): id is string => Boolean(id));
}

export function getHexLine(
  anchorHexId: string,
  direction: HexDirection,
  size: number
): string[] {
  const hexIds = [anchorHexId];

  while (hexIds.length < size) {
    const nextId = getHexNeighborInDirection(hexIds[hexIds.length - 1], direction);
    if (!nextId) break;
    hexIds.push(nextId);
  }

  return hexIds;
}

export function areHexesAdjacent(a: string, b: string): boolean {
  return getHexNeighbors(a).includes(b);
}
