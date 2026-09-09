# Tarot Group MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first single-space tarot website where up to 50 WeChat group members can draw cards online or record physical draws, publish shared readings, and later add one-line feedback.

**Architecture:** A React/Vite single-page client talks to an Express JSON API. The server owns random draws, validation, member edit tokens, admin authorization, idempotent writes, and a small atomic JSON data store suitable for one low-traffic shared group. The production Express process serves both the API and the compiled client so the MVP can be deployed as one Node service with persistent storage.

**Tech Stack:** Node.js 24, TypeScript 5, React 19, Vite 7, Express 5, Zod 4, Vitest 3, Testing Library, Supertest, Playwright, CSS.

## Global Constraints

- The site has exactly one public shared space and one fixed URL; there is no room creation, joining, switching, or password.
- The site is designed for approximately 50 members and prioritizes WeChat's mobile browser.
- Online draws and physical-card recording both support one-, three-, and five-card spreads.
- The complete 78-card deck displays card name, image, and orientation only; no meanings, keywords, or AI interpretation.
- All published readings are visible to every visitor.
- A reading has one optional single-line `feedback` value that its author can add or replace later.
- Member identity is a browser-local edit token; an environment-configured admin key can delete any reading.
- Failed submissions retain the user's draft and an idempotency key prevents duplicate readings.

---

## File Structure

```text
package.json                         scripts and dependencies
tsconfig.json                        shared TypeScript settings
vite.config.ts                       client build and development proxy
vitest.config.ts                     unit/integration test environment
playwright.config.ts                 mobile-browser end-to-end configuration
.env.example                         port, data path, and admin-key contract
shared/types.ts                      API/domain types shared by client and server
shared/cards.ts                      immutable 78-card catalog and spread metadata
server/app.ts                        Express routes, validation, and authorization
server/index.ts                      configuration, startup, static serving
server/store.ts                      serialized atomic JSON persistence
server/draw.ts                       secure no-replacement draw function
server/auth.ts                       token generation and SHA-256 verification
server/__tests__/*.test.ts           draw, persistence, and API behavior tests
src/main.tsx                         React bootstrap
src/App.tsx                          top-level navigation and session restoration
src/api.ts                           typed HTTP client
src/session.ts                       local member credential persistence
src/features/feed/ReadingFeed.tsx    shared feed, filters, and empty/error states
src/features/draw/DrawFlow.tsx       spread selection and online draw flow
src/features/draw/PhysicalFlow.tsx   physical card selection flow
src/features/editor/ReadingEditor.tsx question, interpretation, tags, publish
src/features/detail/ReadingDetail.tsx details, feedback, sharing, deletion
src/components/TarotCard.tsx         reusable face/back/orientation presentation
src/components/Shell.tsx             mobile navigation and layout shell
src/styles.css                       responsive visual system and interaction states
src/__tests__/*.test.tsx             component and flow tests
public/cards/*.svg                   78 original generated card illustrations
public/card-back.svg                 original shared card-back illustration
scripts/generate-card-art.mjs        deterministic SVG asset generator
e2e/tarot-flow.spec.ts               cross-member browser journey
data/.gitkeep                        persistent-data directory marker
```

---

### Task 1: Project foundation and complete tarot catalog

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `.env.example`
- Create: `shared/types.ts`, `shared/cards.ts`, `shared/cards.test.ts`
- Create: `scripts/generate-card-art.mjs`, `public/card-back.svg`, `public/cards/*.svg`

**Interfaces:**
- Produces: `CARDS: readonly CardDefinition[]`, `SPREADS: Record<SpreadKind, SpreadDefinition>`, `isCardId(value: string): value is CardId`.
- Produces domain types `DrawMode`, `Orientation`, `SpreadKind`, `DrawnCard`, `MemberSession`, and `Reading`.

- [ ] **Step 1: Scaffold dependencies and test scripts**

