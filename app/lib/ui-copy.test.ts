import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const styles = readFileSync(
  new URL('../app/globals.css', import.meta.url),
  'utf8',
);

describe('concise product copy', () => {
  it('uses the requested draw mode names', () => {
    expect(page).toContain('随机抽牌，AI解答');
    expect(page).toContain('记录线下牌面');
    expect(page).not.toContain(
      '<NativeSelectOption value="online">在线抽牌</NativeSelectOption>',
    );
    expect(page).not.toContain(
      '<NativeSelectOption value="physical">线下记录</NativeSelectOption>',
    );
    expect(page).not.toContain(
      "reading.mode === 'online' ? '在线抽牌' : '线下记录'",
    );
  });

  it('removes the question-first slogan and redundant prompts', () => {
    for (const copy of [
      '先写问题，再抽牌',
      '先写问题，再选择牌阵',
      '本次想问什么',
      '问题越清楚，牌面越容易落到现实',
    ]) {
      expect(page).not.toContain(copy);
    }
    expect(page).toContain('这次真正想看清什么？');
  });

  it('uses one AI action and the shortened feedback heading', () => {
    expect(page).toContain("'AI 解牌'");
    expect(page).not.toContain('让 AI 帮你串起牌面');
    expect(page).not.toContain('version-tabs');
    expect(page).not.toContain('后来，事情怎么样了？');
    expect(page).not.toContain('真实反馈');
    expect(page).toContain('后续反馈');
  });

  it('waits for the explicit AI button before requesting interpretation', () => {
    expect(page).not.toContain('const openCompose = () =>');
    expect(page).not.toContain("if (mode === 'online') void generateAi();");
    expect(page.match(/onClick=\{\(\) => setView\('compose'\)\}/g)).toHaveLength(2);
    expect(page).toContain('onClick={() => void generateAi()}');
  });

  it('renders text-only card summaries in the feed', () => {
    expect(page).toContain('FeedCardNames');
    expect(page).toMatch(/【\s*\{card\.orientation === 'reversed' \? '逆位' : '正位'\}】/);
  });
});

describe('stable tarot fan renderer', () => {
  it('uses a fixed slot pool and frame-based motion', () => {
    expect(page).toContain('FAN_POOL_SIZE');
    expect(page).toContain('requestAnimationFrame');
    expect(page).toContain('cardRefs');
    expect(page).not.toContain('indexes.map((deckIndex, slot)');
  });

  it('preloads and renders the card back as a real image layer', () => {
    expect(page).toContain("preload.src = '/card-back-source.svg'");
    expect(page).toContain('<picture className="fan-card-art">');
    expect(page).toContain('srcSet="/card-back-source.svg"');
    expect(page).toContain('src="/card-back.jpg"');
    expect(styles).not.toMatch(/\.fan-card\{[^}]*url\('\/card-back\.jpg'\)/);
  });
});
