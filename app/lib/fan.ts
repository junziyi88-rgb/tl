export type FanCardTransform = { x: number; y: number; rotation: number };
export type FanPointerSample = { x: number; time: number };

export const FAN_DRAG_THRESHOLD_PX = 8;
export const FAN_PIXELS_PER_CARD = 14;
const FAN_VELOCITY_WINDOW_MS = 100;
const FAN_INERTIA_THRESHOLD_PX_PER_MS = 0.25;
const FAN_INERTIA_PROJECTION_MS = 180;
const FAN_MIN_INERTIA_CARDS = 4;
const FAN_MAX_INERTIA_CARDS = 12;

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
  pixelsPerCard = FAN_PIXELS_PER_CARD,
) {
  return startCenter - deltaX / Math.max(1, pixelsPerCard);
}

export function recentFanVelocity(
  samples: readonly FanPointerSample[],
  windowMs = FAN_VELOCITY_WINDOW_MS,
) {
  if (samples.length < 2) return 0;
  const latest = samples[samples.length - 1];
  const cutoff = latest.time - windowMs;
  const first = samples.find((sample) => sample.time >= cutoff) ?? latest;
  const elapsed = latest.time - first.time;
  return elapsed > 0 ? (latest.x - first.x) / elapsed : 0;
}

export function fanInertiaTarget(
  center: number,
  velocityPxPerMs: number,
  total: number,
) {
  if (Math.abs(velocityPxPerMs) < FAN_INERTIA_THRESHOLD_PX_PER_MS) {
    return Math.round(clampFanCenter(center, total));
  }
  const projectedCards = Math.min(
    FAN_MAX_INERTIA_CARDS,
    Math.max(
      FAN_MIN_INERTIA_CARDS,
      (Math.abs(velocityPxPerMs) * FAN_INERTIA_PROJECTION_MS) /
        FAN_PIXELS_PER_CARD,
    ),
  );
  const projectedCenter = center - Math.sign(velocityPxPerMs) * projectedCards;
  return Math.round(clampFanCenter(projectedCenter, total));
}

export function fanWheelDelta(
  deltaX: number,
  deltaY: number,
  shiftKey: boolean,
) {
  if (Math.abs(deltaX) > Math.abs(deltaY)) return deltaX;
  return shiftKey ? deltaY : 0;
}
