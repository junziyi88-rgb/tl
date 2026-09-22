export type FanCardTransform = { x: number; y: number; rotation: number };
export type FanPointerSample = { x: number; time: number };
export type FanMotionState = { position: number; velocity: number };
export type FanMotionStep = FanMotionState & { settled: boolean };

export const FAN_DRAG_THRESHOLD_PX = 8;
export const FAN_PIXELS_PER_CARD = 14;
export const FAN_POOL_SIZE = 25;
export const FAN_MAX_OVERSCROLL_CARDS = 5;
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

export function fanPoolIndexes(
  total: number,
  center: number,
  poolSize = FAN_POOL_SIZE,
) {
  const count = Math.min(Math.max(0, poolSize), Math.max(0, total));
  if (!count) return [];
  const safeCenter = Math.round(clampFanCenter(center, total));
  const start = Math.min(
    Math.max(0, safeCenter - Math.floor(count / 2)),
    total - count,
  );
  return Array.from({ length: count }, (_, index) => start + index);
}

export function elasticFanCenter(
  value: number,
  total: number,
  maxOverscroll = FAN_MAX_OVERSCROLL_CARDS,
) {
  const last = Math.max(0, total - 1);
  if (value >= 0 && value <= last) return value;
  const edge = value < 0 ? 0 : last;
  const distance = Math.abs(value - edge);
  const resisted =
    (Math.max(0, maxOverscroll) * distance) / (distance + 3.5);
  return edge + Math.sign(value - edge) * resisted;
}

export function stepFanMotion(
  state: FanMotionState,
  target: number,
  elapsedMs: number,
  spring = { stiffness: 190, damping: 24 },
): FanMotionStep {
  const elapsedSeconds = Math.min(Math.max(elapsedMs, 0), 32) / 1000;
  const acceleration =
    (target - state.position) * spring.stiffness -
    state.velocity * spring.damping;
  const velocity = state.velocity + acceleration * elapsedSeconds;
  const position = state.position + velocity * elapsedSeconds;
  const settled =
    Math.abs(target - position) < 0.002 && Math.abs(velocity) < 0.02;
  return settled
    ? { position: target, velocity: 0, settled: true }
    : { position, velocity, settled: false };
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
    return clampFanCenter(center, total);
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
  return clampFanCenter(projectedCenter, total);
}

export function fanWheelDelta(
  deltaX: number,
  deltaY: number,
  shiftKey: boolean,
) {
  if (Math.abs(deltaX) > Math.abs(deltaY)) return deltaX;
  return shiftKey ? deltaY : 0;
}
