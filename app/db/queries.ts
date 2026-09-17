import { env } from 'cloudflare:workers';
import type { AiInterpretation, CustomSpread, DeckCard, DrawMode, DrawnCard, Reading, SpreadDefinition } from '@/lib/tarot';

type ReadingInput = {
  memberId: string;
  question: string;
  mode: DrawMode;
  spread: SpreadDefinition;
  cards: DrawnCard[];
  interpretation: string;
  aiInterpretation: AiInterpretation | null;
  tags: string[];
  idempotencyKey: string;
};

export async function hashToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createMember(nickname: string) {
  const id = crypto.randomUUID();
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll('-', '');
  await env.DB.prepare('INSERT INTO members (id, nickname, token_hash, created_at) VALUES (?, ?, ?, ?)')
    .bind(id, nickname, await hashToken(token), Date.now()).run();
  return { memberId: id, nickname, token };
}

export async function verifyMember(memberId: string, token: string) {
  const row = await env.DB.prepare('SELECT token_hash FROM members WHERE id = ?').bind(memberId).first<{ token_hash: string }>();
  return Boolean(row && row.token_hash === await hashToken(token));
}

function parseJson<T>(raw: unknown, fallback: T): T {
  try { return JSON.parse(String(raw)) as T } catch { return fallback }
}

function legacySpread(id: string, cards: DrawnCard[]): SpreadDefinition {
  return { id, name: id === 'one' ? '单张指引' : id === 'three' ? '时间之流' : '五张探索', positions: cards.map((card, index) => ({ id: card.positionId || `legacy-${index + 1}`, question: card.position })) };
}

function parseReading(row: Record<string, unknown>): Reading {
  const cards = parseJson<DrawnCard[]>(row.cards, []);
  const storedSpread = parseJson<SpreadDefinition | null>(row.spread_data, null);
  return {
    id: String(row.id), memberId: String(row.member_id), authorName: String(row.author_name),
    question: String(row.question), mode: row.mode as DrawMode,
    spread: storedSpread?.positions?.length ? storedSpread : legacySpread(String(row.spread), cards),
    cards, interpretation: typeof row.interpretation === 'string' ? row.interpretation : '',
    aiInterpretation: row.ai_interpretation ? parseJson<AiInterpretation | null>(row.ai_interpretation, null) : null,
    tags: parseJson<string[]>(row.tags, []), feedback: typeof row.feedback === 'string' ? row.feedback : '',
    createdAt: Number(row.created_at), updatedAt: Number(row.updated_at),
  };
}

function parseCustomSpread(row: Record<string, unknown>): CustomSpread {
  return {
    id: String(row.id), name: String(row.name), isCustom: true,
    positions: parseJson(String(row.positions), []),
    createdAt: Number(row.created_at), updatedAt: Number(row.updated_at),
  };
}

export async function listReadings() {
  const result = await env.DB.prepare('SELECT * FROM readings ORDER BY created_at DESC LIMIT 300').all();
  return result.results.map((row) => parseReading(row));
}
export async function getReading(id: string) {
  const row = await env.DB.prepare('SELECT * FROM readings WHERE id = ?').bind(id).first();
  return row ? parseReading(row) : null;
}
export async function insertReading(input: ReadingInput) {
  const existing = await env.DB.prepare('SELECT * FROM readings WHERE idempotency_key = ?').bind(input.idempotencyKey).first();
  if (existing) return parseReading(existing);
  const member = await env.DB.prepare('SELECT nickname FROM members WHERE id = ?').bind(input.memberId).first<{ nickname: string }>();
  if (!member) throw new Error('MEMBER_NOT_FOUND');
  const id = crypto.randomUUID();
  const now = Date.now();
  await env.DB.prepare(`
    INSERT INTO readings
      (id, member_id, author_name, question, mode, spread, spread_data, cards, interpretation, ai_interpretation, tags, feedback, idempotency_key, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?)
  `).bind(
    id, input.memberId, member.nickname, input.question, input.mode, input.spread.id, JSON.stringify(input.spread),
    JSON.stringify(input.cards), input.interpretation, input.aiInterpretation ? JSON.stringify(input.aiInterpretation) : '',
    JSON.stringify(input.tags), input.idempotencyKey, now, now,
  ).run();
  return (await getReading(id))!;
}
export async function updateReading(id: string, input: { question?: string; interpretation?: string; tags?: string[]; feedback?: string }) {
  const current = await getReading(id);
  if (!current) return null;
  await env.DB.prepare('UPDATE readings SET question = ?, interpretation = ?, tags = ?, feedback = ?, updated_at = ? WHERE id = ?')
    .bind(input.question ?? current.question, input.interpretation ?? current.interpretation, JSON.stringify(input.tags ?? current.tags), input.feedback ?? current.feedback, Date.now(), id).run();
  return getReading(id);
}
export async function removeReading(id: string) {
  const result = await env.DB.prepare('DELETE FROM readings WHERE id = ?').bind(id).run();
  return result.meta.changes > 0;
}

