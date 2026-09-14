import {
  CARDS,
  CARD_MAP,
  isMode,
  validateSpread,
  type AiInterpretation,
  type DrawMode,
  type DrawnCard,
  type SpreadDefinition,
} from './tarot';

export function jsonError(message: string, status = 400) { return Response.json({ error: message }, { status }) }
export function bearerToken(request: Request) {
  const value = request.headers.get('authorization') ?? '';
  return value.startsWith('Bearer ') ? value.slice(7) : '';
}
export function secureRandomIndex(max: number) {
  const limit = Math.floor(0x100000000 / max) * max;
  const values = new Uint32Array(1);
  do crypto.getRandomValues(values); while (values[0] >= limit);
  return values[0] % max;
}

export function drawCards(spread: SpreadDefinition): DrawnCard[] {
  const pool = CARDS.map((card) => card.id);
  return spread.positions.map((position) => {
    const index = secureRandomIndex(pool.length);
    return {
      cardId: pool.splice(index, 1)[0],
      positionId: position.id,
      position: position.question,
      orientation: secureRandomIndex(2) === 0 ? 'upright' : 'reversed',
    };
  });
}

export function validateDrawRequest(input: Record<string, unknown>) {
  const question = typeof input.question === 'string' ? input.question.trim() : '';
  if (!question || question.length > 160) return { ok: false as const, error: '请先填写 160 字以内的本次问题' };
  const spreadResult = validateSpread(input.spread);
  if (!spreadResult.ok) return spreadResult;
  return { ok: true as const, value: { question, spread: spreadResult.value } };
}

type ReadingValue = {
  question: string;
  mode: DrawMode;
  spread: SpreadDefinition;
  cards: DrawnCard[];
  interpretation: string;
  aiInterpretation: AiInterpretation | null;
  tags: string[];
  idempotencyKey: string;
};
type ValidationResult = { ok: true; value: ReadingValue } | { ok: false; error: string };

export function validateReading(input: Record<string, unknown>): ValidationResult {
  const question = typeof input.question === 'string' ? input.question.trim() : '';
  const interpretation = typeof input.interpretation === 'string' ? input.interpretation.trim() : '';
  const idempotencyKey = typeof input.idempotencyKey === 'string' ? input.idempotencyKey.trim() : '';
  if (!question || question.length > 160) return { ok: false, error: '请填写 160 字以内的占卜问题' };
  if (interpretation.length > 4000) return { ok: false, error: '个人解读最多 4000 字' };
  if (!isMode(input.mode)) return { ok: false, error: '抽牌方式无效' };
  if (!idempotencyKey || idempotencyKey.length > 100) return { ok: false, error: '提交标识无效，请刷新后重试' };
  const spreadResult = validateSpread(input.spread);
  if (!spreadResult.ok) return spreadResult;
  if (!Array.isArray(input.cards) || input.cards.length !== spreadResult.value.positions.length) return { ok: false, error: '牌面数量与牌阵不一致' };
  const cards = input.cards as DrawnCard[];
  const ids = new Set<string>();
  for (let index = 0; index < cards.length; index += 1) {
    const card = cards[index];
    const position = spreadResult.value.positions[index];
    if (!card || !CARD_MAP.has(card.cardId) || !['upright', 'reversed'].includes(card.orientation)) return { ok: false, error: '牌面数据无效' };
    if (ids.has(card.cardId)) return { ok: false, error: '同一次记录不能重复选择同一张牌' };
    ids.add(card.cardId);
    card.positionId = position.id;
    card.position = position.question;
  }
  const tags = Array.isArray(input.tags) ? input.tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean).slice(0, 3) : [];
  if (tags.some((tag) => tag.length > 16)) return { ok: false, error: '每个标签最多 16 个字' };
  const aiInterpretation = input.aiInterpretation && typeof input.aiInterpretation === 'object' ? input.aiInterpretation as AiInterpretation : null;
  return { ok: true, value: { question, interpretation, idempotencyKey, mode: input.mode, spread: spreadResult.value, cards, tags, aiInterpretation } };
}