Create scripts `dev`, `build`, `start`, `test`, `test:e2e`, and `generate:cards`. Install React/Vite for the client; Express/Zod for the server; `tsx`, Vitest, Testing Library, Supertest, and Playwright for verification. Configure Vite to proxy `/api` to `http://localhost:8787`.

- [ ] **Step 2: Write the failing catalog test**

```ts
import { describe, expect, it } from "vitest";
import { CARDS, SPREADS } from "./cards";

describe("tarot catalog", () => {
  it("contains 78 unique cards and fixed spread sizes", () => {
    expect(CARDS).toHaveLength(78);
    expect(new Set(CARDS.map((card) => card.id)).size).toBe(78);
    expect(SPREADS.one.positions).toHaveLength(1);
    expect(SPREADS.three.positions).toHaveLength(3);
    expect(SPREADS.five.positions).toHaveLength(5);
  });
});
```

- [ ] **Step 3: Run the test and confirm the catalog is absent**

Run: `npm test -- shared/cards.test.ts`

Expected: FAIL because `shared/cards.ts` does not exist.

- [ ] **Step 4: Implement the shared types and 78-card catalog**

Define 22 major arcana and four 14-card suits with stable IDs. Use spread positions `本次指引`, `过去/现在/未来`, and `现状/阻碍/根源/建议/可能结果`. Every card points to `/cards/<id>.svg`.

- [ ] **Step 5: Generate deterministic original SVG artwork**

The generator must create one 300×520 SVG per catalog card using suit-specific colors and symbols, plus a dark indigo/gold geometric card back. It must escape all embedded card labels and overwrite only files in `public/cards`.

- [ ] **Step 6: Verify and commit**

Run: `npm run generate:cards && npm test -- shared/cards.test.ts && npm run build`

Expected: 78 card SVGs generated, catalog test PASS, Vite build PASS.

Commit: `feat: add tarot catalog and project foundation`

---

### Task 2: Secure draws, authorization, and atomic persistence

**Files:**
- Create: `server/draw.ts`, `server/auth.ts`, `server/store.ts`
- Create: `server/__tests__/draw.test.ts`, `server/__tests__/store.test.ts`
- Create: `data/.gitkeep`

**Interfaces:**
- Consumes: `CARDS`, `SPREADS`, `DrawnCard`, `SpreadKind`, `MemberSession`, `Reading`.
- Produces: `drawCards(spread: SpreadKind): DrawnCard[]`.
- Produces: `createToken(): string`, `hashToken(token: string): string`, `tokensMatch(token: string, hash: string): boolean`.
- Produces: `JsonStore` methods `createMember`, `listReadings`, `createReading`, `updateReading`, and `deleteReading`.

- [ ] **Step 1: Write failing draw and store tests**

```ts
it("draws five unique cards with legal orientations", () => {
  const result = drawCards("five");
  expect(result).toHaveLength(5);
  expect(new Set(result.map((item) => item.cardId)).size).toBe(5);
  expect(result.every((item) => ["upright", "reversed"].includes(item.orientation))).toBe(true);
});

it("returns the original reading for a repeated idempotency key", async () => {
  const first = await store.createReading(member.id, "same-key", validInput);
  const second = await store.createReading(member.id, "same-key", validInput);
  expect(second.id).toBe(first.id);
  expect((await store.listReadings())).toHaveLength(1);
});
```

- [ ] **Step 2: Run tests and confirm missing implementations**

Run: `npm test -- server/__tests__/draw.test.ts server/__tests__/store.test.ts`

Expected: FAIL on unresolved `drawCards` and `JsonStore` imports.

- [ ] **Step 3: Implement cryptographic draw and token helpers**

Use `crypto.randomInt` with a shrinking card pool so draws contain no duplicates. Use `randomBytes(32).toString("base64url")` for tokens and SHA-256 digests with `timingSafeEqual` for comparisons.

- [ ] **Step 4: Implement serialized atomic JSON storage**

