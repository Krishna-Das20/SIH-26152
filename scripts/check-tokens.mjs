/**
 * Verifies that configured platform credentials actually WORK.
 *
 * `/api/platforms` reports whether an env var is *present*, which is cheap and
 * needs no network. It cannot tell you whether the credential is still *valid*.
 * Those are different things, and the gap is dangerous: on 2026-08-26 an agent
 * pasted short-lived Meta tokens into .env and marked both platforms live in
 * PROGRESS.md. The tokens expired within hours; every status surface still said
 * green, because the variables were still set.
 *
 * This script closes that gap by making one real call per platform.
 *
 *   node scripts/check-tokens.mjs
 *
 * Exit code 0 when every configured credential works, 1 otherwise — so it can
 * gate a demo rehearsal or run in CI.
 */

import fs from 'fs';
import path from 'path';

const ENV_PATH = path.join(process.cwd(), '.env');

function loadEnv() {
  const env = {};
  if (!fs.existsSync(ENV_PATH)) return env;
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

const env = { ...loadEnv(), ...process.env };
const results = [];

function record(platform, state, detail) {
  results.push({ platform, state, detail });
}

/** Meta returns HTTP 400 for auth failures, so the error object is the signal. */
async function meta(pathname, token) {
  const url = `https://graph.facebook.com/v21.0${pathname}${
    pathname.includes('?') ? '&' : '?'
  }access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok && !json.error, json };
}

async function checkInstagram() {
  const token = env.INSTAGRAM_ACCESS_TOKEN;
  const id = env.INSTAGRAM_BUSINESS_ID;
  if (!token || !id) return record('Instagram', 'not-configured', 'no credentials set');

  const { ok, json } = await meta(`/${id}?fields=username,media_count`, token);
  if (ok) {
    const life = await metaExpiry(token);
    return record(
      'Instagram',
      'working',
      `@${json.username}, ${json.media_count} media${life ? ` — ${life}` : ''}`
    );
  }

  const e = json.error || {};
  const expired = e.code === 190;
  record(
    'Instagram',
    expired ? 'EXPIRED' : 'broken',
    `${e.message || 'unknown error'}`.slice(0, 120)
  );
}

/**
 * Reports when a Meta token dies. `expires_at: 0` means no scheduled expiry —
 * which is what a Page token derived from a LONG-LIVED user token gets, and is
 * the only durable option for a demo weeks away.
 */
async function metaExpiry(token) {
  const appId = env.FACEBOOK_APP_ID || env.INSTAGRAM_APP_ID;
  const appSecret = env.FACEBOOK_APP_SECRET || env.INSTAGRAM_APP_SECRET;
  if (!appId || !appSecret) return null; // debug_token needs an app token

  try {
    const url =
      `https://graph.facebook.com/v21.0/debug_token?input_token=${encodeURIComponent(token)}` +
      `&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`;
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    const d = json?.data;
    if (!d) return null;
    if (d.expires_at === 0) return 'PERMANENT (no scheduled expiry)';
    if (d.expires_at) {
      const when = new Date(d.expires_at * 1000);
      const days = Math.round((when - Date.now()) / 86400000);
      return `expires ${when.toISOString().slice(0, 16)}Z (${days}d)`;
    }
    return null;
  } catch {
    return null;
  }
}

async function checkFacebook() {
  const token = env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const id = env.FACEBOOK_PAGE_ID;
  if (!token || !id) return record('Facebook', 'not-configured', 'no credentials set');

  const { ok, json } = await meta(`/${id}?fields=name,fan_count`, token);
  if (ok) {
    const life = await metaExpiry(token);
    return record(
      'Facebook',
      'working',
      `${json.name}, ${json.fan_count ?? '?'} followers${life ? ` — ${life}` : ''}`
    );
  }

  const e = json.error || {};
  record('Facebook', e.code === 190 ? 'EXPIRED' : 'broken', `${e.message || 'unknown'}`.slice(0, 120));
}

async function checkYouTube() {
  const key = env.YOUTUBE_API_KEY;
  if (!key) return record('YouTube', 'not-configured', 'no YOUTUBE_API_KEY');

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=dQw4w9WgXcQ&key=${key}`
  );
  const json = await res.json().catch(() => ({}));
  if (res.ok && !json.error) return record('YouTube', 'working', 'Data API v3 responding');

  const msg = json?.error?.message || `HTTP ${res.status}`;
  record('YouTube', /quota/i.test(msg) ? 'QUOTA' : 'broken', msg.slice(0, 120));
}

async function checkX() {
  const token = env.X_BEARER_TOKEN;
  if (!token) return record('X (Twitter)', 'not-configured', 'no X_BEARER_TOKEN');

  const res = await fetch('https://api.twitter.com/2/users/by/username/nasa', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok) return record('X (Twitter)', 'working', 'API v2 responding');
  record('X (Twitter)', res.status === 401 ? 'EXPIRED' : 'broken', `HTTP ${res.status}`);
}

async function checkReddit() {
  const id = env.REDDIT_CLIENT_ID;
  const secret = env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) return record('Reddit', 'not-configured', 'no client credentials');

  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': env.REDDIT_USER_AGENT || 'SIH26152/1.0',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  });
  if (res.ok) return record('Reddit', 'working', 'OAuth token minted');
  record('Reddit', res.status === 401 ? 'EXPIRED' : 'broken', `HTTP ${res.status}`);
}

async function checkTelegram() {
  // Needs no credentials at all — verify the public route still answers.
  const res = await fetch('https://t.me/s/durov', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  record(
    'Telegram',
    res.ok ? 'working' : 'broken',
    res.ok ? 'public preview reachable (no credentials needed)' : `HTTP ${res.status}`
  );
}

const ICON = {
  working: '  OK      ',
  EXPIRED: '  EXPIRED ',
  QUOTA: '  QUOTA   ',
  broken: '  BROKEN  ',
  'not-configured': '  --      ',
};

async function main() {
  console.log('\nChecking whether configured credentials actually work...\n');

  await Promise.all([
    checkTelegram(),
    checkYouTube(),
    checkInstagram(),
    checkFacebook(),
    checkX(),
    checkReddit(),
  ]);

  results.sort((a, b) => a.platform.localeCompare(b.platform));
  for (const r of results) {
    console.log(`${ICON[r.state] || '  ?       '}${r.platform.padEnd(14)} ${r.detail}`);
  }

  const working = results.filter((r) => r.state === 'working').length;
  const bad = results.filter((r) => ['EXPIRED', 'broken', 'QUOTA'].includes(r.state));

  console.log(`\n  ${working}/6 platforms actually working.\n`);

  if (bad.length > 0) {
    console.log('  Credentials are SET but not working for:');
    for (const r of bad) console.log(`    - ${r.platform} (${r.state})`);
    console.log(
      '\n  These will show as "live" in /api/platforms, which only checks that the\n' +
        '  variable is present. Fix or clear them before demoing.\n'
    );
    process.exit(1);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
