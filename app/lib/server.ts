import { CARDS, CARD_MAP, SPREADS, isMode, isSpread, type DrawnCard, type SpreadKind } from '@/lib/tarot';

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

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

export function drawCards(spread: SpreadKind): DrawnCard[] {
  const pool = CARDS.map((card) => card.id);
  return SPREADS[spread].positions.map((position) => {
    const index = secureRandomIndex(pool.length);
    const cardId = pool.splice(index, 1)[0];
    return {
      cardId,
      position,
      orientation: secureRandomIndex(2) === 0 ? 'upright' : 'reversed',
    };
  });
}

type ValidationResult =
  | { ok: true; value: { question: string; mode: 'online' | 'physical'; spread: SpreadKind; cards: DrawnCard[]; interpretation: string; tags: string[]; idempotencyKey: string } }
  | { ok: false; error: string };

export function validateReading(input: Record<string, unknown>): ValidationResult {
  const question = typeof input.question === 'string' ? input.question.trim() : '';
  const interpretation = typeof input.interpretation === 'string' ? input.interpretation.trim() : '';
  const idempotencyKey = typeof input.idempotencyKey === 'string' ? input.idempotencyKey.trim() : '';
  if (!question || question.length > 160) return { ok: false, error: '请填写 160 字以内的占卜主题或问题' };
  if (!interpretation || interpretation.length > 4000) return { ok: false, error: '请填写你的解读' };
  if (!isMode(input.mode) || !isSpread(input.spread)) return { ok: false, error: '抽牌方式或牌阵无效' };
  if (!idempotencyKey || idempotencyKey.length > 100) return { ok: false, error: '提交标识无效，请刷新后重试' };
  if (!Array.isArray(input.cards) || input.cards.length !== SPREADS[input.spread].positions.length) {
    return { ok: false, error: '牌面数量与牌阵不一致' };
  }
  const cards = input.cards as DrawnCard[];
  const ids = new Set<string>();
  for (let index = 0; index < cards.length; index += 1) {
    const card = cards[index];
    if (!card || !CARD_MAP.has(card.cardId) || !['upright', 'reversed'].includes(card.orientation)) {
      return { ok: false, error: '牌面数据无效' };
    }
    if (ids.has(card.cardId)) return { ok: false, error: '同一次记录不能重复选择同一张牌' };
    ids.add(card.cardId);
    card.position = SPREADS[input.spread].positions[index];
  }
  const tags = Array.isArray(input.tags)
    ? input.tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean).slice(0, 3)
    : [];
  if (tags.some((tag) => tag.length > 16)) return { ok: false, error: '每个标签最多 16 个字' };
  return { ok: true, value: { question, interpretation, idempotencyKey, mode: input.mode, spread: input.spread, cards, tags } };
}
