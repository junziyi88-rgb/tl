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
import { requestDeepSeekInterpretation } from './deepseek-browser';

export const CLOUDBASE_ENV_ID = 'gongjian-tarot-d2geleaahb9b8605e';
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(
  /\/+$/,
  '',
);
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
// The owner intentionally accepts that this small-balance key is public in the
// static browser bundle. Do not use a valuable or unrestricted key here.
export const DEEPSEEK_API_KEY =
  import.meta.env.VITE_DEEPSEEK_API_KEY ?? '';

const SESSION_KEY = 'gongjian-tarot-cloudbase-session-v1';

type CloudbaseError = { message?: string } | null;
export type CloudbaseUser = { id: string };
type CloudbaseResult<T> = { data: T; error: CloudbaseError };

export type CloudbaseAuth = {
  getSession(): Promise<
    CloudbaseResult<{ session?: { user?: CloudbaseUser } }>
  >;
  signInAnonymously(): Promise<CloudbaseResult<{ user?: CloudbaseUser }>>;
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

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function readLocalSession(): MemberSession | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const value = JSON.parse(
      localStorage.getItem(SESSION_KEY) || 'null',
    ) as Partial<MemberSession> | null;
    if (
      value &&
      isUuid(value.memberId) &&
      typeof value.nickname === 'string' &&
      typeof value.token === 'string' &&
      value.token.length >= 32
    ) {
      return value as MemberSession;
    }
  } catch {
    // Old CloudBase sessions are replaced with a local portable identity.
  }
  return null;
}

function newLocalSession(nickname: string): MemberSession {
  return {
    memberId: crypto.randomUUID(),
    nickname,
    token: `${crypto.randomUUID()}${crypto.randomUUID()}`,
  };
}

function requireLocalSession() {
  const session = readLocalSession();
  if (!session) throw new Error('成员身份已失效，请重新输入昵称');
  return session;
}

const READING_COLUMNS = [
  'id',
  'owner_id',
  'author_name',
  'question',
  'mode',
  'spread',
  'spread_data',
  'cards',
  'interpretation',
  'ai_interpretation',
  'tags',
  'feedback',
  'created_at',
  'updated_at',
].join(',');

const SPREAD_COLUMNS = 'id,name,positions,created_at,updated_at';

async function parseSupabaseResponse<T>(
  response: Response,
  fallback: string,
): Promise<T | null> {
  const text = await response.text();
  const result = text
    ? parseObject<T & { message?: string }>(text)
    : null;
  if (!response.ok) {
    throw new Error(result?.message || fallback);
  }
  return result as T | null;
}

function requireFirstRow<T>(rows: T[] | null, message: string): T {
  const row = rows?.[0];
  if (!row) throw new Error(message);
  return row;
}

function assertSupabaseConfigured() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('数据库尚未配置，请稍后重试');
  }
}

export function buildOwnerRequestHeaders(session: MemberSession) {
  return {
    'x-owner-id': session.memberId,
    'x-owner-token': session.token,
  };
}

function supabaseHeaders(session?: MemberSession) {
  return {
    apikey: SUPABASE_ANON_KEY,
    authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'content-type': 'application/json',
    ...(session ? buildOwnerRequestHeaders(session) : {}),
  };
}

