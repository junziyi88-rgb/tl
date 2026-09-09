import { drawCards, jsonError } from '@/lib/server';
import { isSpread } from '@/lib/tarot';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { spread?: unknown };
  if (!isSpread(body.spread)) return jsonError('请选择有效牌阵');
  return Response.json({ cards: drawCards(body.spread) });
}
