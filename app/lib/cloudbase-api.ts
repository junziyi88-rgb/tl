import {
  CARDS,
  validateSpread,
  type AiInterpretation,
  type CustomSpread,
  type DeckCard,
  type DrawMode,
  type DrawnCard,
  type Reading,
  type SpreadDefinition,
} from '@/lib/tarot';
import { validateDrawRequest, validateReading } from './server';

export const CLOUDBASE_ENV_ID = 'gongjian-tarot-d2geleaahb9b8605e';
export const AI_ENDPOINT =
  'https://gongjian-tarot-d2geleaahb9b8605e.service.tcloudbase.com/api/tarot-ai';

type CloudbaseError = { message?: string } | null;
export type CloudbaseUser = { id: string };
type CloudbaseResult<T> = { data: T; error: CloudbaseError };

export type CloudbaseAuth = {
  getSession(): Promise<
    CloudbaseResult<{ session?: { user?: CloudbaseUser } }>
  >;
  signInAnonymously(): Promise<CloudbaseResult<{ user?: CloudbaseUser }>>;
};

type QueryResult<T> = PromiseLike<CloudbaseResult<T>>;
type QueryBuilder<T> = QueryResult<T> & {
  eq(column: string, value: unknown): QueryBuilder<T>;
  limit(count: number): QueryBuilder<T>;
  order(column: string, options: { ascending: boolean }): QueryBuilder<T>;
  select(columns?: string): QueryBuilder<T>;
};

type TableBuilder<T> = {
  delete(): QueryBuilder<T[]>;
  insert(values: Record<string, unknown>): QueryBuilder<T[]>;
  select(columns?: string): QueryBuilder<T[]>;
  update(values: Record<string, unknown>): QueryBuilder<T[]>;
};

type CloudbaseApp = {
  auth: CloudbaseAuth;
  rdb(): { from<T = CloudbaseRow>(table: string): TableBuilder<T> };
};

export type MemberSession = {
  memberId: string;
  nickname: string;
  token: string;
};

export type NewReading = {
  memberId: string;
  authorName: string;
  question: string;
  mode: DrawMode;
  spread: SpreadDefinition;
  cards: DrawnCard[];
  interpretation: string;
  aiInterpretation?: AiInterpretation | null;
  tags: string[];
  idempotencyKey: string;
};

