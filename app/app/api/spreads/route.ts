import { insertCustomSpread, listCustomSpreads, verifyMember } from '@/db/queries';
import { bearerToken, jsonError } from '@/lib/server';
import { validateSpread } from '@/lib/tarot';

async function identify(request: Request) {
  const memberId = request.headers.get('x-member-id') ?? '';
  return memberId && await verifyMember(memberId, bearerToken(request)) ? memberId : '';
}

export async function GET(request: Request) {
  const memberId = await identify(request);
  if (!memberId) return jsonError('成员身份已失效，请重新输入昵称', 401);
  return Response.json(await listCustomSpreads(memberId));
}

export async function POST(request: Request) {
  const memberId = await identify(request);
  if (!memberId) return jsonError('成员身份已失效，请重新输入昵称', 401);
  const result = validateSpread(await request.json().catch(() => ({})));
  if (!result.ok) return jsonError(result.error);
  return Response.json(await insertCustomSpread(memberId, { ...result.value, isCustom: true }), { status: 201 });
}
