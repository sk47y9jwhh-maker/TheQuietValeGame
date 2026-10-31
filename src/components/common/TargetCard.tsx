import type { ReactNode, SVGProps } from "react";
import { describeTargetCard, isOpenTargetCard } from "../../data/targetCards";
import type { TargetCardDefinition, TargetCardDirection } from "../../engine/types";
import { CardFace } from "../cards/PokerCard";

const ink = "#2b2f33";
const steel = "#3e5566";

// Flat-top hexes, as on the board: corners at 0, 60, 120 ... degrees.
const hexPoints = (cx: number, cy: number, r: number) => [0, 1, 2, 3, 4, 5].map((i) => {
  const a = (Math.PI / 3) * i;
  return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
}).join(" ");

const Hex = ({ cx = 50, cy = 50, r, ...rest }: { cx?: number; cy?: number; r: number } & SVGProps<SVGPolygonElement>) => <polygon points={hexPoints(cx, cy, r)} {...rest} />;
const glyph = (children: ReactNode, viewBox = "0 0 100 100") => <svg viewBox={viewBox} aria-hidden="true">{children}</svg>;
const outline = { fill: "none", stroke: ink, strokeWidth: 7 };

const glyphs = {
  core: glyph(<Hex r={40} {...outline} />),
  specialOrGolden: glyph(<><Hex r={40} {...outline} /><path d="M50 27 L56 43 L73 43 L59 53 L64 70 L50 60 L36 70 L41 53 L27 43 L44 43 Z" fill={ink} /></>),
  basic: glyph(<Hex r={40} {...outline} />),
  upgraded: glyph(<><Hex r={42} fill="none" stroke={ink} strokeWidth={6} /><Hex r={26} fill="none" stroke={ink} strokeWidth={6} /></>),
  either: glyph(<><Hex r={42} fill="none" stroke={ink} strokeWidth={6} /><Hex r={26} fill="none" stroke={ink} strokeWidth={5} strokeDasharray="8 7" /></>),
  ring: (filled: number) => glyph(<>
    <Hex cx={60} cy={60} r={16} fill="none" stroke={ink} strokeWidth={5} />
    {[0, 1, 2, 3, 4, 5].map((i) => {
      const a = -Math.PI / 2 + (Math.PI / 3) * i;
      return <Hex key={i} cx={60 + 31 * Math.cos(a)} cy={60 + 31 * Math.sin(a)} r={15} {...(i < filled ? { fill: ink } : { fill: "none", stroke: ink, strokeWidth: 3, strokeOpacity: 0.45 })} />;
    })}
  </>, "0 0 120 120"),
  strained: glyph(<><circle cx={50} cy={50} r={34} fill="#1d1d1f" /><ellipse cx={40} cy={38} rx={12} ry={7} fill="#fff" fillOpacity={0.28} /></>),
  unstrained: glyph(<circle cx={50} cy={50} r={32} fill="none" stroke={ink} strokeWidth={5} strokeDasharray="9 8" />)
};

const vectors: Record<TargetCardDirection, [number, number]> = { N: [0, -1], NE: [Math.sqrt(3) / 2, -0.5], SE: [Math.sqrt(3) / 2, 0.5], S: [0, 1], SW: [-Math.sqrt(3) / 2, 0.5], NW: [-Math.sqrt(3) / 2, -0.5] };
export const directionNames: Record<TargetCardDirection, string> = { N: "north", NE: "north-east", SE: "south-east", S: "south", SW: "south-west", NW: "north-west" };

/**
 * The tie, as on the printed card: a small board outline (N marked), one arrow
 * in the card's direction and the tile it points to filled in, with two other
 * tied tiles held back. The same geometry as design/target-cards/render-target.mjs.
 */
