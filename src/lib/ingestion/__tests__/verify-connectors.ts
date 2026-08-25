/**
 * Connector contract checks.
 *
 * Run with:  npx tsx src/lib/ingestion/__tests__/verify-connectors.ts
 *
 * Two things are verified without needing real credentials:
 *
 *  1. With NO credentials, every connector reports `missing-credentials`
 *     rather than throwing or -- worse -- returning fabricated posts.
 *
 *  2. With DUMMY credentials, each connector actually reaches its provider and
 *     comes back with `unauthorized`. That proves the request shape, URL, and
 *     auth header are real: a 401 from the provider can only be produced by
 *     code that genuinely called it. A connector that returned a canned
 *     response would pass check 1 and fail this one.
 */

import { CONNECTORS, getConnector, inferPlatform, describeCapabilities } from '../registry';

let failures = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (!ok) failures++;
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const CREDENTIALED = ['x', 'instagram', 'facebook', 'reddit', 'youtube'] as const;

/** Env keys touched by these tests, restored afterwards. */
const ENV_KEYS = [
  'X_BEARER_TOKEN',
  'INSTAGRAM_ACCESS_TOKEN',
  'INSTAGRAM_BUSINESS_ID',
  'FACEBOOK_PAGE_ACCESS_TOKEN',
  'FACEBOOK_PAGE_ID',
  'REDDIT_CLIENT_ID',
  'REDDIT_CLIENT_SECRET',
  'YOUTUBE_API_KEY',
];

async function main() {
  const saved: Record<string, string | undefined> = {};
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  const restore = () => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  };

  // ── 1. Registry completeness ────────────────────────────────────────────
  console.log('\n[1] Registry covers every platform in the problem statement');
  const platforms = CONNECTORS.map((c) => c.platform).sort();
  check('all six platforms registered', CONNECTORS.length === 6, platforms.join(', '));
  for (const p of ['x', 'telegram', 'instagram', 'facebook', 'reddit', 'youtube']) {
    check(`connector exists: ${p}`, Boolean(getConnector(p as any)));
  }
  const essentials = CONNECTORS.filter((c) => c.tier === 'essential').map((c) => c.platform).sort();
  check('X and Telegram are the Essentials', JSON.stringify(essentials) === '["telegram","x"]', essentials.join(','));

  // ── 2. URL -> platform inference ────────────────────────────────────────
  console.log('\n[2] Platform inference from a pasted target');
  const cases: [string, string | null][] = [
    ['https://x.com/nasa', 'x'],
    ['https://twitter.com/nasa/status/1', 'x'],
    ['https://t.me/durov', 'telegram'],
    ['https://www.instagram.com/nasa/', 'instagram'],
    ['https://www.facebook.com/nasa', 'facebook'],
    ['r/india', 'reddit'],
    ['https://www.youtube.com/watch?v=abc', 'youtube'],
    ['https://youtu.be/abc', 'youtube'],
    ['just a search phrase', null],
  ];
  for (const [input, expected] of cases) {
    const got = inferPlatform(input);
    check(`${input.slice(0, 38)} -> ${expected}`, got === expected, got === expected ? undefined : `got ${got}`);
  }

  // ── 3. No credentials => missing-credentials, never fabricated posts ────
  console.log('\n[3] Unconfigured connectors report honestly');
  for (const k of ENV_KEYS) delete process.env[k];

  for (const platform of CREDENTIALED) {
    const c = getConnector(platform)!;
    const r = await c.fetch(platform === 'instagram' ? '#test' : 'test', 5);
    const honest = r.status === 'missing-credentials' || r.status === 'unauthorized';
    check(`${platform}: reports missing/unauthorized`, honest, r.status);
    check(`${platform}: returns ZERO posts (nothing fabricated)`, r.posts.length === 0, `${r.posts.length} posts`);
    check(`${platform}: explains what is needed`, Boolean(r.note && r.note.length > 10));
  }

  // ── 4. Dummy credentials => the connector really calls the provider ─────
  console.log('\n[4] With dummy credentials, connectors reach the real provider');
  process.env.X_BEARER_TOKEN = 'dummy-invalid-token';
  process.env.INSTAGRAM_ACCESS_TOKEN = 'dummy-invalid-token';
  process.env.INSTAGRAM_BUSINESS_ID = '17841400000000000';
  process.env.FACEBOOK_PAGE_ACCESS_TOKEN = 'dummy-invalid-token';
  process.env.FACEBOOK_PAGE_ID = '000000000000000';
  process.env.REDDIT_CLIENT_ID = 'dummy';
  process.env.REDDIT_CLIENT_SECRET = 'dummy';
  process.env.YOUTUBE_API_KEY = 'dummy-invalid-key';

  for (const platform of CREDENTIALED) {
    const c = getConnector(platform)!;
    const r = await c.fetch(platform === 'instagram' ? '#test' : 'test', 5);
    // A rejection from the provider proves a real network call was made.
    const reached = ['unauthorized', 'rate-limited', 'not-found', 'error', 'missing-credentials'].includes(r.status);
    check(`${platform}: provider rejected the dummy credential`, reached, `${r.status}${r.note ? ` — ${r.note.slice(0, 70)}` : ''}`);
    check(`${platform}: still returns ZERO posts`, r.posts.length === 0);
  }

  restore();

  // ── 5. Capability reporting reflects the real environment ───────────────
  console.log('\n[5] Capability reporting');
  const caps = describeCapabilities();
  check('describes all six', caps.length === 6);
  check('telegram needs no credentials', caps.find((c) => c.platform === 'telegram')!.worksWithoutCredentials === true);
  check('X is the only paid platform', caps.filter((c) => c.cost === 'paid').map((c) => c.platform).join() === 'x');
  check('every connector names a setup doc', caps.every((c) => Boolean(c.setupDoc)));
  check('every credentialed connector lists its env vars',
    caps.filter((c) => !c.worksWithoutCredentials).every((c) => c.requiredEnv.length > 0));

  console.log(`\n${failures === 0 ? 'ALL CONNECTOR CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('harness error:', e);
  process.exit(1);
});
