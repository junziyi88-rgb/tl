import { env } from 'cloudflare:workers';
import { getAiDraft, insertAiVersion, releaseAiGeneration, reserveAiGeneration, verifyMember } from '@/db/queries';
import { requestDeepSeekInterpretation } from '@/lib/ai';
import { bearerToken, jsonError } from '@/lib/server';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const memberId = typeof body.memberId === 'string' ? body.memberId : '';
  if (!memberId || !(await verifyMember(memberId, bearerToken(request)))) return jsonError('成员身份已失效，请重新输入昵称', 401);
  const draftId = typeof body.draftId === 'string' ? body.draftId.trim() : '';
  if (!draftId || draftId.length > 100) return jsonError('本次抽牌标识无效');
  const draft = await getAiDraft(draftId, memberId);
  if (!draft) return jsonError('本次抽牌标识无效', 404);
  if (!env.DEEPSEEK_API_KEY) return jsonError('AI 解牌暂未配置，请稍后再试', 503);
  if (!(await reserveAiGeneration(memberId, draftId))) return jsonError('本次抽牌最多生成三次 AI 解读', 429);
  try {
    const interpretation = await requestDeepSeekInterpretation({
      question: draft.question,
      spread: draft.spread,
      cards: draft.cards,
    }, env.DEEPSEEK_API_KEY);
    const versionId = await insertAiVersion(draftId, memberId, interpretation);
    return Response.json({ versionId, interpretation });
  } catch (error) {
    await releaseAiGeneration(memberId, draftId);
    const code = error instanceof Error ? error.message : '';
    if (code === 'AI_AUTH') return jsonError('AI 密钥不可用，请联系管理员', 503);
    if (code === 'AI_QUOTA') return jsonError('AI 余额不足，请联系管理员', 503);
    if (code === 'AI_LENGTH' || code === 'AI_FORMAT') return jsonError('AI 返回内容不完整，请重试', 502);
    return jsonError('AI 暂时没有回应，请稍后重试', 502);
  }
}