Persist `{ members, readings, idempotency }` to `DATA_FILE`. Chain all mutations through one promise, write to `<data-file>.tmp`, then rename it atomically. Store only token hashes. Sort readings by `createdAt` descending.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- server/__tests__/draw.test.ts server/__tests__/store.test.ts`

Expected: all draw, token, atomic-write, ownership, and idempotency tests PASS.

Commit: `feat: add tarot draw and persistence core`

---

### Task 3: Validated single-space JSON API

**Files:**
- Create: `server/app.ts`, `server/index.ts`
- Create: `server/__tests__/api.test.ts`

**Interfaces:**
- Consumes: all Task 2 functions and store methods.
- Produces routes `POST /api/members`, `POST /api/draws`, `GET /api/readings`, `POST /api/readings`, `PATCH /api/readings/:id`, and `DELETE /api/readings/:id`.
- Authorization: `Authorization: Bearer <member token>` for author changes; `X-Admin-Key` for administrative deletion.

- [ ] **Step 1: Write failing API journey tests**

```ts
it("lets two members share readings but only the author edit feedback", async () => {
  const alice = await createMember("Alice");
  const bob = await createMember("Bob");
  const reading = await createReading(alice, validReading);
  expect((await request(app).get("/api/readings")).body[0].question).toBe(validReading.question);
  await request(app).patch(`/api/readings/${reading.id}`)
    .set("Authorization", `Bearer ${bob.token}`)
    .send({ feedback: "实际结果" })
    .expect(403);
  await request(app).patch(`/api/readings/${reading.id}`)
    .set("Authorization", `Bearer ${alice.token}`)
    .send({ feedback: "实际结果" })
    .expect(200);
});
```

- [ ] **Step 2: Run the API test and verify failure**

Run: `npm test -- server/__tests__/api.test.ts`

Expected: FAIL because `createApp` is missing.

- [ ] **Step 3: Implement Zod request schemas and routes**

Validate nickname length 1–24, question 1–160, interpretation 1–4000, feedback 0–200, at most three tags of 1–16 characters, spread/card counts, legal card IDs, legal orientations, and no repeated cards. Return errors as `{ error: string, fieldErrors?: Record<string, string[]> }`.

- [ ] **Step 4: Implement startup and production static serving**

Read `PORT`, `DATA_FILE`, and `ADMIN_KEY` from environment. Refuse production startup when `ADMIN_KEY` is missing or shorter than 12 characters. Serve `dist/index.html` for non-API routes after `npm run build`.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- server/__tests__/api.test.ts`

Expected: member creation, random draw, publish, list, author feedback, forbidden cross-edit, idempotency, and admin deletion tests PASS.

Commit: `feat: expose single-space tarot API`

---

### Task 4: Mobile shell, identity, feed, and filtering

**Files:**
- Create: `src/main.tsx`, `src/App.tsx`, `src/api.ts`, `src/session.ts`
- Create: `src/components/Shell.tsx`, `src/components/TarotCard.tsx`
- Create: `src/features/feed/ReadingFeed.tsx`
- Create: `src/styles.css`, `index.html`
- Create: `src/__tests__/feed.test.tsx`

**Interfaces:**
- Consumes: Task 3 JSON routes and shared domain types.
- Produces: `api` typed client, `loadSession/saveSession/clearSession`, `TarotCard`, and public feed UI.

- [ ] **Step 1: Write a failing feed test**

