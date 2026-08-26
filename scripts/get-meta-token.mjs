/**
 * One-shot helper that mints a PERMANENT Meta Page access token.
 *
 * Why this exists: the manual Graph API Explorer route has a silent failure
 * mode. A Page token inherits the lifetime of the user token it was derived
 * from — derive it from the raw Explorer token and it dies in 1-2 hours;
 * derive it from a LONG-LIVED user token and it carries `expires_at: 0`, no
 * scheduled expiry. Both look identical until one stops working. That is
 * exactly how the previous tokens expired mid-project.
 *
 * This script performs the sequence in the only correct order:
 *
 *   authorization code
 *     -> short-lived user token
 *     -> LONG-LIVED user token          <-- the step that is easy to skip
 *     -> Page access token (permanent)
 *     -> Instagram Business ID via that Page
 *
 * and then verifies the result with debug_token before printing anything, so
 * you never paste a token that was already dead.
 *
 * Usage:
 *   node scripts/get-meta-token.mjs
 *
 * Requires FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in .env.
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import crypto from 'crypto';

const PORT = 5599;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const GRAPH = 'https://graph.facebook.com/v21.0';

const SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  // Without this the Page token reads metadata but /{page}/posts returns
  // "(#10) requires the 'pages_read_user_content' permission" -- which is the
  // state the previous token was left in. Granting it here means one mint
  // fixes both platforms instead of needing a second pass for Facebook.
  'pages_read_user_content',
  'instagram_basic',
  'instagram_manage_insights',
].join(',');

// ── env ───────────────────────────────────────────────────────────────────
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
const APP_ID = env.FACEBOOK_APP_ID || env.INSTAGRAM_APP_ID;
const APP_SECRET = env.FACEBOOK_APP_SECRET || env.INSTAGRAM_APP_SECRET;

if (!APP_ID || !APP_SECRET) {
  console.error(`
  Missing app credentials.

  Add these to .env, from Meta dashboard -> App settings -> Basic:

    FACEBOOK_APP_ID=your_app_id
    FACEBOOK_APP_SECRET=your_app_secret
`);
  process.exit(1);
}

async function get(url) {
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (json.error) throw new Error(`${json.error.message} (code ${json.error.code})`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return json;
}

/** Confirms a token really has no scheduled expiry before we trust it. */
async function describeToken(token) {
  const appToken = `${APP_ID}|${APP_SECRET}`;
  const json = await get(
    `${GRAPH}/debug_token?input_token=${encodeURIComponent(token)}` +
      `&access_token=${encodeURIComponent(appToken)}`
  );
  const d = json.data || {};
  return {
    permanent: d.expires_at === 0,
    expiresAt: d.expires_at ? new Date(d.expires_at * 1000).toISOString() : null,
    scopes: d.scopes || [],
    type: d.type,
  };
}

async function exchange(code) {
  console.log('\n  [1/5] authorization code -> short-lived user token');
  const short = await get(
    `${GRAPH}/oauth/access_token?client_id=${APP_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&client_secret=${APP_SECRET}&code=${encodeURIComponent(code)}`
  );

  // THE critical step. Skipping it is what makes the Page token die in hours.
  console.log('  [2/5] short-lived -> LONG-LIVED user token');
  const long = await get(
    `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token` +
      `&client_id=${APP_ID}&client_secret=${APP_SECRET}` +
      `&fb_exchange_token=${encodeURIComponent(short.access_token)}`
  );

  const longInfo = await describeToken(long.access_token);
  console.log(
    `        user token: ${longInfo.expiresAt ? `expires ${longInfo.expiresAt.slice(0, 10)}` : 'no expiry'}`
  );

  console.log('  [3/5] deriving Page token from the LONG-LIVED token');
  const accounts = await get(
    `${GRAPH}/me/accounts?fields=id,name,access_token,fan_count` +
      `&access_token=${encodeURIComponent(long.access_token)}`
  );

  const pages = accounts.data || [];
  if (pages.length === 0) {
    throw new Error(
      'No Facebook Pages found on this account. Create a Page and make sure you are its admin.'
    );
  }

  const page = pages[0];
  if (pages.length > 1) {
    console.log(`        ${pages.length} Pages found; using "${page.name}"`);
  }

  console.log('  [4/5] verifying the Page token has no expiry');
  const pageInfo = await describeToken(page.access_token);

  console.log('  [5/5] resolving the linked Instagram Business account');
  let igId = null;
  let igHandle = null;
  try {
    const linked = await get(
      `${GRAPH}/${page.id}?fields=instagram_business_account` +
        `&access_token=${encodeURIComponent(page.access_token)}`
    );
    igId = linked.instagram_business_account?.id ?? null;
    if (igId) {
      const ig = await get(
        `${GRAPH}/${igId}?fields=username,media_count` +
          `&access_token=${encodeURIComponent(page.access_token)}`
      );
      igHandle = ig.username;
      console.log(`        linked: @${ig.username} (${ig.media_count} media)`);
    }
  } catch (e) {
    console.log(`        Instagram lookup failed: ${e.message}`);
  }

  return { page, pageInfo, igId, igHandle };
}

