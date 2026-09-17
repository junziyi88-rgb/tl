import { describe, expect, it } from 'vitest';
import { clampFanCenter, fanCardTransform, visibleFanIndexes } from './fan';

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
    expect(left.rotation).toBe(-right.rotation);
  });
});
