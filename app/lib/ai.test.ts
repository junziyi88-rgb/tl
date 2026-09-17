import { describe, expect, it } from 'vitest';
import { buildAiMessages, parseAiInterpretation } from './ai';
import { BUILT_IN_SPREADS, CARDS } from './tarot';

describe('AI interpretation contract', () => {
  it('grounds the prompt in the question, position, card, orientation, and local meaning', () => {
    const spread = BUILT_IN_SPREADS[3];
    const messages = buildAiMessages({
      question: '这段关系值得继续吗？',
      spread,
      cards: [{ cardId: CARDS[0].id, orientation: 'reversed', positionId: spread.positions[0].id, position: spread.positions[0].question }],
    });
    const text = JSON.stringify(messages);
    expect(text).toContain('这段关系值得继续吗？');
    expect(text).toContain(spread.positions[0].question);
    expect(text).toContain(CARDS[0].nameZh);
    expect(text).toContain('逆位');
    expect(text).toContain('仅供娱乐与自我反思');
  });

  it('accepts bounded JSON and rejects missing card interpretations', () => {
    const parsed = parseAiInterpretation(JSON.stringify({
      cards: [{ positionId: 'p1', text: '这张牌提示你先观察现状，再确认自己的真实需求。'.repeat(5) }],
      synthesis: '关系仍有沟通空间，但需要以事实而不是猜测为依据。'.repeat(4),
      advice: '先进行一次坦诚而具体的沟通。'.repeat(3),
      disclaimer: '仅供娱乐与自我反思。',
    }), ['p1']);
    expect(parsed.cards).toHaveLength(1);
    expect(() => parseAiInterpretation('{"cards":[]}', ['p1'])).toThrow();
  });
});
