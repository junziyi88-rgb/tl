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
  it('contains the CloudBase web-function bootstrap', () => {
    expect(
      existsSync(
        new URL('../functions/tarot-ai/scf_bootstrap', import.meta.url),
      ),
    ).toBe(true);
    expect(
      existsSync(new URL('../functions/tarot-ai/server.js', import.meta.url)),
    ).toBe(true);
  });
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

  it('exposes the same handler through a POST-only HTTP response', async () => {
    const entryPath = new URL(
      '../functions/tarot-ai/index.js',
      import.meta.url,
    );
    const { createHttpHandler } = require(
      entryPath.pathname.replace(/^\/(?:([A-Z]:))/, '$1'),
    );
    const response = await createHttpHandler(async (input: unknown) => ({
      received: input,
    }))({
      httpMethod: 'POST',
      body: JSON.stringify({ question: '测试问题' }),
      isBase64Encoded: false,
    });

    expect(response).toMatchObject({
      statusCode: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
    expect(JSON.parse(response.body)).toEqual({
      received: { question: '测试问题' },
    });

    const rejected = await createHttpHandler(async () => ({}))({
      httpMethod: 'GET',
    });
    expect(rejected.statusCode).toBe(405);
  });
});
