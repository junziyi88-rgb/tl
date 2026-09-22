import { describe, expect, it } from 'vitest';
import {
  FAN_DRAG_THRESHOLD_PX,
  FAN_PIXELS_PER_CARD,
  clampFanCenter,
  fanCardTransform,
  fanCenterFromDrag,
  fanInertiaTarget,
  fanWheelDelta,
  recentFanVelocity,
  visibleFanIndexes,
} from './fan';

describe('tarot fan geometry', () => {
  it('keeps a 21-card viewport within the 78-card deck', () => {
    expect(clampFanCenter(-50, 78)).toBe(0);
    expect(clampFanCenter(200, 78)).toBe(77);
    expect(visibleFanIndexes(78, 0, 21)).toEqual(
      Array.from({ length: 11 }, (_, index) => index),
    );
    expect(visibleFanIndexes(78, 77, 21)).toEqual(
      Array.from({ length: 11 }, (_, index) => index + 67),
    );
  });

  it('lays cards out as a symmetric 2D arc', () => {
    const left = fanCardTransform(6, 10, 390);
    const middle = fanCardTransform(10, 10, 390);
    const right = fanCardTransform(14, 10, 390);

    expect(middle).toEqual({ x: 0, y: 0, rotation: 0 });
    expect(left.x).toBe(-right.x);
    expect(left.y).toBe(right.y);
    expect(left.y).toBeGreaterThan(0);
    expect(left.rotation).toBe(-right.rotation);
    expect(left.rotation).toBeLessThan(0);
  });

  it('maps a short drag to immediate fan movement', () => {
    expect(FAN_PIXELS_PER_CARD).toBe(14);
    expect(FAN_DRAG_THRESHOLD_PX).toBe(8);
    expect(fanCenterFromDrag(38, 42)).toBe(35);
    expect(fanCenterFromDrag(38, -42)).toBe(41);
    expect(fanCenterFromDrag(38, 7)).toBe(37.5);
  });

  it('calculates velocity from only the latest 100ms of pointer samples', () => {
    expect(
      recentFanVelocity([
        { x: 0, time: 0 },
        { x: 10, time: 40 },
        { x: 38, time: 100 },
        { x: 52, time: 140 },
      ]),
    ).toBeCloseTo(0.42);
    expect(recentFanVelocity([{ x: 12, time: 100 }])).toBe(0);
  });

  it('snaps slow releases and projects fast flicks by four to twelve cards', () => {
    expect(fanInertiaTarget(38.3, 0.2, 78)).toBe(38);
    expect(fanInertiaTarget(38, 0.5, 78)).toBe(32);
    expect(fanInertiaTarget(38, -2, 78)).toBe(50);
    expect(fanInertiaTarget(2, 1, 78)).toBe(0);
    expect(fanInertiaTarget(75, -1, 78)).toBe(77);
  });

  it('uses horizontal wheel or shifted vertical wheel without hijacking page scroll', () => {
    expect(fanWheelDelta(24, 4, false)).toBe(24);
    expect(fanWheelDelta(0, 32, true)).toBe(32);
    expect(fanWheelDelta(0, 32, false)).toBe(0);
  });
});
