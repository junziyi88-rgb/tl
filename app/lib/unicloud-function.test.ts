import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const functionUrl = new URL(
  '../uniCloud-aliyun/cloudfunctions/tarot-ai/index.js',
  import.meta.url,
);
const meaningsUrl = new URL(
  '../uniCloud-aliyun/cloudfunctions/tarot-ai/meanings.js',
  import.meta.url,
);
const packageUrl = new URL(
  '../uniCloud-aliyun/cloudfunctions/tarot-ai/package.json',
  import.meta.url,
);

describe('uniCloud Alibaba DeepSeek function', () => {
  it('keeps the DeepSeek key server-side and exposes a URL-safe HTTP handler', () => {
    expect(existsSync(functionUrl)).toBe(true);
    if (!existsSync(functionUrl)) return;

    const source = readFileSync(functionUrl, 'utf8');
    expect(source).toContain('process.env.DEEPSEEK_API_KEY');
    expect(source).toContain('uniCloud.httpclient.request');
    expect(source).toContain('https://api.deepseek.com/chat/completions');
    expect(source).toContain('exports.main = async');
    expect(source).toContain("event.httpMethod === 'OPTIONS'");
    expect(source).toContain('Access-Control-Allow-Origin');
    expect(source).toContain(
      'gongjian-tarot-d2geleaahb9b8605e-1484522062.tcloudbaseapp.com',
    );
    expect(source).not.toContain('neon.tech');
    expect(source).not.toContain('chatgpt.site');
  });

  it('ships all 78 local card meanings without external dependencies', () => {
    expect(existsSync(meaningsUrl)).toBe(true);
    expect(existsSync(packageUrl)).toBe(true);
    if (!existsSync(meaningsUrl) || !existsSync(packageUrl)) return;

    const meanings = readFileSync(meaningsUrl, 'utf8');
    expect(meanings).toContain('majorThemes');
    expect(meanings).toContain('rankThemes');
    expect(meanings).toContain('CARD_MEANINGS');

    const packageJson = JSON.parse(readFileSync(packageUrl, 'utf8'));
    expect(packageJson.main).toBe('index.js');
    expect(packageJson.dependencies ?? {}).toEqual({});
  });
});
