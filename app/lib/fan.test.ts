import { describe, expect, it } from 'vitest';
import { clampFanCenter, fanCardTransform, visibleFanIndexes } from './fan';

describe('tarot fan geometry', () => {
  it('clamps the center so the first and last windows cover the full deck', () => {
    expect(clampFanCenter(-20, 78, 21)).toBe(10);
    expect(clampFanCenter(100, 78, 21)).toBe(67);
    expect(visibleFanIndexes(78, 10, 21)).toEqual(Array.from({ length: 21 }, (_, index) => index));
    expect(visibleFanIndexes(78, 67, 21)).toEqual(Array.from({ length: 21 }, (_, index) => index + 57));
  });

  it('produces a symmetric arc around the center card', () => {
    const left = fanCardTransform(0, 10, 390);
    const center = fanCardTransform(10, 10, 390);
    const right = fanCardTransform(20, 10, 390);
    expect(left.x).toBe(-right.x);
    expect(left.rotation).toBe(-right.rotation);
    expect(left.y).toBe(right.y);
    expect(center).toMatchObject({ x: 0, y: 0, rotation: 0 });
  });
});
