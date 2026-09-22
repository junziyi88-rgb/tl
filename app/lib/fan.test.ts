import { describe, expect, it } from 'vitest';
import {
  clampFanCenter,
  fanCardTransform,
  fanCenterFromDrag,
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
    expect(fanCenterFromDrag(38, 48)).toBe(35);
    expect(fanCenterFromDrag(38, -48)).toBe(41);
    expect(fanCenterFromDrag(38, 8)).toBe(37.5);
  });
});
