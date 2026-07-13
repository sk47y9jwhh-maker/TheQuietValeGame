import {
  mapArtworkLayers,
  mapLayout,
  type MapArtworkLayerKind
} from "../../data/map";

const activeMapArtworkLayers = mapArtworkLayers.filter((layer) => layer.src);

export const hasMapArtwork = activeMapArtworkLayers.length > 0;

export function MapArtworkCredit() {
  if (!hasMapArtwork) return null;

  return (
    <p className="map-artwork-credit">
      Map artwork by Giovanni Spadaro &amp; Daniele Nicotra
      <span aria-hidden="true"> · </span>
      Map image and site © 2026{" "}
      <a href="mailto:Robert@thequietvalegame.com">
        Robert@thequietvalegame.com
      </a>
      <span aria-hidden="true"> · </span>
      All rights reserved.
    </p>
  );
}

interface MapArtworkImageProps {
  kind: MapArtworkLayerKind;
  hexRadius?: number;
  originX?: number;
  originY?: number;
}

export function MapArtworkImage({
  kind,
  hexRadius = mapLayout.hexRadius,
  originX = mapLayout.originX,
  originY = mapLayout.originY
}: MapArtworkImageProps) {
  const scale = hexRadius / mapLayout.hexRadius;
  const translateX = originX - mapLayout.originX * scale;
  const translateY = originY - mapLayout.originY * scale;
  const transform = `translate(${translateX} ${translateY}) scale(${scale})`;

  return (
    <>
      {activeMapArtworkLayers
        .filter((layer) => layer.kind === kind)
        .map((layer) => (
          <image
            aria-hidden="true"
            className={`map-artwork-layer map-artwork-${layer.kind}`}
            height={layer.frame.height}
            href={layer.src}
            key={layer.id}
            opacity={layer.opacity}
            preserveAspectRatio="none"
            transform={transform}
            width={layer.frame.width}
            x={layer.frame.x}
            y={layer.frame.y}
          />
        ))}
    </>
  );
}