async function selectReadingFeed() {
  assertSupabaseConfigured();
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/reading_feed?select=*&order=created_at.desc&limit=300`,
    {
      headers: supabaseHeaders(),
    },
  );
  const result = parseObject<CloudbaseRow[] & { message?: string }>(
    await response.text(),
  );
  if (!response.ok) {
    throw new Error(result?.message || '数据库暂时不可用，请稍后重试');
  }
  return Array.isArray(result) ? result : [];
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
  const current = readLocalSession();
  return current
    ? { ...current, nickname: cleanNickname }
    : newLocalSession(cleanNickname);
}

export async function updateMemberNickname(
  nickname: string,
): Promise<MemberSession> {
  const cleanNickname = nickname.trim();
  if (!cleanNickname || cleanNickname.length > 24) {
    throw new Error('昵称需要在 1—24 个字之间');
  }
  const session = requireLocalSession();
  assertSupabaseConfigured();
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/readings?owner_id=eq.${encodeURIComponent(session.memberId)}`,
    {
      method: 'PATCH',
      headers: {
        ...supabaseHeaders(session),
        prefer: 'return=minimal',
      },
      body: JSON.stringify({
        author_name: cleanNickname,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  await parseSupabaseResponse<never>(response, '昵称修改失败');
  return { ...session, nickname: cleanNickname };
}

export async function listReadings(): Promise<Reading[]> {
  const rows = await selectReadingFeed();
  return (rows ?? []).map(mapReadingRow);
}

export async function createReading(input: NewReading): Promise<Reading> {
  const session = requireLocalSession();
  if (session.memberId !== input.memberId)
    throw new Error('成员身份已失效，请重新输入昵称');
  const value = toReadingRow(input);
  assertSupabaseConfigured();
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/readings?select=${READING_COLUMNS}`,
    {
      method: 'POST',
      headers: {
        ...supabaseHeaders(session),
        prefer: 'return=representation',
      },
      body: JSON.stringify(value),
    },
  );
  const rows = await parseSupabaseResponse<CloudbaseRow[]>(
    response,
    '发布记录失败，请稍后重试',
  );
  const row = requireFirstRow(rows, '发布记录失败，请稍后重试');
  return mapReadingRow(row);
}

export async function updateFeedback(
  id: string,
  feedback: string,
): Promise<Reading> {
  const session = requireLocalSession();
  assertSupabaseConfigured();
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/readings?id=eq.${encodeURIComponent(id)}&select=${READING_COLUMNS}`,
    {
      method: 'PATCH',
      headers: {
        ...supabaseHeaders(session),
        prefer: 'return=representation',
      },
      body: JSON.stringify({
        feedback: normalizeFeedback(feedback),
        updated_at: new Date().toISOString(),
      }),
    },
  );
  const rows = await parseSupabaseResponse<CloudbaseRow[]>(
    response,
    '保存反馈失败',
  );
  const row = requireFirstRow(rows, '没有找到这条记录');
  return mapReadingRow(row);
}

export async function deleteReading(id: string) {
  const session = requireLocalSession();
  assertSupabaseConfigured();
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/readings?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      headers: {
        ...supabaseHeaders(session),
        prefer: 'return=minimal',
      },
    },
  );
  await parseSupabaseResponse<never>(response, '删除记录失败');
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
  const session = readLocalSession();
  if (!session) return [];
  assertSupabaseConfigured();
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/custom_spreads?select=${SPREAD_COLUMNS}&order=updated_at.desc`,
    { headers: supabaseHeaders(session) },
  );
  const rows = await parseSupabaseResponse<SpreadRow[]>(
    response,
    '读取我的牌阵失败',
  );
  return (rows ?? []).map(mapSpreadRow);
}
export async function createCustomSpread(
  spread: SpreadDefinition,
): Promise<CustomSpread> {
  const checked = validateSpread(spread);
  if (!checked.ok) throw new Error(checked.error);
  const session = requireLocalSession();
  assertSupabaseConfigured();
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/custom_spreads?select=${SPREAD_COLUMNS}`,
    {
      method: 'POST',
      headers: {
        ...supabaseHeaders(session),
        prefer: 'return=representation',
      },
      body: JSON.stringify({
        id: checked.value.id,
        name: checked.value.name,
        positions: checked.value.positions,
      }),
    },
  );
  const rows = await parseSupabaseResponse<SpreadRow[]>(
    response,
    '保存牌阵失败，请重试',
  );
  const row = requireFirstRow(rows, '保存牌阵失败，请重试');
  return mapSpreadRow(row);
}
export async function updateCustomSpread(
  id: string,
  spread: SpreadDefinition,
): Promise<CustomSpread> {
  const checked = validateSpread(spread);
  if (!checked.ok) throw new Error(checked.error);
  const session = requireLocalSession();
  assertSupabaseConfigured();
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/custom_spreads?id=eq.${encodeURIComponent(id)}&select=${SPREAD_COLUMNS}`,
    {
      method: 'PATCH',
      headers: {
        ...supabaseHeaders(session),
        prefer: 'return=representation',
      },
      body: JSON.stringify({
        name: checked.value.name,
        positions: checked.value.positions,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  const rows = await parseSupabaseResponse<SpreadRow[]>(
    response,
    '修改牌阵失败',
  );
  const row = requireFirstRow(rows, '牌阵不存在或不属于当前身份');
  return mapSpreadRow(row);
}
export async function deleteCustomSpread(id: string) {
  const session = requireLocalSession();
  assertSupabaseConfigured();
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/custom_spreads?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      headers: {
        ...supabaseHeaders(session),
        prefer: 'return=minimal',
      },
    },
  );
  await parseSupabaseResponse<never>(response, '删除牌阵失败');
}
export async function generateInterpretation(input: {
  question: string;
  spread: SpreadDefinition;
  cards: DrawnCard[];
  draftId: string;
}): Promise<AiInterpretation> {
  try {
    return await requestDeepSeekInterpretation(input, DEEPSEEK_API_KEY);
  } catch (error) {
    if (error instanceof Error && /[\u4e00-\u9fff]/.test(error.message))
      throw error;
    throw new Error('AI 服务暂时不可用，请稍后重试');
  }
}
