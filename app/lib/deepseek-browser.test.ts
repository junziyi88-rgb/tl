import { describe, expect, it, vi } from 'vitest';
import { requestDeepSeekInterpretation } from './deepseek-browser';

const input = {
  question: '我该如何沟通？',
  spread: {
    id: 'one-card',
    name: '一张牌',
    positions: [{ id: 'p1', question: '本次指引' }],
  },
  cards: [
    {
      cardId: 'ar00',
      orientation: 'upright' as const,
      positionId: 'p1',
      position: '本次指引',
    },
  ],
  draftId: 'draft-1',
};

describe('browser DeepSeek client', () => {
  it('calls DeepSeek directly with the public build-time key', async () => {
    const interpretation = {
      cards: [{ positionId: 'p1', text: '牌义解读'.repeat(30) }],
      synthesis: '综合观察'.repeat(24),
      advice: '行动建议'.repeat(10),
      disclaimer: '模型输出不可信',
    };
    let calledUrl: RequestInfo | URL | undefined;
    let calledInit: RequestInit | undefined;
    const fetcher = vi.fn(
      async (url: RequestInfo | URL, init?: RequestInit) => {
        calledUrl = url;
        calledInit = init;
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(interpretation) } }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    ) as typeof fetch;

    const result = await requestDeepSeekInterpretation(
      input,
      'public-test-key',
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledOnce();
    expect(calledUrl).toBe('https://api.deepseek.com/chat/completions');
    expect(calledInit?.headers).toMatchObject({
      authorization: 'Bearer public-test-key',
      'content-type': 'application/json',
    });
    const body = JSON.parse(String(calledInit?.body));
    expect(body).toMatchObject({
      model: 'deepseek-flash',
      thinking: { type: 'disabled' },
      response_format: { type: 'json_object' },
    });
    expect(body.messages[1].content).toContain('我该如何沟通');
    expect(body.messages[1].content).toContain('愚者');
    expect(result.disclaimer).toBe('仅供娱乐与自我反思。');
  });

  it('refuses to send a request when the public key is empty', async () => {
    await expect(
      requestDeepSeekInterpretation(input, '', vi.fn() as unknown as typeof fetch),
    ).rejects.toThrow('AI 服务尚未配置');
  });
});
