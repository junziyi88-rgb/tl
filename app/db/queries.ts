import { env } from 'cloudflare:workers';
import type { DrawMode, DrawnCard, Reading, SpreadKind } from '@/lib/tarot';

type ReadingInput = {
  memberId: string;
  question: string;
  mode: DrawMode;
  spread: SpreadKind;
  cards: DrawnCard[];
  interpretation: string;
  tags: string[];
  idempotencyKey: string;
};

export async function hashToken(token: string) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createMember(nickname: string) {
  const id = crypto.randomUUID();
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll('-', '');
  await env.DB.prepare(
    'INSERT INTO members (id, nickname, token_hash, created_at) VALUES (?, ?, ?, ?)',
  ).bind(id, nickname, await hashToken(token), Date.now()).run();
  return { memberId: id, nickname, token };
}

export async function verifyMember(memberId: string, token: string) {
  const row = await env.DB.prepare('SELECT token_hash FROM members WHERE id = ?')
    .bind(memberId).first<{ token_hash: string }>();
  return Boolean(row && row.token_hash === await hashToken(token));
}

function parseReading(row: Record<string, unknown>): Reading {
  return {
    id: String(row.id),
    memberId: String(row.member_id),
    authorName: String(row.author_name),
    question: String(row.question),
    mode: row.mode as DrawMode,
    spread: row.spread as SpreadKind,
    cards: JSON.parse(String(row.cards)) as DrawnCard[],
    interpretation: String(row.interpretation),
    tags: JSON.parse(String(row.tags)) as string[],
    feedback: String(row.feedback ?? ''),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
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
  const existing = await env.DB.prepare('SELECT * FROM readings WHERE idempotency_key = ?')
    .bind(input.idempotencyKey).first();
  if (existing) return parseReading(existing);
  const member = await env.DB.prepare('SELECT nickname FROM members WHERE id = ?')
    .bind(input.memberId).first<{ nickname: string }>();
  if (!member) throw new Error('MEMBER_NOT_FOUND');
  const id = crypto.randomUUID();
  const now = Date.now();
  await env.DB.prepare(`
    INSERT INTO readings
      (id, member_id, author_name, question, mode, spread, cards, interpretation, tags, feedback, idempotency_key, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?)
  `).bind(
    id, input.memberId, member.nickname, input.question, input.mode, input.spread,
    JSON.stringify(input.cards), input.interpretation, JSON.stringify(input.tags),
    input.idempotencyKey, now, now,
  ).run();
  return (await getReading(id))!;
}

export async function updateReading(id: string, input: { question?: string; interpretation?: string; tags?: string[]; feedback?: string }) {
  const current = await getReading(id);
  if (!current) return null;
  await env.DB.prepare(`
    UPDATE readings SET question = ?, interpretation = ?, tags = ?, feedback = ?, updated_at = ? WHERE id = ?
  `).bind(
    input.question ?? current.question,
    input.interpretation ?? current.interpretation,
    JSON.stringify(input.tags ?? current.tags),
    input.feedback ?? current.feedback,
    Date.now(), id,
  ).run();
  return getReading(id);
}

export async function removeReading(id: string) {
  const result = await env.DB.prepare('DELETE FROM readings WHERE id = ?').bind(id).run();
  return result.meta.changes > 0;
}
