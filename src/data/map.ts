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

export interface MapLayout {
  columns: number;
  rows: number;
  hexRadius: number;
  hexWidth: number;
  hexHeight: number;
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export type MapArtworkLayerKind = "underlay" | "overlay";

export interface MapArtworkLayer {
  id: string;
  label: string;
  kind: MapArtworkLayerKind;
  src: string;
  opacity: number;
  /**
   * Artwork is authored against the same SVG viewBox as the playable hex grid.
   * This keeps clicks, placement rules, and future painted art aligned.
   */
  placement: "svg-view-box";
  notes: string;
}

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

export const mapLayout: MapLayout = {
  columns: mapColumns.length,
  rows: rows.length,
  hexRadius: 30,
  hexWidth: 60,
  hexHeight: Math.sqrt(3) * 30,
  originX: 14,
  originY: 18,
  width: 60 + (mapColumns.length - 1) * 30 * 1.5 + 30,
  height: Math.sqrt(3) * 30 * rows.length + (Math.sqrt(3) * 30) / 2 + 40
};

export const mapArtworkLayers: MapArtworkLayer[] = [
  {
    id: "painted_map_underlay",
    label: "Painted map underlay",
    kind: "underlay",
    src: "",
    opacity: 1,
    placement: "svg-view-box",
    notes:
      "Optional full-board artwork behind the interactive hex grid. Export at the map SVG viewBox ratio."
  },
  {
    id: "painted_map_overlay",
    label: "Painted map overlay",
    kind: "overlay",
    src: "",
    opacity: 0.92,
    placement: "svg-view-box",
    notes:
      "Optional transparent PNG/SVG details above the grid. It is click-through so gameplay still uses the hex map."
  }
];

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
