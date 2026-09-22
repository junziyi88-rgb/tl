# Tarot Fan Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-pointer React rerenders and CSS target jumps with stable pooled card nodes and frame-based motion, while preloading the card back and increasing edge elasticity.

**Architecture:** Pure helpers in `lib/fan.ts` define the pooled deck window, nonlinear elastic bounds, and frame integration. `TarotFan` owns stable slot refs and one `requestAnimationFrame` loop that writes transforms directly; React only renders semantic state. The back artwork is a preloaded `<picture>` layer with WebP and JPEG sources.

**Tech Stack:** React 19, TypeScript 5.9, Vite 8, Vitest 5, CSS transforms, Pointer Events, `requestAnimationFrame`.

## Global Constraints

- Do not change deck order, selection rules, copy, page structure, data APIs, AI, persistence, or deployment configuration.
- Preserve 8px click/drag separation, 14px per card, mouse drag, horizontal trackpad, `Shift + wheel`, keyboard selection, and a maximum 12-card flick.
- Respect `prefers-reduced-motion` and cancel all animation/timer work on unmount.
- Deploy only after tests, TypeScript, production build, and interaction checks pass.

---

### Task 1: Pure fan motion and pooling helpers

**Files:**
- Modify: `app/lib/fan.ts`
- Test: `app/lib/fan.test.ts`

**Interfaces:**
- Produces: `elasticFanCenter(value, total)`, `fanPoolIndexes(total, center, poolSize)`, `stepFanMotion(state, target, elapsedMs, spring)`.
- Consumes: existing fan constants and geometry helpers.

- [ ] Add tests proving the pool always has stable slot count, edge overscroll is visibly larger but bounded, and frame integration approaches its target without an instantaneous jump.
- [ ] Run `npm test -- lib/fan.test.ts` and confirm the new imports/tests fail because the helpers do not exist.
- [ ] Implement the three pure helpers with nonlinear edge resistance and a damped spring step.
- [ ] Re-run `npm test -- lib/fan.test.ts` and confirm all fan tests pass.

### Task 2: Stable DOM renderer and real card-back image layer

**Files:**
- Modify: `app/app/page.tsx`
- Modify: `app/app/globals.css`
- Create: `app/public/card-back.webp`
- Test: `app/lib/ui-copy.test.ts`

**Interfaces:**
- Consumes: Task 1 pool, elasticity, geometry, and spring helpers.
- Produces: a fixed 25-slot fan whose button nodes persist across drag, inertia, and rebound.

- [ ] Add source-level regression assertions requiring a fixed slot pool, `requestAnimationFrame`, card-back preload, and `<picture>`/`<img>` rendering instead of a fan-card CSS background.
- [ ] Run the focused test and confirm it fails against the current renderer.
- [ ] Generate a screen-sized WebP from `public/card-back.jpg` while keeping the JPEG fallback.
- [ ] Replace continuous React center state with refs, stable button refs, and one animation-frame renderer that updates transforms, slot deck indices, layer order, labels, selected classes, and badges.
- [ ] Drive release inertia and edge rebound through frame integration; update React only after final snapping.
- [ ] Preload/decode the artwork before enabling the visible fan, use `<picture><source type="image/webp"><img ...></picture>`, and retain the dark fallback.
- [ ] Disable expensive moving shadows while dragging/animating and restore them when settled.
- [ ] Re-run the focused tests and TypeScript check.

### Task 3: Verification and deployment

**Files:**
- Verify: `app/app/page.tsx`, `app/app/globals.css`, `app/lib/fan.ts`, `app/public/card-back.webp`

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces: verified production bundle on the existing Tencent CloudBase static URL.

- [ ] Run `npm test`, `npx tsc --noEmit`, and `npm run build:supabase`.
- [ ] Start a local preview and verify mouse drag, click suppression, edge pull/rebound, card-back visibility, and wheel behavior.
- [ ] Deploy `dist` with `tcb hosting deploy ./dist / -e gongjian-tarot-d2geleaahb9b8605e`.
- [ ] Fetch the production HTML/assets and verify the deployed hashes and card-back responses.
- [ ] Commit only the scoped source, tests, asset, and documentation changes.
