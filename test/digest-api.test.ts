import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

describe('GET /api/digest/:night', () => {
  const app = createApp({ ...loadConfig(), runsDir: 'runs' });

  it('returns the reader rows in order', async () => {
    const res = await app.request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows.map((r: { job: string }) => r.job)).toEqual([
      'digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs',
    ]);
    expect(body.badLines).toBe(1);
  });

  it('404s on a missing night and a bad date', async () => {
    const res = await app.request('/api/digest/2020-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night', night: '2020-01-01' });
    expect((await app.request('/api/digest/nope')).status).toBe(404);
  });
});
