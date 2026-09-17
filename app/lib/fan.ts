export type FanCardTransform = { x: number; y: number; rotation: number };

export function clampFanCenter(center: number, total: number, visibleCount = 21) {
  const half = Math.floor(Math.min(visibleCount, total) / 2);
  return Math.min(Math.max(center, half), Math.max(half, total - half - 1));
}

export function visibleFanIndexes(total: number, center: number, visibleCount = 21) {
  const count = Math.min(visibleCount, total);
  const half = Math.floor(count / 2);
  const safeCenter = Math.round(clampFanCenter(center, total, count));
  const start = Math.max(0, Math.min(safeCenter - half, total - count));
  return Array.from({ length: count }, (_, index) => start + index);
}

export function fanCardTransform(
  slot: number,
  centerSlot: number,
  viewportWidth: number,
): FanCardTransform {
  const relative = slot - centerSlot;
  const step = Math.max(18, Math.min(34, viewportWidth / 15));
  return {
    x: Math.round(relative * step),
    y: Math.round(relative * relative * Math.max(0.8, viewportWidth / 560)),
    rotation: Number((relative * 2.65).toFixed(2)),
  };
}
