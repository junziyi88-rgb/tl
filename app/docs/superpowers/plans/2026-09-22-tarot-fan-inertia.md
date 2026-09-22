# Tarot Fan Inertia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add responsive whole-stage dragging, velocity-based inertia, and desktop wheel support to the existing tarot fan.

**Architecture:** Put all gesture math in pure helpers in `lib/fan.ts`, then keep `TarotFan` as a thin Pointer Events and wheel adapter. Reuse the current React state, elastic bounds, CSS transforms, and release transition.

**Tech Stack:** React 19, TypeScript 5.9, Pointer Events, CSS transforms, Vitest 5, Vite 8.

## Global Constraints

- Use 14px per card, an 8px drag threshold, a 100ms velocity window, and a 0.25px/ms inertia threshold.
- Fast flicks travel 4–12 additional cards and never exceed deck boundaries.
- Preserve selection, keyboard controls, elastic bounds, fan geometry, APIs, data, AI, and Tencent hosting settings.
- Add no dependency and do not include unrelated dirty files in commits.

---

### Task 1: Gesture physics helpers

**Files:**
- Modify: `lib/fan.test.ts`
- Modify: `lib/fan.ts`

**Interfaces:**
- Produces `FAN_DRAG_THRESHOLD_PX = 8`, `FAN_PIXELS_PER_CARD = 14`, `recentFanVelocity(samples, windowMs?)`, `fanInertiaTarget(center, velocityPxPerMs, total)`, and `fanWheelDelta(deltaX, deltaY, shiftKey)`.
- Updates `fanCenterFromDrag()` to default to 14px per card.

- [ ] **Step 1: Write failing tests**

Test that 42px moves three cards, the threshold is 8px, the latest 100ms determines velocity, slow release only snaps, fast release moves 4–12 cards, targets clamp at deck edges, and wheel selection ignores ordinary vertical scrolling.

- [ ] **Step 2: Verify RED**

Run: `npm test -- lib/fan.test.ts`

Expected: FAIL because the new constants and helpers do not exist and drag still defaults to 16px per card.

- [ ] **Step 3: Implement the pure helpers**

Use `(latest.x - first.x) / elapsedMs` for velocity. For speeds at least 0.25px/ms, calculate `clamp(abs(velocity) * 180 / 14, 4, 12)` additional cards, apply the opposite sign to the fan center, clamp, and round.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- lib/fan.test.ts`

Expected: all fan tests PASS.

### Task 2: Whole-stage pointer and wheel interaction

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Test: `lib/fan.test.ts`

**Interfaces:**
- Consumes the Task 1 helpers.
- Produces whole-stage mouse/touch/pen dragging, click suppression after 8px, velocity-based release, horizontal touchpad scrolling, and Shift + wheel support.

- [ ] **Step 1: Move pointer capture to `.fan-stage`**

Change handlers to `PointerEvent<HTMLDivElement>`, bind them to the stage, store `{ pointerId, startX, startCenter, moved, samples }`, and clear stale click suppression on every new pointer down.

- [ ] **Step 2: Add release inertia**

On every move, keep only the latest 100ms of samples. On pointer up, calculate velocity, suppress the following click after 8px, project the target with `fanInertiaTarget`, and use the current settling transition. On pointer cancel, skip inertia and snap safely.

- [ ] **Step 3: Add desktop wheel handling**

Use horizontal `deltaX` or shifted `deltaY`, leave ordinary vertical wheel events untouched, apply native wheel deltas while transitions are disabled, and snap 90ms after the final wheel event.

- [ ] **Step 4: Verify source and behavior**

Run: `npm test -- lib/fan.test.ts`

Run: `npm test`

Run: `npx tsc --noEmit`

Run: `npm run build:supabase`

Expected: all commands exit 0.

### Task 3: Publish to the existing Tencent URL

**Files:**
- Read: `cloudbaserc.json`
- Read: `dist/index.html`

**Interfaces:**
- Consumes the verified production build.
- Produces updated static assets in CloudBase environment `gongjian-tarot-d2geleaahb9b8605e`.

- [ ] **Step 1: Review the scoped diff**

Confirm only `app/page.tsx`, `lib/fan.ts`, `lib/fan.test.ts`, optional fan CSS, and the two documentation files belong to this change.

- [ ] **Step 2: Deploy**

Run: `tcb hosting deploy ./dist / -e gongjian-tarot-d2geleaahb9b8605e`

Expected: all static files upload successfully and CloudBase reports deployment completed.

- [ ] **Step 3: Verify production assets**

Request the public URL with `Cache-Control: no-cache` and confirm the returned JavaScript contains the 8px threshold, 14px sensitivity, stage pointer handlers, inertia helper, and wheel handler.

