import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_SPREADS,
  CARDS,
  CARD_MEANINGS,
  normalizeSpread,
  validateSpread,
} from './tarot';
import { validateDrawRequest, validateReading } from './server';

describe('tarot catalog and spreads', () => {
  it('contains the complete deck, meanings, and exactly the nine approved spreads', () => {
    expect(CARDS).toHaveLength(78);
    expect(Object.keys(CARD_MEANINGS)).toHaveLength(78);
    expect(BUILT_IN_SPREADS.map((spread) => spread.name)).toEqual([
      '维纳斯之爱', '爱的解答', '心之声', '他心知', '恋人金字塔',
      '情感之境', '爱情十字', '关系前景', '友谊牌阵',
    ]);
    expect(BUILT_IN_SPREADS.some((spread) => spread.name.includes('钻石'))).toBe(false);
    expect(BUILT_IN_SPREADS.at(-1)?.positions).toHaveLength(6);
    expect(BUILT_IN_SPREADS.at(-1)?.positions.at(-1)?.question).toBe('对方期待的未来发展');
  });

  it('accepts private spreads with 1–12 named positions and rejects invalid spreads', () => {
    const spread = normalizeSpread({
      id: 'custom-1',
      name: '临时关系观察',
      positions: [{ id: 'p1', question: '我真正担心什么？' }],
    });
    expect(validateSpread(spread)).toEqual({ ok: true, value: spread });
    expect(validateSpread({ ...spread, positions: [] }).ok).toBe(false);
    expect(validateSpread({ ...spread, positions: Array.from({ length: 13 }, (_, index) => ({ id: `p${index}`, question: '问题' })) }).ok).toBe(false);
  });

  it('requires the question before drawing and allows an optional personal interpretation', () => {
    const spread = BUILT_IN_SPREADS[3];
    expect(validateDrawRequest({ question: '', spread }).ok).toBe(false);
    expect(validateDrawRequest({ question: '对方现在如何看我？', spread }).ok).toBe(true);
    const cards = spread.positions.map((position, index) => ({
      cardId: CARDS[index].id,
      orientation: 'upright' as const,
      positionId: position.id,
      position: position.question,
    }));
    expect(validateReading({
      question: '对方现在如何看我？', mode: 'online', spread, cards,
      interpretation: '', aiInterpretation: null, tags: [], idempotencyKey: 'draft-1',
    }).ok).toBe(true);
  });
});
