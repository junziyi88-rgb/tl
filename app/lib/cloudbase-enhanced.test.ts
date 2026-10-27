import { describe, expect, it } from 'vitest';
import * as tarot from './tarot';
import * as api from './cloudbase-api';
import { existsSync, readFileSync } from 'node:fs';

const spread = {
  id: 'custom-1',
  name: '自建',
  isCustom: true,
  positions: [{ id: 'p1', question: '我的想法' }],
};
const input = {
  authorName: '小月',
  question: '我该如何沟通？',
  mode: 'physical' as const,
  spread,
  cards: [
    {
      cardId: 'ar00',
      orientation: 'upright' as const,
      positionId: 'p1',
      position: '我的想法',
    },
  ],
  interpretation: '',
  aiInterpretation: null,
  tags: [],
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
};

describe('enhanced CloudBase contract', () => {
  it('puts the four original spreads before the imported spreads and keeps 78 local meanings', () => {
    expect((tarot as any).BUILT_IN_SPREADS?.map((s: any) => s.name)).toEqual([
      '三张无牌阵',
      '时间之流',
      '一张牌',
      '探索',
      '二选一抉择',
      '维纳斯之爱',
      '爱的解答',
      '心之声',
      '他心知',
      '恋人金字塔',
      '情感之境',
      '爱情十字',
      '关系前景',
      '友谊牌阵',
    ]);
    expect(Object.keys((tarot as any).CARD_MEANINGS ?? {})).toHaveLength(78);
  });
  it('requires a question before drawing structured spreads', () => {
    expect(() => (api.drawCards as any)(spread, '')).toThrow('请先填写');
    const cards = (api.drawCards as any)(spread, '如何沟通？');
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ positionId: 'p1', position: '我的想法' });
  });
  it('rejects malformed spread positions and blank names without coercion', () => {
    for (const bad of [
      { ...spread, name: '' },
      { ...spread, positions: [null] },
      { ...spread, positions: [{ id: 'p1', question: {} }] },
      {
        ...spread,
        positions: Array.from({ length: 13 }, (_, i) => ({
          id: `p${i}`,
          question: '问题',
        })),
      },
    ]) {
      expect(tarot.validateSpread(bad).ok).toBe(false);
    }
  });
  it('stores structured spread and optional interpretations separately', () => {
    expect(api.toReadingRow(input as any)).toMatchObject({
      spread: 'custom-1',
      spread_data: spread,
      interpretation: '',
      ai_interpretation: null,
    });
  });
  it('maps old readings with legacy card positions to structured data', () => {
    const reading = api.mapReadingRow({
      id: 1,
      owner_id: 'u1',
      author_name: '小月',
      question: '问题',
      mode: 'online',
      spread: 'one',
      cards: [{ cardId: 'ar00', position: '本次指引', orientation: 'upright' }],
      interpretation: '旧解读',
      tags: [],
      feedback: '',
      created_at: '2026-09-10',
      updated_at: '2026-09-10',
    } as any);
    expect(reading.spread).toMatchObject({
      id: 'one',
      positions: [{ question: '本次指引' }],
    });
    expect(reading.cards[0]).toHaveProperty('positionId');
    expect(reading).toHaveProperty('aiInterpretation', null);
    expect(reading.interpretation).toBe('旧解读');
  });
  it('exposes private spread CRUD and event-function interpretation', () => {
    for (const name of [
      'listCustomSpreads',
      'createCustomSpread',
      'updateCustomSpread',
      'deleteCustomSpread',
      'generateInterpretation',
    ])
      expect((api as any)[name]).toBeTypeOf('function');
  });
  it('uses Alibaba Supabase tables for data and calls DeepSeek directly from the browser', () => {
    const source = readFileSync(
      new URL('./cloudbase-api.ts', import.meta.url),
      'utf8',
    );
    expect(source).toContain('VITE_SUPABASE_URL');
    expect(source).toContain('VITE_SUPABASE_ANON_KEY');
    expect(source).toContain('VITE_DEEPSEEK_API_KEY');
    expect(source).toContain('requestDeepSeekInterpretation');
    expect(source).not.toContain('VITE_AI_API_URL');
    expect(source).not.toContain('/rest/v1/rpc/');
    expect(source).toContain('/rest/v1/readings');
    expect(source).toContain('/rest/v1/custom_spreads');
    expect(source).toContain('/rest/v1/reading_feed');
    expect(source).not.toContain('/functions/v1/tarot-ai');
    expect(source).toContain("'content-type': 'application/json'");
    expect(source).not.toContain('neon.tech');
    expect(source).not.toContain('chatgpt.site');
    expect(source).not.toContain('service.tcloudbase.com');
    expect(source).not.toContain("callFunction({ name: 'tarot-ai'");
  });
  it('keeps Tencent CloudBase as static hosting only', () => {
    const path = new URL(
      '../cloudbase/migrations/20260914000000_enhanced_tarot.sql',
      import.meta.url,
    );
    expect(existsSync(path)).toBe(true);
    if (!existsSync(path)) return;
    const sql = readFileSync(path, 'utf8');
    expect(sql).toMatch(/add column if not exists spread_data/i);
    expect(sql).toMatch(/custom_spreads enable row level security/i);
    expect(sql).toMatch(
      /for select to anon\s+using \(owner_id = \(select auth.uid\(\)\)\)/i,
    );
    expect(sql).not.toMatch(/drop table|truncate/i);
    const config = JSON.parse(
      readFileSync(new URL('../cloudbaserc.json', import.meta.url), 'utf8'),
    );
    expect(config).not.toHaveProperty('functionRoot');
    expect(config).not.toHaveProperty('functions');
    expect(config).not.toHaveProperty('database');
    expect(config.hosting[0]).toMatchObject({
      framework: 'vite',
      outputDir: 'dist',
      deployPath: '/',
    });
  });
  it('uses 后续反馈 in the Vite metadata', () => {
    const html = readFileSync(
      new URL('../index.html', import.meta.url),
      'utf8',
    );
    expect(html).toContain('后续反馈记录墙');
    expect(html).not.toContain('真实反馈');
  });
});
