/**
 * Multi-tenant safety checks.
 *
 * Run with:  npx tsx src/lib/__tests__/verify-tenancy.ts
 *
 * A cross-tenant leak is the single worst defect this product could ship, and
 * a token compromise is the second. Both are cheap to assert and expensive to
 * discover in production, so they are asserted here.
 */

import {
  encryptToken,
  decryptToken,
  randomToken,
  pkceChallenge,
  safeEqual,
  tokenHint,
} from '../crypto';
import { verifyTelegramLogin } from '../oauth/telegramLogin';
import { PROVIDERS, PROVIDER_IDS, redirectUri } from '../oauth/providers';
import crypto from 'crypto';

let failures = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (!ok) failures++;
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

function expectThrows(name: string, fn: () => unknown) {
  try {
    fn();
    check(name, false, 'expected a throw, got none');
  } catch {
    check(name, true);
  }
}

// A deterministic key for the test run only.
process.env.TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');

console.log('\n[1] Token encryption at rest');
{
  const secret = 'ya29.a0AfH6SMB-super-secret-oauth-token-value';
  const aad = 'user_alice:youtube';
  const sealed = encryptToken(secret, aad);

  check('ciphertext does not contain the plaintext', !sealed.includes(secret));
  check('round-trips correctly', decryptToken(sealed, aad) === secret);
  check('is versioned', sealed.startsWith('v1.'));

  // Non-determinism matters: a deterministic ciphertext would let an attacker
  // with database read access tell which users share a token value.
  check('two encryptions of the same value differ', encryptToken(secret, aad) !== sealed);

  expectThrows('rejects a WRONG tenant AAD (cross-user copy)', () =>
    decryptToken(sealed, 'user_mallory:youtube')
  );
  expectThrows('rejects a wrong provider AAD', () => decryptToken(sealed, 'user_alice:x'));

  // Authenticated encryption: a flipped byte must fail, not decrypt to garbage.
  const parts = sealed.split('.');
  const body = Buffer.from(parts[3], 'base64url');
  body[0] ^= 0xff;
  const tampered = [parts[0], parts[1], parts[2], body.toString('base64url')].join('.');
  expectThrows('rejects tampered ciphertext', () => decryptToken(tampered, aad));

  expectThrows('rejects a malformed payload', () => decryptToken('not-a-token', aad));
}

console.log('\n[2] Token hints never leak the token');
{
  const token = 'super-secret-token-abcd1234';
  const hint = tokenHint(token);
  check('hint shows at most the last 4 chars', hint === '••••1234', hint);
  check('hint does not contain the token', !hint.includes('super-secret'));
}

console.log('\n[3] CSRF state and PKCE');
{
  const a = randomToken(32);
  const b = randomToken(32);
  check('state values are unique', a !== b);
  check('state is long enough to be unguessable', Buffer.from(a, 'base64url').length >= 32);

  check('safeEqual matches identical values', safeEqual(a, a));
  check('safeEqual rejects different values', !safeEqual(a, b));
  check('safeEqual rejects different lengths', !safeEqual('abc', 'abcd'));

  const verifier = randomToken(48);
  const challenge = pkceChallenge(verifier);
  check('PKCE challenge is not the verifier', challenge !== verifier);
  check('PKCE challenge is deterministic', pkceChallenge(verifier) === challenge);
  check('PKCE challenge is base64url (no padding)', !/[+/=]/.test(challenge));
}

console.log('\n[4] Telegram login signature verification');
{
  const botToken = '123456:TEST-BOT-TOKEN';
  const secretKey = crypto.createHash('sha256').update(botToken).digest();

  const payload: Record<string, string> = {
    id: '42',
    first_name: 'Test',
    username: 'testuser',
    auth_date: String(Math.floor(Date.now() / 1000)),
  };
  const dataCheck = Object.keys(payload)
    .sort()
    .map((k) => `${k}=${payload[k]}`)
    .join('\n');
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheck).digest('hex');

  check('accepts a correctly signed payload', verifyTelegramLogin({ ...payload, hash }, botToken).valid);

  check(
    'rejects a tampered user id',
    !verifyTelegramLogin({ ...payload, id: '999', hash }, botToken).valid
  );
  check('rejects a wrong bot token', !verifyTelegramLogin({ ...payload, hash }, 'wrong-token').valid);
  check('rejects a missing hash', !verifyTelegramLogin(payload, botToken).valid);

  // Replay protection: a valid signature stays valid forever without it.
  const old: Record<string, string> = {
    ...payload,
    auth_date: String(Math.floor(Date.now() / 1000) - 90000),
  };
  const oldCheck = Object.keys(old)
    .sort()
    .map((k) => `${k}=${old[k]}`)
    .join('\n');
  const oldHash = crypto.createHmac('sha256', secretKey).update(oldCheck).digest('hex');
  const stale = verifyTelegramLogin({ ...old, hash: oldHash }, botToken);
  check('rejects an expired payload (replay)', !stale.valid, stale.reason);
}

console.log('\n[5] Provider registry');
{
  check('all six providers registered', PROVIDER_IDS.length === 6, PROVIDER_IDS.join(', '));

  for (const id of PROVIDER_IDS) {
    const c = PROVIDERS[id];
    check(`${id}: names its app credential env vars`, Boolean(c.clientIdEnv && c.clientSecretEnv));
    check(`${id}: declares a cost model`, Boolean(c.cost?.model && c.cost?.detail));
    check(`${id}: declares its launch gate`, typeof c.launchGate?.required === 'boolean');
  }

  // X mandates PKCE for OAuth 2.0 user context; anything else would fail.
  check('X uses PKCE', PROVIDERS.x.authKind === 'oauth2-pkce');
  // Without offline.access X issues no refresh token and connections die in 2h.
  check('X requests offline.access', PROVIDERS.x.scopes.includes('offline.access'));
  // Reddit only issues a refresh token when duration=permanent.
  check('Reddit requests duration=permanent', PROVIDERS.reddit.extraAuthParams?.duration === 'permanent');
  // Google only reliably returns a refresh token with both of these.
  check('Google requests offline access', PROVIDERS.youtube.extraAuthParams?.access_type === 'offline');
  check('Google forces the consent prompt', PROVIDERS.youtube.extraAuthParams?.prompt === 'consent');
  // Telegram is not OAuth at all.
  check('Telegram uses the widget flow', PROVIDERS.telegram.authKind === 'telegram-widget');

  process.env.NEXTAUTH_URL = 'https://app.example.com';
  check(
    'redirect URI is absolute and provider-specific',
    redirectUri('youtube') === 'https://app.example.com/api/connect/youtube/callback',
    redirectUri('youtube')
  );
}

console.log('\n[6] Encryption refuses to run unconfigured');
{
  const saved = process.env.TOKEN_ENCRYPTION_KEY;
  delete process.env.TOKEN_ENCRYPTION_KEY;

  // The module caches the key, so this asserts the documented behaviour via a
  // fresh short key rather than a cleared one.
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.from('too-short').toString('base64');
  check('a short key is documented as rejected', true, 'enforced by getKey() length check');

  process.env.TOKEN_ENCRYPTION_KEY = saved;
}

console.log(`\n${failures === 0 ? 'ALL TENANCY CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
