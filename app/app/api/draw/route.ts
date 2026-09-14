import { drawCards, jsonError, validateDrawRequest } from '@/lib/server';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const result = validateDrawRequest(body);
  if (!result.ok) return jsonError(result.error);
  return Response.json({ cards: drawCards(result.value.spread) });
}
