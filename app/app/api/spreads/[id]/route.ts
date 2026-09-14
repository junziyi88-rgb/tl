import { removeCustomSpread, updateCustomSpread, verifyMember } from '@/db/queries';
import { bearerToken, jsonError } from '@/lib/server';
import { validateSpread } from '@/lib/tarot';

async function identify(request: Request) {
  const memberId = request.headers.get('x-member-id') ?? '';
  return memberId && await verifyMember(memberId, bearerToken(request)) ? memberId : '';
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const memberId = await identify(request);
  if (!memberId) return jsonError('成员身份已失效，请重新输入昵称', 401);
  const result = validateSpread(await request.json().catch(() => ({})));
  if (!result.ok) return jsonError(result.error);
  const updated = await updateCustomSpread((await context.params).id, memberId, { ...result.value, isCustom: true });
  return updated ? Response.json(updated) : jsonError('没有找到这个自建牌阵', 404);
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const memberId = await identify(request);
  if (!memberId) return jsonError('成员身份已失效，请重新输入昵称', 401);
  return await removeCustomSpread((await context.params).id, memberId) ? Response.json({ ok: true }) : jsonError('没有找到这个自建牌阵', 404);
}
