# CloudBase Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the existing one-room shared tarot record MVP to Tencent CloudBase so a WeChat group can use one mainland-accessible URL for online random draws, physical-card entry, shared records, and one-line feedback.

**Architecture:** Convert the existing vinext/Cloudflare build into a static Vite React application. Use CloudBase JS SDK v3 with anonymous sessions and CloudBase PostgreSQL directly from the browser; PostgreSQL RLS makes every record readable by the room while limiting update/delete to the anonymous identity that created it. Use a versioned SQL migration and CloudBase CLI for database and static-hosting deployment.

**Tech Stack:** React 19, Vite 8, TypeScript 5.9, `@cloudbase/js-sdk` 3.8.2, PostgreSQL with RLS, Vitest, CloudBase CLI 3.8.1.

## Global Constraints

- Exactly one shared room; no room creation or room selector.
- All signed-in group members can read every tarot record.
- Support both online cryptographic random draws and physical-card selection.
- Feedback is one line, at most 200 characters.
- Nickname-only entry; no phone number, password, or private profile.
- CloudBase environment is `gongjian-tarot-d2geleaahb9b8605e` in `ap-shanghai`.
- The free experience package must remain at 0 yuan with pay-as-you-go disabled.
- Do not create a Publishable Key or long-lived Tencent API key.

---

### Task 1: CloudBase data contract and browser repository

**Files:**
- Create: `lib/cloudbase-api.ts`
- Create: `lib/cloudbase-api.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `Reading`, `DrawnCard`, `DrawMode`, and `SpreadKind` from `lib/tarot.ts`.
- Produces: `createMember(nickname)`, `listReadings()`, `createReading(input)`, `updateFeedback(id, feedback)`, `deleteReading(id)`, and `drawCards(spread)`.

- [ ] **Step 1: Install the CloudBase SDK and test runner**

Run: `npm install @cloudbase/js-sdk@3.8.2 && npm install --save-dev vitest@latest`

Expected: `package.json` contains `@cloudbase/js-sdk` and `vitest`; installation exits 0.

- [ ] **Step 2: Write failing repository contract tests**

Create `lib/cloudbase-api.test.ts` with tests that assert the exact snake_case PostgreSQL row mapping, ISO timestamp conversion to milliseconds, single-line feedback validation, unique-card draws, and spread-position preservation.

```ts
import { describe, expect, it } from 'vitest';
import { drawCards, mapReadingRow, normalizeFeedback, toReadingRow } from './cloudbase-api';

