import { env } from 'cloudflare:workers';
import { getReading, removeReading, updateReading, verifyMember } from '@/db/queries';
import { bearerToken, jsonError } from '@/lib/server';

type Context = { params: Promise<{ id: string }> };

async function canEdit(request: Request, memberId: string) {
  const requestMemberId = request.headers.get('x-member-id') ?? '';
  return requestMemberId === memberId && await verifyMember(requestMemberId, bearerToken(request));
}

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  const reading = await getReading(id);
  if (!reading) return jsonError('没有找到这条记录', 404);
  if (!(await canEdit(request, reading.memberId))) return jsonError('只有原记录者可以修改', 403);
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const changes: { question?: string; interpretation?: string; tags?: string[]; feedback?: string } = {};
  if ('question' in body) {
    if (typeof body.question !== 'string' || !body.question.trim() || body.question.trim().length > 160) return jsonError('问题内容无效');
    changes.question = body.question.trim();
  }
  if ('interpretation' in body) {
    if (typeof body.interpretation !== 'string' || !body.interpretation.trim() || body.interpretation.trim().length > 4000) return jsonError('解读内容无效');
    changes.interpretation = body.interpretation.trim();
  }
  if ('feedback' in body) {
    if (typeof body.feedback !== 'string' || body.feedback.length > 200 || /[\r\n]/.test(body.feedback)) return jsonError('后续反馈需要是一行 200 字以内的文字');
    changes.feedback = body.feedback.trim();
  }
  if ('tags' in body) {
    if (!Array.isArray(body.tags)) return jsonError('标签格式无效');
    const tags = body.tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean).slice(0, 3);
    if (tags.some((tag) => tag.length > 16)) return jsonError('每个标签最多 16 个字');
    changes.tags = tags;
  }
  return Response.json(await updateReading(id, changes));
}

export async function DELETE(request: Request, context: Context) {
  const { id } = await context.params;
  const reading = await getReading(id);
  if (!reading) return jsonError('没有找到这条记录', 404);
  const owner = await canEdit(request, reading.memberId);
  const adminKey = request.headers.get('x-admin-key') ?? '';
  const admin = Boolean(env.ADMIN_KEY && adminKey === env.ADMIN_KEY);
  if (!owner && !admin) return jsonError('你没有删除这条记录的权限', 403);
  await removeReading(id);
  return Response.json({ ok: true });
}
