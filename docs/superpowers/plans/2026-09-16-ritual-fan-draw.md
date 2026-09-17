# Ritual Fan Draw Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two ritual transition screens and a server-fixed, draggable 2D fan for choosing online tarot cards.

**Architecture:** A D1-backed draw session fixes the full deck before the fan opens. Pure layout helpers keep the mobile fan deterministic and testable, while the existing reveal, interpretation, and save flows consume the selected cards unchanged.

**Tech Stack:** React 19, TypeScript, CSS transforms and pointer events, Vinext/Cloudflare Workers, D1/Drizzle, Vitest.

## Global Constraints

- Preserve the existing public Site, theme, member identity, physical-card workflow, AI workflow, and saved-reading format.
- The browser must not receive the hidden 78-card mapping before selection is finalized.
- Use ordinary React and CSS; add no animation or gesture dependency.
- Support touch, mouse, keyboard focus, and reduced motion.

---

### Task 1: Fixed deck domain and draw session

**Files:**
- Modify: `app/lib/tarot.ts`
- Modify: `app/lib/server.ts`
- Modify: `app/lib/tarot.test.ts`
- Modify: `app/db/schema.ts`
- Modify: `app/db/queries.ts`
- Modify: `app/app/api/draw/route.ts`
- Create: generated `app/drizzle/0002_*.sql` and metadata

**Interfaces:**
- Produces `DeckCard`, `createDeck()`, `selectCardsFromDeck()`, `createDrawSession()`, and `getDrawSession()`.
- `POST /api/draw` accepts `prepare`, `select`, and `physical` actions.

- [ ] Add failing tests proving a deck has 78 unique cards and selection preserves the clicked order.
- [ ] Run `npm test -- lib/tarot.test.ts` and confirm the new assertions fail because the deck APIs do not exist.
- [ ] Implement the minimal deck helpers and run the focused test until it passes.
- [ ] Add `draw_sessions` to the Drizzle schema and query layer, then generate and inspect the migration.
- [ ] Refactor the draw route so preparation stores the deck and selection creates an idempotent AI draft using the session ID.
- [ ] Run `npm test -- lib/tarot.test.ts` and confirm it passes.

### Task 2: Fan geometry and ritual UI

**Files:**
- Create: `app/lib/fan.ts`
- Create: `app/lib/fan.test.ts`
- Modify: `app/app/page.tsx`
- Modify: `app/app/globals.css`

**Interfaces:**
- Produces `clampFanCenter()`, `visibleFanIndexes()`, and `fanCardTransform()`.
- Adds `breathe`, `shuffle`, and `fan` view states before the existing `online` reveal view.

- [ ] Add failing tests for the fan's initial window, ending window, clamping, and symmetric transforms.
- [ ] Run `npm test -- lib/fan.test.ts` and confirm failure because the helper module is absent.
- [ ] Implement the minimal geometry helpers and run the focused tests until they pass.
- [ ] Add the breathing and shuffling screens with reduced-motion-safe CSS.
- [ ] Add the draggable fan component with pointer capture, click suppression after drag, keyboard browsing, selection progress, and retry handling.
- [ ] Connect online and physical draft creation to the revised draw API and retain the returned server draft ID.
- [ ] Run all unit tests and the production build.

### Task 3: Verify and publish

**Files:**
- Inspect all changed source and generated migration files.

**Interfaces:**
- Produces one tested source revision and one production Sites deployment.

- [ ] Run `npm test`, `npm run lint`, and the Sites production build helper; fix all failures.
- [ ] Check the final diff for unrelated changes, secrets, placeholders, migration safety, and accessibility regressions.
- [ ] Commit the exact source, push it through the existing Sites source repository, package it, save a version, and deploy while preserving public access.
- [ ] Confirm the deployment reaches `succeeded` and return its production URL.