```tsx
it("collects a nickname and filters the public feed by draw mode", async () => {
  render(<App />);
  await userEvent.type(screen.getByLabelText("你的昵称"), "小月");
  await userEvent.click(screen.getByRole("button", { name: "进入记录墙" }));
  expect(await screen.findByText("大家的塔罗记录")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "线上抽牌" }));
  expect(screen.queryByText("线下记录示例")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `npm test -- src/__tests__/feed.test.tsx`

Expected: FAIL because the React application is missing.

- [ ] **Step 3: Implement typed API and browser-local session**

Wrap non-2xx responses in an `ApiError`. Store `{ memberId, nickname, token }` under `tarot-member-session-v1`. Never place member or admin tokens in URLs.

- [ ] **Step 4: Build the nickname gate and public feed**

Show the nickname form only without a valid local session. Load the shared feed after entry. Provide author, mode, and tag filters; reset filters with one action. Feed cards show question, author, relative time, mode, tags, and compact card faces.

- [ ] **Step 5: Add a mobile visual system**

Use a deep ink background, warm parchment surfaces, muted gold accents, serif display headings, readable system body text, 44px minimum touch targets, visible focus styles, reduced-motion support, sticky bottom actions, and responsive card grids with no horizontal page overflow. `TarotCard` must replace a failed card image with the shared card back plus visible card name.

- [ ] **Step 6: Verify and commit**

Run: `npm test -- src/__tests__/feed.test.tsx && npm run build`

Expected: feed test PASS and production build PASS.

Commit: `feat: add shared tarot feed and member entry`

---

### Task 5: Online and physical draw publishing flows

**Files:**
- Create: `src/features/draw/DrawFlow.tsx`
- Create: `src/features/draw/PhysicalFlow.tsx`
- Create: `src/features/editor/ReadingEditor.tsx`
- Create: `src/__tests__/draw-flows.test.tsx`
- Modify: `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `SPREADS`, `CARDS`, `api.createDraw`, `api.createReading`, `TarotCard`.
- Produces: a normalized `ReadingDraft` from either flow and publishes with `crypto.randomUUID()` as idempotency key.

- [ ] **Step 1: Write failing online and physical flow tests**

