import { createMember } from '@/db/queries';
import { jsonError } from '@/lib/server';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { nickname?: unknown };
  const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : '';
  if (!nickname || nickname.length > 24) return jsonError('昵称需要在 1—24 个字之间');
  return Response.json(await createMember(nickname), { status: 201 });
}
