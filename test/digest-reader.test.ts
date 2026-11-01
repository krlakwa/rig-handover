import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

describe('readNight on runs/2026-10-28', () => {
  const night = readNight('runs', '2026-10-28');

  it('has 5 jobs sorted by job and 1 bad line', () => {
    expect(night).not.toBeNull();
    expect(night?.badLines).toBe(1);
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('counts retries and keeps times from the log', () => {
    const row = night?.rows.find((r) => r.job === 'fixtures/refresh');
    expect(row).toMatchObject({
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: null,
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('keeps the last error of a failed job', () => {
    const row = night?.rows.find((r) => r.job === 'notes/backup');
    expect(row?.lastStatus).toBe('fail');
    expect(row?.lastError).toBe('quota exceeded');
  });

  it('keeps a row whose owner is null', () => {
    const row = night?.rows.find((r) => r.job === 'digest/render');
    expect(row).toBeDefined();
    expect(row?.owner).toBeNull();
  });
});

describe('readNight edge cases', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns null for a missing file', () => {
    expect(readNight(dir, '2026-01-01')).toBeNull();
  });

  it('returns an empty night for an empty file', () => {
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');
    expect(readNight(dir, '2026-01-01')).toEqual({ night: '2026-01-01', rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } });
  });

  it('counts bad lines, ignores blank lines, never throws', () => {
    const lines = [
      '{"at":"2026-01-01T01:00:00+01:00","job":"a","status":"ok","owner":"rook"}',
      'not json',
      '{"at":"2026-01-01T02:00:00+01:00","job":"a","status":"maybe","owner":"rook"}',
      '{"at":"2026-01-01T02:00:00+01:00","job":"a","status":"ok","owner":7}',
      '{"job":"a","status":"ok","owner":null}',
      '[]',
      '',
      '{"at":"2026-01-01T03:00:00+01:00","job":"a","status":"retry","owner":null,"error":"boom"}',
      '',
    ];
    writeFileSync(join(dir, '2026-01-01.jsonl'), lines.join('\n'));
    const night = readNight(dir, '2026-01-01');
    expect(night?.badLines).toBe(5);
    expect(night?.rows).toEqual([
      {
        job: 'a',
        owner: null,
        runs: 2,
        retries: 1,
        lastStatus: 'retry',
        lastError: 'boom',
        firstAt: '2026-01-01T01:00:00+01:00',
        lastAt: '2026-01-01T03:00:00+01:00',
      },
    ]);
  });
});
