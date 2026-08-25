/**
 * Captures the current live corpus into a committed seed file.
 *
 * Why this exists: a hackathon demo must not depend on venue wi-fi, a live API,
 * or a daily quota. YouTube's Data API allows 10,000 units/day and `search.list`
 * costs 100 of them, so a morning of rehearsals can exhaust the quota before
 * judging even starts. Freezing a real, already-ML-scored corpus means the demo
 * shows genuine data with zero network dependency.
 *
 * This is NOT synthetic data. Every post here was really ingested from YouTube
 * and Telegram and scored by the transformer service; the file is a snapshot,
 * not a fabrication, and the UI labels it as a snapshot with its capture date.
 *
 * Usage:
 *   node scripts/freeze-corpus.mjs [http://localhost:3000]
 */

import fs from 'fs';
import path from 'path';

const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const OUT = path.join(process.cwd(), 'src', 'lib', 'frozenCorpus.json');

async function main() {
  console.log(`Reading corpus from ${BASE} ...`);

  const res = await fetch(`${BASE}/api/posts?limit=500`);
  if (!res.ok) {
    console.error(`Failed: HTTP ${res.status}. Is the dev server running?`);
    process.exit(1);
  }

  const data = await res.json();
  const posts = data.posts || [];

  if (posts.length === 0) {
    console.error('Corpus is empty. Ingest some data first.');
    process.exit(1);
  }

  const mlScored = posts.filter((p) => p?.sentiment?.engine === 'ml').length;
  if (mlScored === 0) {
    console.warn(
      'WARNING: nothing in this corpus was scored by the ML service. Start it and ' +
        're-ingest, or the frozen demo will ship lexicon-quality sentiment.'
    );
  }

  const platforms = {};
  for (const p of posts) platforms[p.platform] = (platforms[p.platform] || 0) + 1;

  const timestamps = posts
    .map((p) => new Date(p.timestamp).getTime())
    .filter((t) => !Number.isNaN(t));

  const payload = {
    capturedAt: new Date().toISOString(),
    postCount: posts.length,
    mlScoredCount: mlScored,
    platforms,
    window: {
      from: new Date(Math.min(...timestamps)).toISOString(),
      to: new Date(Math.max(...timestamps)).toISOString(),
    },
    // Ownership tags are stripped: the frozen corpus is the shared demo dataset,
    // not any tenant's private data.
    posts: posts.map(({ ownerUserId, _id, ...rest }) => rest),
  };

  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), 'utf8');

  const sizeKb = Math.round(fs.statSync(OUT).size / 1024);
  console.log(`\nFrozen ${posts.length} posts -> ${path.relative(process.cwd(), OUT)} (${sizeKb} KB)`);
  console.log(`  ML-scored : ${mlScored}/${posts.length}`);
  console.log(`  platforms : ${JSON.stringify(platforms)}`);
  console.log(`  window    : ${payload.window.from} .. ${payload.window.to}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