function report({ page, pageInfo, igId, igHandle }) {
  console.log('\n' + '='.repeat(68));
  if (pageInfo.permanent) {
    console.log('  PAGE TOKEN IS PERMANENT (expires_at: 0, no scheduled expiry)');
  } else {
    console.log(`  WARNING: token expires ${pageInfo.expiresAt}`);
    console.log('  The long-lived exchange did not take effect. Re-run this script.');
  }
  console.log('='.repeat(68));

  console.log(`\n  Page      : ${page.name} (${page.id})`);
  console.log(`  Followers : ${page.fan_count ?? 'n/a'}`);
  console.log(`  Instagram : ${igHandle ? `@${igHandle} (${igId})` : 'NOT LINKED'}`);
  console.log(`  Scopes    : ${pageInfo.scopes.join(', ')}`);

  console.log('\n  Add these to .env:\n');
  console.log(`FACEBOOK_PAGE_ID=${page.id}`);
  console.log(`FACEBOOK_PAGE_ACCESS_TOKEN=${page.access_token}`);
  if (igId) {
    // The same Page token reads the linked Instagram account.
    console.log(`INSTAGRAM_BUSINESS_ID=${igId}`);
    console.log(`INSTAGRAM_ACCESS_TOKEN=${page.access_token}`);
  } else {
    console.log('\n  Instagram is NOT linked to this Page. Link it, then re-run:');
    console.log('  Instagram app -> Edit profile -> Public business information -> Page');
  }

  console.log('\n  Then confirm with:  npm run check:tokens\n');
}

// ── local callback server ─────────────────────────────────────────────────
const state = crypto.randomBytes(16).toString('hex');

const authUrl =
  `https://www.facebook.com/v21.0/dialog/oauth?client_id=${APP_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&scope=${encodeURIComponent(SCOPES)}&response_type=code&state=${state}`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (!url.pathname.startsWith('/callback')) {
    res.writeHead(404).end();
    return;
  }

  const err = url.searchParams.get('error_description') || url.searchParams.get('error');
  if (err) {
    res.writeHead(200, { 'Content-Type': 'text/html' }).end(`<h2>Cancelled</h2><p>${err}</p>`);
    console.error(`\n  Authorization cancelled: ${err}\n`);
    server.close();
    process.exit(1);
  }

  // Guards against a stray request completing the flow with someone else's code.
  if (url.searchParams.get('state') !== state) {
    res.writeHead(400).end('state mismatch');
    return;
  }

  res
    .writeHead(200, { 'Content-Type': 'text/html' })
    .end('<h2>Done.</h2><p>Return to your terminal — the token is printed there.</p>');

  try {
    report(await exchange(url.searchParams.get('code')));
    process.exit(0);
  } catch (e) {
    console.error(`\n  FAILED: ${e.message}\n`);
    process.exit(1);
  } finally {
    server.close();
  }
});

server.listen(PORT, () => {
  console.log(`
  ${'='.repeat(66)}
  ONE-TIME SETUP — register this redirect URI in your Meta app:

    ${REDIRECT_URI}

  Meta dashboard -> Facebook Login for Business -> Settings
  -> "Valid OAuth Redirect URIs" -> paste the line above -> Save changes
  ${'='.repeat(66)}

  Then open this URL in the browser where you are logged into Facebook,
  and click Continue / Approve (tick your Page when asked):

${authUrl}

  Waiting for the callback on port ${PORT}...
`);
});