describe('CloudBase tarot data contract', () => {
  it('maps a PostgreSQL row to the UI Reading shape', () => {
    expect(mapReadingRow({
      id: 7, owner_id: 'u1', author_name: '小月', question: '本周如何？',
      mode: 'online', spread: 'one', cards: [{ cardId: 'ar00', orientation: 'upright', position: '本次指引' }],
      interpretation: '保持开放', tags: ['工作'], feedback: '事情顺利完成',
      created_at: '2026-09-10T00:00:00.000Z', updated_at: '2026-09-10T01:00:00.000Z',
    })).toMatchObject({ id: '7', memberId: 'u1', authorName: '小月', createdAt: 1788998400000 });
  });

  it('creates rows without accepting a caller supplied owner id', () => {
    expect(toReadingRow({
      authorName: '小月', question: '本周如何？', mode: 'online', spread: 'one',
      cards: [{ cardId: 'ar00', orientation: 'upright', position: '本次指引' }],
      interpretation: '保持开放', tags: ['工作'], idempotencyKey: '11111111-1111-4111-8111-111111111111',
    })).not.toHaveProperty('owner_id');
  });

  it('keeps feedback to one line and 200 characters', () => {
    expect(normalizeFeedback('已经发生')).toBe('已经发生');
    expect(() => normalizeFeedback('第一行\n第二行')).toThrow('真实反馈需要是一行');
    expect(() => normalizeFeedback('字'.repeat(201))).toThrow('真实反馈需要是一行');
  });

  it('draws unique cards and preserves configured positions', () => {
    const cards = drawCards('five');
    expect(new Set(cards.map((card) => card.cardId)).size).toBe(5);
    expect(cards.map((card) => card.position)).toEqual(['现状', '阻碍', '根源', '建议', '可能结果']);
  });
});
```

- [ ] **Step 3: Run the tests and verify RED**

Run: `npx vitest run lib/cloudbase-api.test.ts`

Expected: FAIL because `lib/cloudbase-api.ts` does not exist.

- [ ] **Step 4: Implement the minimal CloudBase browser repository**

Create `lib/cloudbase-api.ts` with a single CloudBase app initialized using environment `gongjian-tarot-d2geleaahb9b8605e`, an `ensureAnonymousSession()` helper based on `auth.getSession()` / `auth.signInAnonymously()`, PostgreSQL CRUD through `app.rdb().from('readings')`, pure row mapping helpers, and client-side cryptographic drawing without replacement.

The member session returned to the UI must be `{ memberId: user.id, nickname, token: '' }`. The repository must omit `owner_id` on insert so PostgreSQL assigns it from `auth.uid()`. Every SDK `{ error }` must be converted into a Chinese `Error` message.

- [ ] **Step 5: Run the tests and verify GREEN**

Run: `npx vitest run lib/cloudbase-api.test.ts`

Expected: 4 tests pass, 0 fail.

- [ ] **Step 6: Commit the repository layer**

Run: `git add package.json package-lock.json lib/cloudbase-api.ts lib/cloudbase-api.test.ts && git commit -m "feat: add CloudBase tarot repository"`

Expected: commit created on `codex/cloudbase-deploy`.

### Task 2: Static Vite application conversion

**Files:**
- Create: `index.html`
- Create: `src/main.tsx`
- Modify: `app/page.tsx`
- Modify: `vite.config.ts`
- Modify: `tsconfig.json`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: the repository functions from Task 1.
- Produces: static `dist/index.html`, hashed client assets, tarot card images, and a browser-only application with no `/api` dependency.

- [ ] **Step 1: Write the failing static-build assertion**

Add a Vitest case that reads `vite.config.ts` and asserts it no longer imports the OpenAI Sites or Cloudflare Vite plugins and that the build entry `index.html` exists.

```ts
it('uses a portable Vite build with a browser entry', () => {
  const config = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
  expect(config).not.toContain('@openai/sites-vite-plugin');
  expect(config).not.toContain('@cloudflare/vite-plugin');
  expect(existsSync(new URL('../index.html', import.meta.url))).toBe(true);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run lib/cloudbase-api.test.ts`

Expected: FAIL because the current config contains both Cloudflare-specific plugins and `index.html` does not exist.

- [ ] **Step 3: Replace server fetch dispatch with the repository**

In `app/page.tsx`, import Task 1 functions and make its local `api()` compatibility wrapper dispatch the existing paths to CloudBase CRUD. Keep all current screens and copy unchanged. Remove the non-owner admin-key delete controls because RLS permits deletion only by the record owner.

- [ ] **Step 4: Add the Vite browser entry and portable config**

Create `index.html` with `<div id="root"></div>` and `/src/main.tsx`. Create `src/main.tsx` that imports `app/globals.css` and renders `<Home />` through `createRoot`. Replace `vite.config.ts` with React, Tailwind PostCSS, and the `@` path alias. Set scripts to `vite`, `vite build`, `vite preview`, and `vitest run`; remove vinext, Wrangler, Drizzle, Cloudflare, and OpenAI Sites build dependencies.

- [ ] **Step 5: Run tests and production build**

Run: `npm test && npm run build`

Expected: all tests pass and `dist/index.html` plus `dist/assets/*` are produced.

- [ ] **Step 6: Commit the static application**

Run: `git add index.html src/main.tsx app/page.tsx vite.config.ts tsconfig.json package.json package-lock.json && git commit -m "refactor: make tarot app a static CloudBase client"`

Expected: commit created on `codex/cloudbase-deploy`.

### Task 3: PostgreSQL RLS schema and CloudBase deployment

**Files:**
- Create: `cloudbase/migrations/20260910000000_create_tarot_readings.sql`
- Create: `cloudbaserc.json`
- Create: `README-CLOUDBASE.md`

**Interfaces:**
- Consumes: CloudBase environment `gongjian-tarot-d2geleaahb9b8605e` and `dist/` from Task 2.
- Produces: `public.readings` table, RLS policies, deployed static website, and the public mainland-accessible URL.

- [ ] **Step 1: Write a failing migration policy test**

Add a test that reads the SQL migration and requires: `ENABLE ROW LEVEL SECURITY`; public read policy for `anon`; insert/update/delete ownership checks using `auth.uid()`; `feedback` as `varchar(200)`; and no grant allowing arbitrary updates to `owner_id`.

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test`

Expected: FAIL because the migration file does not exist.

- [ ] **Step 3: Create the PostgreSQL migration**

Create a `public.readings` table with bigint identity primary key, `owner_id text default auth.uid()`, the tarot fields, `jsonb` cards, `text[]` tags, one-line feedback check, timestamps, and a unique idempotency key. Grant `SELECT`, `INSERT`, and `DELETE` to `anon`; grant column-scoped `UPDATE(feedback, updated_at)` to `anon`; grant sequence usage; enable RLS; create select-all and owner-only insert/update/delete policies.

- [ ] **Step 4: Add deployment configuration and operator notes**

Create `cloudbaserc.json` version 2.1 with the environment ID, PostgreSQL migration directory, and static hosting output `dist`. Create `README-CLOUDBASE.md` with exact build, migration preview/apply, hosting deploy, and verification commands.

- [ ] **Step 5: Verify configuration and preview database migration**

Run: `tcb -v && tcb db pg migration up -e gongjian-tarot-d2geleaahb9b8605e --dry-run`

Expected: CLI version is at least 3.8.1 and one pending migration is shown without an error.

- [ ] **Step 6: Apply schema and deploy the static site**

Run: `tcb db pg migration up -e gongjian-tarot-d2geleaahb9b8605e`

Run: `tcb hosting deploy ./dist / -e gongjian-tarot-d2geleaahb9b8605e --verify --safe`

Expected: migration is recorded as applied and the hosting upload verifies successfully.

- [ ] **Step 7: Verify remote schema and website behavior**

Run: `tcb db execute -e gongjian-tarot-d2geleaahb9b8605e --role cloudbase_read_only_user --sql "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='readings'" --json`

Expected: result includes `readings`.

Open the CloudBase hosting URL and verify: nickname entry; empty shared feed; online one-card draw; physical one-card selection; publishing a record; opening it from the feed; adding one-line feedback; and reloading with the record still visible.

- [ ] **Step 8: Commit deployment assets**

Run: `git add cloudbase cloudbaserc.json README-CLOUDBASE.md lib/cloudbase-api.test.ts && git commit -m "deploy: configure Tencent CloudBase hosting and database"`

Expected: commit created on `codex/cloudbase-deploy`.

## Self-Review

- Spec coverage: one room, shared full feed, both draw modes, nickname entry, and one-line feedback are mapped to Tasks 1–3.
- Placeholder scan: no deferred implementation markers are present.
- Type consistency: PostgreSQL `owner_id` maps to `Reading.memberId`; numeric IDs map to strings; `cards` and `tags` keep the existing UI types.

