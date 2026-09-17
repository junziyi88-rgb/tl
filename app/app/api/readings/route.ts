import { getAiVersion, insertReading, listReadings, verifyMember } from '@/db/queries';
import { bearerToken, jsonError, validateReading } from '@/lib/server';

export async function GET() {
  return Response.json(await listReadings());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const memberId = typeof body.memberId === 'string' ? body.memberId : '';
  if (!memberId || !(await verifyMember(memberId, bearerToken(request)))) {
    return jsonError('成员身份已失效，请重新输入昵称', 401);
  }
  const result = validateReading(body);
  if (!result.ok) return jsonError(result.error);
  const aiVersionId = typeof body.aiVersionId === 'string' ? body.aiVersionId : '';
  const aiInterpretation = aiVersionId ? await getAiVersion(aiVersionId, result.value.idempotencyKey, memberId) : null;
  if (aiVersionId && !aiInterpretation) return jsonError('采用的 AI 解读版本无效');
  const reading = await insertReading({ memberId, ...result.value, aiInterpretation });
  return Response.json(reading, { status: 201 });
}
