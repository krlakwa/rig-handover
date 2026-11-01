import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('digest page', () => {
  it('renders a night', async () => {
    const res = await createApp(config).request('/digest/2026-10-28');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('lane/sync');
  });

  it('404s for a missing or malformed night', async () => {
    const app = createApp(config);
    expect((await app.request('/digest/2020-01-01')).status).toBe(404);
    expect((await app.request('/digest/..%2Fx')).status).toBe(404);
  });
});
