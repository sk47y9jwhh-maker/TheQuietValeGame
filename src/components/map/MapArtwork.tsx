import {
  mapArtworkLayers,
  mapLayout,
  type MapArtworkLayerKind
} from "../../data/map";
import type { ReactNode } from "react";

const activeMapArtworkLayers = mapArtworkLayers.filter((layer) => layer.src);

export const hasMapArtwork = activeMapArtworkLayers.length > 0;

interface MapMountProps {
  children: ReactNode;
  canvasClassName?: string;
}

export function MapMount({
  children,
  canvasClassName = ""
}: MapMountProps) {
  return (
    <div className="map-mount">
      <span aria-hidden="true" className="map-mount-keyline" />
      {(["north-west", "north-east", "south-east", "south-west"] as const).map(
        (corner) => (
          <span
            aria-hidden="true"
            className={`map-mount-corner map-mount-corner-${corner}`}
            key={corner}
          >
            <span className="map-mount-rivet" />
          </span>
        )
      )}
      <span
        aria-hidden="true"
        className="map-mount-studs map-mount-studs-north"
      />
      <span
        aria-hidden="true"
        className="map-mount-studs map-mount-studs-south"
      />
      <div className={`map-canvas ${canvasClassName}`.trim()}>{children}</div>
    </div>
  );
}

export function MapArtworkCredit() {
  if (!hasMapArtwork) return null;

  return (
    <p className="map-artwork-credit">
      Map artwork by Giovanni Spadaro and Daniele Nicotra
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
