import { SocialPost } from '@/types/intelligence';
import { generateFullIntelligenceDataset } from '@/lib/demoData';
import frozenCorpus from '@/lib/frozenCorpus.json';
import type { Db } from 'mongodb';
import { getDatabase } from '@/lib/mongodb';
import { enrichPosts } from '@/lib/ml/client';

/**
 * Unified post store: MongoDB when reachable, in-memory otherwise.
 *
 * The cache lives on `globalThis`, not in a module-level `let`. Next.js gives
 * each compiled route its own module instance in dev (and re-evaluates modules
 * across HMR), so a module-scoped array is NOT shared between
 * /api/ingest and /api/posts -- writes through one route were invisible to the
 * other, and each route accumulated its own divergent copy of the data.
 */
declare global {
  // eslint-disable-next-line no-var
  var _postsCache: SocialPost[] | undefined;
  // eslint-disable-next-line no-var
  var _baselineEnriched: boolean | undefined;
}

/**
 * The demo baseline.
 *
 * Prefers `frozenCorpus.json` — a real, already-ML-scored snapshot captured
 * from YouTube and Telegram by `scripts/freeze-corpus.mjs`. Using it means the
 * demo shows genuine data with ZERO network dependency: no venue wi-fi, no live
 * API, no daily quota. (YouTube allows 10,000 quota units/day and search.list
 * costs 100, so a morning of rehearsals can exhaust it before judging starts.)
 *
 * Falls back to the synthetic generator only when no snapshot is present.
 */
function baseline(): SocialPost[] {
  const frozen = (frozenCorpus as { posts?: SocialPost[] })?.posts;
  if (Array.isArray(frozen) && frozen.length > 0) {
    return frozen as SocialPost[];
  }
  return generateFullIntelligenceDataset();
}

/** Provenance of the demo baseline, surfaced so the UI can label it honestly. */
export function baselineInfo(): {
  source: 'frozen-snapshot' | 'synthetic';
  capturedAt?: string;
  postCount: number;
  platforms?: Record<string, number>;
} {
  const f = frozenCorpus as any;
  if (Array.isArray(f?.posts) && f.posts.length > 0) {
    return {
      source: 'frozen-snapshot',
      capturedAt: f.capturedAt,
      postCount: f.postCount ?? f.posts.length,
      platforms: f.platforms,
    };
  }
  return { source: 'synthetic', postCount: generateFullIntelligenceDataset().length };
}

function cache(): SocialPost[] {
  if (!global._postsCache) {
    global._postsCache = baseline();
  }
  return global._postsCache;
}

/**
 * Re-scores the synthetic baseline through the transformer service, once.
 *
 * The demo dataset is generated synchronously at module load, so it can only
 * be scored by the lexicon engine at that point. The lexicon over-predicts
 * "opposing", which pushed the baseline dashboard to 75% opposing and a
 * CRITICAL threat level before any real data was ingested -- a bad first
 * impression that is an artefact of the fallback engine, not of the content.
 *
 * Runs at most once per process and silently keeps the lexicon scores if the
 * ML service is unreachable.
 */
async function enrichBaselineOnce(): Promise<void> {
  if (global._baselineEnriched) return;
  global._baselineEnriched = true;

  // A frozen snapshot was already scored at capture time. Re-scoring it would
  // add a startup stall and make the demo depend on the ML service being up.
  if (baselineInfo().source === 'frozen-snapshot') return;

  try {
    const current = cache();
    const enriched = await enrichPosts(current);
    if (enriched.some((p) => p.sentiment.engine === 'ml')) {
      global._postsCache = enriched;
    }
  } catch (e) {
    console.warn('Baseline ML enrichment skipped:', e);
  }
}

