import { CARD_MAP, CARD_MEANINGS, type AiInterpretation, type DrawnCard, type SpreadDefinition } from './tarot';

type AiInput = { question: string; spread: SpreadDefinition; cards: DrawnCard[] };
type AiMessage = { role: 'system' | 'user'; content: string };

export function buildAiMessages(input: AiInput): AiMessage[] {
  const cardGrounding = input.cards.map((drawn) => {
    const card = CARD_MAP.get(drawn.cardId);
    const meaning = CARD_MEANINGS[drawn.cardId];
    return {
      positionId: drawn.positionId,
      positionQuestion: drawn.position,
      card: card?.nameZh ?? drawn.cardId,
      orientation: drawn.orientation === 'reversed' ? '逆位' : '正位',
      groundedMeaning: drawn.orientation === 'reversed' ? meaning?.reversed : meaning?.upright,
    };
  });
  return [
    {
      role: 'system',
      content: [
        '你是克制、温和的中文塔罗辅助解读员。只能依据提供的牌面和本地牌义底稿，不得修改抽牌结果或虚构牌。',
        '每张牌结合主问题与对应牌位写 100–200 个中文字；避免绝对断言，不预测确定的生死、疾病、法律或投资结果。',
        '输出纯 JSON：{"cards":[{"positionId":"...","text":"..."}],"synthesis":"...","advice":"...","disclaimer":"仅供娱乐与自我反思。"}',
        'cards 必须与输入牌位一一对应；synthesis 80–240 字，advice 30–120 字。',
      ].join('\n'),
    },
    { role: 'user', content: JSON.stringify({ question: input.question, spread: input.spread.name, cards: cardGrounding }) },
  ];
}

export function parseAiInterpretation(raw: string, expectedPositionIds: string[]): AiInterpretation {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const value = JSON.parse(cleaned) as Partial<AiInterpretation>;
  if (!Array.isArray(value.cards) || value.cards.length !== expectedPositionIds.length) throw new Error('AI_FORMAT');
  const actualIds = value.cards.map((card) => String(card?.positionId || ''));
  if (new Set(actualIds).size !== actualIds.length || expectedPositionIds.some((id) => !actualIds.includes(id))) throw new Error('AI_FORMAT');
  const cards = value.cards.map((card) => ({ positionId: String(card.positionId), text: String(card.text || '').trim() }));
  if (cards.some((card) => card.text.length < 60 || card.text.length > 260)) throw new Error('AI_LENGTH');
  const synthesis = String(value.synthesis || '').trim();
  const advice = String(value.advice || '').trim();
  if (!synthesis || synthesis.length > 320 || !advice || advice.length > 160) throw new Error('AI_FORMAT');
  return { cards, synthesis, advice, disclaimer: '仅供娱乐与自我反思。' };
}

export async function requestDeepSeekInterpretation(input: AiInput, apiKey: string, fetcher: typeof fetch = fetch): Promise<AiInterpretation> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetcher('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: buildAiMessages(input),
        response_format: { type: 'json_object' },
        max_tokens: Math.min(3600, 500 + input.cards.length * 360),
        temperature: 0.65,
        thinking: { type: 'disabled' },
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(response.status === 401 ? 'AI_AUTH' : response.status === 402 ? 'AI_QUOTA' : 'AI_UPSTREAM');
    const body = await response.json() as { choices?: { message?: { content?: string } }[] };
    return parseAiInterpretation(body.choices?.[0]?.message?.content ?? '', input.cards.map((card) => card.positionId));
  } finally {
    clearTimeout(timeout);
  }
}
