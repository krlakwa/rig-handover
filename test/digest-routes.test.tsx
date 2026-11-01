import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const GOOD = '2026-01-01';
const EMPTY = '2026-01-02';
const BAD = '2026-01-03';
const MISSING = '2026-01-04';

const l = (at: string, job: string, status: string, owner: string | null, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error === undefined ? {} : { error }) });

const goodLines = [
  l('2026-01-01T01:00:00+01:00', 'zeta-sync', 'ok', 'ann'),
  l('2026-01-01T01:05:00+01:00', 'alpha-backup', 'retry', null),
  l('2026-01-01T01:10:00+01:00', 'alpha-backup', 'fail', null, 'disk full'),
  l('2026-01-01T02:00:00+01:00', 'mid-report', 'ok', 'bob'),
];

let runsDir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  writeFileSync(join(runsDir, `${GOOD}.jsonl`), goodLines.join('\n') + '\n');
  writeFileSync(join(runsDir, `${EMPTY}.jsonl`), '');
  writeFileSync(
    join(runsDir, `${BAD}.jsonl`),
    [goodLines[0], 'this is not json', goodLines[3]].join('\n') + '\n',
  );
  app = createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

describe('digest page and JSON', () => {
  it('serves a night with data, same jobs in the same order in both', async () => {
    const page = await app.request(`/digest/${GOOD}`);
    const json = await app.request(`/api/digest/${GOOD}`);
    expect(page.status).toBe(200);
    expect(json.status).toBe(200);

    const html = await page.text();
    const body = (await json.json()) as { night: string; rows: { job: string }[]; badLines: number };
    const jobs = body.rows.map((r) => r.job);
    expect(body.night).toBe(GOOD);
    expect(jobs).toEqual(['alpha-backup', 'mid-report', 'zeta-sync']);

    const positions = jobs.map((job) => html.indexOf(job));
    for (const p of positions) expect(p).toBeGreaterThanOrEqual(0);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('keeps null owner and error as null in JSON', async () => {
    const body = (await (await app.request(`/api/digest/${GOOD}`)).json()) as {
      rows: { job: string; owner: string | null; lastError: string | null }[];
    };
    const alpha = body.rows.find((r) => r.job === 'alpha-backup');
    const zeta = body.rows.find((r) => r.job === 'zeta-sync');
    expect(alpha?.owner).toBeNull();
    expect(alpha?.lastError).toBe('disk full');
    expect(zeta?.lastError).toBeNull();
  });

  it('answers 404 for a night with no file, page and JSON', async () => {
    expect((await app.request(`/digest/${MISSING}`)).status).toBe(404);
    expect((await app.request(`/api/digest/${MISSING}`)).status).toBe(404);
  });

  it('renders the empty night as "nothing ran" with no rows in JSON', async () => {
    const page = await app.request(`/digest/${EMPTY}`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    const json = await app.request(`/api/digest/${EMPTY}`);
    expect(json.status).toBe(200);
    const body = (await json.json()) as { rows: unknown[] };
    expect(body.rows).toEqual([]);
  });

  it('counts a bad line and still serves the good rows', async () => {
    const page = await app.request(`/digest/${BAD}`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('mid-report');
    expect(html).toContain('zeta-sync');

    const json = await app.request(`/api/digest/${BAD}`);
    expect(json.status).toBe(200);
    const body = (await json.json()) as { rows: { job: string }[]; badLines: number };
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['mid-report', 'zeta-sync']);
  });
});
