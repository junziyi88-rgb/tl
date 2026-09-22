export type FanCardTransform = { x: number; y: number; rotation: number };

export function clampFanCenter(center: number, total: number) {
  return Math.min(Math.max(center, 0), Math.max(0, total - 1));
}

export function visibleFanIndexes(total: number, center: number, visibleCount = 21) {
  const count = Math.min(visibleCount, total);
  const half = Math.floor(count / 2);
  const safeCenter = Math.round(clampFanCenter(center, total));
  const start = Math.max(0, safeCenter - half);
  const end = Math.min(total - 1, safeCenter + half);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export function fanCardTransform(
  slot: number,
  centerSlot: number,
  viewportWidth: number,
): FanCardTransform {
  const relative = slot - centerSlot;
  const step = Math.max(20, Math.min(34, viewportWidth / 14));
  const arc = Math.max(0.62, Math.min(1, viewportWidth / 520));
  return {
    x: Math.round(relative * step),
    y: Math.round(relative * relative * arc),
    rotation: Number((relative * 2.8).toFixed(2)),
  };
}

export function fanCenterFromDrag(
  startCenter: number,
  deltaX: number,
  pixelsPerCard = 16,
) {
  return startCenter - deltaX / Math.max(1, pixelsPerCard);
}
