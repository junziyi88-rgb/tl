# Tarot Group MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first single-space tarot website where up to 50 WeChat group members first write a question, use nine built-in or private 1–12-card spreads, optionally request concise DeepSeek-assisted interpretation, and decide whether to save the reading and spread.

**Architecture:** A React/Vite single-page client talks to an Express JSON API. The server owns random draws, private custom-spread access, validation, member edit tokens, admin authorization, idempotent writes, an atomic JSON data store, and a DeepSeek adapter that combines an original local 78-card meaning catalog with structured model output. The production Express process serves both the API and the compiled client as one Node service with persistent storage.

**Tech Stack:** Node.js 24, TypeScript 5, React 19, Vite 7, Express 5, Zod 4, Vitest 3, Testing Library, Supertest, Playwright, CSS.

## Global Constraints

- The site has exactly one public shared space and one fixed URL; there is no room creation, joining, switching, or password.
- The site is designed for approximately 50 members and prioritizes WeChat's mobile browser.
- A non-empty question is required before any random draw.
- Online draws and physical-card recording support nine built-in spreads and private 1–12-card temporary/custom spreads.
- The complete 78-card deck displays card name, image, and orientation; original upright/reversed meanings remain server-side inputs for optional AI interpretation.
- AI uses the domestic DeepSeek `deepseek-flash` API in non-thinking JSON mode, is click-triggered, limited to three generations per draw, and targets 100–200 Chinese characters per card.
- A custom spread may be discarded, saved privately by its owner, or snapshotted only into a saved reading.
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
shared/cards.ts                      immutable 78-card catalog and nine built-in spread definitions
shared/card-meanings.ts              original Chinese upright/reversed interpretation inputs
server/app.ts                        Express routes, validation, and authorization
server/index.ts                      configuration, startup, static serving
server/store.ts                      serialized atomic JSON persistence
server/draw.ts                       secure no-replacement draw function
server/ai.ts                         DeepSeek adapter, JSON validation, timeout and output limits
server/auth.ts                       token generation and SHA-256 verification
server/__tests__/*.test.ts           draw, persistence, and API behavior tests
src/main.tsx                         React bootstrap
src/App.tsx                          top-level navigation and session restoration
src/api.ts                           typed HTTP client
src/session.ts                       local member credential persistence
src/features/feed/ReadingFeed.tsx    shared feed, filters, and empty/error states
src/features/draw/DrawFlow.tsx       spread selection and online draw flow
src/features/draw/PhysicalFlow.tsx   physical card selection flow
src/features/draw/SpreadBuilder.tsx  temporary/private 1–12-card spread editor
src/features/editor/ReadingEditor.tsx question, interpretation, tags, publish
src/features/editor/AiInterpretation.tsx click-triggered generation and version choice
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

### Task 1: Project foundation, card meanings, and built-in spreads

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `.env.example`
- Create: `shared/types.ts`, `shared/cards.ts`, `shared/card-meanings.ts`, `shared/cards.test.ts`
- Create: `scripts/generate-card-art.mjs`, `public/card-back.svg`, `public/cards/*.svg`

**Interfaces:**
- Produces: `CARDS: readonly CardDefinition[]`, `BUILT_IN_SPREADS: readonly SpreadDefinition[]`, `CARD_MEANINGS: Record<CardId, CardMeaning>`, and `isCardId(value: string): value is CardId`.
- Produces domain types `DrawMode`, `Orientation`, `SpreadDefinition`, `SpreadPosition`, `DrawnCard`, `AiInterpretation`, `CustomSpread`, `MemberSession`, and `Reading`.

- [ ] **Step 1: Scaffold dependencies and test scripts**

Create scripts `dev`, `build`, `start`, `test`, `test:e2e`, and `generate:cards`. Install React/Vite for the client; Express/Zod for the server; `tsx`, Vitest, Testing Library, Supertest, and Playwright for verification. Configure Vite to proxy `/api` to `http://localhost:8787`.

- [ ] **Step 2: Write the failing catalog test**

```ts
import { describe, expect, it } from "vitest";
import { CARD_MEANINGS } from "./card-meanings";
import { BUILT_IN_SPREADS, CARDS } from "./cards";

describe("tarot catalog", () => {
  it("contains 78 unique cards, meanings, and nine approved spreads", () => {
    expect(CARDS).toHaveLength(78);
    expect(new Set(CARDS.map((card) => card.id)).size).toBe(78);
    expect(Object.keys(CARD_MEANINGS)).toHaveLength(78);
    expect(BUILT_IN_SPREADS.map((spread) => spread.name)).toEqual([
      "维纳斯之爱", "爱的解答", "心之声", "他心知", "恋人金字塔",
      "情感之境", "爱情十字", "关系前景", "友谊牌阵",
    ]);
    expect(BUILT_IN_SPREADS.find((spread) => spread.name === "友谊牌阵")?.positions).toHaveLength(6);
  });
});
```

- [ ] **Step 3: Run the test and confirm the catalog is absent**

Run: `npm test -- shared/cards.test.ts`

Expected: FAIL because `shared/cards.ts` does not exist.

- [ ] **Step 4: Implement the shared types and 78-card catalog**

Define 22 major arcana and four 14-card suits with stable IDs. Transcribe the nine approved spread names and ordered position questions from the supplied images, excluding “钻石展开法”; implement “友谊牌阵” as six positions with the lower-right position numbered six. Add original concise Chinese upright and reversed meanings for every card. Every card points to `/cards/<id>.svg`.

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
- Consumes: `CARDS`, a validated `SpreadDefinition`, `DrawnCard`, `MemberSession`, and `Reading`.
- Produces: `drawCards(spread: SpreadDefinition): DrawnCard[]`.
- Produces: `createToken(): string`, `hashToken(token: string): string`, `tokensMatch(token: string, hash: string): boolean`.
- Produces: `JsonStore` methods `createMember`, `listReadings`, `createReading`, `updateReading`, `deleteReading`, `listCustomSpreads`, `createCustomSpread`, `updateCustomSpread`, and `deleteCustomSpread`.

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

Persist `{ members, readings, customSpreads, idempotency }` to `DATA_FILE`. Chain all mutations through one promise, write to `<data-file>.tmp`, then rename it atomically. Store only token hashes. Sort readings by `createdAt` descending and never return one member's custom spreads to another member token.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- server/__tests__/draw.test.ts server/__tests__/store.test.ts`

Expected: all draw, token, atomic-write, ownership, and idempotency tests PASS.

Commit: `feat: add tarot draw and persistence core`

---

### Task 3: Validated JSON API, private spreads, and DeepSeek adapter

**Files:**
- Create: `server/app.ts`, `server/index.ts`, `server/ai.ts`
- Create: `server/__tests__/api.test.ts`, `server/__tests__/ai.test.ts`

**Interfaces:**
- Consumes: all Task 2 functions and store methods.
- Produces routes `POST /api/members`, `POST /api/draws`, `GET /api/readings`, `POST /api/readings`, `PATCH /api/readings/:id`, `DELETE /api/readings/:id`, private `/api/spreads` CRUD, and `POST /api/interpretations`.
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

Validate nickname length 1–24, question 1–160 before draws, optional personal interpretation up to 4000 characters, feedback 0–200, at most three tags of 1–16 characters, 1–12 ordered spread positions with non-empty labels, spread/card counts, legal card IDs, legal orientations, no repeated cards, and no more than three AI generations for one draw ID. Return errors as `{ error: string, fieldErrors?: Record<string, string[]> }`.

- [ ] **Step 4: Implement and test the DeepSeek adapter**

Read `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, and `DEEPSEEK_MODEL` from the environment. Send the local card-meaning ground truth, user question, ordered position questions, card names, and orientations to `deepseek-flash` with thinking disabled and JSON output enabled. Validate a response shaped as `{ cards: { positionId, text }[], synthesis: string, advice: string, disclaimer: string }`; enforce 100–200 Chinese characters per card, cap synthesis and advice, use an abort timeout, and map upstream/auth/quota/format failures to stable application errors without losing the client draft.

- [ ] **Step 5: Implement startup and production static serving**

Read `PORT`, `DATA_FILE`, and `ADMIN_KEY` from environment. Refuse production startup when `ADMIN_KEY` is missing or shorter than 12 characters. Serve `dist/index.html` for non-API routes after `npm run build`.

- [ ] **Step 6: Verify and commit**

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

### Task 5: Question-first draw, temporary spreads, AI preview, and save choices

**Files:**
- Create: `src/features/draw/DrawFlow.tsx`
- Create: `src/features/draw/PhysicalFlow.tsx`
- Create: `src/features/draw/SpreadBuilder.tsx`
- Create: `src/features/editor/ReadingEditor.tsx`
- Create: `src/features/editor/AiInterpretation.tsx`
- Create: `src/__tests__/draw-flows.test.tsx`
- Modify: `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `BUILT_IN_SPREADS`, `CARDS`, private spread CRUD, `api.createDraw`, `api.createInterpretation`, `api.createReading`, and `TarotCard`.
- Produces: a normalized `ReadingDraft` from either draw mode, up to three private AI preview versions, and the explicit outcomes discard, save-reading, or save-reading-and-spread.

- [ ] **Step 1: Write failing online and physical flow tests**

```tsx
it("requires a question, uses a temporary spread, and saves the reading without saving the spread", async () => {
  render(<DrawFlow session={session} onPublished={onPublished} />);
  expect(screen.getByRole("button", { name: "开始抽牌" })).toBeDisabled();
  await userEvent.type(screen.getByLabelText("本次想问什么？"), "这周需要留意什么？");
  await userEvent.click(screen.getByRole("button", { name: "临时自建牌阵" }));
  await userEvent.type(screen.getByLabelText("第 1 张牌的小问题"), "当前最重要的能量");
  await userEvent.click(screen.getByRole("button", { name: "开始抽牌" }));
  for (const button of await screen.findAllByRole("button", { name: "翻开这张牌" })) {
    await userEvent.click(button);
  }
  await userEvent.click(screen.getByRole("button", { name: "AI 辅助解牌" }));
  await userEvent.click(await screen.findByRole("button", { name: "采用这版" }));
  await userEvent.click(screen.getByRole("button", { name: "仅保存本次记录" }));
  expect(onPublished).toHaveBeenCalledOnce();
  expect(api.createCustomSpread).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the tests and confirm missing flows**

Run: `npm test -- src/__tests__/draw-flows.test.tsx`

Expected: FAIL because draw-flow components do not exist.

- [ ] **Step 3: Implement online draw interaction**

Require the question before enabling a draw. Let the member select one of the nine built-in spreads, a private saved spread, or a temporary 1–12-card spread; request the result once, reveal each face without changing it, and preserve the draw and draft when publishing or AI generation fails.

- [ ] **Step 4: Implement physical selection interaction**

Render one selector per spread position. Provide searchable Chinese/English card names, orientation toggles, clear duplicate-card errors, and disable continuation until every position is filled.

- [ ] **Step 5: Implement temporary and private spread editing**

Allow 1–12 ordered positions with editable non-empty questions, add/remove/reorder controls, optional spread name, and owner-only saved-spread CRUD. After a temporary-spread draw expose exactly three outcomes: discard without writing, save the reading with an immutable spread snapshot, or atomically save both the reading and reusable private spread.

- [ ] **Step 6: Implement click-triggered AI preview and shared editor**

Keep personal interpretation optional. Call AI only after the explicit button, show per-card 100–200-character sections plus synthesis/advice/disclaimer, allow at most three generations, and add only the selected version to the record. Allow up to three tags, show a compact preview, disable repeated submit clicks, reuse the same idempotency key on retries, and show explicit retry without clearing content.

- [ ] **Step 7: Verify and commit**

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
