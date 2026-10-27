import { describe, expect, it } from 'vitest';

const tencentOrigin =
  'https://gongjian-tarot-d2geleaahb9b8605e-1484522062.tcloudbaseapp.com';

async function createHandler() {
  const { createFetchHandler } = await import(
    '../functions/tarot-ai/http.mjs'
  );
  return createFetchHandler({
    handleDataRequest: async (action: string) => ({ action }),
    handleAiRequest: async (input: unknown) => ({ input }),
  });
}

describe('Neon Function HTTP boundary', () => {
  it('allows Tencent preflight and rejects every other browser origin', async () => {
    const handler = await createHandler();
    const allowed = await handler(
      new Request('https://neon.example/', {
        method: 'OPTIONS',
        headers: { origin: tencentOrigin },
      }),
    );
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-origin')).toBe(
      tencentOrigin,
    );

    const rejected = await handler(
      new Request('https://neon.example/', {
        method: 'POST',
        headers: {
          origin: 'https://gongjian-tarot.junziyi88.chatgpt.site',
          'content-type': 'application/json',
        },
        body: '{}',
      }),
    );
    expect(rejected.status).toBe(403);
    await expect(rejected.json()).resolves.toEqual({ error: '来源无效。' });
  });

  it('routes database actions and AI requests through injected handlers', async () => {
    const handler = await createHandler();
    const headers = {
      origin: tencentOrigin,
      'content-type': 'application/json',
    };
    const data = await handler(
      new Request('https://neon.example/', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'list_readings', params: {} }),
      }),
    );
    expect(await data.json()).toEqual({ data: { action: 'list_readings' } });

    const ai = await handler(
      new Request('https://neon.example/', {
        method: 'POST',
        headers,
        body: JSON.stringify({ question: '测试' }),
      }),
    );
    expect(await ai.json()).toEqual({ input: { question: '测试' } });
  });
});