export async function listCustomSpreads(memberId: string) {
  const result = await env.DB.prepare('SELECT * FROM custom_spreads WHERE member_id = ? ORDER BY updated_at DESC').bind(memberId).all();
  return result.results.map((row) => parseCustomSpread(row));
}
export async function getCustomSpread(id: string, memberId: string) {
  const row = await env.DB.prepare('SELECT * FROM custom_spreads WHERE id = ? AND member_id = ?').bind(id, memberId).first();
  return row ? parseCustomSpread(row) : null;
}
export async function insertCustomSpread(memberId: string, spread: SpreadDefinition) {
  const id = crypto.randomUUID();
  const now = Date.now();
  await env.DB.prepare('INSERT INTO custom_spreads (id, member_id, name, positions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, memberId, spread.name, JSON.stringify(spread.positions), now, now).run();
  return (await getCustomSpread(id, memberId))!;
}
export async function updateCustomSpread(id: string, memberId: string, spread: SpreadDefinition) {
  await env.DB.prepare('UPDATE custom_spreads SET name = ?, positions = ?, updated_at = ? WHERE id = ? AND member_id = ?')
    .bind(spread.name, JSON.stringify(spread.positions), Date.now(), id, memberId).run();
  return getCustomSpread(id, memberId);
}
export async function removeCustomSpread(id: string, memberId: string) {
  const result = await env.DB.prepare('DELETE FROM custom_spreads WHERE id = ? AND member_id = ?').bind(id, memberId).run();
  return result.meta.changes > 0;
}

export async function createDrawSession(memberId: string, input: { question: string; spread: SpreadDefinition; deck: DeckCard[] }) {
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO draw_sessions (id, member_id, question, spread, deck, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, memberId, input.question, JSON.stringify(input.spread), JSON.stringify(input.deck), Date.now()).run();
  return id;
}

export async function getDrawSession(id: string, memberId: string) {
  const row = await env.DB.prepare('SELECT question, spread, deck FROM draw_sessions WHERE id = ? AND member_id = ?')
    .bind(id, memberId).first<Record<string, unknown>>();
  if (!row) return null;
  return {
    question: String(row.question),
    spread: parseJson<SpreadDefinition>(row.spread, { id: '', name: '', positions: [] }),
    deck: parseJson<DeckCard[]>(row.deck, []),
  };
}

export async function reserveAiGeneration(memberId: string, draftId: string) {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const [memberUsage, globalUsage] = await Promise.all([
    env.DB.prepare('SELECT COALESCE(SUM(count), 0) AS total FROM ai_generations WHERE member_id = ? AND created_at >= ?').bind(memberId, dayStart.getTime()).first<{ total: number }>(),
    env.DB.prepare('SELECT COALESCE(SUM(count), 0) AS total FROM ai_generations WHERE created_at >= ?').bind(dayStart.getTime()).first<{ total: number }>(),
  ]);
  if (Number(memberUsage?.total ?? 0) >= 12 || Number(globalUsage?.total ?? 0) >= 60) return false;
  const id = `${memberId}:${draftId}`;
  const result = await env.DB.prepare(`
    INSERT INTO ai_generations (id, draft_id, member_id, count, created_at) VALUES (?, ?, ?, 1, ?)
    ON CONFLICT(draft_id, member_id) DO UPDATE SET count = count + 1 WHERE count < 3
  `).bind(id, draftId, memberId, Date.now()).run();
  return result.meta.changes > 0;
}

export async function releaseAiGeneration(memberId: string, draftId: string) {
  await env.DB.prepare('UPDATE ai_generations SET count = MAX(0, count - 1) WHERE draft_id = ? AND member_id = ?').bind(draftId, memberId).run();
}

export async function createAiDraft(memberId: string, input: { question: string; spread: SpreadDefinition; cards: DrawnCard[] }, requestedId?: string) {
  const id = requestedId ?? crypto.randomUUID();
  await env.DB.prepare('INSERT OR IGNORE INTO ai_drafts (id, member_id, question, spread, cards, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, memberId, input.question, JSON.stringify(input.spread), JSON.stringify(input.cards), Date.now()).run();
  return id;
}

export async function getAiDraft(id: string, memberId: string) {
  const row = await env.DB.prepare('SELECT question, spread, cards FROM ai_drafts WHERE id = ? AND member_id = ?').bind(id, memberId).first<Record<string, unknown>>();
  if (!row) return null;
  return { question: String(row.question), spread: parseJson<SpreadDefinition>(row.spread, { id: '', name: '', positions: [] }), cards: parseJson<DrawnCard[]>(row.cards, []) };
}

export async function insertAiVersion(draftId: string, memberId: string, interpretation: AiInterpretation) {
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO ai_versions (id, draft_id, member_id, content, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, draftId, memberId, JSON.stringify(interpretation), Date.now()).run();
  return id;
}

export async function getAiVersion(id: string, draftId: string, memberId: string) {
  const row = await env.DB.prepare('SELECT content FROM ai_versions WHERE id = ? AND draft_id = ? AND member_id = ?').bind(id, draftId, memberId).first<{ content: string }>();
  return row ? parseJson<AiInterpretation | null>(row.content, null) : null;
}
