import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const backupUrl = new URL('../scripts/backup-supabase.ps1', import.meta.url);
const restoreUrl = new URL('../scripts/restore-supabase.ps1', import.meta.url);
const toolsUrl = new URL('../scripts/Test-PostgresTools.ps1', import.meta.url);
const scheduleUrl = new URL(
  '../scripts/Register-WeeklyBackupTask.ps1',
  import.meta.url,
);

describe('Supabase backup and restore tooling', () => {
  it('creates timestamped schema and data dumps without embedding credentials', () => {
    expect(existsSync(backupUrl)).toBe(true);
    if (!existsSync(backupUrl)) return;

    const source = readFileSync(backupUrl, 'utf8');
    expect(source).toContain('SUPABASE_DB_URL');
    expect(source).toContain('.env.supabase.local');
    expect(source).toContain('yyyyMMdd-HHmmssZ');
    expect(source).toContain('schema.sql');
    expect(source).toContain('data.sql');
    expect(source).toContain('SHA256SUMS.txt');
    expect(source).toContain('--schema-only');
    expect(source).toContain('--data-only');
    expect(source).toContain('--schema=public');
    expect(source).toContain('Get-FileHash');
    expect(source).not.toMatch(/postgres(?:ql)?:\/\/[^'"\s]*:[^'"\s]*@/i);
  });

  it('requires explicit confirmation and restores schema before data', () => {
    expect(existsSync(restoreUrl)).toBe(true);
    expect(existsSync(toolsUrl)).toBe(true);
    if (!existsSync(restoreUrl) || !existsSync(toolsUrl)) return;

    const source = readFileSync(restoreUrl, 'utf8');
    expect(source).toMatch(/\[switch\]\$ConfirmRestore/);
    expect(source).toContain('schema.sql');
    expect(source).toContain('data.sql');
    expect(source.indexOf('schema.sql')).toBeLessThan(source.indexOf('data.sql'));
    expect(source).toContain('ON_ERROR_STOP=1');

    const tools = readFileSync(toolsUrl, 'utf8');
    expect(tools).toContain("Get-Command -Name 'pg_dump'");
    expect(tools).toContain("Get-Command -Name 'psql'");
  });

  it('registers a weekly local backup without putting the database URL in task arguments', () => {
    expect(existsSync(scheduleUrl)).toBe(true);
    if (!existsSync(scheduleUrl)) return;

    const source = readFileSync(scheduleUrl, 'utf8');
    expect(source).toContain('New-ScheduledTaskTrigger');
    expect(source).toContain('-Weekly');
    expect(source).toContain('Sunday');
    expect(source).toContain('03:00');
    expect(source).toContain('backup-supabase.ps1');
    expect(source).not.toContain('SUPABASE_DB_URL=');
  });
});
