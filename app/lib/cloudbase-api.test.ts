import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BUILT_IN_SPREADS } from './tarot';
import {
  createDeck,
  drawCards,
  mapReadingRow,
  normalizeFeedback,
  resolveAnonymousUser,
  selectCardsFromDeck,
  toReadingRow,
} from './cloudbase-api';

describe('CloudBase tarot data contract', () => {
  it('starts anonymous login when the first session has no credentials', async () => {
    const user = await resolveAnonymousUser({
      getSession: async () => ({
        data: {},
        error: { message: 'credentials not found' },
      }),
      signInAnonymously: async () => ({
        data: { user: { id: 'anonymous-user-1' } },
        error: null,
      }),
    });

    expect(user.id).toBe('anonymous-user-1');
  });

  it('maps a PostgreSQL row to the UI Reading shape', () => {
    expect(
      mapReadingRow({
        id: 7,
        owner_id: 'u1',
        author_name: '小月',
        question: '本周如何？',
        mode: 'online',
        spread: 'one',
        cards: [
          {
            cardId: 'ar00',
            orientation: 'upright',
            position: '本次指引',
          },
        ],
        interpretation: '保持开放',
        tags: ['工作'],
        feedback: '事情顺利完成',
        created_at: '2026-09-10T00:00:00.000Z',
        updated_at: '2026-09-10T01:00:00.000Z',
      }),
    ).toMatchObject({
      id: '7',
      memberId: 'u1',
      authorName: '小月',
      createdAt: 1788998400000,
    });
  });

  it('creates rows without accepting a caller supplied owner id', () => {
    expect(
      toReadingRow({
        authorName: '小月',
        question: '本周如何？',
        mode: 'online',
        spread: { id: 'test', name: '测试', positions: [{ id: 'p1', question: '本次指引' }] },
        cards: [
          {
            cardId: 'ar00',
            orientation: 'upright',
            position: '本次指引',
            positionId: 'p1',
          },
        ],
        interpretation: '保持开放',
        tags: ['工作'],
        idempotencyKey: '11111111-1111-4111-8111-111111111111',
      }),
    ).not.toHaveProperty('owner_id');
  });

  it('keeps feedback to one line and 200 characters', () => {
    expect(normalizeFeedback('已经发生')).toBe('已经发生');
    expect(() => normalizeFeedback('第一行\n第二行')).toThrow('后续反馈需要是一行');
    expect(() => normalizeFeedback('字'.repeat(201))).toThrow('后续反馈需要是一行');
  });

  it('draws unique cards and preserves configured positions', () => {
    const emotionalRealm = BUILT_IN_SPREADS.find((spread) => spread.id === 'emotional-realm')!;
    const cards = drawCards(emotionalRealm, '如何理解这段关系？');
    expect(new Set(cards.map((card) => card.cardId)).size).toBe(5);
    expect(cards.map((card) => card.position)).toEqual([
      '你目前的状态想法',
      '对方目前的状态想法',
      '现状',
      '未来趋势',
      '最终结果',
    ]);
  });

  it('fixes all 78 card identities and orientations before the user selects', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(78);
    expect(new Set(deck.map((card) => card.cardId)).size).toBe(78);
    expect(deck.every((card) => ['upright', 'reversed'].includes(card.orientation))).toBe(true);
  });

  it('maps clicked deck indexes to spread positions in click order', () => {
    const spread = BUILT_IN_SPREADS.find((item) => item.id === 'timeline')!;
    const deck = createDeck();
    const cards = selectCardsFromDeck(deck, spread, [12, 3, 48]);

    expect(cards.map((card) => card.cardId)).toEqual([
      deck[12].cardId,
      deck[3].cardId,
      deck[48].cardId,
    ]);
    expect(cards.map((card) => card.position)).toEqual(['过去', '现在', '未来']);
    expect(() => selectCardsFromDeck(deck, spread, [2, 2, 4])).toThrow('不能重复');
  });

  it('uses a portable Vite build with a browser entry', () => {
    const config = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
    expect(config).not.toContain('@openai/sites-vite-plugin');
    expect(config).not.toContain('@cloudflare/vite-plugin');
    expect(existsSync(new URL('../index.html', import.meta.url))).toBe(true);
  });

  it('locks the PostgreSQL schema to public reads and owner writes', () => {
    const migration = readFileSync(
      new URL(
        '../cloudbase/migrations/20260910000000_create_tarot_readings.sql',
        import.meta.url,
      ),
      'utf8',
    );
    expect(migration).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(migration).toMatch(/FOR SELECT\s+TO anon\s+USING \(true\)/i);
    expect(migration).toMatch(/FOR INSERT\s+TO anon[\s\S]+auth\.uid\(\)/i);
    expect(migration).toMatch(/FOR UPDATE\s+TO anon[\s\S]+auth\.uid\(\)/i);
    expect(migration).toMatch(/FOR DELETE\s+TO anon[\s\S]+auth\.uid\(\)/i);
    expect(migration).toMatch(/feedback\s+varchar\(200\)/i);
    expect(migration).toMatch(/GRANT UPDATE \(feedback, updated_at\)/i);
    expect(migration).not.toMatch(/GRANT UPDATE ON public\.readings/i);
  });
});