/** Newest-last, deduplicated by id. */
function normalise(posts: SocialPost[]): SocialPost[] {
  const byId = new Map<string, SocialPost>();
  for (const p of posts) byId.set(p.id, p);
  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

/**
 * Ensures the indexes the store depends on exist.
 *
 * The unique index on `id` is what actually prevents duplicate posts: without
 * it, re-ingesting the same Telegram channel inserted a fresh copy of every
 * message on each run (40 posts had become 100 rows before this was added).
 * Runs at most once per process.
 */
let indexesEnsured = false;
async function ensureIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  indexesEnsured = true;
  try {
    await db.collection('posts').createIndex({ id: 1 }, { unique: true, name: 'uniq_post_id' });
    await db.collection('posts').createIndex({ timestamp: 1 }, { name: 'timestamp_asc' });
    // Every tenant read filters on ownerUserId; without this it is a full scan.
    await db
      .collection('posts')
      .createIndex({ ownerUserId: 1, timestamp: 1 }, { name: 'owner_timestamp' });
  } catch (e) {
    // A pre-existing collection with duplicates will reject the unique index.
    // Log rather than throw: reads still work, and dedup is a maintenance task.
    console.warn('Could not ensure post indexes (duplicates may exist):', e);
    indexesEnsured = false;
  }
}

export async function getAllPosts(): Promise<SocialPost[]> {
  const db = await getDatabase();
  if (db) {
    try {
      await ensureIndexes(db);
      const posts = await db
        .collection<SocialPost>('posts')
        .find({})
        .sort({ timestamp: 1 })
        .toArray();
      if (posts.length > 0) return posts;
    } catch (e) {
      console.warn('Could not read from MongoDB; using memory cache:', e);
    }
  }
  await enrichBaselineOnce();
  return cache();
}

export async function addPosts(newPosts: SocialPost[]): Promise<void> {
  const existing = cache();
  const existingIds = new Set(existing.map((p) => p.id));
  const uniqueNew = newPosts.filter((p) => !existingIds.has(p.id));

  if (uniqueNew.length > 0) {
    global._postsCache = normalise([...existing, ...uniqueNew]);
  }

  const db = await getDatabase();
  if (db && uniqueNew.length > 0) {
    try {
      await ensureIndexes(db);
      // Upsert rather than insertMany: re-ingesting a channel re-sees the same
      // message ids, and a plain insert throws a duplicate-key error that
      // aborts the whole batch.
      await db.collection('posts').bulkWrite(
        uniqueNew.map((post) => ({
          updateOne: {
            filter: { id: post.id },
            update: { $set: post },
            upsert: true,
          },
        })),
        { ordered: false }
      );
    } catch (e) {
      console.warn('Failed to persist to MongoDB:', e);
    }
  }
}

/**
 * Restores the baseline demo dataset.
 *
 * This clears the persisted collection as well as the memory cache. Resetting
 * only the cache left every ingested post in MongoDB, and since getAllPosts()
 * prefers a non-empty database, "reset" appeared to do nothing at all.
 */
export async function resetDataset(): Promise<SocialPost[]> {
  global._postsCache = baseline();
  global._baselineEnriched = false; // re-score the fresh baseline

  const db = await getDatabase();
  if (db) {
    try {
      await db.collection('posts').deleteMany({});
    } catch (e) {
      console.warn('Could not clear persisted posts:', e);
    }
  }

  return global._postsCache;
}

/**
 * Returns ONLY the posts belonging to one tenant.
 *
 * The userId filter is applied in the database query, not after the fact, so
 * a large corpus never crosses the tenant boundary even in memory. The
 * in-memory fallback applies the same filter.
 */
export async function getPostsForUser(userId: string): Promise<SocialPost[]> {
  if (!userId) return [];

  const db = await getDatabase();
  if (db) {
    try {
      await ensureIndexes(db);
      return await db
        .collection<SocialPost>('posts')
        .find({ ownerUserId: userId })
        .sort({ timestamp: 1 })
        .toArray();
    } catch (e) {
      console.warn('Could not read tenant posts from MongoDB:', e);
    }
  }

  return cache().filter((p) => p.ownerUserId === userId);
}