export type CloudbaseRow = {
  id: string | number;
  owner_id: string;
  author_name: string;
  question: string;
  mode: DrawMode;
  spread: string;
  spread_data?: SpreadDefinition | string | null;
  cards: (Omit<DrawnCard, 'positionId'> & { positionId?: string })[] | string;
  interpretation: string | null;
  ai_interpretation?: AiInterpretation | string | null;
  tags: string[] | string;
  feedback: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

let appPromise: Promise<CloudbaseApp> | undefined;

async function getApp() {
  appPromise ??= import('@cloudbase/js-sdk').then(
    ({ default: cloudbase }) =>
      cloudbase.init({
        env: CLOUDBASE_ENV_ID,
        region: 'ap-shanghai',
      }) as unknown as CloudbaseApp,
  );
  return appPromise;
}

function errorMessage(error: CloudbaseError, fallback: string) {
  if (!error) return;
  throw new Error(error.message?.trim() || fallback);
}

export async function resolveAnonymousUser(auth: CloudbaseAuth) {
  const current = await auth.getSession();
  const currentUser = current.data?.session?.user;
  if (currentUser?.id) return currentUser;

  const missingCredentials = /credentials not found|missing_credentials/i.test(
    current.error?.message ?? '',
  );
  if (current.error && !missingCredentials) {
    errorMessage(current.error, '无法读取成员身份');
  }

  const signedIn = await auth.signInAnonymously();
  errorMessage(signedIn.error, '匿名进入失败，请稍后重试');
  const user = signedIn.data?.user;
  if (!user?.id) throw new Error('匿名进入失败，请稍后重试');
  return user;
}

async function ensureAnonymousSession() {
  const app = await getApp();
  const user = await resolveAnonymousUser(app.auth);
  return { app, user };
}

function parseArray<T>(value: T[] | string): T[] {
  if (Array.isArray(value)) return value;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function mapReadingRow(row: CloudbaseRow): Reading {
  const cards = parseArray<DrawnCard>(row.cards as DrawnCard[] | string).map(
    (card, index) => ({
      ...card,
      positionId: card.positionId || `${row.spread}-${index + 1}`,
    }),
  );
  const legacyNames: Record<string, string> = {
    one: '单张指引',
    three: '三张牌阵',
    five: '五张牌阵',
  };
  const storedSpread = parseObject<SpreadDefinition>(row.spread_data);
  const spread = storedSpread || {
    id: row.spread,
    name: legacyNames[row.spread] || '历史牌阵',
    positions: cards.map((card) => ({
      id: card.positionId,
      question: card.position,
    })),
  };
  return {
    id: String(row.id),
    memberId: row.owner_id,
    authorName: row.author_name,
    question: row.question,
    mode: row.mode,
    spread,
    cards,
    interpretation: row.interpretation ?? '',
    aiInterpretation: parseObject<AiInterpretation>(row.ai_interpretation),
    tags: parseArray<string>(row.tags),
    feedback: row.feedback ?? '',
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export function toReadingRow(input: Omit<NewReading, 'memberId'>) {
  const validated = validateReading(input);
  if (!validated.ok) throw new Error(validated.error);
  const value = validated.value;
  return {
    author_name: input.authorName.trim(),
    question: input.question.trim(),
    mode: input.mode,
    spread: value.spread.id,
    spread_data: value.spread,
    cards: value.cards,
    interpretation: value.interpretation,
    ai_interpretation: input.aiInterpretation ?? null,
    tags: value.tags,
    idempotency_key: input.idempotencyKey,
  };
}

export function normalizeFeedback(feedback: string) {
  const normalized = feedback.trim();
  if (normalized.length > 200 || /[\r\n]/.test(feedback)) {
    throw new Error('后续反馈需要是一行 200 字以内的文字');
  }
  return normalized;
}

function secureRandomIndex(max: number) {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const values = new Uint32Array(1);
  do crypto.getRandomValues(values);
  while (values[0] >= limit);
  return values[0] % max;
}

export function createDeck(): DeckCard[] {
  const deck = CARDS.map((card) => ({
    cardId: card.id,
    orientation: (secureRandomIndex(2) === 0 ? 'upright' : 'reversed') as DeckCard['orientation'],
  }));
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapWith = secureRandomIndex(index + 1);
    [deck[index], deck[swapWith]] = [deck[swapWith], deck[index]];
  }
  return deck;
}

export function selectCardsFromDeck(
  deck: readonly DeckCard[],
  spread: SpreadDefinition,
  selectedIndices: readonly number[],
): DrawnCard[] {
  const validation = validateSpread(spread);
  if (!validation.ok) throw new Error(validation.error);
  if (deck.length !== CARDS.length) throw new Error('牌组不完整，请重新洗牌');
  if (selectedIndices.length !== validation.value.positions.length) {
    throw new Error(`请抽取 ${validation.value.positions.length} 张牌`);
  }
  if (new Set(selectedIndices).size !== selectedIndices.length) {
    throw new Error('同一次抽牌不能重复选择同一张牌');
  }
  if (selectedIndices.some((index) => !Number.isInteger(index) || index < 0 || index >= deck.length)) {
    throw new Error('选中的牌不在牌组中');
  }
  return validation.value.positions.map((position, index) => ({
    ...deck[selectedIndices[index]],
    positionId: position.id,
    position: position.question,
  }));
}

export function drawCards(
  spread: SpreadDefinition,
  question: string,
): DrawnCard[] {
  const validation = validateDrawRequest({ spread, question });
  if (!validation.ok) throw new Error(validation.error);
  const deck = createDeck();
  return selectCardsFromDeck(
    deck,
    validation.value.spread,
    validation.value.spread.positions.map((_, index) => index),
  );
}

export async function createMember(nickname: string): Promise<MemberSession> {
  const cleanNickname = nickname.trim();
  if (!cleanNickname || cleanNickname.length > 24) {
    throw new Error('昵称需要在 1—24 个字之间');
  }
  const { user } = await ensureAnonymousSession();
  return { memberId: user.id, nickname: cleanNickname, token: '' };
}

export async function updateMemberNickname(
  nickname: string,
): Promise<MemberSession> {
  const cleanNickname = nickname.trim();
  if (!cleanNickname || cleanNickname.length > 24) {
    throw new Error('昵称需要在 1—24 个字之间');
  }
  const { app, user } = await ensureAnonymousSession();
  const result = await app
    .rdb()
    .from('readings')
    .update({
      author_name: cleanNickname,
      updated_at: new Date().toISOString(),
    })
    .eq('owner_id', user.id);
  errorMessage(result.error, '更新历史记录昵称失败');
  return { memberId: user.id, nickname: cleanNickname, token: '' };
}

export async function listReadings(): Promise<Reading[]> {
  const { app } = await ensureAnonymousSession();
  const result = await app
    .rdb()
    .from('readings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300);
  errorMessage(result.error, '读取记录失败');
  return (result.data ?? []).map(mapReadingRow);
}

async function findReadingBy(column: string, value: unknown) {
  const { app } = await ensureAnonymousSession();
  const result = await app
    .rdb()
    .from('readings')
    .select('*')
    .eq(column, value)
    .limit(1);
  errorMessage(result.error, '读取记录失败');
  const row = result.data?.[0];
  return row ? mapReadingRow(row) : null;
}

export async function createReading(input: NewReading): Promise<Reading> {
  const { app, user } = await ensureAnonymousSession();
  if (user.id !== input.memberId)
    throw new Error('成员身份已失效，请重新输入昵称');

  const existing = await findReadingBy('idempotency_key', input.idempotencyKey);
  if (existing) return existing;

  const result = await app
    .rdb()
    .from('readings')
    .insert(toReadingRow(input))
    .select('*');
  errorMessage(result.error, '发布记录失败');
  const row = result.data?.[0];
  if (!row) throw new Error('发布记录失败，请稍后重试');
  return mapReadingRow(row);
}

export async function updateFeedback(
  id: string,
  feedback: string,
): Promise<Reading> {
  const { app } = await ensureAnonymousSession();
  const result = await app
    .rdb()
    .from('readings')
    .update({
      feedback: normalizeFeedback(feedback),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  errorMessage(result.error, '保存反馈失败');
  const updated = await findReadingBy('id', id);
  if (!updated) throw new Error('没有找到这条记录');
  return updated;
}

export async function deleteReading(id: string) {
  const { app } = await ensureAnonymousSession();
  const result = await app.rdb().from('readings').delete().eq('id', id);
  errorMessage(result.error, '删除记录失败');
  return { ok: true };
}

function parseObject<T>(value: T | string | null | undefined): T | null {
  if (value == null) return null;
  try {
    return (typeof value === 'string' ? JSON.parse(value) : value) as T;
  } catch {
    return null;
  }
}

type SpreadRow = {
  id: string;
  name: string;
  positions: SpreadDefinition['positions'] | string;
  created_at: string;
  updated_at: string;
};
function mapSpreadRow(row: SpreadRow): CustomSpread {
  return {
    id: row.id,
    name: row.name,
    positions: parseArray(row.positions),
    isCustom: true,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}
export async function listCustomSpreads(): Promise<CustomSpread[]> {
  const { app, user } = await ensureAnonymousSession();
  const result = await app
    .rdb()
    .from<SpreadRow>('custom_spreads')
    .select('*')
    .eq('owner_id', user.id)
    .order('updated_at', { ascending: false });
  errorMessage(result.error, '读取我的牌阵失败');
  return (result.data ?? []).map(mapSpreadRow);
}
export async function createCustomSpread(
  spread: SpreadDefinition,
): Promise<CustomSpread> {
  const checked = validateSpread(spread);
  if (!checked.ok) throw new Error(checked.error);
  const { app, user } = await ensureAnonymousSession();
  const table = app.rdb().from<SpreadRow>('custom_spreads');
  // The draft's stable ID makes a retried “save both” safe after a partial network failure.
  const existing = await table
    .select('*')
    .eq('id', checked.value.id)
    .eq('owner_id', user.id)
    .limit(1);
  errorMessage(existing.error, '读取我的牌阵失败');
  if (existing.data?.[0]) return mapSpreadRow(existing.data[0]);
  const result = await table
    .insert({
      id: checked.value.id,
      name: checked.value.name,
      positions: checked.value.positions,
    })
    .select('*');
  errorMessage(result.error, '保存牌阵失败');
  if (!result.data?.[0]) throw new Error('保存牌阵失败，请重试');
  return mapSpreadRow(result.data[0]);
}
export async function updateCustomSpread(
  id: string,
  spread: SpreadDefinition,
): Promise<CustomSpread> {
  const checked = validateSpread(spread);
  if (!checked.ok) throw new Error(checked.error);
  const { app, user } = await ensureAnonymousSession();
  const result = await app
    .rdb()
    .from<SpreadRow>('custom_spreads')
    .update({
      name: checked.value.name,
      positions: checked.value.positions,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('owner_id', user.id)
    .select('*');
  errorMessage(result.error, '修改牌阵失败');
  if (!result.data?.[0]) throw new Error('牌阵不存在或不属于当前身份');
  return mapSpreadRow(result.data[0]);
}
export async function deleteCustomSpread(id: string) {
  const { app, user } = await ensureAnonymousSession();
  const result = await app
    .rdb()
    .from<SpreadRow>('custom_spreads')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id);
  errorMessage(result.error, '删除牌阵失败');
}
export async function generateInterpretation(input: {
  question: string;
  spread: SpreadDefinition;
  cards: DrawnCard[];
  draftId: string;
}): Promise<AiInterpretation> {
  try {
    const response = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    const result = parseObject<{
      interpretation?: AiInterpretation;
      error?: string;
    }>(await response.text());
    if (result?.error) throw new Error(result.error);
    if (!response.ok) throw new Error('AI 服务暂时不可用，请稍后重试');
    if (!result?.interpretation) throw new Error('AI 返回格式有误，请重试');
    return result.interpretation;
  } catch (error) {
    if (error instanceof Error && /[\u4e00-\u9fff]/.test(error.message))
      throw error;
    throw new Error('AI 服务暂时不可用，请稍后重试');
  }
}
