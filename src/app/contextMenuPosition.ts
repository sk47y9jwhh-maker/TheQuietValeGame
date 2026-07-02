export interface FloatingMenuPosition {
  left: number;
  top: number;
}

export function fitContextMenuToViewport(
  anchorX: number,
  anchorY: number,
  menuWidth: number,
  menuHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  margin = 8,
  gap = 8
): FloatingMenuPosition {
  const maxLeft = Math.max(margin, viewportWidth - menuWidth - margin);
  const maxTop = Math.max(margin, viewportHeight - menuHeight - margin);
  const left = Math.min(Math.max(margin, anchorX), maxLeft);
  const below = anchorY + gap;
  const preferredTop = below + menuHeight <= viewportHeight - margin
    ? below
    : anchorY - menuHeight - gap;

  return {
    left,
    top: Math.min(Math.max(margin, preferredTop), maxTop)
  };
}
