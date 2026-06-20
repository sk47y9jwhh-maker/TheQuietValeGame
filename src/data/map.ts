import type { HexData, Terrain } from "../engine/types";

export const terrainLabels: Record<Terrain, string> = {
  grasslands: "Grasslands",
  water: "Water/River",
  woodland: "Woodland",
  mountains: "Mountains",
  heaths: "Heaths",
  arable: "Arable Land",
  ruins: "Ruins"
};

const rows: Terrain[][] = [
  [
    "mountains",
    "mountains",
    "mountains",
    "water",
    "grasslands",
    "grasslands",
    "woodland",
    "woodland",
    "woodland",
    "grasslands",
    "grasslands",
    "arable",
    "arable",
    "arable"
  ],
  [
    "grasslands",
    "grasslands",
    "grasslands",
    "water",
    "grasslands",
    "grasslands",
    "grasslands",
    "grasslands",
    "grasslands",
    "grasslands",
    "grasslands",
    "grasslands",
    "grasslands",
    "grasslands"
  ],
  [
    "heaths",
    "heaths",
    "grasslands",
    "grasslands",
    "water",
    "water",
    "grasslands",
    "grasslands",
    "grasslands",
    "grasslands",
    "grasslands",
    "grasslands",
    "grasslands",
    "heaths"
  ],
  [
    "heaths",
    "grasslands",
    "grasslands",
    "grasslands",
    "water",
    "ruins",
    "water",
    "water",
    "grasslands",
    "grasslands",
    "grasslands",
    "grasslands",
    "heaths",
    "heaths"
  ],
  [
    "grasslands",
    "grasslands",
    "grasslands",
    "grasslands",
    "water",
    "ruins",
    "ruins",
    "grasslands",
    "water",
    "water",
    "grasslands",
    "grasslands",
    "grasslands",
    "grasslands"
  ],
  [
    "arable",
    "arable",
    "grasslands",
    "grasslands",
    "water",
    "grasslands",
    "grasslands",
    "grasslands",
    "grasslands",
    "grasslands",
    "water",
    "water",
    "grasslands",
    "mountains"
  ],
  [
    "arable",
    "grasslands",
    "grasslands",
    "grasslands",
    "water",
    "grasslands",
    "grasslands",
    "grasslands",
    "grasslands",
    "grasslands",
    "grasslands",
    "water",
    "mountains",
    "mountains"
  ],
  [
    "grasslands",
    "woodland",
    "grasslands",
    "grasslands",
    "water",
    "water",
    "grasslands",
    "grasslands",
    "grasslands",
    "grasslands",
    "grasslands",
    "grasslands",
    "water",
    "water"
  ],
  [
    "woodland",
    "woodland",
    "grasslands",
    "grasslands",
    "grasslands",
    "grasslands",
    "water",
    "water",
    "grasslands",
    "ruins",
    "ruins",
    "ruins",
    "grasslands",
    "grasslands"
  ]
];

export const mapColumns = "ABCDEFGHIJKLMN".split("");

export const mapCells: HexData[] = rows.flatMap((row, rowIndex) =>
  row.map((terrain, colIndex) => {
    const col = mapColumns[colIndex];
    const rowNumber = rowIndex + 1;

    return {
      id: `${col}${rowNumber}`,
      col,
      row: rowNumber,
      terrain
    };
  })
);

export const mapById = Object.fromEntries(
  mapCells.map((cell) => [cell.id, cell])
) as Record<string, HexData>;

export const waterHexIds = mapCells
  .filter((cell) => cell.terrain === "water")
  .map((cell) => cell.id);

export const ruinsHexIds = mapCells
  .filter((cell) => cell.terrain === "ruins")
  .map((cell) => cell.id);

