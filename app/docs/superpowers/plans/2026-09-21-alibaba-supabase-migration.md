# Alibaba Cloud Supabase Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the tarot application's database from Neon Ohio to Alibaba Cloud's Hangzhou Supabase free project, move its AI proxy to uniCloud Alibaba free functions, and add repeatable database migration, backup, and restore tooling.

**Architecture:** The browser uses Alibaba Supabase PostgREST for PostgreSQL RPCs and a separately configured uniCloud Alibaba URLized function for DeepSeek interpretation. This split is required because Alibaba Supabase Edge Functions need a paid EIP or NAT gateway for public internet egress. The existing token-hash authorization SQL is preserved. PowerShell scripts wrap `pg_dump` and `psql` so schema and data backups are timestamped, checksummed, and restorable without committing credentials.

**Tech Stack:** Vite, TypeScript, PostgreSQL, Supabase-compatible PostgREST, uniCloud Alibaba cloud functions (Node.js), PowerShell, Vitest.

## Global Constraints

- Do not use any ChatGPT domain.
- The production browser must not call Neon or another overseas backend.
- Keep the Tencent Cloud static frontend.
- Store `DEEPSEEK_API_KEY` only as a server-side uniCloud environment variable.
- Do not purchase or bind an EIP or public NAT gateway.
- Keep database credentials out of Git.
- Preserve existing user work in the dirty worktree.

---

### Task 1: Supabase Browser Client

**Files:**
- Modify: `lib/cloudbase-api.ts`
- Modify: `lib/cloudbase-api.test.ts`
- Modify: `lib/cloudbase-enhanced.test.ts`

**Interfaces:**
- Consumes: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at build time.
- Produces: PostgREST RPC calls and direct browser `generateInterpretation()` calls to DeepSeek using the intentionally public `VITE_DEEPSEEK_API_KEY`.

- [ ] Write failing tests asserting there is no Neon URL and that PostgREST and Edge Function endpoints are derived from Supabase configuration.
- [ ] Run the focused Vitest files and confirm the expected failures.
- [ ] Implement the smallest Supabase REST client that preserves existing exported application functions.
- [ ] Run the focused tests and confirm they pass.

### Task 2: PostgreSQL Migration

**Files:**
- Create: `supabase/migrations/20260921000000_tarot.sql`
- Test: `lib/supabase-migration.test.ts`

**Interfaces:**
- Consumes: the existing Neon PostgreSQL schema and token-hash authorization behavior.
- Produces: idempotent tables, views, RPC functions, indexes, grants, and RLS posture compatible with Supabase PostgREST.

- [ ] Write a failing migration contract test for required tables, RPC signatures, grants, and secret-column exclusions.
- [ ] Run it and confirm failure because the migration is absent.
- [ ] Add the idempotent migration.
- [ ] Run the contract test and confirm it passes.

### Task 3: DeepSeek AI Proxy

**Files:**
- Create: `uniCloud-aliyun/cloudfunctions/tarot-ai/index.js`
- Create: `uniCloud-aliyun/cloudfunctions/tarot-ai/meanings.js`
- Test: `lib/unicloud-function.test.ts`

**Interfaces:**
- Consumes: JSON `{ question, spread, cards, draftId }` and secret `DEEPSEEK_API_KEY`.
- Produces: JSON `{ interpretation }` with restricted CORS and the existing validation/output contract.

- [ ] Write failing source-contract tests for CORS, DeepSeek server-side invocation, secret usage, and input validation.
- [ ] Run them and confirm expected failure.
- [ ] Port the existing deterministic validation and prompt logic to a uniCloud Alibaba Node.js function.
- [ ] Run tests and confirm they pass.

### Task 4: Backup and Restore Tooling

**Files:**
- Create: `scripts/backup-supabase.ps1`
- Create: `scripts/restore-supabase.ps1`
- Create: `scripts/Test-PostgresTools.ps1`
- Modify: `.gitignore`
- Modify: `package.json`
- Test: `lib/supabase-backup.test.ts`

**Interfaces:**
- Consumes: `SUPABASE_DB_URL` from the process environment or `.env.supabase.local`.
- Produces: `backups/supabase/<UTC timestamp>/schema.sql`, `data.sql`, and `SHA256SUMS.txt`.

- [ ] Write failing tests for credential handling, timestamped output, schema/data split, checksum generation, and restore ordering.
- [ ] Run them and confirm expected failure.
- [ ] Implement backup and restore scripts plus npm entry points.
- [ ] Run contract tests and PowerShell parser validation.

### Task 5: Deployment Documentation and Verification

**Files:**
- Create: `.env.supabase.example`
- Modify: `README-CLOUDBASE.md`

**Interfaces:**
- Consumes: Alibaba Supabase project URL, anon key, database URL, and DeepSeek secret.
- Produces: reproducible database migration, uniCloud function deployment, Tencent frontend build, backup, and restore commands.

- [ ] Document Alibaba free-project creation and exact secret/configuration names.
- [ ] Create the free Hangzhou project, apply migration, create a uniCloud Alibaba free space, deploy the URLized function, and configure `DEEPSEEK_API_KEY`.
- [ ] Build and deploy the Tencent frontend with Alibaba Supabase values.
- [ ] Verify database CRUD, AI interpretation, mainland-facing URLs, focused tests, type checking, and production build.
- [ ] Run the first backup and verify both dump files with checksums.
