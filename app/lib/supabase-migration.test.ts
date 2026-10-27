import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../supabase/migrations/20260921000000_tarot.sql',
  import.meta.url,
);

describe('Alibaba Supabase migration contract', () => {
  it('creates the complete token-protected PostgreSQL backend', () => {
    expect(existsSync(migrationUrl)).toBe(true);
    if (!existsSync(migrationUrl)) return;

    const sql = readFileSync(migrationUrl, 'utf8');
    expect(sql).toMatch(/create extension if not exists pgcrypto/i);
    expect(sql).toMatch(/create table if not exists public\.readings/i);
    expect(sql).toMatch(/create table if not exists public\.custom_spreads/i);
    expect(sql).toMatch(/alter table public\.readings enable row level security/i);
    expect(sql).toMatch(/alter table public\.custom_spreads enable row level security/i);
    expect(sql).toMatch(/create or replace view public\.reading_feed/i);
    expect(sql).not.toMatch(/create\s+(or\s+replace\s+)?function/i);
    expect(sql).toMatch(/extensions\.digest\(/i);
    expect(sql).toMatch(/grant select on public\.reading_feed to anon, authenticated/i);
    expect(sql).not.toMatch(/security definer/i);
    expect(sql).toMatch(/current_setting\('request\.headers', true\)/i);
    expect(sql).toMatch(/x-owner-token/i);
    expect(sql).toMatch(/x-owner-id/i);
    expect(sql).toMatch(/create policy readings_owner_insert/i);
    expect(sql).toMatch(/create policy readings_owner_update/i);
    expect(sql).toMatch(/create policy readings_owner_delete/i);
    expect(sql).toMatch(/grant insert\s*\([\s\S]+idempotency_key[\s\S]+\)\s*on public\.readings/i);
    expect(sql).not.toMatch(/grant insert\s*\([^)]*owner_token_hash/i);
    expect(sql).not.toMatch(/grant select on public\.readings to anon/i);
    expect(sql).not.toMatch(/anonymous/);
  });

  it('never exposes owner tokens through the public feed', () => {
    expect(existsSync(migrationUrl)).toBe(true);
    if (!existsSync(migrationUrl)) return;

    const sql = readFileSync(migrationUrl, 'utf8');
    const view = sql.match(
      /create or replace view public\.reading_feed as([\s\S]+?)from public\.readings;/i,
    )?.[1];
    expect(view).toBeTruthy();
    expect(view).not.toMatch(/owner_token_hash|idempotency_key/i);
  });
});
