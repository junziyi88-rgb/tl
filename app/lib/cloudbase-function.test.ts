import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const functionPath = new URL(
  '../functions/tarot-ai/index.cjs',
  import.meta.url,
);

describe('CloudBase AI event function', () => {
  it('provides a deployable, isolated handler', () =>
    expect(existsSync(functionPath)).toBe(true));
  it('validates JSON strictly, orders card output, and hides provider errors', async () => {
    expect(existsSync(functionPath)).toBe(true);
    if (!existsSync(functionPath)) return;
    const { parseAiInterpretation, createHandler } = require(
      functionPath.pathname.replace(/^\/(?:([A-Z]:))/, '$1'),
    );
    const value = {
      cards: [{ positionId: 'p1', text: '观察'.repeat(105) }],
      synthesis: '综合'.repeat(45),
      advice: '建议'.repeat(20),
      disclaimer: '仅供娱乐与自我反思。',
    };
    expect(parseAiInterpretation(JSON.stringify(value), ['p1'])).toEqual({
      ...value,
      cards: [{ ...value.cards[0], text: value.cards[0].text.slice(0, 200) }],
    });
    expect(
      parseAiInterpretation(`\`\`\`json\n${JSON.stringify(value)}\n\`\`\``, [
        'p1',
      ]),
    ).toMatchObject({
      cards: [{ positionId: 'p1', text: expect.any(String) }],
    });
    for (const bad of [
      null,
      { ...value, cards: [] },
      { ...value, cards: [{ positionId: 'p2', text: '观察'.repeat(60) }] },
      { ...value, cards: [{ positionId: 'p1', text: 123 }] },
      { ...value, cards: [{ positionId: 'p1', text: '字'.repeat(99) }] },
    ])
      expect(() =>
        parseAiInterpretation(JSON.stringify(bad), ['p1']),
      ).toThrow();
    const handler = createHandler({ getKey: () => '', fetcher: fetch });
    expect(await handler({})).toMatchObject({
      error: expect.stringMatching(/[\u4e00-\u9fff]/),
    });
  });
});
