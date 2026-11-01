// Plan morning-digest § 3. Saves one rig page as one self-contained HTML file (ADR 0001), for a
// public preview (ADR 0003). The banner shows LANE_MARKER from the environment, or "no marker set".
// Usage: tsx scripts/preview.tsx [path] [out]   defaults: /digest/2026-10-28 var/preview/index.html
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createApp } from '../src/app.js';

async function main() {
  const [path = '/digest/2026-10-28', out = 'var/preview/index.html'] = process.argv.slice(2);
  const res = await createApp().request(path);
  if (res.status !== 200) throw new Error(`${path} answered ${res.status}`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, await res.text());
  console.log(`saved ${path} -> ${out}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
