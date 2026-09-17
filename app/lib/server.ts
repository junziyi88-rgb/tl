import {
  CARDS,
  CARD_MAP,
  isMode,
  validateSpread,
  type AiInterpretation,
  type DeckCard,
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
  const selected = selectCardsFromDeck(createDeck(), spread, spread.positions.map((_, index) => index));
  return selected.ok ? selected.value : [];
}

export function createDeck(): DeckCard[] {
  const deck = CARDS.map((card) => ({
    cardId: card.id,
    orientation: secureRandomIndex(2) === 0 ? 'upright' as const : 'reversed' as const,
  }));
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = secureRandomIndex(index + 1);
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }
  return deck;
}

export function selectCardsFromDeck(
  deck: DeckCard[],
  spread: SpreadDefinition,
  selectedIndices: number[],
): { ok: true; value: DrawnCard[] } | { ok: false; error: string } {
  if (deck.length !== CARDS.length || new Set(deck.map((card) => card.cardId)).size !== CARDS.length) {
    return { ok: false, error: '牌堆数据无效，请重新洗牌' };
  }
  if (selectedIndices.length !== spread.positions.length) return { ok: false, error: '请选择正确数量的牌' };
  if (new Set(selectedIndices).size !== selectedIndices.length) return { ok: false, error: '同一张牌不能重复抽取' };
  if (selectedIndices.some((index) => !Number.isInteger(index) || index < 0 || index >= deck.length)) {
    return { ok: false, error: '选择的牌位无效' };
  }
  return {
    ok: true,
    value: selectedIndices.map((deckIndex, index) => ({
      ...deck[deckIndex],
      positionId: spread.positions[index].id,
      position: spread.positions[index].question,
    })),
  };
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
  const aiInterpretation: AiInterpretation | null = null;
  return { ok: true, value: { question, interpretation, idempotencyKey, mode: input.mode, spread: spreadResult.value, cards, tags, aiInterpretation } };
}
