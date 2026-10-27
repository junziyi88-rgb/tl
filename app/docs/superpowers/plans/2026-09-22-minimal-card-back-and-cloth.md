# Minimal Card Back and Cloth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the confirmed flat indigo-and-gold card back and a faint light-gray draw-table cloth without changing fan interaction or stacking.

**Architecture:** Two static SVG assets contain all new visuals. Existing card-back references switch to the lightweight SVG with the JPEG retained as an error fallback; the cloth is one non-interactive background layer under the fan cards.

**Tech Stack:** SVG, React 19, CSS, Vitest, Vite 8.

## Global Constraints

- Keep fan geometry, left-to-right stacking, drag sensitivity, inertia, rebound, selection logic, copy, and every non-draw page unchanged.
- Use no gradients, textures, filters, shadows, or animation inside the new assets.
- Keep the cloth static, light gray, low-opacity, and behind every card.

---

### Task 1: Add regression expectations

**Files:**
- Modify: `app/lib/ui-copy.test.ts`

**Interfaces:**
- Consumes: `app/app/page.tsx` and `app/app/globals.css` as source text.
- Produces: regression assertions for the new card-back and cloth asset paths while preserving `20 + slot` stack order.

- [ ] Add a test that expects `/card-back-simple.svg`, `/tarot-cloth.svg`, the JPEG fallback, and `20 + slot`.
- [ ] Run `npm test -- lib/ui-copy.test.ts` and confirm it fails because the new asset paths do not exist in source.

### Task 2: Create lightweight assets and switch references

**Files:**
- Create: `app/public/card-back-simple.svg`
- Create: `app/public/tarot-cloth.svg`
- Modify: `app/app/page.tsx`
- Modify: `app/app/globals.css`

**Interfaces:**
- Consumes: the current stable fan renderer and existing JPEG fallback.
- Produces: one shared minimal card back and one static cloth layer.

- [ ] Create the 300×520 indigo card back with double border, four geometric corners, centered hexagram, and four dots.
- [ ] Create the wide transparent cloth line art with only sparse light-gray paths and points.
- [ ] Point fan preload/image, hidden cards, and shuffle cards to `/card-back-simple.svg`; retain `/card-back.jpg` only in error handling.
- [ ] Add `/tarot-cloth.svg` as `.fan-stage::before`, beneath the existing cards with pointer events disabled.
- [ ] Run the focused test, TypeScript, full tests, and `npm run build:supabase`.
- [ ] Commit only these assets, source references, tests, and documentation, then deploy `dist` to `gongjian-tarot-d2geleaahb9b8605e`.
