import targetCardArtwork from "../../assets/target-cards/target-card-vale-blue-rose-template.webp";
import {
  describeTargetCard,
  isOpenTargetCard
} from "../../data/targetCards";
import type {
  TargetCardDefinition,
  TargetCardDirection
} from "../../engine/types";

const directions: TargetCardDirection[] = ["NE", "E", "SE", "SW", "W", "NW"];

interface TargetCardProps {
  card: TargetCardDefinition;
  className?: string;
}

export function TargetCard({ card, className = "" }: TargetCardProps) {
  const description = describeTargetCard(card);
  const open = isOpenTargetCard(card);
  const preferences = [
    ["Tile class", description.tileClass],
    ["Tile side", description.side],
    ["Adjacency", description.adjacency],
    ["Current Strain", description.strain]
  ] as const;

  return (
    <div
      aria-label={`Target Card ${card.id}${open ? ", Open Target" : `, tie direction ${card.direction}`}`}
      className={`physical-target-card ${open ? "target-card-open" : "target-card-structured"} ${className}`.trim()}
    >
      <img
        alt=""
        aria-hidden="true"
        className="physical-target-card-artwork"
        draggable={false}
        src={targetCardArtwork}
      />

      <p className="physical-target-card-type">Target</p>
      <h3 className="physical-target-card-title">
        Card {String(card.id).padStart(2, "0")}
      </h3>

      <div className="physical-target-card-preferences">
        {preferences.map(([label, value]) => (
          <section className="physical-target-card-preference" key={label}>
            <p className="physical-target-card-label">{label}</p>
            <strong className="physical-target-card-value">{value}</strong>
            <small className="physical-target-card-qualifier">Unless specified</small>
          </section>
        ))}
      </div>

      {open ? (
        <section className="physical-target-card-outcome physical-target-card-open-outcome">
          <p className="physical-target-card-open-label">Open target</p>
          <strong>Choose any eligible tile</strong>
          <small>Apply any restrictions specified by the triggering effect.</small>
        </section>
      ) : (
        <section className="physical-target-card-outcome physical-target-card-direction">
          <p className="physical-target-card-label">Tie direction</p>
          <div className="physical-target-card-direction-row">
            <span aria-hidden="true" className="physical-target-card-direction-ring">
              {directions.map((direction) => (
                <span
                  className={`physical-target-card-direction-hex direction-${direction.toLowerCase()} ${
                    card.direction === direction ? "selected" : ""
                  }`}
                  key={direction}
                />
              ))}
            </span>
            <strong>{card.direction}</strong>
          </div>
        </section>
      )}
    </div>
  );
}
