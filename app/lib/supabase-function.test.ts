import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const functionUrl = new URL('../supabase/functions/tarot-ai/index.ts', import.meta.url);
const meaningsUrl = new URL('../supabase/functions/tarot-ai/meanings.ts', import.meta.url);
const configUrl = new URL('../supabase/config.toml', import.meta.url);

describe('Alibaba Supabase DeepSeek Edge Function', () => {
  it('keeps the model key server-side and restricts browser origins', () => {
    expect(existsSync(functionUrl)).toBe(true);
    if (!existsSync(functionUrl)) return;

    const source = readFileSync(functionUrl, 'utf8');
    expect(source).toContain("Deno.env.get('DEEPSEEK_API_KEY')");
    expect(source).toContain('https://api.deepseek.com/chat/completions');
    expect(source).toContain('gongjian-tarot-d2geleaahb9b8605e-1484522062.tcloudbaseapp.com');
    expect(source).toMatch(/request\.method === 'OPTIONS'/);
    expect(source).toContain('Access-Control-Allow-Origin');
    expect(source).toContain('validateInput');
    expect(source).not.toContain('neon.tech');
    expect(source).not.toContain('chatgpt.site');
  });

  it('ships all local card meanings and permits public anon invocation', () => {
    expect(existsSync(meaningsUrl)).toBe(true);
    expect(existsSync(configUrl)).toBe(true);
    if (!existsSync(meaningsUrl) || !existsSync(configUrl)) return;

    const meanings = readFileSync(meaningsUrl, 'utf8');
    const cardIds = new Set(
      [...meanings.matchAll(/"((?:ar|cu|pe|sw|wa)\d{2})"\s*:/g)].map(
        (match) => match[1],
      ),
    );
    expect(cardIds).toHaveLength(78);

    const config = readFileSync(configUrl, 'utf8');
    expect(config).toMatch(/\[functions\.tarot-ai\][\s\S]+verify_jwt\s*=\s*false/);
  });
});