export function TieDiagram({ direction }: { direction: TargetCardDirection }) {
  const [dx, dy] = vectors[direction];
  const [px, py] = [-dy, dx];
  const W = 320, H = 214, cx = W / 2, cy = H / 2 + 6, hw = 136, hh = 84, r = 21;
  const reach = Math.min(dx ? hw / Math.abs(dx) : 1e9, dy ? hh / Math.abs(dy) : 1e9) - r - 10;
  const win = [cx + dx * reach, cy + dy * reach];
  const others = [
    [cx - dx * reach * 0.25 + px * 58, cy - dy * reach * 0.25 + py * 58],
    [cx + dx * reach * 0.2 - px * 60, cy + dy * reach * 0.2 - py * 60]
  ].map(([x, y]) => [Math.max(cx - hw + r + 6, Math.min(cx + hw - r - 6, x)), Math.max(cy - hh + r + 6, Math.min(cy + hh - r - 6, y))]);
  const tail = [cx - dx * reach * 0.92, cy - dy * reach * 0.92];
  const tip = [win[0] - dx * (r + 12), win[1] - dy * (r + 12)];
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return <svg className="tface-diagram" viewBox={`0 0 ${W} ${H + 8}`} role="img" aria-label={`Arrow pointing ${directionNames[direction]}`}>
    <text x={cx} y={16} textAnchor="middle" fontFamily="Alegreya Sans, sans-serif" fontWeight={500} fontSize={22} fill={ink} fillOpacity={0.6}>N</text>
    <rect x={cx - hw} y={cy - hh} width={hw * 2} height={hh * 2} rx={14} fill="rgba(62,85,102,0.07)" stroke={ink} strokeWidth={3} strokeOpacity={0.45} strokeDasharray="10 7" />
    {others.map(([x, y], index) => <Hex key={index} cx={x} cy={y} r={r} fill="#f6f0df" stroke={ink} strokeWidth={4} />)}
    <Hex cx={win[0]} cy={win[1]} r={r} fill={steel} stroke={ink} strokeWidth={4} />
    <line x1={tail[0]} y1={tail[1]} x2={tip[0] - dx * 20} y2={tip[1] - dy * 20} stroke={steel} strokeWidth={11} strokeLinecap="round" />
    <g transform={`translate(${tip[0]} ${tip[1]}) rotate(${angle})`}><path d="M8 0 L-30 -22 L-30 22 Z" fill={steel} /></g>
  </svg>;
}

interface TargetCardProps {
  card: TargetCardDefinition;
  className?: string;
  sizes?: string;
}

/** A Target Card as printed: the silver front, four preference rows and the tie. */
export function TargetCard({ card, className = "", sizes }: TargetCardProps) {
  const description = describeTargetCard(card);
  const open = isOpenTargetCard(card);
  const rows = [
    ["Tile class", description.tileClass, card.tileClass === "any" ? null : glyphs[card.tileClass]],
    ["Tile side", description.side, card.side === "any" ? null : glyphs[card.side]],
    ["Adjacency", description.adjacency, card.adjacency === "any" ? null : glyphs.ring(card.adjacency === "threePlus" ? 3 : 2)],
    ["Current Strain", description.strain, card.strain === "any" ? null : glyphs[card.strain]]
  ] as const;
  return <CardFace
    kind="target"
    sizes={sizes}
    className={`tface ${open ? "target-card-open" : "target-card-structured"} ${className}`.trim()}
    label={`Target Card ${card.id}${open ? ", Open Target" : `, tie direction ${card.direction}`}`}
  >
    <div className="tface-glow" aria-hidden="true" />
    <p className="tface-type">Target</p>
    <h3 className="tface-title">Card {String(card.id).padStart(2, "0")}</h3>
    <div className="tface-rows">
      {rows.map(([label, value, mark]) => <section className="tface-row" key={label}>
        <p className="tface-label">{label}</p>
        <strong className="tface-value">{mark && <span className="tface-glyph">{mark}</span>}<span>{value}</span></strong>
      </section>)}
    </div>
    {open || !card.direction
      ? <section className="tface-outcome"><p className="tface-label">Open target</p><strong className="tface-big">Choose any eligible tile</strong><small className="tface-small">Keep to any limits set by the effect.</small></section>
      : <section className="tface-outcome is-tied"><p className="tface-label">If still tied</p>
        <div className="tface-tie"><TieDiagram direction={card.direction} /><div className="tface-tie-words"><strong className="tface-big">Take the tile the arrow points to</strong><small className="tface-small">among the tied tiles, <span className="tface-direction">{card.direction}</span></small></div></div>
      </section>}
    <p className="tface-foot">Work down the rows. Skip any row no tile matches.</p>
  </CardFace>;
}
