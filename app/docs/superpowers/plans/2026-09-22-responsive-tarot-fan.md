# Responsive Tarot Fan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current flat horizontal tarot picker into a responsive curved fan while preserving all other behavior and deployment settings.

**Architecture:** Keep layout and drag math in `lib/fan.ts`, consume it from the existing `TarotFan` component, and express the geometry through the existing CSS custom properties. No new dependency or component split is required.

**Tech Stack:** React 19, TypeScript 5.9, CSS transforms, Pointer Events, Vitest 5, Vite 8.

## Global Constraints

- Modify only fan geometry, drag sensitivity, fan transforms, and their tests.
- Preserve existing elastic release/snap behavior, selection behavior, keyboard controls, copy, data flow, APIs, and Tencent CloudBase hosting configuration.
- Add no dependencies.
- Do not include or overwrite unrelated uncommitted database/backend work.

---

### Task 1: Curved fan geometry and sensitive drag mapping

**Files:**
- Modify: `lib/fan.test.ts`
- Modify: `lib/fan.ts`

**Interfaces:**
- Consumes: `(slot, centerSlot, viewportWidth)` and `(startCenter, deltaX)` numeric inputs.
- Produces: `fanCardTransform(...): { x, y, rotation }` and `fanCenterFromDrag(startCenter, deltaX, pixelsPerCard?): number`.

- [ ] **Step 1: Write failing geometry and drag tests**

Add assertions that the center transform is zero, symmetric outer cards have equal positive `y`, opposite `x`/rotation, and a 48px drag maps to three cards at the 16px default sensitivity.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- lib/fan.test.ts`

Expected: FAIL because the current transform has `y: 0`, `rotation: 0`, and `fanCenterFromDrag` does not exist.

- [ ] **Step 3: Implement minimal fan math**

Use a viewport-bounded horizontal step, quadratic downward arc, symmetric rotation, and `startCenter - deltaX / 16` for drag mapping.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- lib/fan.test.ts`

Expected: all fan tests PASS.

### Task 2: Apply geometry to the existing interaction

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Test: `lib/fan.test.ts`

**Interfaces:**
- Consumes: `fanCenterFromDrag()` and the existing `--fan-x`, `--fan-y`, `--fan-rotation` custom properties.
- Produces: a curved, immediately responsive draggable fan with unchanged selection and release behavior.

- [ ] **Step 1: Replace the drag dead zone and slow divisor**

Call `fanCenterFromDrag(dragRef.current.startCenter, delta)` on every active move. Keep the 30px click-suppression threshold and existing elastic `moveCenter(..., true)` behavior.

- [ ] **Step 2: Apply all transform values in CSS**

Use `translate3d(var(--fan-x), var(--fan-y), 0) rotate(var(--fan-rotation))`; for chosen cards subtract the existing lift from `var(--fan-y)`. Keep transitions disabled while dragging and shorten settling to a responsive spring-like duration.

- [ ] **Step 3: Run focused and full verification**

Run: `npm test -- lib/fan.test.ts`

Run: `npm test`

Run: `npx tsc --noEmit`

Run: `npm run build:supabase`

Expected: all commands exit 0.

### Task 3: Publish unchanged Tencent hosting target

**Files:**
- Read: `cloudbaserc.json`
- Read: `README-CLOUDBASE.md`

**Interfaces:**
- Consumes: verified `dist/` output and CloudBase environment `gongjian-tarot-d2geleaahb9b8605e`.
- Produces: updated static assets at the existing public URL.

- [ ] **Step 1: Review the diff**

Confirm the source diff contains only the fan files and the two design/plan documents, with unrelated dirty files left untouched.

- [ ] **Step 2: Deploy the verified build**

Run: `tcb hosting deploy ./dist / -e gongjian-tarot-d2geleaahb9b8605e`

Expected: CloudBase reports successful static hosting deployment.

- [ ] **Step 3: Verify the production URL**

Open `https://gongjian-tarot-d2geleaahb9b8605e-1484522062.tcloudbaseapp.com` and confirm the page loads from the existing Tencent Cloud static URL.