```tsx
it("publishes an online three-card draw after every card is revealed", async () => {
  render(<DrawFlow session={session} onPublished={onPublished} />);
  await userEvent.click(screen.getByRole("button", { name: "三张牌" }));
  await userEvent.click(screen.getByRole("button", { name: "开始抽牌" }));
  for (const button of await screen.findAllByRole("button", { name: "翻开这张牌" })) {
    await userEvent.click(button);
  }
  await userEvent.type(screen.getByLabelText("占卜主题或问题"), "这周需要留意什么？");
  await userEvent.type(screen.getByLabelText("我的解读"), "保持节奏并留意沟通。");
  await userEvent.click(screen.getByRole("button", { name: "发布记录" }));
  expect(onPublished).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run the tests and confirm missing flows**

Run: `npm test -- src/__tests__/draw-flows.test.tsx`

Expected: FAIL because draw-flow components do not exist.

- [ ] **Step 3: Implement online draw interaction**

Let the member choose one, three, or five cards, request the result once, reveal each face without changing the result, and continue only after all cards are revealed. Preserve the draw and draft in component state when publishing fails.

- [ ] **Step 4: Implement physical selection interaction**

Render one selector per spread position. Provide searchable Chinese/English card names, orientation toggles, clear duplicate-card errors, and disable continuation until every position is filled.

- [ ] **Step 5: Implement the shared editor and publishing state**

Require question and interpretation, allow up to three tags, show a compact preview, disable repeated submit clicks, reuse the same idempotency key on retries, and show an explicit retry action without clearing content.

- [ ] **Step 6: Verify and commit**

Run: `npm test -- src/__tests__/draw-flows.test.tsx && npm run build`

Expected: both publishing flows and failure-retention tests PASS; build PASS.

Commit: `feat: add online and physical tarot recording`

---

### Task 6: Detail, author edits, one-line feedback, sharing, and deletion

**Files:**
- Create: `src/features/detail/ReadingDetail.tsx`
- Create: `src/__tests__/reading-detail.test.tsx`
- Modify: `src/App.tsx`, `src/api.ts`, `src/styles.css`

**Interfaces:**
- Consumes: current `Reading`, member session, `api.updateReading`, and `api.deleteReading`.
- Produces: URL-addressable detail state using `?reading=<id>` and a copyable WeChat summary.

- [ ] **Step 1: Write failing feedback and authorization UI tests**

```tsx
it("lets the author edit content, replace one-line feedback, and copy a share summary", async () => {
  render(<ReadingDetail reading={ownedReading} session={ownerSession} />);
  await userEvent.click(screen.getByRole("button", { name: "编辑记录" }));
  await userEvent.clear(screen.getByLabelText("我的解读"));
  await userEvent.type(screen.getByLabelText("我的解读"), "更新后的个人解读");
  await userEvent.click(screen.getByRole("button", { name: "保存修改" }));
  await userEvent.type(screen.getByLabelText("真实反馈"), "后来确实收到了对方的回复");
  await userEvent.click(screen.getByRole("button", { name: "保存反馈" }));
  expect(api.updateReading).toHaveBeenCalledWith(
    ownedReading.id,
    ownerSession.token,
    { feedback: "后来确实收到了对方的回复" },
  );
  await userEvent.click(screen.getByRole("button", { name: "复制到微信群" }));
  expect(navigator.clipboard.writeText).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `npm test -- src/__tests__/reading-detail.test.tsx`

Expected: FAIL because `ReadingDetail` is missing.

- [ ] **Step 3: Implement URL-addressable details, author edits, and feedback**

Display question, author, created time, draw mode, spread positions, orientation, interpretation, tags, and feedback. Let only the author edit question, interpretation, tags, and the single-line feedback; keep the original cards and draw mode immutable. Update the URL with `history.pushState`; handle browser back without React Router.

- [ ] **Step 4: Implement sharing and deletion**

Copy a message containing question, author, compact card list, and the current fixed URL with the reading query parameter. Show delete only to the author or after an admin key is entered; require an in-app confirmation and return to the feed after success.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- src/__tests__/reading-detail.test.tsx && npm run build`

Expected: author content edits and feedback, non-author read-only state, copy, delete, and browser navigation tests PASS; build PASS.

Commit: `feat: add reading feedback and sharing`

---

### Task 7: Mobile end-to-end verification and deployment handoff

**Files:**
- Create: `playwright.config.ts`, `e2e/tarot-flow.spec.ts`, `README.md`
- Modify: `.gitignore`, `package.json`, `.env.example`

**Interfaces:**
- Consumes: the complete single-process production application.
- Produces: repeatable local startup, test, build, and deployment instructions.

- [ ] **Step 1: Write the cross-member end-to-end test**

```ts
test("two mobile members can publish, view, and feedback", async ({ browser }) => {
  const alice = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const bob = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const alicePage = await alice.newPage();
  const bobPage = await bob.newPage();
  await enterAs(alicePage, "Alice");
  await publishOneCardReading(alicePage, "今天的工作状态？", "先完成最重要的事情。");
  await enterAs(bobPage, "Bob");
  await expect(bobPage.getByText("今天的工作状态？")).toBeVisible();
  await alicePage.getByText("今天的工作状态？").click();
  await alicePage.getByLabel("真实反馈").fill("当天按计划完成了");
  await alicePage.getByRole("button", { name: "保存反馈" }).click();
  await bobPage.reload();
  await bobPage.getByText("今天的工作状态？").click();
  await expect(bobPage.getByText("当天按计划完成了")).toBeVisible();
});
```

- [ ] **Step 2: Run the E2E test and fix only observed defects**

Run: `npm run build && npm run test:e2e`

Expected: the two isolated browser contexts see shared data; only Alice can edit her feedback; no horizontal overflow at 390×844.

- [ ] **Step 3: Document operation and deployment**

README must include Windows PowerShell commands for install, development, tests, production build/start, setting a 12+ character `ADMIN_KEY`, backing up `DATA_FILE`, and deploying the one Node service on a host with a persistent disk. State explicitly that ephemeral/serverless filesystems will lose records.

- [ ] **Step 4: Run final verification**

Run: `npm test && npm run build && npm run test:e2e`

Expected: all unit/integration/component tests PASS, production build PASS, mobile E2E PASS.

- [ ] **Step 5: Commit**

Commit: `test: verify shared tarot MVP end to end`
