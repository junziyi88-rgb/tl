import { createAiDraft, createDrawSession, getDrawSession, verifyMember } from '@/db/queries';
import { bearerToken, createDeck, jsonError, selectCardsFromDeck, validateDrawRequest, validateReading } from '@/lib/server';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const memberId = typeof body.memberId === 'string' ? body.memberId : '';
  if (!memberId || !(await verifyMember(memberId, bearerToken(request)))) return jsonError('成员身份已失效，请重新输入昵称', 401);
  const action = typeof body.action === 'string' ? body.action : 'prepare';

  if (action === 'prepare') {
    const result = validateDrawRequest(body);
    if (!result.ok) return jsonError(result.error);
    const sessionId = await createDrawSession(memberId, { ...result.value, deck: createDeck() });
    return Response.json({ sessionId });
  }

  if (action === 'select') {
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
    const selectedIndices = Array.isArray(body.selectedIndices) ? body.selectedIndices as number[] : [];
    if (!sessionId || sessionId.length > 100) return jsonError('本次洗牌标识无效');
    const session = await getDrawSession(sessionId, memberId);
    if (!session) return jsonError('这副牌已经失效，请重新洗牌', 404);
    const selected = selectCardsFromDeck(session.deck, session.spread, selectedIndices);
    if (!selected.ok) return jsonError(selected.error);
    const draftId = await createAiDraft(memberId, { question: session.question, spread: session.spread, cards: selected.value }, sessionId);
    return Response.json({ cards: selected.value, draftId });
  }

  if (action === 'physical') {
    const result = validateReading({ ...body, interpretation: '', tags: [], idempotencyKey: crypto.randomUUID() });
    if (!result.ok) return jsonError(result.error);
    const draftId = await createAiDraft(memberId, result.value);
    return Response.json({ draftId });
  }

  return jsonError('抽牌步骤无效');
}
